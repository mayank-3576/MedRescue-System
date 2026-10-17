import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, RotateCcw, Truck, ShieldCheck } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import { settingsApi } from '../../api/settings';
import { AppSettings } from '../../types';
import toast from 'react-hot-toast';

const defaults: AppSettings = {
  cost_per_km: 15,
  fixed_delivery_charge: 500,
  min_shelf_life_days: 30,
  max_delivery_radius_km: 800,
};

const settingsSchema = z.object({
  cost_per_km: z.number().min(0).max(100000),
  fixed_delivery_charge: z.number().min(0).max(10000000),
  min_shelf_life_days: z.number().int().min(1).max(365),
  max_delivery_radius_km: z.number().min(1).max(20000),
});

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<AppSettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    settingsApi.getSettings()
      .then(reset)
      .catch(() => toast.error('Failed to load system settings'))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: AppSettings) => {
    setSaving(true);
    try {
      const saved = await settingsApi.updateSettings(data);
      reset(saved);
      toast.success('Delivery and rescue settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    reset(defaults);
    toast('Defaults loaded. Save to apply them.');
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

  return (
    <AnimatedPage>
      <PageHeader title="Delivery & Rescue Settings" subtitle="Configure the cost formula and eligibility limits used by route estimates and rescue recommendations." />
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
        <Card title={<span className="flex items-center gap-2"><Truck className="h-4 w-4 text-teal-600" />Delivery cost estimate</span>} subtitle="Estimate = distance × cost per kilometre + fixed charge. Straight-line fallbacks are labelled in the route panel.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Cost per kilometre (₹)
              <input type="number" min="0" step="0.01" className={inputClass} {...register('cost_per_km', { valueAsNumber: true })} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Fixed delivery charge (₹)
              <input type="number" min="0" step="0.01" className={inputClass} {...register('fixed_delivery_charge', { valueAsNumber: true })} />
            </label>
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-600" />Rescue eligibility limits</span>} subtitle="The rescue engine uses these configured constraints. Approval remains required for every transfer request.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Minimum remaining shelf life (days)
              <input type="number" min="1" max="365" step="1" className={inputClass} {...register('min_shelf_life_days', { valueAsNumber: true })} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Maximum delivery radius (km)
              <input type="number" min="1" max="20000" step="0.1" className={inputClass} {...register('max_delivery_radius_km', { valueAsNumber: true })} />
            </label>
          </div>
        </Card>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" disabled={loading || saving} onClick={resetDefaults} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Load defaults
          </button>
          <button type="submit" disabled={loading || saving || !isDirty} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </AnimatedPage>
  );
};

export default SettingsPage;
