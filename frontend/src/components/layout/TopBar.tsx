import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Building,
  Barcode,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Breadcrumbs from './Breadcrumbs';
import QuickBarcodeAddModal from '../common/QuickBarcodeAddModal';

interface TopBarProps {
  onOpenMobileNav: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileNav }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sampleNotifications = [
    {
      id: 1,
      title: 'Critical Expiry Alert',
      desc: 'Remdesivir 100mg (AIIMS) expires in 13 days',
      time: '10m ago',
      unread: true,
      type: 'critical',
    },
    {
      id: 2,
      title: 'AI Rescue Match Found',
      desc: 'Apollo Hospital matched with 96% confidence',
      time: '35m ago',
      unread: true,
      type: 'rescue',
    },
    {
      id: 3,
      title: 'Transfer Dispatched',
      desc: 'Courier TRK-MED-84920 picked up cold chain unit',
      time: '2h ago',
      unread: false,
      type: 'transfer',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Breadcrumbs />
      </div>

      {/* Right side: Global Search, Quick Rescue, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Quick Rescue Engine Action */}
        <button
          type="button"
          onClick={() => navigate(isAdmin ? '/admin/rescue' : '/staff/rescue')}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 rounded-lg transition-all shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-spin-slow" />
          <span>AI Rescue Engine</span>
        </button>

        {/* 1-Click Direct Barcode Scanner Intake */}
        <button
          type="button"
          onClick={() => setBarcodeModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Scan medicine barcode to directly add to pharmacy stock"
        >
          <Barcode className="w-4 h-4" />
          <span>Scan & Add Medicine</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notifications
                </span>
                <span className="text-[11px] bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                  2 New
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {sampleNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                      notif.unread ? 'bg-teal-50/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {notif.type === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : notif.type === 'rescue' ? (
                          <Sparkles className="w-4 h-4 text-teal-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{notif.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.desc}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{notif.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate(isAdmin ? '/admin/alerts' : '/staff/alerts');
                  }}
                  className="text-xs font-medium text-teal-600 hover:text-teal-700"
                >
                  View All Expiry Alerts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                {user?.full_name || user?.username}
              </span>
              <span className="text-[10px] text-teal-600 font-medium capitalize">
                {user?.role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                {user?.hospital_name && (
                  <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1 font-medium truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    {user.hospital_name}
                  </p>
                )}
              </div>

              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    navigate('/staff/profile');
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  My Profile
                </button>
              )}

              <div className="border-t border-slate-100 my-1"></div>

              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Direct Barcode Inward Intake Modal */}
      <QuickBarcodeAddModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
      />
    </header>
  );
};

export default TopBar;
