import React, { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hasShadow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hasShadow = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white border border-[#e6e1eb] rounded-[8px] p-6 text-[#24212b] ${
        hasShadow ? 'shadow-sm' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
