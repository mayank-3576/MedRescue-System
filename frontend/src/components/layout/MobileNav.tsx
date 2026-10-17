import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  LayoutDashboard,
  Building2,
  Users,
  Package,
  AlertTriangle,
  Zap,
  MapPin,
  ArrowLeftRight,
  BarChart3,
  FileText,
  Settings,
  Bot,
  User,
  LogOut,
  CloudSun,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogoMark } from '../common/BrandLogoMark';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { user, isAdmin, logout } = useAuth();

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
    { to: '/admin/staff-management', icon: Users, label: 'Staff' },
    { to: '/admin/inventory', icon: Package, label: 'Inventory' },
    { to: '/admin/forecast', icon: CloudSun, label: 'AI Demand Forecast' },
    { to: '/admin/alerts', icon: AlertTriangle, label: 'Expiry Alerts' },
    { to: '/admin/rescue', icon: Zap, label: 'Rescue Engine' },
    { to: '/admin/map', icon: MapPin, label: 'Hospital Map' },
    { to: '/admin/transfers', icon: ArrowLeftRight, label: 'Transfers' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/wallet', icon: Wallet, label: 'Payments & Wallet' },
    { to: '/admin/audit', icon: FileText, label: 'Audit Logs' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const staffLinks = [
    { to: '/staff/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/staff/inventory', icon: Package, label: 'My Inventory' },
    { to: '/staff/batches', icon: Package, label: 'Medicine Batches' },
    { to: '/shop', icon: ShoppingBag, label: 'Buy medicines' },
    { to: '/staff/forecast', icon: CloudSun, label: 'AI Demand Forecast' },
    { to: '/staff/alerts', icon: AlertTriangle, label: 'Expiry Alerts' },
    { to: '/staff/rescue', icon: Zap, label: 'AI Rescue' },
    { to: '/staff/map', icon: MapPin, label: 'Hospital Map' },
    { to: '/staff/transfers', icon: ArrowLeftRight, label: 'Transfers' },
    { to: '/staff/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/staff/assistant', icon: Bot, label: 'AI Assistant' },
    { to: '/staff/profile', icon: User, label: 'My Profile' },
  ];

  const navLinks = isAdmin ? adminLinks : staffLinks;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-72 bg-slate-900 text-white shadow-2xl flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <BrandLogoMark className="w-9 h-9 rounded-lg border border-teal-500/30" />
                <div>
                  <h2 className="font-bold text-base leading-tight">MedRescue System</h2>
                  <p className="text-[10px] text-teal-400 font-medium">Healthcare Redistribution</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MobileNav;
