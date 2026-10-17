import apiClient from './client';
import { AppSettings } from '../types';

interface SettingRecord {
  key: keyof AppSettings;
  value: string;
}

const mapSettings = (records: SettingRecord[]): AppSettings => {
  const values = Object.fromEntries(records.map((record) => [record.key, Number(record.value)]));
  return {
    cost_per_km: values.cost_per_km ?? 15,
    fixed_delivery_charge: values.fixed_delivery_charge ?? 500,
    min_shelf_life_days: values.min_shelf_life_days ?? 30,
    max_delivery_radius_km: values.max_delivery_radius_km ?? 800,
  };
};

export const settingsApi = {
  getSettings: async (): Promise<AppSettings> => {
    const response = await apiClient.get<SettingRecord[]>('/settings');
    return mapSettings(response.data);
  },

  updateSettings: async (settings: AppSettings): Promise<AppSettings> => {
    const response = await apiClient.put<SettingRecord[]>('/settings', {
      values: Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])),
    });
    return mapSettings(response.data);
  },
};
