import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap: Record<string, string> = {
  admin: 'Admin Center',
  staff: 'Hospital Center',
  dashboard: 'Dashboard',
  hospitals: 'Hospitals',
  inventory: 'Medicine Inventory',
  batches: 'Medicine Batches',
  alerts: 'Expiry Risk Alerts',
  rescue: 'AI Rescue Engine',
  map: 'Interactive Map',
  transfers: 'Transfer Requests',
  analytics: 'Analytics & Reporting',
  audit: 'Audit Trails',
  settings: 'System Settings',
  assistant: 'AI Medical Assistant',
  profile: 'My Profile',
  'staff-management': 'Staff Accounts',
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <nav className="hidden sm:flex items-center text-xs text-slate-500 font-medium" aria-label="Breadcrumb">
      <Link
        to={pathnames[0] === 'admin' ? '/admin/dashboard' : '/staff/dashboard'}
        className="text-slate-400 hover:text-teal-600 transition-colors flex items-center gap-1"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-slate-300" />
            {isLast ? (
              <span className="text-slate-800 font-semibold">{displayName}</span>
            ) : (
              <Link to={to} className="text-slate-500 hover:text-teal-600 transition-colors">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
