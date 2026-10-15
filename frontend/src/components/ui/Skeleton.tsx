import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-pulse bg-[#eae2f5]/60 rounded-[4px] ${className}`} />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-6 space-y-4 shadow-sm">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex justify-between items-center pt-4 border-t border-[#e6e1eb]">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-9 w-28 rounded-[6px]" />
      </div>
    </div>
  );
};
