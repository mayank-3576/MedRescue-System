import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Lock,
  Mail,
  ShieldCheck,
  Building,
  UserCheck,
  ArrowRight,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogoMark } from '../../components/common/BrandLogoMark';

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@medrescue.com',
      password: 'Admin123!',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setSubmitting(true);
    const authenticatedUser = await login(data.email, data.password);
    setSubmitting(false);
    if (authenticatedUser) {
      const requestedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      if (requestedPath === '/shop' && authenticatedUser?.role === 'staff') {
        navigate('/shop');
      } else if (authenticatedUser?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/staff/dashboard');
      }
    }
  };

  const setAdminDemo = () => {
    setValue('email', 'admin@medrescue.com');
    setValue('password', 'Admin123!');
  };

  const setStaffDemo = () => {
    setValue('email', 'staff@medrescue.com');
    setValue('password', 'Staff123!');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background radial gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-teal-500/15 via-teal-900/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10"
      >
        <BrandLogoMark className="mx-auto mb-4 h-14 w-14 rounded-2xl border border-teal-500/30 shadow-lg shadow-teal-500/10" />
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          MedRescue System
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Inter-Hospital Medical Expiry Prevention &amp; Autonomous Redistribution
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0"
      >
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {/* Demo account quick selector */}
          <div className="mb-6 p-3.5 bg-slate-900/70 border border-slate-700/60 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1-Click Demo Credentials:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={setAdminDemo}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-medium transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>National Admin</span>
              </button>
              <button
                type="button"
                onClick={setStaffDemo}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-medium transition-colors"
              >
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>AIIMS Staff</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email / Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  {...register('email')}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                  placeholder="name@hospital.org"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center gap-2 group"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              Multi-Role Access
            </span>
            <span className="text-[11px] text-slate-500">v1.0.0 Production</span>
          </div>
          <div className="mt-5 text-center">
            <a href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-300 hover:text-teal-200">
              <ShoppingBag className="h-4 w-4" />Hospital staff: sign in to buy medicines
            </a>
          </div>
          <div className="mt-4 text-center">
            <Link to="/register" className="text-sm font-semibold text-slate-300 transition-colors hover:text-white">Hospital staff? Request an account</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
