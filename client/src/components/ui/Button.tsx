import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'md' | 'sm';
  loading?: boolean;
}
export function Button({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, type = 'button', ...rest }: Props) {
  const v = variant === 'secondary' ? '' : `btn-${variant}`;
  return (
    <button type={type} className={`btn ${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}
