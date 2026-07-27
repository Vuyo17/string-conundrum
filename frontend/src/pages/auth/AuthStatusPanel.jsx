import React from 'react';
import s from './Auth.module.css';

/**
 * Shared shell for the non-form steps — verification sent, reset sent, account
 * ready and already signed in. Keeps those states visually identical to the
 * forms so moving between them never feels like a different product.
 */
export function AuthStatusPanel({
  icon: Icon,
  tone = 'default',
  title,
  children,
  actions,
  footer,
}) {
  return (
    <section className={s.status}>
      <div className={`${s.statusIcon} ${tone === 'success' ? s.statusIconSuccess : ''}`}>
        <Icon size={21} aria-hidden="true" />
      </div>

      <h2 className={s.heading}>{title}</h2>
      <div className={s.subheading}>{children}</div>

      {actions && <div className={s.statusActions}>{actions}</div>}
      {footer && <div className={s.statusActionsRow}>{footer}</div>}
    </section>
  );
}
