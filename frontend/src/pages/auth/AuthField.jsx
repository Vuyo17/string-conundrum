import React, { useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import s from './Auth.module.css';

/**
 * Labelled input with an optional leading icon, password visibility toggle and
 * accessible error wiring (aria-invalid + aria-describedby, icon beside the
 * message so errors are never signalled by colour alone).
 */
export function AuthField({
  id,
  label,
  type = 'text',
  icon: Icon,
  error,
  hint,
  action,
  value,
  onChange,
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={s.field}>
      <div className={s.fieldLabelRow}>
        <label htmlFor={fieldId}>{label}</label>
        {action}
      </div>

      <div className={s.inputWrap}>
        {Icon && <Icon size={15} aria-hidden="true" />}
        <input
          id={fieldId}
          type={inputType}
          value={value}
          onChange={onChange}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            s.input,
            isPassword ? s.inputWithToggle : '',
            error ? s.inputInvalid : '',
          ].join(' ')}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className={s.toggleVisibility}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className={s.fieldHint}>{hint}</p>
      )}
      {error && (
        <p id={errorId} className={s.fieldError}>
          <AlertCircle size={13} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
