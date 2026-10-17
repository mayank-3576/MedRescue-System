import React, { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  hover?: boolean;
  delay?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = 'p-5',
  hover = false,
  delay = 0,
}) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover && !reducedMotion ? { y: -3 } : undefined}
      transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : delay, ease: 'easeOut' }}
      className={`bg-white rounded-xl border border-slate-100 shadow-card ${
        hover ? 'hover:shadow-card-hover transition-all duration-200' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </motion.div>
  );
};

export default Card;
