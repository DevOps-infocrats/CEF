import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, ChevronDown, Loader2 } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface LocationMultiSelectProps {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  maxTagsDisplay?: number;
}

export const LocationMultiSelect: React.FC<LocationMultiSelectProps> = ({
  label,
  placeholder = 'Select items...',
  options,
  selectedIds,
  onChange,
  isLoading = false,
  disabled = false,
  error,
  helperText,
  maxTagsDisplay = 4,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Selected option objects
  const selectedOptions = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return selectedIds
      .map((id) => map.get(id))
      .filter((opt): opt is MultiSelectOption => Boolean(opt));
  }, [options, selectedIds]);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredOptions.map((o) => o.id);
    const newSet = new Set([...selectedIds, ...allFilteredIds]);
    onChange(Array.from(newSet));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const visibleSelected = selectedOptions.slice(0, maxTagsDisplay);
  const overflowCount = selectedOptions.length - maxTagsDisplay;
  const displayedOptions = filteredOptions.slice(0, 60);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {/* Label and Selected Counter */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">
          {label}
        </label>
        {selectedIds.length > 0 && (
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Main Trigger Box */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
          disabled
            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
            : error
            ? 'bg-red-50/20 border-red-300 ring-1 ring-red-400/20'
            : isOpen
            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-white hover:bg-slate-50/70 border-slate-200 shadow-2xs'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-xs text-slate-400 select-none">
              {disabled ? 'Please make a parent selection first' : placeholder}
            </span>
          ) : (
            <>
              {visibleSelected.map((opt) => (
                <span
                  key={opt.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-800 animate-in fade-in zoom-in-95 duration-100"
                >
                  <span>{opt.name}</span>
                  {opt.subtitle && (
                    <span className="text-[10px] text-indigo-600 font-normal">
                      ({opt.subtitle})
                    </span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => removeOption(opt.id, e)}
                      className="hover:bg-indigo-200/60 rounded p-0.5 text-indigo-700 transition-colors ml-0.5"
                      title={`Remove ${opt.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  +{overflowCount} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <>
              {selectedIds.length > 0 && !disabled && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-slate-600 p-1 text-slate-400 text-[11px] font-semibold"
                  title="Clear all"
                >
                  Clear
                </button>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </>
          )}
        </div>
      </div>

      {/* Helper text or Error */}
      {error ? (
        <p className="text-[11px] font-medium text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Search Box */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions (Select All / Deselect) */}
            {filteredOptions.length > 1 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50/30 text-[11px] text-slate-500">
                <span>{filteredOptions.length} options</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-700 hover:text-indigo-800 font-semibold"
                >
                  Select All Filtered
                </button>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {searchQuery ? `No matching items for "${searchQuery}"` : 'No options available'}
                </div>
              ) : (
                <>
                  {displayedOptions.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => toggleOption(opt.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{opt.name}</span>
                          {opt.subtitle && (
                            <span className="text-[10px] text-slate-400 font-normal shrink-0">
                              ({opt.subtitle})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredOptions.length > 60 && (
                    <div className="py-2 text-center text-[11px] text-slate-400 font-medium">
                      Showing 60 of {filteredOptions.length} — type in search to refine
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
