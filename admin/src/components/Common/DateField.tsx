import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { ymdToDmy, dmyToYmd, isValidDmy } from '../../utils/dateUtils';

export interface DateFieldProps {
  value?: string | null;
  onChange: (e: { target: { value: string; name?: string } }) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  autoFocus?: boolean;
}

/**
 * Auto-format digits into DD-MM-YYYY
 */
const formatDigitsToDmy = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

/**
 * Universal DateField component that displays and edits dates strictly in DD-MM-YYYY format
 * while maintaining 100% compatibility with backend/form state expecting YYYY-MM-DD.
 */
export const DateField: React.FC<DateFieldProps> = ({
  value,
  onChange,
  name,
  id,
  placeholder = 'DD-MM-YYYY',
  className = 'form-control',
  style,
  disabled = false,
  readOnly = false,
  required = false,
  min,
  max,
  autoFocus,
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [pickerValue, setPickerValue] = useState<string>('');
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Sync incoming value to DD-MM-YYYY display and YYYY-MM-DD picker
  useEffect(() => {
    if (!value) {
      setDisplayValue('');
      setPickerValue('');
    } else {
      const dmy = ymdToDmy(value);
      const ymd = dmyToYmd(value);
      setDisplayValue(dmy);
      setPickerValue(ymd);
    }
  }, [value]);

  // Handle typing inside the text field
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const raw = e.target.value;

    // Handle clearing
    if (!raw.trim()) {
      setDisplayValue('');
      setPickerValue('');
      onChange({ target: { value: '', name } });
      return;
    }

    const formatted = formatDigitsToDmy(raw);
    setDisplayValue(formatted);

    // If a full DD-MM-YYYY is typed (10 chars: DD-MM-YYYY)
    if (formatted.length === 10) {
      if (isValidDmy(formatted)) {
        const ymd = dmyToYmd(formatted);
        setPickerValue(ymd);
        onChange({ target: { value: ymd, name } });
      }
    }
  };

  // Handle native calendar picker selection
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const ymd = e.target.value; // browser produces YYYY-MM-DD
    if (!ymd) {
      setDisplayValue('');
      setPickerValue('');
      onChange({ target: { value: '', name } });
      return;
    }
    const dmy = ymdToDmy(ymd);
    setDisplayValue(dmy);
    setPickerValue(ymd);
    onChange({ target: { value: ymd, name } });
  };

  // Open calendar popup
  const openCalendar = () => {
    if (disabled || readOnly) return;
    if (datePickerRef.current) {
      if (typeof datePickerRef.current.showPicker === 'function') {
        try {
          datePickerRef.current.showPicker();
          return;
        } catch {
          // fallback to click
        }
      }
      datePickerRef.current.focus();
      datePickerRef.current.click();
    }
  };

  // Separate container layout styles from input styling
  const {
    width,
    minWidth,
    maxWidth,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    height,
    ...inputStyles
  } = style || {};

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: width || '100%',
        minWidth,
        maxWidth,
        flex,
        flexGrow,
        flexShrink,
        flexBasis,
        margin,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        verticalAlign: 'middle',
        boxSizing: 'border-box',
      }}
    >
      <input
        type="text"
        id={id}
        name={name}
        className={className}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleTextChange}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        maxLength={10}
        style={{
          width: '100%',
          height: height || undefined,
          paddingRight: '34px',
          paddingLeft: '11px',
          fontSize: '13px',
          letterSpacing: displayValue ? '0.5px' : 'normal',
          fontFamily: displayValue ? 'monospace, sans-serif' : 'inherit',
          fontWeight: displayValue ? 600 : 400,
          boxSizing: 'border-box',
          ...inputStyles,
        }}
      />

      {/* Calendar icon button & hidden native date picker */}
      <div
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: (disabled || readOnly) ? 'not-allowed' : 'pointer',
          zIndex: 2,
        }}
        title={readOnly ? 'Read only' : 'Click to select date from calendar'}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={openCalendar}
          disabled={disabled || readOnly}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: (disabled || readOnly) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
        >
          <Calendar size={16} />
        </button>

        {/* Hidden native input for calendar popover */}
        <input
          ref={datePickerRef}
          type="date"
          tabIndex={-1}
          disabled={disabled || readOnly}
          min={min}
          max={max}
          value={pickerValue}
          onChange={handlePickerChange}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            width: '100%',
            height: '100%',
            cursor: disabled ? 'not-allowed' : 'pointer',
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default DateField;
