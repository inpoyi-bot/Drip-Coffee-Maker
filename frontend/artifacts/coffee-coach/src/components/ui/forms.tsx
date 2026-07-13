import * as React from 'react';
import { Check } from 'lucide-react';

export function RadioOption({ name, value, checked, onChange, label, description, fallbackType }: any) {
  // fallbackType: 'missing' (没观察/没计时 - 客观缺失) | 'vague' (说不清 - 主观模糊) | undefined
  
  let containerStyle = 'rounded-md bg-background hover:bg-card/50 border-solid';
  if (fallbackType === 'missing') {
    containerStyle = 'rounded-none border-dashed bg-card/30 opacity-80 text-muted-foreground';
  } else if (fallbackType === 'vague') {
    containerStyle = 'rounded-tr-2xl rounded-bl-2xl border-dotted bg-background/50 hover:bg-card/30 italic';
  }

  return (
    <label data-fallback={fallbackType} className={`form-choice flex items-start gap-3 p-4 border border-border transition-colors cursor-pointer
      ${containerStyle}
      ${checked ? (fallbackType ? '!bg-card/80' : '') : ''}`}
      style={checked ? {
        borderColor: 'hsl(var(--select-accent))',
        borderWidth: 2,
        backgroundColor: 'hsl(var(--select-accent) / 0.08)',
      } : undefined}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <div
        className="form-choice-control mt-0.5 w-4 h-4 rounded-full border border-slate flex-shrink-0 flex items-center justify-center"
        style={checked ? { borderColor: 'hsl(var(--select-accent))' } : undefined}
      >
         {checked && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--select-accent))' }} />}
      </div>
      <div className="flex flex-col">
        <span className="font-medium text-sm leading-tight text-current">{label}</span>
        {description && <span className="text-muted-foreground text-xs mt-1">{description}</span>}
      </div>
    </label>
  );
}

export function CheckboxOption({ checked, onChange, label, fallbackType }: any) {
  let containerStyle = 'rounded-md bg-background hover:bg-card/50 border-solid';
  if (fallbackType === 'missing') {
    containerStyle = 'rounded-none border-dashed bg-card/30 opacity-80 text-muted-foreground';
  } else if (fallbackType === 'vague') {
    containerStyle = 'rounded-tr-2xl rounded-bl-2xl border-dotted bg-background/50 hover:bg-card/30 italic';
  }

  return (
    <label data-fallback={fallbackType} className={`form-choice flex items-start gap-3 p-4 border border-border transition-colors cursor-pointer
      ${containerStyle}
      ${checked ? (fallbackType ? '!bg-card/80' : '') : ''}`}
      style={checked ? {
        borderColor: 'hsl(var(--select-accent))',
        borderWidth: 2,
        backgroundColor: 'hsl(var(--select-accent) / 0.08)',
      } : undefined}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div
        className="form-choice-control mt-0.5 w-4 h-4 rounded-sm border border-slate flex-shrink-0 flex items-center justify-center"
        style={checked ? {
          borderColor: 'hsl(var(--select-accent))',
          backgroundColor: 'hsl(var(--select-accent))',
          color: 'hsl(var(--paper))',
        } : undefined}
      >
         {checked && <Check className="w-3 h-3" />}
      </div>
      <span className="font-medium text-sm leading-tight text-current">{label}</span>
    </label>
  );
}

export function Label({ children, className = '', required = false }: any) {
  return (
    <label className={`form-field-label flex items-center justify-between gap-2 text-sm font-medium text-foreground mb-2 ${className}`}>
      <span>{children}</span>
      {required && <span className="font-normal text-xs" style={{ color: 'hsl(var(--select-accent))' }}>必填</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: any) {
  return <input className={`form-text-input flex h-12 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: any) {
  return <textarea className={`form-text-input flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
}
