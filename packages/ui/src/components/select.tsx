import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  icon?: React.ReactNode;
  selectSize?: 'sm' | 'md';
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      icon,
      selectSize = 'md',
      className = '',
      containerClassName = '',
      children,
      id,
      ...props
    },
    ref
  ) => {
    const sizeClasses =
      selectSize === 'sm'
        ? 'h-7 text-[11px] py-0.5 pl-2.5 pr-7'
        : 'h-8 text-[12px] py-1 pl-2.5 pr-8';

    const iconPadding = icon ? 'pl-7' : '';

    return (
      <div className={`relative inline-flex flex-col gap-1 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={id}
            className="text-[10px] uppercase font-semibold tracking-wider text-[var(--muted)] select-none"
          >
            {label}
          </label>
        )}
        <div className="relative inline-flex items-center">
          {icon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)] flex items-center justify-center">
              {icon}
            </div>
          )}
          <select
            ref={ref}
            id={id}
            className={`
              appearance-none -webkit-appearance-none -moz-appearance-none
              bg-[var(--card)] text-[var(--text)]
              border border-[var(--border)]
              rounded-md font-medium tracking-tight
              cursor-pointer outline-none select-none
              transition-all duration-150 ease-out
              hover:border-[var(--border-hover,#52525b)] hover:bg-[var(--card-raised,#1f1f23)]
              focus:border-[var(--accent,#6366f1)] focus:ring-1 focus:ring-[var(--accent,#6366f1)] focus:bg-[var(--card-raised,#1f1f23)]
              active:scale-[0.99]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${sizeClasses}
              ${iconPadding}
              ${className}
            `}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '12px 12px',
            }}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[var(--card)] text-[var(--text)] py-1.5 px-2">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
