import React, { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  color?: 'teal' | 'blue' | 'rose' | 'amber' | 'emerald';
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'teal',
  prefix,
  suffix,
  subtitle,
  onClick,
  className = '',
  delay = 0,
}) => {
  const reducedMotion = useReducedMotion();
  const numericValue = typeof value === 'number' ? value : null;
  const counter = useMotionValue(reducedMotion ? numericValue || 0 : 0);
  const displayCounter = useTransform(counter, (current) => current.toLocaleString('en-IN', {
    maximumFractionDigits: numericValue !== null && Number.isInteger(numericValue) ? 0 : 2,
  }));

  useEffect(() => {
    if (numericValue === null) return;
    if (reducedMotion) {
      counter.set(numericValue);
      return;
    }
    const animation = animate(counter, numericValue, {
      duration: 0.9,
      delay: delay + 0.12,
      ease: 'easeOut',
    });
    return () => animation.stop();
  }, [counter, delay, numericValue, reducedMotion]);

  const colorStyles = {
    teal: {
      bg: 'bg-teal-50',
      text: 'text-teal-600',
      border: 'hover:border-teal-300',
      glow: 'shadow-teal-500/5',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'hover:border-blue-300',
      glow: 'shadow-blue-500/5',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'hover:border-rose-300',
      glow: 'shadow-rose-500/5',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'hover:border-amber-300',
      glow: 'shadow-amber-500/5',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'hover:border-emerald-300',
      glow: 'shadow-emerald-500/5',
    },
  };

  const currentTheme = colorStyles[color];

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -4, scale: 1.01 }}
      transition={{ duration: reducedMotion ? 0 : 0.38, delay: reducedMotion ? 0 : delay, ease: 'easeOut' }}
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-100 p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${currentTheme.border} ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, scale: 0.78, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          whileHover={reducedMotion ? undefined : { scale: 1.1, rotate: 6 }}
          transition={{ duration: 0.32, delay: reducedMotion ? 0 : delay + 0.08, ease: 'easeOut' }}
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${currentTheme.bg} ${currentTheme.text}`}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {prefix && <span className="text-xl font-medium text-slate-600">{prefix}</span>}
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">
          {numericValue !== null ? <motion.span>{displayCounter}</motion.span> : value}
        </h4>
        {suffix && <span className="text-sm font-medium text-slate-500">{suffix}</span>}
      </div>

      {(trend || subtitle) && (
        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-50">
          {trend ? (
            <div className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-0.5 font-medium ${
                  trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {trend.value}
              </span>
              {trend.label && <span className="text-slate-400">{trend.label}</span>}
            </div>
          ) : (
            <div />
          )}

          {subtitle && <span className="text-slate-400 text-xs ml-auto">{subtitle}</span>}
        </div>
      )}
    </motion.div>
  );
};

export default StatCard;
