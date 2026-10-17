import React, { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, LucideIcon } from 'lucide-react';

interface DashboardHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actions?: ReactNode;
  stats: { label: string; value: string | number; note: string }[];
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  stats,
}) => {
  const reducedMotion = useReducedMotion();
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative isolate mb-7 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-5 py-6 text-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.8)] sm:px-8 sm:py-8"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-44 h-[27rem] w-[27rem] rounded-full border border-teal-100/10"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 75, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-7 rounded-full border border-teal-100/[0.07]" />
        <div className="absolute inset-16 rounded-full border border-teal-100/[0.06]" />
      </motion.div>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-[38%] h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100/75">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-100/15 bg-white/[0.06] px-3 py-1.5 normal-case tracking-normal text-teal-50">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                animate={reducedMotion ? undefined : { opacity: [1, 0.45, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Activity className="h-3.5 w-3.5 text-teal-300" />
              {eyebrow}
            </span>
            <span className="text-teal-100/45">{today}</span>
          </div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-5"
          >
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2.1rem]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-100/15 bg-teal-300/10 text-teal-200 shadow-inner shadow-white/5">
                <Icon className="h-5 w-5" />
              </span>
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">{subtitle}</p>
          </motion.div>

          {actions && <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.slice(0, 2).map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 + index * 0.09, duration: 0.35 }}
              whileHover={reducedMotion ? undefined : { y: -3 }}
              className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-lg shadow-slate-950/10 backdrop-blur-sm"
            >
              <p className="text-[11px] font-medium text-slate-300">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white">{stat.value}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-teal-200/70">{stat.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default DashboardHero;
