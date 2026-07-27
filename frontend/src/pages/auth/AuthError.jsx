import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import s from './Auth.module.css';

const TONES = {
  error: { className: s.alertError, Icon: AlertCircle, role: 'alert' },
  info: { className: s.alertInfo, Icon: Info, role: 'status' },
  success: { className: s.alertSuccess, Icon: CheckCircle2, role: 'status' },
};

/** Form-level feedback banner. Icon + text, so tone is never colour-only. */
export function AuthError({ children, tone = 'error' }) {
  if (!children) return null;
  const { className, Icon, role } = TONES[tone] ?? TONES.error;

  return (
    <div className={`${s.alert} ${className}`} role={role}>
      <Icon size={15} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
