'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  listPatients,
  searchPatients,
  subscribePatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import { Search, ChevronDown, User, X, Check, IdCard } from 'lucide-react';

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
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  id?: string;
}

export const formatPatientName = (p: FacilityPatient): string => {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
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
  style,
  inputStyle,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allPatients, setAllPatients] = useState<FacilityPatient[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
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
      } else {
        setQuery('');
      }
    }
  }, [activePatient, isOpen]);

  // Filtered patients based on user typing
  const filteredPatients = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      return allPatients.slice(0, 50);
    }
    // Filter by name, hospitalNumber, phone, etc.
    return allPatients.filter((p) => {
      const name = `${p.firstName} ${p.middleName || ''} ${p.lastName}`.toLowerCase();
      const hn = (p.hospitalNumber || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const nhia = (p.nhiaNumber || '').toLowerCase();
      const nin = (p.nin || '').toLowerCase();
      return (
        name.includes(q) ||
        hn.includes(q) ||
        phone.includes(q) ||
        nhia.includes(q) ||
        nin.includes(q)
      );
    }).slice(0, 50);
  }, [allPatients, query, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (patient: FacilityPatient) => {
    onChange(patient);
    setQuery(`${formatPatientName(patient)} · ${patient.hospitalNumber}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
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
            if (activePatient) {
              setQuery(''); // Clear text when user wants to search a different patient
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '10px 38px 10px 36px',
            borderRadius: 10,
            border: isOpen ? '1.5px solid #0052D4' : '1px solid #CBD5E1',
            background: disabled ? '#F1F5F9' : '#FFFFFF',
            fontSize: 13,
            fontWeight: activePatient ? 600 : 400,
            color: activePatient ? '#0F172A' : '#334155',
            outline: 'none',
            boxShadow: isOpen ? '0 0 0 3px rgba(0, 82, 212, 0.12)' : 'none',
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

      {/* Dropdown Results Box */}
      {isOpen && !disabled && (
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
                No patient found matching &quot;{query}&quot;
              </div>
              <div style={{ fontSize: 11 }}>
                Check name spelling, hospital number, or register at reception.
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
    </div>
  );
};

export default SearchablePatientSelect;
