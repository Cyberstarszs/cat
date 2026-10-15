import React, { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className = '', id, ...props }, ref) => {
    const selectId = id || props.name || Math.random().toString(36).substring(7);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold tracking-wider uppercase text-[#24212b]">
            {label}
            {props.required && <span className="text-[#b63b48] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full min-h-[46px] px-3.5 bg-white border ${
            error ? 'border-[#b63b48] ring-1 ring-[#b63b48]' : 'border-[#e6e1eb] focus:border-[#583682]'
          } rounded-[6px] text-sm text-[#24212b] outline-none transition duration-150 cursor-pointer ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-[#b63b48] font-medium mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#595562] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
