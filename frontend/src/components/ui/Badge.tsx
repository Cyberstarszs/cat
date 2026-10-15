import React, { ReactNode } from 'react';

export type BadgeVariant =
  | 'purple'
  | 'royal'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variantStyles = {
    purple: 'bg-[#eae2f5] text-[#583682] border-[#cfc2df]',
    royal: 'bg-[#f6f2fa] text-[#754ead] border-[#eae2f5]',
    success: 'bg-[#eaf4ef] text-[#287a58] border-[#bce2cf]',
    warning: 'bg-[#fdf6ec] text-[#a96817] border-[#f6ddba]',
    danger: 'bg-[#fbeeed] text-[#b63b48] border-[#f4c6cb]',
    neutral: 'bg-[#f6f2fa] text-[#595562] border-[#e6e1eb]',
    info: 'bg-[#edf3fc] text-[#4269a6] border-[#cbe0f9]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold tracking-wide border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
