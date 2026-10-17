import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, CheckCircle2, FileCheck2, IdCard, LockKeyhole, Mail, ShieldCheck, UploadCloud, UserRound } from 'lucide-react';
import { authApi, RegistrationHospital } from '../../api/auth';
import { BrandLogoMark } from '../../components/common/BrandLogoMark';

const idTypes = [
  { value: 'aadhaar_masked', label: 'Masked Aadhaar copy' },
  { value: 'pan', label: 'PAN card' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving licence' },
  { value: 'other', label: 'Other government photo ID' },
];

const fileTypes = '.pdf,.jpg,.jpeg,.png';
const maxFileBytes = 5 * 1024 * 1024;

export const StaffRegistrationPage: React.FC = () => {
  const [hospitals, setHospitals] = useState<RegistrationHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [application, setApplication] = useState<{ application_id: number; message: string } | null>(null);
  const [governmentIdFile, setGovernmentIdFile] = useState<File | null>(null);
  const [authorizationFile, setAuthorizationFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    hospital_id: '',
    government_id_type: 'aadhaar_masked',
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    authApi.getRegistrationHospitals()
      .then(setHospitals)
      .catch((requestError: any) => setError(requestError.response?.data?.detail || 'Hospital list could not be loaded. Please try again.'))
      .finally(() => setLoadingHospitals(false));
  }, []);

  const updateField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const validateFile = (file: File | null, label: string) => {
    if (!file) return `${label} document is required.`;
    if (file.size > maxFileBytes) return `${label} document must be 5 MB or smaller.`;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(extension || '')) return `${label} must be a PDF, JPG, or PNG.`;
    return '';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.hospital_id) { setError('Choose your active hospital.'); return; }
    const govFileError = validateFile(governmentIdFile, 'Government ID');
    const authorizationFileError = validateFile(authorizationFile, 'Hospital authorization');
    if (govFileError || authorizationFileError) { setError(govFileError || authorizationFileError); return; }
    if (form.password.length < 12 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, and a number.'); return;
    }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }

    const payload = new FormData();
    payload.append('full_name', form.full_name.trim());
    payload.append('email', form.email.trim());
    payload.append('hospital_id', form.hospital_id);
    payload.append('government_id_type', form.government_id_type);
    payload.append('password', form.password);
    payload.append('government_id_document', governmentIdFile!);
    payload.append('hospital_authorization_document', authorizationFile!);

    setSubmitting(true);
    try {
      const result = await authApi.registerHospitalStaff(payload);
      setApplication({ application_id: result.application_id, message: result.message });
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not submit your application. Check the information and try again.');
    } finally { setSubmitting(false); }
  };

  const filePicker = (label: string, hint: string, file: File | null, setFile: (file: File | null) => void, icon: React.ReactNode) => (
    <label className="block cursor-pointer rounded-xl border border-dashed border-slate-600 bg-slate-900/55 p-4 transition-colors hover:border-teal-400/70 hover:bg-slate-900/80">
      <input type="file" accept={fileTypes} className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <span className="flex items-start gap-3">
        <span className="rounded-lg bg-teal-500/10 p-2 text-teal-300">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-100">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-400">{file ? file.name : hint}</span>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-300"><UploadCloud className="h-3.5 w-3.5" />{file ? 'Choose a different file' : 'Choose document'}</span>
        </span>
      </span>
    </label>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-blue-500/[0.08] blur-3xl" />

      <div className="relative mx-auto max-w-3xl">
        <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>

        {application ? (
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-700 bg-slate-900/85 p-7 text-center shadow-2xl backdrop-blur sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><CheckCircle2 className="h-9 w-9" /></span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Application submitted</p>
            <h1 className="mt-2 text-2xl font-bold">Waiting for hospital staff verification</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">An administrator will check your government ID and hospital authorization before activating your account. You can sign in with your email and chosen password after approval.</p>
            <p className="mt-6 inline-flex rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 font-mono text-sm text-slate-200">Application #{application.application_id}</p>
            <Link to="/login" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-500"><ArrowLeft className="h-4 w-4" />Return to sign in</Link>
          </motion.section>
        ) : (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/85 shadow-2xl shadow-black/30 backdrop-blur">
            <header className="border-b border-slate-700/70 bg-gradient-to-r from-teal-950/70 to-slate-900 px-6 py-6 sm:px-8">
              <div className="flex items-center gap-3">
                <BrandLogoMark className="h-12 w-12 rounded-2xl border border-teal-300/20" />
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">MedRescue System</p><h1 className="mt-1 text-xl font-bold sm:text-2xl">Request a hospital staff account</h1></div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Only authorized staff from an active hospital can receive access. Your account stays pending until an administrator checks both documents.</p>
            </header>

            <form onSubmit={submit} className="space-y-5 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Full name</span><span className="relative block"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input required minLength={2} maxLength={160} value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20" placeholder="Name as shown on ID" /></span></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Email · login ID</span><span className="relative block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input required type="email" maxLength={255} value={form.email} onChange={(e) => updateField('email', e.target.value)} autoComplete="email" className="w-full rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20" placeholder="name@hospital.org" /></span></label>
              </div>

              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Active hospital</span><span className="relative block"><Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><select required value={form.hospital_id} onChange={(e) => updateField('hospital_id', e.target.value)} disabled={loadingHospitals || hospitals.length === 0} className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"><option value="">{loadingHospitals ? 'Loading hospitals…' : hospitals.length ? 'Select your hospital' : 'No active hospitals available'}</option>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.city}, {hospital.state}</option>)}</select></span></label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Government-issued photo ID type</span><span className="relative block"><IdCard className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><select value={form.government_id_type} onChange={(e) => updateField('government_id_type', e.target.value)} className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20">{idTypes.map((idType) => <option key={idType.value} value={idType.value}>{idType.label}</option>)}</select></span></label>
                {filePicker('Government ID document', 'Use a masked copy. For Aadhaar, upload only a masked Aadhaar.', governmentIdFile, setGovernmentIdFile, <IdCard className="h-4 w-4" />)}
              </div>

              {filePicker('Hospital authorization proof', 'Hospital ID, appointment letter, or a signed authorization letter.', authorizationFile, setAuthorizationFile, <FileCheck2 className="h-4 w-4" />)}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Create password</span><span className="relative block"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input required type="password" minLength={12} maxLength={128} value={form.password} onChange={(e) => updateField('password', e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20" placeholder="12+ characters" /></span><span className="mt-1 block text-[11px] text-slate-500">Use uppercase, lowercase, and a number.</span></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Confirm password</span><span className="relative block"><ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input required type="password" minLength={12} maxLength={128} value={form.confirm_password} onChange={(e) => updateField('confirm_password', e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-slate-700 bg-slate-950/65 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20" placeholder="Re-enter password" /></span></label>
              </div>

              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100/80"><strong className="text-amber-100">Privacy and verification:</strong> Documents are encrypted while review is pending and permanently deleted after the administrator decides. Upload a masked ID copy. Verification is a manual document check; this project does not connect to a government identity database.</div>
              {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

              <button type="submit" disabled={submitting || loadingHospitals || hospitals.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{submitting ? 'Submitting for verification…' : 'Submit for admin verification'}</button>
              <p className="text-center text-xs text-slate-500">Already approved? <Link to="/login" className="font-semibold text-teal-300 hover:text-teal-200">Sign in with your email and password</Link></p>
            </form>
          </motion.section>
        )}
      </div>
    </main>
  );
};

export default StaffRegistrationPage;
