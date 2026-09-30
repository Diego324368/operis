import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldProps { label: string; error?: string; hint?: string; className?: string; children: ReactNode; htmlFor?: string }
export function Field({ label, error, hint, className = '', children, htmlFor }: FieldProps) {
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="error-text" role="alert">{error}</span> : hint ? <span className="muted tiny">{hint}</span> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, r) => <input ref={r} className="input" {...p} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, r) => <textarea ref={r} className="textarea" {...p} />);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((p, r) => <select ref={r} className="select" {...p} />);
