import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Building, Mail, Edit2, Trash2, IdCard, FileCheck2, ShieldCheck, Clock3, Eye } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import { staffApi, StaffRegistrationRequest } from '../../api/staff';
import { hospitalsApi } from '../../api/hospitals';
import { User, Hospital } from '../../types';
import toast from 'react-hot-toast';

const staffSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  hospital_id: z.string().min(1, 'Hospital assignment is required'),
  password: z.string().optional(),
});

type StaffFormData = z.infer<typeof staffSchema>;

export const StaffManagementPage: React.FC = () => {
  const [staffList, setStaffList] = useState<User[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<StaffRegistrationRequest[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<Record<number, { governmentId: boolean; hospitalAuthorization: boolean }>>({});
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; mimeType: string; title: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, hospData, requestData] = await Promise.all([
        staffApi.getAll({
          search: search || undefined,
          hospital_id: selectedHospitalFilter !== 'all' ? selectedHospitalFilter : undefined,
        }),
        hospitalsApi.getAll({ is_active: true }),
        staffApi.getRegistrationRequests(),
      ]);
      setStaffList(staffData);
      setHospitals(hospData);
      setRegistrationRequests(requestData);
    } catch (e) {
      toast.error('Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedHospitalFilter]);

  const openRegistrationDocument = async (application: StaffRegistrationRequest, kind: 'government-id' | 'hospital-authorization') => {
    try {
      const documentBlob = await staffApi.getRegistrationDocument(application.id, kind);
      const url = URL.createObjectURL(documentBlob);
      setSelectedDocument({
        url,
        mimeType: documentBlob.type,
        title: kind === 'government-id' ? `${application.full_name} · Government ID` : `${application.full_name} · Hospital authorization`,
      });
      setRegistrationRequests((current) => current.map((request) => request.id !== application.id ? request : {
        ...request,
        government_id_document_viewed: request.government_id_document_viewed || kind === 'government-id',
        authorization_document_viewed: request.authorization_document_viewed || kind === 'hospital-authorization',
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not open the verification document');
    }
  };

  const closeRegistrationDocument = () => {
    if (selectedDocument) URL.revokeObjectURL(selectedDocument.url);
    setSelectedDocument(null);
  };

  const updateVerificationCheck = (id: number, field: 'governmentId' | 'hospitalAuthorization', value: boolean) => {
    setVerificationChecks((current) => ({
      ...current,
      [id]: { governmentId: current[id]?.governmentId || false, hospitalAuthorization: current[id]?.hospitalAuthorization || false, [field]: value },
    }));
  };

  const reviewRegistration = async (application: StaffRegistrationRequest, decision: 'approved' | 'rejected') => {
    const reviewNote = window.prompt(decision === 'approved' ? 'Optional verification note:' : 'Reason for rejecting this account request:');
    if (reviewNote === null) return;
    if (decision === 'rejected' && !reviewNote.trim()) { toast.error('Add a rejection reason'); return; }
    const checks = verificationChecks[application.id];
    if (decision === 'approved' && (!checks?.governmentId || !checks.hospitalAuthorization)) {
      toast.error('Open and verify both documents before approving');
      return;
    }
    setReviewingRequestId(application.id);
    try {
      await staffApi.decideRegistration(application.id, decision, reviewNote, checks?.governmentId, checks?.hospitalAuthorization);
      toast.success(decision === 'approved' ? 'Verified staff account activated' : 'Account request rejected; documents deleted');
      setRegistrationRequests((current) => current.filter((request) => request.id !== application.id));
      setVerificationChecks((current) => { const next = { ...current }; delete next[application.id]; return next; });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not review this account request');
    } finally { setReviewingRequestId(null); }
  };

  const handleOpenAdd = () => {
    setEditingStaff(null);
    reset({
      full_name: '',
      email: '',
      hospital_id: hospitals[0]?.id || '',
      password: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingStaff(user);
    reset({
      full_name: user.full_name || '',
      email: user.email,
      hospital_id: user.hospital_id || '',
      password: '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: StaffFormData) => {
    try {
      if (editingStaff) {
        await staffApi.update(editingStaff.id, {
          full_name: data.full_name,
          email: data.email,
          hospital_id: data.hospital_id,
        });
        toast.success('Staff account updated successfully');
      } else {
        if (!data.password || data.password.length < 8) {
          toast.error('Set a temporary password with at least 8 characters');
          return;
        }
        await staffApi.create(data as StaffFormData & { password: string });
        toast.success('New hospital pharmacist registered');
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;
    try {
      await staffApi.delete(staffToDelete.id);
      toast.success('Staff account deactivated');
      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
      loadData();
    } catch (e) {
      toast.error('Failed to delete staff account');
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      header: 'Staff Member',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
          {(u.full_name || u.email)[0].toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-slate-900 block">{u.full_name || u.email}</span>
            <span className="text-xs text-slate-500">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'hospital_name',
      header: 'Assigned Facility',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          <span>{u.hospital_name || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact Info',
      render: (u) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-slate-400" />
            <span>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge variant={u.role === 'admin' ? 'info' : 'active'} size="sm">
          {u.role.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (u) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(u)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Account"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setStaffToDelete(u);
              setDeleteConfirmOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Deactivate Account"
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
        title="Hospital Staff & Pharmacist Accounts"
        subtitle="Manage facility pharmacists authorized to report medicine surplus, accept incoming rescue consignments, and coordinate dispatch."
        actions={
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Account</span>
          </button>
        }
      />

      {registrationRequests.length > 0 && <section className="mb-6 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-white to-teal-50/70 shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-teal-100 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-teal-100 p-2.5 text-teal-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-900">Staff access requests</h2><p className="mt-0.5 text-xs text-slate-500">Open both documents and verify the applicant's identity and hospital authorization before approval.</p></div></div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><Clock3 className="h-3.5 w-3.5" />{registrationRequests.length} pending</span>
        </div>
        <div className="divide-y divide-slate-100">
          {registrationRequests.map((application) => {
            const checks = verificationChecks[application.id] || { governmentId: false, hospitalAuthorization: false };
            const idViewed = application.government_id_document_viewed;
            const authorizationViewed = application.authorization_document_viewed;
            return <article key={application.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold text-slate-900">{application.full_name}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{application.government_id_type.replace(/_/g, ' ')}</span></div>
                <p className="mt-1 truncate text-xs text-slate-600">{application.email}</p>
                <p className="mt-1 truncate text-xs font-medium text-teal-700">{application.hospital_name} · {application.hospital_city}</p>
                <p className="mt-1 text-[11px] text-slate-400">Submitted {new Date(application.submitted_at).toLocaleString()}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <button type="button" disabled={!application.government_id_document_available} onClick={() => void openRegistrationDocument(application, 'government-id')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"><IdCard className="h-4 w-4" />{idViewed ? 'View ID again' : 'Review government ID'}<Eye className="h-3.5 w-3.5" /></button>
                  <label className={`mt-2 flex items-start gap-2 text-[11px] leading-4 ${idViewed ? 'cursor-pointer text-slate-600' : 'cursor-not-allowed text-slate-400'}`}><input type="checkbox" disabled={!idViewed} checked={checks.governmentId} onChange={(event) => updateVerificationCheck(application.id, 'governmentId', event.target.checked)} className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />I verified this government ID</label>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <button type="button" disabled={!application.authorization_document_available} onClick={() => void openRegistrationDocument(application, 'hospital-authorization')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"><FileCheck2 className="h-4 w-4" />{authorizationViewed ? 'View proof again' : 'Review hospital proof'}<Eye className="h-3.5 w-3.5" /></button>
                  <label className={`mt-2 flex items-start gap-2 text-[11px] leading-4 ${authorizationViewed ? 'cursor-pointer text-slate-600' : 'cursor-not-allowed text-slate-400'}`}><input type="checkbox" disabled={!authorizationViewed} checked={checks.hospitalAuthorization} onChange={(event) => updateVerificationCheck(application.id, 'hospitalAuthorization', event.target.checked)} className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />I confirmed hospital authorization</label>
                </div>
              </div>

              <div className="flex gap-2 lg:flex-col">
                <button type="button" onClick={() => void reviewRegistration(application, 'approved')} disabled={reviewingRequestId === application.id || !checks.governmentId || !checks.hospitalAuthorization} className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45">{reviewingRequestId === application.id ? 'Saving…' : 'Verify & activate'}</button>
                <button type="button" onClick={() => void reviewRegistration(application, 'rejected')} disabled={reviewingRequestId === application.id} className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-45">Reject request</button>
              </div>
            </article>;
          })}
        </div>
        <p className="border-t border-teal-100 px-5 py-3 text-[11px] text-slate-500">Document check is performed manually. Source files are encrypted while pending and deleted after the decision.</p>
      </section>}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search staff by name or email..."
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <FilterDropdown
            label="Facility"
            value={selectedHospitalFilter}
            onChange={setSelectedHospitalFilter}
            options={[
              { label: 'All Hospitals', value: 'all' },
              ...hospitals.map((h) => ({ label: h.name, value: h.id })),
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={staffList}
        keyExtractor={(u) => u.id}
        loading={loading}
      />

      <Modal isOpen={!!selectedDocument} onClose={closeRegistrationDocument} title={selectedDocument?.title || 'Verification document'} maxWidth="4xl">
        {selectedDocument?.mimeType.startsWith('image/') ? <img src={selectedDocument.url} alt={selectedDocument.title} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" /> : selectedDocument && <iframe title={selectedDocument.title} src={selectedDocument.url} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50" />}
      </Modal>

      {/* Add / Edit Staff Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStaff ? 'Edit Staff Credentials' : 'Provision Staff Account'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              {...register('full_name')}
              placeholder="e.g. Dr. Rajesh Mehra"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {errors.full_name && (
              <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hospital Email *
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="pharmacist@hospital.org"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {!editingStaff && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
              <input type="password" minLength={8} autoComplete="new-password" {...register('password')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <p className="mt-1 text-[11px] text-slate-500">Share this securely with the staff member; they can use it with their email to sign in.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Hospital Node *
            </label>
            <select
              {...register('hospital_id')}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
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
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
            >
              {editingStaff ? 'Update Account' : 'Provision Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Revoke Staff Credentials?"
        message={`Are you sure you want to deactivate ${staffToDelete?.full_name || staffToDelete?.email}? They will no longer be able to log in to the facility redistribution portal.`}
        variant="danger"
        confirmText="Revoke Access"
      />
    </AnimatedPage>
  );
};

export default StaffManagementPage;
