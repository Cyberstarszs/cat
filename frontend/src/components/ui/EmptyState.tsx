import React, { ReactNode } from 'react';
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#e6e1eb] rounded-[8px]">
      <div className="w-14 h-14 bg-[#f6f2fa] text-[#583682] rounded-full flex items-center justify-center mb-4">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="font-display font-bold text-base text-[#24212b] mb-1">{title}</h3>
      <p className="text-xs text-[#595562] max-w-sm mb-6 leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
};

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title = 'Kendala Memuat Data',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex items-start gap-3 p-4 bg-[#fbeeed] border border-[#f4c6cb] rounded-[6px] text-xs text-[#b63b48] ${className}`}
    >
      <AlertCircle className="w-5 h-5 shrink-0 text-[#b63b48] mt-0.5" />
      <div className="flex-1 text-left">
        <h4 className="font-bold text-xs uppercase tracking-wide text-[#922b37] mb-0.5">{title}</h4>
        <p className="leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="secondary"
          className="min-h-[32px] px-3 text-[11px] bg-white text-[#922b37] border-[#f4c6cb] hover:bg-[#fbeeed]"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Coba Lagi
        </Button>
      )}
    </div>
  );
};
