import React, { ReactNode } from 'react';

export type BadgeVariant =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'active'
  | 'expired'
  | 'pending'
  | 'in_transit'
  | 'delivered'
  | 'rejected'
  | 'approved'
  | 'received'
  | 'cancelled'
  | 'pending_approval'
  | 'dispatched'
  | 'info'
  | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    active: 'bg-teal-50 text-teal-700 border-teal-200',
    expired: 'bg-slate-100 text-slate-700 border-slate-300',
    pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    in_transit: 'bg-blue-50 text-blue-700 border-blue-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    approved: 'bg-teal-50 text-teal-700 border-teal-200',
    received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-700 border-slate-300',
    pending_approval: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    dispatched: 'bg-blue-50 text-blue-700 border-blue-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    default: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const dotColors: Record<BadgeVariant, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
    active: 'bg-teal-500',
    expired: 'bg-slate-400',
    pending: 'bg-yellow-500',
    in_transit: 'bg-blue-500',
    delivered: 'bg-emerald-500',
    rejected: 'bg-red-500',
    approved: 'bg-teal-500',
    received: 'bg-emerald-500',
    cancelled: 'bg-slate-400',
    pending_approval: 'bg-yellow-500',
    dispatched: 'bg-blue-500',
    info: 'bg-sky-500',
    default: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-xs ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-ping' : ''}`}
      />
      {children}
    </span>
  );
};

export default Badge;
