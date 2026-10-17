import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Building, Mail, Phone, ShieldCheck, Key, Save } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(8, 'Phone number is required'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const MyProfilePage: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '+91 98110 00002',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      updateCurrentUser(data);
      toast.success('Profile details updated successfully');
    } catch (e) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        title="Hospital Pharmacist Profile"
        subtitle="Manage personal credentials, authorized hospital node assignment, and notification contact points."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left ID Badge Card */}
        <Card className="lg:col-span-1 text-center">
          <div className="w-20 h-20 rounded-2xl bg-teal-600 text-white font-bold text-2xl flex items-center justify-center mx-auto shadow-md shadow-teal-700/20 mb-3">
            {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <h3 className="font-bold text-slate-900 text-base">{user?.full_name || user?.username}</h3>
          <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider mt-0.5">
            {user?.role} Access Level
          </p>

          <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Authorized Node</span>
              <span className="font-semibold text-slate-800">{user?.hospital_name || 'AIIMS Delhi'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">System Username</span>
              <span className="font-mono text-slate-700">@{user?.username}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Redistribution Clearance</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Clinical Pharmacist
              </span>
            </div>
          </div>
        </Card>

        {/* Right Form Card */}
        <Card title="Update Profile Details" className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                {...register('full_name')}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.full_name && (
                <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Urgent SMS Dispatch Mobile *
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Updating...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default MyProfilePage;
