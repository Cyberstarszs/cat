import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(7);

    // Padding yang aman dan terisolasi agar icon dan teks tidak pernah bertabrakan
    const paddingLeftClass = leftIcon ? '!pl-11' : 'pl-3.5';
    const paddingRightClass = rightIcon ? '!pr-11' : 'pr-3.5';

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold tracking-wider uppercase text-[#24212b]">
            {label}
            {props.required && <span className="text-[#b63b48] ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center justify-center w-5 h-5 z-10">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full min-h-[46px] py-2.5 bg-white border ${
              error ? 'border-[#b63b48] ring-1 ring-[#b63b48]' : 'border-[#e6e1eb] focus:border-[#583682]'
            } rounded-[6px] text-sm text-[#24212b] placeholder-gray-400 outline-none transition duration-150 ${paddingLeftClass} ${paddingRightClass} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center justify-center w-5 h-5 z-10">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#b63b48] font-medium mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#595562] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
