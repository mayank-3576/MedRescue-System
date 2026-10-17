import React, { useState, useEffect } from 'react';
import { FileText, Search, Shield, Filter, Clock } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Badge from '../../components/common/Badge';
import { auditApi } from '../../api/audit';
import { AuditLog } from '../../types';
import toast from 'react-hot-toast';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await auditApi.getAuditLogs({
        search: search || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });
      setLogs(data);
    } catch (e) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (l) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date(l.timestamp).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'System Action',
      sortable: true,
      render: (l) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
          {l.action}
        </span>
      ),
    },
    {
      key: 'user_email',
      header: 'Initiator',
      sortable: true,
      render: (l) => (
        <div>
          <span className="font-medium text-slate-800 text-xs block">{l.user_email}</span>
          <span className="text-[10px] text-slate-400 font-mono">IP: {l.ip_address}</span>
        </div>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entity / Target',
      render: (l) => (
        <span className="text-xs text-slate-600 font-medium">
          {l.entity_type} ({l.entity_id})
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Audit Record Details',
      render: (l) => <span className="text-xs text-slate-600 leading-snug">{l.details}</span>,
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Security & System Audit Trail"
        subtitle="Immutable transaction ledger logging all medicine status changes, automated AI rescue executions, and redistribution approvals."
      />

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by action, email, or details..."
          className="w-full sm:w-72"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <FilterDropdown
            label="Action"
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { label: 'All Actions', value: 'all' },
              { label: 'Transfer Approved', value: 'TRANSFER_APPROVED' },
              { label: 'Batch Registered', value: 'BATCH_REGISTERED' },
              { label: 'AI Rescue Generated', value: 'AI_RESCUE_GENERATED' },
              { label: 'Settings Updated', value: 'SETTINGS_UPDATED' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(l) => l.id}
        loading={loading}
      />
    </AnimatedPage>
  );
};

export default AuditLogsPage;
