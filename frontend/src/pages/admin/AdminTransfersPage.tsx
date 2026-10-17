import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Building,
  Calendar,
  Search,
  Filter,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { transfersApi } from '../../api/transfers';
import { TransferRequest, TransferStatus } from '../../types';
import toast from 'react-hot-toast';

export const AdminTransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const data = await transfersApi.getAll({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        urgency: urgencyFilter !== 'all' ? urgencyFilter : undefined,
      });
      setTransfers(data);
    } catch (e) {
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [search, statusFilter, urgencyFilter]);

  const handleUpdateStatus = async (id: string, newStatus: TransferStatus) => {
    try {
      await transfersApi.updateStatus(id, newStatus);
      toast.success(`Transfer status updated to ${newStatus.replace('_', ' ')}`);
      loadTransfers();
      if (selectedTransfer?.id === id) {
        setDetailModalOpen(false);
      }
    } catch (e) {
      toast.error('Failed to update transfer status');
    }
  };

  const columns: Column<TransferRequest>[] = [
    {
      key: 'tracking_code',
      header: 'Tracking #',
      sortable: true,
      render: (t) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900 block">{t.tracking_code}</span>
          <span className="text-[11px] text-slate-400">Created: {new Date(t.created_at).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: 'medicine',
      header: 'Medicine & Quantity',
      render: (t) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs block">
            {t.medicine_name || 'Medicinal stock'}
          </span>
          <span className="text-xs text-slate-500 font-medium">{t.quantity} units</span>
        </div>
      ),
    },
    {
      key: 'source_hospital',
      header: 'Origin Facility',
      render: (t) => (
        <span className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          {t.source_hospital_name}
        </span>
      ),
    },
    {
      key: 'destination_hospital',
      header: 'Destination Facility',
      render: (t) => (
        <span className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
          <Building className="w-3.5 h-3.5 text-teal-600" />
          {t.destination_hospital_name}
        </span>
      ),
    },
    {
      key: 'urgency',
      header: 'Priority',
      sortable: true,
      render: (t) => (
        <Badge
          variant={t.urgency === 'emergency' ? 'critical' : t.urgency === 'urgent' ? 'high' : 'info'}
          size="sm"
        >
          {t.urgency.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (t) => (
        <Badge variant={t.status} size="sm">
          {t.status.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Control Actions',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          {t.status === 'pending' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus(t.id, 'approved')}
              className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded shadow-2xs"
            >
              Approve
            </button>
          )}
          {t.status === 'approved' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus(t.id, 'in_transit')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-2xs"
            >
              Dispatch
            </button>
          )}
          {t.status === 'in_transit' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus(t.id, 'delivered')}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-2xs"
            >
              Delivered
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedTransfer(t);
              setDetailModalOpen(true);
            }}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100 text-xs font-medium rounded border border-slate-200"
          >
            Details
          </button>
        </div>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Inter-Facility Transfer Logistics"
        subtitle="Live tracking of pharmaceutical shipments, courier assignments, chain-of-custody, and receiving verification."
      />

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tracking #, hospital, or medicine..."
          className="w-full sm:w-72"
        />

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending Approval', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'In Transit', value: 'in_transit' },
              { label: 'Delivered', value: 'delivered' },
              { label: 'Rejected', value: 'rejected' },
            ]}
          />
          <FilterDropdown
            label="Urgency"
            value={urgencyFilter}
            onChange={setUrgencyFilter}
            options={[
              { label: 'All Urgencies', value: 'all' },
              { label: 'Emergency', value: 'emergency' },
              { label: 'Urgent', value: 'urgent' },
              { label: 'Routine', value: 'routine' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={transfers}
        keyExtractor={(t) => t.id}
        loading={loading}
      />

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Transfer Details: ${selectedTransfer.tracking_code}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Medicine:</span>
                <span className="font-bold text-slate-800">{selectedTransfer.medicine_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity Dispatched:</span>
                <span className="font-bold text-slate-800">{selectedTransfer.quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transit Distance:</span>
                <span className="font-medium text-slate-700">{selectedTransfer.distance_km} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Logistics Cost:</span>
                <span className="font-bold text-teal-700">₹{selectedTransfer.estimated_cost}</span>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">Route Corridor:</p>
              <p className="text-slate-600">
                Origin: <strong>{selectedTransfer.source_hospital_name}</strong>
              </p>
              <p className="text-slate-600">
                Destination: <strong>{selectedTransfer.destination_hospital_name}</strong>
              </p>
            </div>

            {selectedTransfer.notes && (
              <div>
                <p className="font-semibold text-slate-700 mb-1">Clinical Notes:</p>
                <p className="p-2 bg-slate-50 rounded text-slate-600 italic">
                  {selectedTransfer.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatedPage>
  );
};

export default AdminTransfersPage;
