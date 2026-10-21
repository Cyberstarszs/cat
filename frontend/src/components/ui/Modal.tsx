import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClasses[maxWidth]} bg-white border border-[#e6e1eb] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e1eb] bg-[#faf9fc] shrink-0">
          <div className="pr-4 min-w-0">
            <h3 className="font-display font-bold text-base sm:text-lg text-[#24212b] truncate tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#595562] mt-0.5 line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-[#583682] hover:bg-[#eae2f5] rounded-lg transition shrink-0"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body (Bounded so user never scrolls entire page) */}
        <div className="px-6 py-5 overflow-y-auto overflow-x-hidden flex-1 text-xs leading-relaxed space-y-4">
          {children}
        </div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-[#e6e1eb] bg-[#faf9fc] shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
