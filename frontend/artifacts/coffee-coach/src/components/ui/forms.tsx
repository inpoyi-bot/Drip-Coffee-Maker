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
    <label className={`flex items-start gap-3 p-4 border border-border transition-colors cursor-pointer
      ${containerStyle}
      ${checked ? (fallbackType ? '!bg-card/80 border-slate' : '!bg-card border-slate') : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <div className={`mt-0.5 w-4 h-4 rounded-full border border-slate flex-shrink-0 flex items-center justify-center ${checked ? 'bg-slate' : ''}`}>
         {checked && <div className="w-1.5 h-1.5 bg-background rounded-full" />}
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
    <label className={`flex items-start gap-3 p-4 border border-border transition-colors cursor-pointer
      ${containerStyle}
      ${checked ? (fallbackType ? '!bg-card/80 border-slate' : '!bg-card border-slate') : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div className={`mt-0.5 w-4 h-4 rounded-sm border border-slate flex-shrink-0 flex items-center justify-center ${checked ? 'bg-slate text-background' : ''}`}>
         {checked && <Check className="w-3 h-3" />}
      </div>
      <span className="font-medium text-sm leading-tight text-current">{label}</span>
    </label>
  );
}

export function Label({ children, className = '' }: any) {
  return <label className={`block text-sm font-medium text-foreground mb-2 ${className}`}>{children}</label>;
}

export function Input({ className = '', ...props }: any) {
  return <input className={`flex h-12 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: any) {
  return <textarea className={`flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
}
