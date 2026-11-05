'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Search, X, ChevronRight, Sparkles } from 'lucide-react';

export interface SearchSuggestion {
  id: string;
  label: string;
  sub?: string;
  category?: string;
  badge?: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

export interface InteractiveSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  resultsCount?: number;
  totalCount?: number;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  themeColor?: string;
  kbdShortcut?: string;
  isLoading?: boolean;
  aiAssisted?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectSuggestion?: (item: SearchSuggestion) => void;
  'aria-label'?: string;
}

/**
 * Modern Interactive Search Bar
 * - Real-Time Autocomplete / Suggestions Dropdown
 * - Dynamic Visual State Transitions (Default, Hover, Focused Glowing Ring, Pressed)
 * - Instant Filtering & Preview Counts
 * - Quick Reset (Clear Icon with instant state restoration)
 */
export const InteractiveSearchBar: React.FC<InteractiveSearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search anything...',
  suggestions = [],
  resultsCount,
  totalCount,
  autoFocus = false,
  className = '',
  style,
  inputStyle,
  size = 'md',
  themeColor = '#0066FF',
  kbdShortcut,
  isLoading = false,
  aiAssisted = false,
  onKeyDown,
  onSelectSuggestion,
  'aria-label': ariaLabel = 'Search',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Filter suggestions based on query if not already pre-filtered
  const filteredSuggestions = useMemoSuggestions(suggestions, value);
  const showDropdown = isFocused && filteredSuggestions.length > 0;

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset active keyboard index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  const handleClear = useCallback(() => {
    onChange('');
    onClear?.();
    setActiveIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onChange, onClear]);

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        e.preventDefault();
        const selected = filteredSuggestions[activeIndex];
        if (selected.onClick) {
          selected.onClick();
        } else if (onSelectSuggestion) {
          onSelectSuggestion(selected);
        } else {
          onChange(selected.label);
        }
        setIsFocused(false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (value) {
          handleClear();
        } else {
          setIsFocused(false);
        }
        return;
      }
    } else if (e.key === 'Escape' && value) {
      e.preventDefault();
      handleClear();
      return;
    }

    onKeyDown?.(e);
  };

  // Dimensions by size
  const sizeStyles = {
    sm: { padding: '6px 10px', height: 32, fontSize: '0.8rem', iconSize: 13 },
    md: { padding: '8px 12px', height: 40, fontSize: '0.875rem', iconSize: 15 },
    lg: { padding: '12px 16px', height: 48, fontSize: '0.975rem', iconSize: 18 },
  }[size];

  return (
    <div
      ref={containerRef}
      className={`interactive-search-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 200,
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Main Interactive Input Box ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          boxSizing: 'border-box',
          padding: sizeStyles.padding,
          minHeight: sizeStyles.height,
          background: isFocused ? '#FFFFFF' : isHovered ? '#F8FAFC' : '#F1F5F9',
          border: `1.5px solid ${isFocused ? themeColor : isHovered ? '#CBD5E1' : '#E2E8F0'}`,
          boxShadow: isFocused ? `0 0 0 3.5px ${themeColor}28, 0 2px 6px ${themeColor}14` : isHovered ? '0 2px 5px rgba(0, 0, 0, 0.04)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
          borderRadius: 10,

          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search Icon with Active State Shift */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFocused ? themeColor : isHovered ? '#475569' : '#94A3B8',
            transition: 'color 0.18s ease, transform 0.18s ease',
            transform: isFocused ? 'scale(1.05)' : 'scale(1)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {aiAssisted ? (
            <Sparkles size={sizeStyles.iconSize} color={isFocused ? '#0066FF' : '#F59E0B'} />
          ) : (
            <Search size={sizeStyles.iconSize} />
          )}
        </div>

        {/* Dynamic Digital Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDownInternal}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: sizeStyles.fontSize,
            fontWeight: 500,
            color: '#0F172A',
            letterSpacing: '-0.01em',
            width: '100%',
            minWidth: 0,
            padding: 0,
            caretColor: '#0066FF',
            ...inputStyle,
          }}
        />

        {/* Live Filter / Results Badge (when searching) */}
        {value.trim() && resultsCount !== undefined && (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 6,
              background: resultsCount > 0 ? '#E0F2FE' : '#FEE2E2',
              color: resultsCount > 0 ? '#0369A1' : '#B91C1C',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {resultsCount} {totalCount !== undefined ? `of ${totalCount}` : resultsCount === 1 ? 'match' : 'matches'}
          </span>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div
            style={{
              width: 14,
              height: 14,
              border: '2px solid #CBD5E1',
              borderTopColor: '#0066FF',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              flexShrink: 0,
            }}
          />
        )}

        {/* Quick Reset Clear Button */}
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear search (Esc)"
            aria-label="Clear search"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: 6,
              border: 'none',
              background: '#E2E8F0',
              color: '#475569',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#CBD5E1';
              e.currentTarget.style.color = '#0F172A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#E2E8F0';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}

        {/* Keyboard shortcut hint if provided (e.g. ⌘K) and input is empty */}
        {kbdShortcut && !value && (
          <kbd
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 5,
              background: isFocused ? '#EEF2FF' : '#E2E8F0',
              color: isFocused ? '#4F46E5' : '#64748B',
              border: '1px solid #CBD5E1',
              flexShrink: 0,
              fontFamily: 'monospace',
            }}
          >
            {kbdShortcut}
          </kbd>
        )}
      </div>

      {/* ── Real-Time Autocomplete / Suggestions Dropdown ── */}
      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
            maxHeight: 320,
            overflowY: 'auto',
            padding: 6,
            animation: 'slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {filteredSuggestions.map((item, index) => {
            const Icon = item.icon || Search;
            const isSelected = index === activeIndex;

            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else if (onSelectSuggestion) {
                    onSelectSuggestion(item);
                  } else {
                    onChange(item.label);
                  }
                  setIsFocused(false);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? '#EFF6FF' : 'transparent',
                  color: isSelected ? '#0066FF' : '#1E293B',
                  transition: 'background 0.12s ease',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: isSelected ? '#DBEAFE' : '#F1F5F9',
                      color: isSelected ? '#0066FF' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {highlightMatch(item.label, value)}
                    </span>
                    {item.sub && (
                      <span style={{ fontSize: '0.72rem', color: isSelected ? '#60A5FA' : '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.sub}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {item.category && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isSelected ? '#DBEAFE' : '#F8FAFC',
                        color: isSelected ? '#1D4ED8' : '#94A3B8',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.category}
                    </span>
                  )}
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#FEF3C7',
                        color: '#B45309',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={13} style={{ color: isSelected ? '#0066FF' : '#CBD5E1' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Helper to filter suggestions
function useMemoSuggestions(suggestions: SearchSuggestion[], query: string): SearchSuggestion[] {
  return React.useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const q = query.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions
      .filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.sub && s.sub.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [suggestions, query]);
}

// Helper to highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: 'rgba(0, 102, 255, 0.15)',
              color: '#0052D4',
              fontWeight: 800,
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

