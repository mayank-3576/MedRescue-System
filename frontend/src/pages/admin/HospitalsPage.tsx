import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Bed,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Lock,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import HospitalMap from '../../components/map/HospitalMap';
import { hospitalsApi, GovIdVerificationResult } from '../../api/hospitals';
import { Hospital, HospitalType } from '../../types';
import toast from 'react-hot-toast';

const hospitalSchema = z.object({
  name: z.string().min(3, 'Hospital name is required'),
  code: z.string().min(2, 'Code is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().min(6, 'Valid pincode required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().min(8, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
  bed_capacity: z.number().min(1, 'Bed capacity must be at least 1'),
  type: z.enum(['government', 'private', 'clinic']),
  pmjay_hospital_id: z.string().min(3, 'Government Hospital ID is mandatory for facility onboarding'),
});

type HospitalFormData = z.infer<typeof hospitalSchema>;

const SAMPLE_GOV_IDS = [
  { id: 'ABDM-DL-AIIMS-01', label: 'AIIMS New Delhi (ABDM)' },
  { id: 'PMJAY-DEL-SAF-02', label: 'Safdarjung Hospital (PMJAY)' },
  { id: 'PMJAY-MUM-KEM-02', label: 'KEM Hospital Mumbai (PMJAY)' },
  { id: 'NIN-BLR-VIC-03', label: 'Victoria Hospital Bengaluru (NIN)' },
  { id: 'ROHINI-HYD-NIZ-04', label: 'NIMS Hyderabad (ROHINI)' },
];

export const HospitalsPage: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(null);
  const [previewHospital, setPreviewHospital] = useState<Hospital | null>(null);

  // Government Hospital Verification State
  const [govVerifResult, setGovVerifResult] = useState<GovIdVerificationResult | null>(null);
  const [verifyingGovId, setVerifyingGovId] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HospitalFormData>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      type: 'government',
      latitude: 28.57,
      longitude: 77.22,
      bed_capacity: 500,
    },
  });

  const enteredGovId = watch('pmjay_hospital_id');

  const loadHospitals = async () => {
    setLoading(true);
    try {
      const data = await hospitalsApi.getAll({
        search: search || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      setHospitals(data);
    } catch (e) {
      toast.error('Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, [search, typeFilter]);

  const handleOpenAdd = () => {
    setEditingHospital(null);
    setGovVerifResult(null);
    reset({
      name: '',
      code: '',
      pmjay_hospital_id: '',
      address: '',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110029',
      latitude: 28.57,
      longitude: 77.21,
      phone: '+91 11 26588500',
      email: 'medical.superintendent@hospital.gov.in',
      bed_capacity: 500,
      type: 'government',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (h: Hospital) => {
    setEditingHospital(h);
    setGovVerifResult({
      is_valid: true,
      gov_hospital_id: h.pmjay_hospital_id || 'VERIFIED-ID',
      status: 'verified_registry',
      authorized_to_operate: true,
      message: 'Active verified facility node',
      registry_authority: 'National Health Authority Health Facility Registry',
    });
    reset({
      name: h.name,
      code: h.code,
      pmjay_hospital_id: h.pmjay_hospital_id || '',
      address: h.address,
      city: h.city,
      state: h.state,
      pincode: h.pincode,
      latitude: h.latitude,
      longitude: h.longitude,
      phone: h.phone,
      email: h.email,
      bed_capacity: h.bed_capacity,
      type: h.type,
    });
    setModalOpen(true);
  };

  // Perform live verification against official Government Hospital Registry
  const handleVerifyGovernmentId = async (idToVerify?: string) => {
    const targetId = (idToVerify || enteredGovId || '').trim();
    if (!targetId) {
      toast.error('Please enter a Government Hospital ID first');
      return;
    }

    setVerifyingGovId(true);
    try {
      const res = await hospitalsApi.verifyGovId({
        gov_hospital_id: targetId,
      });
      setGovVerifResult(res);

      if (res.is_valid && res.authorized_to_operate) {
        toast.success(`Government ID Verified! Facility permitted for onboarding.`);
        setValue('pmjay_hospital_id', res.gov_hospital_id, { shouldValidate: true });
        if (res.registered_facility_name) {
          setValue('name', res.registered_facility_name, { shouldValidate: true });
        }
        if (res.city) setValue('city', res.city, { shouldValidate: true });
        if (res.state) setValue('state', res.state, { shouldValidate: true });
        if (res.pincode) setValue('pincode', res.pincode, { shouldValidate: true });
        if (res.bed_capacity) setValue('bed_capacity', res.bed_capacity, { shouldValidate: true });
        if (!watch('code') && res.registered_facility_name) {
          const generatedCode = res.registered_facility_name.split(' ').map(w => w[0]).join('').substring(0, 6).toUpperCase();
          setValue('code', `${generatedCode}-${res.city?.substring(0, 3).toUpperCase()}`);
        }
      } else {
        toast.error(res.message || 'Verification failed. ID not authorized by Government Registry.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Verification error with Government Registry.';
      toast.error(msg);
      setGovVerifResult(null);
    } finally {
      setVerifyingGovId(false);
    }
  };

  const onSubmit = async (data: HospitalFormData) => {
    try {
      if (!editingHospital) {
        if (!govVerifResult || !govVerifResult.is_valid || !govVerifResult.authorized_to_operate) {
          toast.error('Government Hospital ID must be verified before the facility can be permitted into the platform.');
          return;
        }
      }

      if (editingHospital) {
        await hospitalsApi.update(editingHospital.id, data);
        toast.success('Hospital facility details updated');
      } else {
        await hospitalsApi.create(data);
        toast.success('Government verified hospital successfully permitted & added to network!');
      }
      setModalOpen(false);
      loadHospitals();
    } catch (e: any) {
      const errorMsg = e?.response?.data?.detail || 'Operation failed. Please verify government credentials.';
      toast.error(errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!hospitalToDelete) return;
    try {
      await hospitalsApi.delete(hospitalToDelete.id);
      toast.success('Facility disconnected from network');
      setDeleteConfirmOpen(false);
      setHospitalToDelete(null);
      loadHospitals();
    } catch (e) {
      toast.error('Failed to remove facility');
    }
  };

  const columns: Column<Hospital>[] = [
    {
      key: 'name',
      header: 'Facility Name & Registry',
      sortable: true,
      render: (h) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 block">{h.name}</span>
            {h.pmjay_hospital_id && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                GOVT VERIFIED
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            {h.city}, {h.state}
          </span>
          {h.pmjay_hospital_id && (
            <span className="text-[11px] font-mono text-teal-700 block mt-0.5">
              Govt ID: {h.pmjay_hospital_id}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Node Code',
      sortable: true,
      render: (h) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
          {h.code}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      sortable: true,
      render: (h) => (
        <Badge
          variant={h.type === 'government' ? 'active' : 'info'}
          size="sm"
        >
          {h.type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'bed_capacity',
      header: 'Beds',
      sortable: true,
      render: (h) => (
        <div className="flex items-center gap-1 text-slate-700 font-medium">
          <Bed className="w-3.5 h-3.5 text-slate-400" />
          <span>{h.bed_capacity}</span>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (h) => (
        <Badge variant={h.is_active ? 'active' : 'default'} size="sm">
          {h.is_active ? 'ACTIVE & PERMITTED' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (h) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenEdit(h)}
            className="p-1 text-slate-500 hover:text-teal-600 rounded transition-colors"
            title="Edit Facility"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setHospitalToDelete(h);
              setDeleteConfirmOpen(true);
            }}
            className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors"
            title="Remove Facility"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Healthcare Facility Nodes"
        subtitle="Manage participating hospitals, official Government Hospital Registry verification, and live node coordinates."
        actions={
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register & Verify Hospital</span>
          </button>
        }
      />

      {/* Selected Hospital Geo-spatial Preview */}
      {previewHospital && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{previewHospital.name}</h3>
                {previewHospital.pmjay_hospital_id && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Official Govt Registry Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {previewHospital.address}, {previewHospital.city}, {previewHospital.state} - {previewHospital.pincode}
              </p>
            </div>
            <button
              onClick={() => setPreviewHospital(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close Map
            </button>
          </div>
          <HospitalMap
            hospitals={[previewHospital]}
            selectedHospital={previewHospital}
            center={[previewHospital.latitude, previewHospital.longitude]}
            zoom={14}
            height={260}
          />
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by hospital name, code, or city..."
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <FilterDropdown
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: 'All Classifications', value: 'all' },
              { label: 'Government', value: 'government' },
              { label: 'Private', value: 'private' },
              { label: 'Clinic', value: 'clinic' },
            ]}
          />
        </div>
      </div>

      {/* Facilities Data Table */}
      <DataTable
        columns={columns}
        data={hospitals}
        keyExtractor={(h) => h.id}
        loading={loading}
        onRowClick={(h) => setPreviewHospital(h)}
      />

      {/* Add / Edit Modal with Government Hospital ID Verification */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHospital ? 'Edit Healthcare Facility' : 'Register & Permit Hospital Node'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Government Hospital ID Verification Engine */}
          <div className="rounded-xl border-2 border-teal-500/30 bg-teal-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Government Hospital ID Verification (Mandatory)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                ABDM / PMJAY / NIN / ROHINI
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Every facility must be verified against official Government Health Registries before the system permits onboarding.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                {...register('pmjay_hospital_id')}
                placeholder="e.g. ABDM-DL-AIIMS-01 or PMJAY-MUM-KEM-02"
                className="flex-1 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                disabled={verifyingGovId}
                onClick={() => handleVerifyGovernmentId()}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                {verifyingGovId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify with Govt Registry</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Demo Govt IDs chips */}
            {!editingHospital && (
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  1-Click Sample Government Registered IDs:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_GOV_IDS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setValue('pmjay_hospital_id', item.id);
                        handleVerifyGovernmentId(item.id);
                      }}
                      className="px-2 py-1 text-[11px] font-mono bg-white hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-md transition-colors"
                    >
                      {item.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Result Badge & Details */}
            {govVerifResult?.is_valid && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>GOVERNMENT REGISTRY VERIFIED</span>
                    {govVerifResult.verification_certificate && (
                      <span className="font-mono text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded text-emerald-900">
                        {govVerifResult.verification_certificate}
                      </span>
                    )}
                  </div>
                  <p>{govVerifResult.message}</p>
                  {govVerifResult.registry_authority && (
                    <p className="text-[11px] text-emerald-700">
                      Authority: <strong>{govVerifResult.registry_authority}</strong>
                    </p>
                  )}
                  <span className="inline-block mt-1 font-semibold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                    ✓ Permitted for Hospital Network Entry
                  </span>
                </div>
              </div>
            )}

            {!govVerifResult?.is_valid && !editingHospital && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Verification required: Enter a Government Hospital ID and verify to unlock onboarding permission.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Facility Name *
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. All India Institute of Medical Sciences"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unique Node Code *
              </label>
              <input
                type="text"
                {...register('code')}
                placeholder="e.g. AIIMS-DEL"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
              />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Classification *
              </label>
              <select
                {...register('type')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="government">Government Hospital</option>
                <option value="private">Private Empanelled</option>
                <option value="clinic">Community Health Center</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Capacity *
              </label>
              <input
                type="number"
                {...register('bed_capacity', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.bed_capacity && (
                <p className="text-xs text-red-500 mt-1">{errors.bed_capacity.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone *
              </label>
              <input
                type="text"
                {...register('phone')}
                placeholder="+91 11 ..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="pharmacy@hospital.gov.in"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                {...register('address')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City *
              </label>
              <input
                type="text"
                {...register('city')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State *
              </label>
              <input
                type="text"
                {...register('state')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Latitude *
              </label>
              <input
                type="number"
                step="0.0001"
                {...register('latitude', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Longitude *
              </label>
              <input
                type="number"
                step="0.0001"
                {...register('longitude', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editingHospital && (!govVerifResult?.is_valid || !govVerifResult?.authorized_to_operate)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              {editingHospital ? (
                'Save Changes'
              ) : !govVerifResult?.is_valid ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Verify Govt ID to Permit</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Permit & Onboard Hospital</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Disconnect Hospital Node?"
        message={`Are you sure you want to remove ${hospitalToDelete?.name}? Inter-hospital automated redistribution algorithms will exclude this node from future dispatch calculations.`}
        variant="danger"
        confirmText="Remove Facility"
      />
    </AnimatedPage>
  );
};

export default HospitalsPage;
