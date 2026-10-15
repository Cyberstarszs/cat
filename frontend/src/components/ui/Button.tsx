import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'min-h-[44px] px-5 rounded-[6px] font-sans font-bold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantClasses = {
    primary:
      'bg-[#583682] text-white border border-[#583682] hover:bg-[#352148] hover:border-[#352148] active:translate-y-[1px]',
    secondary:
      'bg-transparent text-[#583682] border border-[#583682] hover:bg-[#eae2f5] active:translate-y-[1px]',
    ghost:
      'bg-transparent text-[#24212b] border border-transparent hover:bg-[#eae2f5] hover:text-[#583682]',
    light:
      'bg-white text-[#352148] border border-white hover:bg-[#faf9fc] shadow-sm',
    danger:
      'bg-[#b63b48] text-white border border-[#b63b48] hover:bg-[#922b37] active:translate-y-[1px]',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
