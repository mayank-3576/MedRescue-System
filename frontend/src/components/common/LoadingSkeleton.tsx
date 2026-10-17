import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  type?: 'card' | 'table' | 'stat';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 3,
  type = 'card',
  className = '',
}) => {
  if (type === 'stat') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm animate-pulse">
            <div className="flex justify-between items-center mb-3">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
              <div className="w-10 h-10 rounded-lg bg-slate-100"></div>
            </div>
            <div className="h-7 bg-slate-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-4">
          <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 flex gap-4 items-center animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-pulse space-y-4">
          <div className="h-5 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2"></div>
          <div className="h-20 bg-slate-50 rounded-lg"></div>
          <div className="flex justify-between items-center pt-2">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-8 bg-slate-200 rounded w-20"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
