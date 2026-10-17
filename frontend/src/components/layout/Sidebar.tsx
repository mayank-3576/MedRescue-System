import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
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
  ChevronLeft,
  ChevronRight,
  Activity,
  CloudSun,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogoMark } from '../common/BrandLogoMark';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { isAdmin, user } = useAuth();

  const adminNavItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
    { to: '/admin/staff-management', icon: Users, label: 'Staff Accounts' },
    { to: '/admin/inventory', icon: Package, label: 'Medicine Inventory' },
    { to: '/admin/alerts', icon: AlertTriangle, label: 'Expiry Risk Alerts', badge: '4' },
    { to: '/admin/forecast', icon: CloudSun, label: 'Predictable AI Forecast', highlight: true },
    { to: '/admin/rescue', icon: Zap, label: 'AI Rescue Engine', highlight: true },
    { to: '/admin/map', icon: MapPin, label: 'Hospital Map' },
    { to: '/admin/transfers', icon: ArrowLeftRight, label: 'Transfer Requests' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics & Reports' },
    { to: '/admin/wallet', icon: Wallet, label: 'Payments & Wallet' },
    { to: '/admin/audit', icon: FileText, label: 'Audit Trail' },
    { to: '/admin/settings', icon: Settings, label: 'System Settings' },
  ];

  const staffNavItems = [
    { to: '/staff/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/staff/inventory', icon: Package, label: 'My Inventory' },
    { to: '/staff/batches', icon: Activity, label: 'Medicine Batches' },
    { to: '/shop', icon: ShoppingBag, label: 'Buy medicines' },
    { to: '/staff/forecast', icon: CloudSun, label: 'Predictable AI Forecast', highlight: true },
    { to: '/staff/alerts', icon: AlertTriangle, label: 'Expiry Risk Alerts', badge: '2' },
    { to: '/staff/rescue', icon: Zap, label: 'Rescue Recommendations', highlight: true },
    { to: '/staff/map', icon: MapPin, label: 'Redistribution Map' },
    { to: '/staff/transfers', icon: ArrowLeftRight, label: 'Transfer Logistics' },
    { to: '/staff/analytics', icon: BarChart3, label: 'Hospital Analytics' },
    { to: '/staff/assistant', icon: Bot, label: 'AI Medical Assistant' },
    { to: '/staff/profile', icon: User, label: 'Hospital Profile' },
  ];

  const navItems = isAdmin ? adminNavItems : staffNavItems;

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 h-screen sticky top-0 shrink-0 z-40 select-none shadow-xl"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <BrandLogoMark className="w-10 h-10 rounded-xl border border-teal-500/30 shadow-xs" />
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col whitespace-nowrap overflow-hidden"
            >
              <h1 className="font-bold text-white text-base tracking-tight leading-tight">
                MedRescue System
              </h1>
              <span className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">
                {isAdmin ? 'National Command' : 'Facility Portal'}
              </span>
            </motion.div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Hospital Node Subtitle if Staff */}
      {!collapsed && !isAdmin && user?.hospital_name && (
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60">
          <p className="text-[11px] text-slate-400 truncate font-medium">Node Facility:</p>
          <p className="text-xs text-teal-300 font-semibold truncate">{user.hospital_name}</p>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30 font-semibold'
                    : item.highlight
                    ? 'text-teal-400 hover:bg-teal-950/40 hover:text-teal-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="truncate flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {item.badge}
                </span>
              )}
              {!collapsed && item.highlight && (
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom Status Indicator */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-2'}`}>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-slow shrink-0" />
          {!collapsed && (
            <div className="text-[11px] truncate">
              <p className="text-slate-300 font-medium">AI Node Online</p>
              <p className="text-slate-500 text-[10px]">Sync: Real-time API</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
