'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  listPatients,
  hydratePatientsFromPostgres,
  subscribePatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  verifyPatientExists,
  formatFullPatientName,
  type PatientVerificationResult,
} from '../../lib/patientVerification';
import { Search, ChevronDown, User, X, Check, IdCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { scoreSearchCandidate } from '../../lib/universalSearchEngine';

export interface SearchablePatientSelectProps {
  facilityId: string;
  value?: string | null; // patient id
  selectedPatient?: FacilityPatient | null;
  onChange: (patient: FacilityPatient | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  showVerificationBadge?: boolean;
  dark?: boolean;
  onVerificationChange?: (result: PatientVerificationResult) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  id?: string;
}

export const formatPatientName = (p: FacilityPatient): string => {
  return formatFullPatientName(p);
};

export const SearchablePatientSelect: React.FC<SearchablePatientSelectProps> = ({
  facilityId,
  value,
  selectedPatient: propSelectedPatient,
  onChange,
  placeholder = 'Type to search patient by name or hospital no…',
  disabled = false,
  required = false,
  autoFocus = false,
  showVerificationBadge = true,
  dark = false,
  onVerificationChange,
  style,
  inputStyle,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allPatients, setAllPatients] = useState<FacilityPatient[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [checkingRegistry, setCheckingRegistry] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync patients from store
  useEffect(() => {
    const refresh = () => setAllPatients(listPatients(facilityId));
    refresh();
    return subscribePatients(refresh);
  }, [facilityId]);

  // Selected patient object
  const activePatient = useMemo(() => {
    if (propSelectedPatient) return propSelectedPatient;
    if (value) return allPatients.find((p) => p.id === value) || null;
    return null;
  }, [propSelectedPatient, value, allPatients]);

  // Synchronize text query with selected patient when closed
  useEffect(() => {
    if (!isOpen) {
      if (activePatient) {
        setQuery(`${formatPatientName(activePatient)} · ${activePatient.hospitalNumber}`);
        setVerificationError(null);
      } else if (!query.trim()) {
        setQuery('');
      }
    }
  }, [activePatient, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered patients based on user typing with fuzzy & multi-token scoring
  // Privacy & UX rule: do NOT list patients when the search field is empty
  const filteredPatients = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return allPatients
      .map((p) => {
        const name = `${p.firstName} ${p.middleName || ''} ${p.lastName}`.trim();
        const hn = p.hospitalNumber || '';
        const extra = `${p.phone || ''} ${p.nhiaNumber || ''} ${p.nin || ''} ${p.bloodGroup || ''} ${(p.allergies || []).join(' ')} ${(p.chronicConditions || []).join(' ')}`;
        const score = scoreSearchCandidate(q, name, hn, extra, p.category);
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.p);
  }, [allPatients, query, isOpen]);

  // Debounced server registry lookup when typed query has no local hits
  useEffect(() => {
    const q = query.trim();
    if (!isOpen || activePatient || q.length < 2 || filteredPatients.length > 0) {
      setCheckingRegistry(false);
      return;
    }
    let cancelled = false;
    setCheckingRegistry(true);
    const timer = window.setTimeout(() => {
      void hydratePatientsFromPostgres(facilityId, q)
        .catch(() => 0)
        .finally(() => {
          if (!cancelled) {
            setAllPatients(listPatients(facilityId));
            setCheckingRegistry(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [facilityId, query, isOpen, activePatient, filteredPatients.length]);

  const tryVerifyTypedQuery = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setVerificationError(null);
      onVerificationChange?.({ valid: false, status: 'empty' });
      return;
    }
    const res = verifyPatientExists(facilityId, { query: trimmed });
    onVerificationChange?.(res);
    if (res.valid && res.patient) {
      setVerificationError(null);
      onChange(res.patient);
      setQuery(`${formatPatientName(res.patient)} · ${res.patient.hospitalNumber}`);
      setIsOpen(false);
    } else {
      setVerificationError(
        res.error || `Patient / Hospital No. "${trimmed}" does not exist in the facility registry.`
      );
    }
  };

  // Close dropdown when clicking outside and verify unpicked text
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (!activePatient && query.trim()) {
          tryVerifyTypedQuery(query);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  const handleSelect = (patient: FacilityPatient) => {
    setVerificationError(null);
    onVerificationChange?.({
      valid: true,
      status: 'verified',
      patient,
      matchedBy: 'hospitalNumber',
    });
    onChange(patient);
    setQuery(`${formatPatientName(patient)} · ${patient.hospitalNumber}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setVerificationError(null);
    onVerificationChange?.({ valid: false, status: 'empty' });
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      } else if (e.key === 'Enter' && !activePatient && query.trim()) {
        e.preventDefault();
        tryVerifyTypedQuery(query);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1 < filteredPatients.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredPatients.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPatients[highlightIndex]) {
        handleSelect(filteredPatients[highlightIndex]);
      } else if (query.trim()) {
        tryVerifyTypedQuery(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {/* Search Input Box mimicking sleek select */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          width: '100%',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          style={{
            position: 'absolute',
            left: 12,
            display: 'flex',
            alignItems: 'center',
            color: activePatient ? '#0284C7' : '#94A3B8',
            pointerEvents: 'none',
          }}
        >
          {activePatient ? <IdCard size={15} /> : <Search size={15} />}
        </div>

        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          required={required && !activePatient}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setVerificationError(null);
            if (activePatient) {
              setQuery(''); // Clear text when user wants to search a different patient
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setVerificationError(null);
            if (activePatient) {
              onChange(null);
            }
            if (!isOpen) setIsOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '10px 38px 10px 36px',
            borderRadius: 10,
            border: verificationError
              ? '1.5px solid #DC2626'
              : activePatient
                ? '1.5px solid #16A34A'
                : isOpen
                  ? '1.5px solid #0066FF'
                  : isHovered
                    ? '1.5px solid #94A3B8'
                    : dark
                      ? '1px solid #334155'
                      : '1px solid #CBD5E1',
            background: disabled
              ? '#F1F5F9'
              : dark
                ? '#0F172A'
                : '#FFFFFF',
            fontSize: 13,
            fontWeight: activePatient ? 600 : 400,
            color: dark ? '#F8FAFC' : activePatient ? '#0F172A' : '#334155',
            outline: 'none',
            boxShadow: isOpen ? '0 0 0 3.5px rgba(0, 102, 255, 0.16), 0 2px 8px rgba(0, 102, 255, 0.08)' : isHovered ? '0 2px 5px rgba(0, 0, 0, 0.04)' : 'none',
            caretColor: '#0066FF',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'text',
            ...inputStyle,
          }}
        />

        {/* Action icons right */}
        <div
          style={{
            position: 'absolute',
            right: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {activePatient && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: '#E2E8F0',
                border: 'none',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                if (!isOpen && inputRef.current) inputRef.current.focus();
              }
            }}
            tabIndex={-1}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown
              size={15}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Results Box — only shown once the user types into the search field */}
      {isOpen && !disabled && query.trim().length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 290,
            overflowY: 'auto',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: 12,
            boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
            zIndex: 9999,
            padding: '6px 0',
          }}
        >
          {/* Header count indicator */}
          <div
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              {filteredPatients.length === 0
                ? 'No matching patient'
                : filteredPatients.length === 1
                  ? '1 matching patient'
                  : `Showing ${filteredPatients.length} patients`}
            </span>
            {query.trim() && (
              <span style={{ fontSize: 10, color: '#0052D4', fontWeight: 600 }}>
                Filtering: &quot;{query.trim()}&quot;
              </span>
            )}
          </div>

          {filteredPatients.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: '#64748B',
                fontSize: 13,
              }}
            >
              <User size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                {checkingRegistry
                  ? `Checking hospital registry for "${query}"…`
                  : `No patient found matching "${query}"`}
              </div>
              <div style={{ fontSize: 11 }}>
                {checkingRegistry
                  ? 'Searching facility records…'
                  : 'Hospital number or name does not exist in this facility registry. Register at Reception first.'}
              </div>
            </div>
          ) : (
            filteredPatients.map((p, idx) => {
              const isSelected = activePatient?.id === p.id;
              const isHighlighted = idx === highlightIndex;
              const pName = formatPatientName(p);

              return (
                <div
                  key={p.id}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => handleSelect(p)}
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isHighlighted
                      ? '#F0F7FF'
                      : isSelected
                        ? '#F8FAFC'
                        : 'transparent',
                    borderLeft: isHighlighted ? '3px solid #0052D4' : '3px solid transparent',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 800 : 700,
                          color: isSelected ? '#0052D4' : '#0F172A',
                        }}
                      >
                        {pName}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#E2E8F0',
                          color: '#334155',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {p.hospitalNumber}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: '#64748B', display: 'flex', gap: 10 }}>
                      {p.sex && <span>{p.sex}</span>}
                      {p.dob && (
                        <span>
                          {Math.max(0, new Date().getFullYear() - new Date(p.dob).getFullYear())} yrs
                        </span>
                      )}
                      {p.phone && <span>Tel: {p.phone}</span>}
                      {(p.insuranceProvider || p.category) && (
                        <span style={{ color: '#0284C7', fontWeight: 600 }}>
                          {p.insuranceProvider || p.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        color: '#0052D4',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Check size={16} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showVerificationBadge && activePatient && (
        <div
          style={{
            marginTop: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: dark ? '#34D399' : '#047857',
          }}
        >
          <CheckCircle2 size={13} />
          <span>
            Verified · {formatPatientName(activePatient)} · {activePatient.hospitalNumber}
          </span>
        </div>
      )}

      {!activePatient && verificationError && (
        <div
          role="alert"
          style={{
            marginTop: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: dark ? '#FCA5A5' : '#DC2626',
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{verificationError}</span>
        </div>
      )}
    </div>
  );
};

export default SearchablePatientSelect;
