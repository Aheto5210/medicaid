import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function normalizeOption(option) {
  if (option && typeof option === 'object' && 'value' in option) {
    return {
      label: String(option.label ?? option.value ?? ''),
      value: option.value
    };
  }

  return {
    label: String(option ?? ''),
    value: option
  };
}

function matchesOption(optionValue, selectedValue) {
  return String(optionValue ?? '') === String(selectedValue ?? '');
}

export default function CustomDropdown({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option',
  allowCustom = false,
  emptyMessage = 'No options found.',
  disabled = false
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const normalizedOptions = useMemo(
    () => options.map(normalizeOption),
    [options]
  );
  const selectedOption = normalizedOptions.find((option) => matchesOption(option.value, value)) || null;
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [query, setQuery] = useState(() => (
    allowCustom
      ? String(value ?? '')
      : selectedOption?.label || ''
  ));

  useEffect(() => {
    if (!open) {
      setQuery(allowCustom ? String(value ?? '') : selectedOption?.label || '');
    }
  }, [allowCustom, open, selectedOption, value]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        rootRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return;
      }

      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open && allowCustom) {
      inputRef.current?.focus();
    }
  }, [allowCustom, open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }

    function updatePanelPosition() {
      const root = rootRef.current;
      if (!root) return;

      const anchor = root.querySelector('.custom-dropdown-input-shell') ||
        root.querySelector('.custom-dropdown-trigger') ||
        root;

      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const preferredMaxHeight = 240;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const shouldOpenUp = availableBelow < 180 && availableAbove > availableBelow;
      const maxHeight = Math.max(
        Math.min(shouldOpenUp ? availableAbove - gap : availableBelow - gap, preferredMaxHeight),
        120
      );
      const width = Math.min(rect.width, window.innerWidth - (viewportPadding * 2));
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const top = shouldOpenUp
        ? Math.max(viewportPadding, rect.top - gap - maxHeight)
        : Math.max(viewportPadding, rect.bottom + gap);

      setPanelStyle({
        top,
        left,
        width,
        maxHeight
      });
    }

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [allowCustom, open]);

  const filteredOptions = useMemo(() => {
    const searchTerm = String(query || '').trim().toLowerCase();
    if (!searchTerm) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(searchTerm));
  }, [normalizedOptions, query]);

  function handleSelect(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
  }

  const panelContent = open && !disabled ? (
    <div
      ref={panelRef}
      className="custom-dropdown-panel custom-dropdown-panel-floating"
      style={panelStyle ? {
        top: `${panelStyle.top}px`,
        left: `${panelStyle.left}px`,
        width: `${panelStyle.width}px`,
        maxHeight: `${panelStyle.maxHeight}px`,
        right: 'auto'
      } : undefined}
    >
      {filteredOptions.length ? (
        filteredOptions.map((option) => (
          <button
            key={`${option.label}-${String(option.value)}`}
            type="button"
            className={`custom-dropdown-option${matchesOption(option.value, value) ? ' is-selected' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleSelect(option.value)}
          >
            <span>{option.label}</span>
            {matchesOption(option.value, value) && (
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 10.5 8 14.5 16 5.5" />
              </svg>
            )}
          </button>
        ))
      ) : (
        <div className="custom-dropdown-empty">{emptyMessage}</div>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`custom-dropdown${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${allowCustom ? ' is-searchable' : ''}`}
      ref={rootRef}
    >
      {allowCustom ? (
        <div className="custom-dropdown-input-shell">
          <input
            ref={inputRef}
            value={query}
            onFocus={() => !disabled && setOpen(true)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              onChange?.(nextValue);
              setOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            className="custom-dropdown-toggle"
            onClick={() => !disabled && setOpen((current) => !current)}
            aria-label={open ? 'Close options' : 'Open options'}
            tabIndex={-1}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 7 5 6 5-6" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="custom-dropdown-trigger"
          onClick={() => !disabled && setOpen((current) => !current)}
          disabled={disabled}
        >
          <span className={selectedOption ? 'custom-dropdown-value' : 'custom-dropdown-placeholder'}>
            {selectedOption?.label || placeholder}
          </span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 7 5 6 5-6" />
          </svg>
        </button>
      )}

      {panelContent && typeof document !== 'undefined'
        ? createPortal(panelContent, document.body)
        : null}
    </div>
  );
}
