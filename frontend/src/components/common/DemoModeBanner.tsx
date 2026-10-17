import React, { useState } from 'react';
import { Database, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const DemoModeBanner: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const { user } = useAuth();

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 font-semibold">
          <Database className="h-3 w-3" /> DEMO DATA
        </span>
        <span className="truncate">
          Seeded sample records for demonstration. Recommendations and delivery estimates are calculated from this data.
        </span>
        {user && <span className="hidden shrink-0 text-amber-800 md:inline">Signed in as {user.full_name}</span>}
      </div>
      <button type="button" onClick={() => setVisible(false)} className="shrink-0 rounded p-1 text-amber-800 hover:bg-amber-100" aria-label="Dismiss demo data notice">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default DemoModeBanner;
