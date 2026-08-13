import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../config/api';

/**
 * MedicineInput Component
 * Shows medicine name input with real-time suggestions dropdown
 * Includes dosage selection and use cases display
 */
export default function MedicineInput({
  medicine,
  onUpdate,
  onRemove,
  index,
  t,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Dosage options (fixed list per requirements)
  const dosageOptions = [
    { value: '1-0-1', label: '1-0-1 (Morning, Evening)' },
    { value: '1-1-1', label: '1-1-1 (Morning, Afternoon, Evening)' },
    { value: '0-1-0', label: '0-1-0 (Afternoon only)' },
    { value: 'SOS', label: 'SOS (As needed)' },
    { value: 'night', label: 'Night only' },
  ];

  /**
   * Fetch medicine suggestions
   */
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.doctors.medicineSuggestions(query);
      setSuggestions(Array.isArray(data) ? data : []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Fetch suggestions error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle medicine name change
   */
  const handleNameChange = useCallback(
    (value) => {
      onUpdate(index, 'name', value);
      if (value.length > 0) {
        fetchSuggestions(value);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [index, onUpdate, fetchSuggestions]
  );

  /**
   * Handle suggestion click
   */
  const handleSelectSuggestion = useCallback(
    (suggestion) => {
      onUpdate(index, 'name', suggestion.generic);
      setShowSuggestions(false);
      setSuggestions([]);
    },
    [index, onUpdate]
  );

  /**
   * Handle dosage change
   */
  const handleDosageChange = useCallback(
    (dosageValue) => {
      // Convert dosage format to medicine object
      // e.g., '1-0-1' → { morning: true, afternoon: false, evening: true, night: false }
      const times = dosageValue.split('-').map(v => v === '1');

      if (dosageValue === 'SOS') {
        onUpdate(index, 'dosage', 'SOS');
        onUpdate(index, 'morning', false);
        onUpdate(index, 'afternoon', false);
        onUpdate(index, 'evening', false);
        onUpdate(index, 'night', false);
      } else if (dosageValue === 'night') {
        onUpdate(index, 'dosage', 'night');
        onUpdate(index, 'morning', false);
        onUpdate(index, 'afternoon', false);
        onUpdate(index, 'evening', false);
        onUpdate(index, 'night', true);
      } else {
        // Numeric format like '1-0-1'
        onUpdate(index, 'dosage', dosageValue);
        onUpdate(index, 'morning', times[0] ?? false);
        onUpdate(index, 'afternoon', times[1] ?? false);
        onUpdate(index, 'evening', times[2] ?? false);
        onUpdate(index, 'night', times[3] ?? false);
      }
    },
    [index, onUpdate]
  );

  /**
   * Get current dosage value
   */
  const getCurrentDosage = () => {
    if (medicine.dosage) return medicine.dosage;

    // Derive from time flags
    const pattern = [
      medicine.morning ? '1' : '0',
      medicine.afternoon ? '1' : '0',
      medicine.evening ? '1' : '0',
    ].join('-');

    if (medicine.night && !medicine.morning && !medicine.afternoon && !medicine.evening) {
      return 'night';
    }

    return pattern === '0-0-0' ? '' : pattern;
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
      {/* Medicine Name Input with Suggestions */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Medicine Name
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            placeholder="Search and select medicine name"
            value={medicine.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => {
              if (medicine.name.length > 0) fetchSuggestions(medicine.name);
            }}
            autoComplete="off"
          />
          <div className="text-xs text-slate-500 mt-1">Type to search and select</div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-40 max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-slate-800 text-sm">
                    {suggestion.generic}
                  </div>
                  {suggestion.brands && suggestion.brands.length > 0 && (
                    <div className="text-xs text-slate-500 truncate">
                      Brands: {suggestion.brands.join(', ')}
                    </div>
                  )}
                  {suggestion.uses && suggestion.uses.length > 0 && (
                    <div className="text-xs text-slate-600 mt-1">
                      Uses: {suggestion.uses.join(', ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="absolute right-3 top-2 text-xs text-slate-500">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Dosage Selection Dropdown */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Dosage
        </label>
        <select
          value={getCurrentDosage()}
          onChange={(e) => handleDosageChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">Select dosage</option>
          {dosageOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Per-medicine Duration Input */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Duration (in Days)
        </label>
        <input
          type="number"
          min="1"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="e.g. 7"
          value={medicine.durationInDays || ''}
          onChange={e => onUpdate(index, 'durationInDays', e.target.value.replace(/[^\d]/g, ''))}
        />
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-xs text-red-600 hover:underline"
      >
        {t('remove') || 'Remove'}
      </button>
    </div>
  );
}
