import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let globalShowToast: ((message: string, type?: ToastType) => void) | null = null;

export const dispatchToast = (message: string, type: ToastType = 'success'): boolean => {
  if (globalShowToast) {
    globalShowToast(message, type);
    return true;
  }
  return false;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 3.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  useEffect(() => {
    globalShowToast = showToast;
    return () => {
      globalShowToast = null;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Container Floating UI - Top Right */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-4 h-4 text-[#b63b48] shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-4 h-4 text-[#a96817] shrink-0 mt-0.5" />,
            info: <Info className="w-4 h-4 text-[#583682] shrink-0 mt-0.5" />,
          };

          const borderColors = {
            success: 'border-l-4 border-l-[#287a58]',
            error: 'border-l-4 border-l-[#b63b48]',
            warning: 'border-l-4 border-l-[#a96817]',
            info: 'border-l-4 border-l-[#583682]',
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2.5 p-3.5 bg-white border border-[#e6e1eb] ${borderColors[toast.type]} rounded-xl shadow-lg text-xs text-[#24212b] animate-in fade-in slide-in-from-top-2 duration-200`}
            >
              {icons[toast.type]}
              <div className="flex-1 font-medium leading-relaxed">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 transition p-0.5 cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
