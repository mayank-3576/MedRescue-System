import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  Building,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import FilterDropdown from '../../components/common/FilterDropdown';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { transfersApi } from '../../api/transfers';
import { hospitalsApi } from '../../api/hospitals';
import { batchesApi } from '../../api/batches';
import { useAuth } from '../../hooks/useAuth';
import { TransferRequest, Hospital, MedicineBatch, TransferUrgency } from '../../types';
import toast from 'react-hot-toast';

const newTransferSchema = z.object({
  destination_hospital_id: z.string().min(1, 'Select recipient facility'),
  batch_id: z.string().min(1, 'Select an eligible batch'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  urgency: z.enum(['routine', 'urgent', 'emergency']),
  notes: z.string().optional(),
});

type NewTransferFormData = z.infer<typeof newTransferSchema>;

export const StaffTransfersPage: React.FC = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewTransferFormData>({
    resolver: zodResolver(newTransferSchema),
    defaultValues: {
      urgency: 'urgent',
      quantity: 10,
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [transfersData, hospsData, batchesData] = await Promise.all([
        transfersApi.getAll({
          hospital_id: hospitalId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
        hospitalsApi.getAll({ is_active: true }),
        batchesApi.getAll({ hospital_id: hospitalId }),
      ]);
      setTransfers(transfersData);
      setHospitals(hospsData);
      setBatches(batchesData.filter((batch) => batch.status !== 'expired' && batch.quantity > 0));
    } catch (e) {
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId, statusFilter]);

  const handleCreateTransfer = async (data: NewTransferFormData) => {
    try {
      const targetHosp = hospitals.find((h) => h.id === data.destination_hospital_id);
      const selectedBatch = batches.find((batch) => batch.id === data.batch_id);
      if (!selectedBatch || data.quantity > selectedBatch.quantity) {
        toast.error('Requested quantity exceeds unreserved batch stock');
        return;
      }

      await transfersApi.create({
        source_hospital_id: selectedBatch.hospital_id,
        destination_hospital_id: data.destination_hospital_id,
        medicine_id: selectedBatch.medicine_id,
        batch_id: selectedBatch.id,
        quantity: data.quantity,
        urgency: data.urgency,
        notes: data.notes,
        destination_hospital: targetHosp,
        batch_number: selectedBatch.batch_number,
      });

      toast.success('Transfer request submitted for approval');
      setCreateModalOpen(false);
      reset();
      loadData();
    } catch (e) {
      toast.error('Failed to create transfer');
    }
  };

  const handleUpdateStatus = async (id: string, status: any) => {
    try {
      await transfersApi.updateStatus(id, status);
      toast.success(`Transfer status updated to ${status}`);
      loadData();
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const columns: Column<TransferRequest>[] = [
    {
      key: 'tracking_code',
      header: 'Tracking Code',
      sortable: true,
      render: (t) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-800 block">{t.tracking_code}</span>
          <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: 'flow',
      header: 'Direction',
      render: (t) => {
        const isOutbound = t.source_hospital_id === hospitalId;
        return (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isOutbound ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'
            }`}
          >
            {isOutbound ? 'Outbound (Source)' : 'Inbound (Receiving)'}
          </span>
        );
      },
    },
    {
      key: 'medicine',
      header: 'Medicine',
      render: (t) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs block">{t.medicine_name}</span>
          <span className="text-xs text-slate-500 font-medium">{t.quantity} units</span>
        </div>
      ),
    },
    {
      key: 'counterpart',
      header: 'Partner Facility',
      render: (t) => {
        const isOutbound = t.source_hospital_id === hospitalId;
        const counterpart = isOutbound ? t.destination_hospital_name : t.source_hospital_name;
        return (
          <span className="text-xs text-slate-700 font-medium flex items-center gap-1">
            <Building className="w-3 h-3 text-slate-400" />
            {counterpart || 'Partner Facility'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge variant={t.status} size="sm">
          {t.status.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (t) => {
        const isOutbound = t.source_hospital_id === hospitalId;

        if (isOutbound && t.status === 'approved') {
          return (
            <button
              type="button"
              onClick={() => handleUpdateStatus(t.id, 'in_transit')}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-2xs"
            >
              Handover to Courier
            </button>
          );
        }

        if (!isOutbound && t.status === 'in_transit') {
          return (
            <button
              type="button"
              onClick={() => handleUpdateStatus(t.id, 'delivered')}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-2xs"
            >
              Confirm Inward Receipt
            </button>
          );
        }

        return <span className="text-xs text-slate-400 italic">No action needed</span>;
      },
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Inter-Hospital Consignment Transfers"
        subtitle="Manage active shipments dispatched from or incoming to this hospital facility."
        actions={
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Request Consignment Transfer</span>
          </button>
        }
      />

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex items-center justify-between">
        <FilterDropdown
          label="Transfer Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'All Consignments', value: 'all' },
            { label: 'Pending Approval', value: 'pending' },
            { label: 'In Transit', value: 'in_transit' },
            { label: 'Delivered', value: 'delivered' },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={transfers}
        keyExtractor={(t) => t.id}
        loading={loading}
      />

      {/* Create Transfer Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Initiate Inter-Hospital Transfer"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit(handleCreateTransfer)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Recipient Hospital *
            </label>
            <select
              {...register('destination_hospital_id')}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose partner hospital --</option>
              {hospitals
                .filter((h) => h.id !== hospitalId)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
            </select>
            {errors.destination_hospital_id && (
              <p className="text-xs text-red-500 mt-1">{errors.destination_hospital_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Source Medicine Batch *
            </label>
            <select
              {...register('batch_id')}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose medicine to transfer --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.medicine?.name} · {batch.batch_number} · {batch.quantity} available · expires {batch.expiry_date}
                </option>
              ))}
            </select>
            {errors.batch_id && <p className="text-xs text-red-500 mt-1">{errors.batch_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity Units *
              </label>
              <input
                type="number"
                {...register('quantity', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Urgency *
              </label>
              <select
                {...register('urgency')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency (ICU)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Notes & Instructions
            </label>
            <textarea
              rows={2}
              {...register('notes')}
              placeholder="e.g. ICU patient dose requirement..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
            >
              Dispatch Transfer Request
            </button>
          </div>
        </form>
      </Modal>
    </AnimatedPage>
  );
};

export default StaffTransfersPage;
