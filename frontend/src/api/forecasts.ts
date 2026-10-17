import apiClient from './client';

export interface EnvironmentalBreakdown {
  season: string;
  temperature_celsius: number;
  humidity_percentage: number;
  aqi: number;
  outbreak_risk: string;
  combined_multiplier: number;
  season_factor: number;
  season_reason: string;
  temperature_factor: number;
  temperature_reason: string;
  humidity_factor: number;
  humidity_reason: string;
  aqi_factor: number;
  aqi_reason: string;
  outbreak_factor: number;
  outbreak_reason: string;
}

export interface FactAuditItem {
  metric: string;
  value: string;
}

export interface FeatureImportanceItem {
  feature: string;
  weight_pct: number;
}

export interface ExplainableAIData {
  provider: string;
  explanation: string;
  grounding_audit: FactAuditItem[];
  guaranteed_accuracy: string;
  feature_importance: FeatureImportanceItem[];
}

export interface QuantityForecast {
  hospital_id: number;
  hospital_name: string;
  bed_capacity?: number;
  medicine_id: number;
  medicine_name: string;
  generic_name?: string;
  category?: string;
  horizon_days: number;
  current_stock_units: number;
  baseline_quantity?: number;
  forecast_quantity: number;
  recommended_replenishment: number;
  daily_demand_per_bed?: number;
  data_support: string;
  recorded_demand_count?: number;
  environment: EnvironmentalBreakdown;
  explainable_ai: ExplainableAIData;
  explanation: string;
  confidence_note: string;
}

export interface ForecastRequestParams {
  medicineId: string | number;
  hospitalId?: string | number;
  horizonDays?: number;
  season?: string;
  temperature?: number;
  humidity?: number;
  aqi?: number;
  outbreakRisk?: string;
  provider?: string;
}

export interface HospitalForecastItem {
  medicine_id: number;
  medicine_name: string;
  generic_name?: string;
  strength?: string;
  category?: string;
  dosage_form?: string;
  current_stock: number;
  baseline_demand: number;
  environmental_multiplier: number;
  predicted_demand: number;
  gap: number;
  status: 'critical_deficit' | 'moderate_deficit' | 'adequate' | 'surplus';
  urgency_score: number;
  action: string;
  environmental_reasons: string[];
}

export interface HospitalForecastSummary {
  hospital_id: number;
  hospital_name: string;
  hospital_city: string;
  bed_capacity: number;
  horizon_days: number;
  environment: {
    season: string;
    temperature_celsius: number;
    humidity_percentage: number;
    aqi: number;
    outbreak_risk: string;
  };
  summary: {
    total_medicines_analyzed: number;
    critical_deficit_count: number;
    total_predicted_units: number;
    total_deficit_units: number;
  };
  predictions: HospitalForecastItem[];
}

export const forecastsApi = {
  quantity: async (params: ForecastRequestParams): Promise<QuantityForecast> => {
    const response = await apiClient.get<QuantityForecast>('/forecasts/quantity', {
      params: {
        medicine_id: params.medicineId,
        hospital_id: params.hospitalId,
        horizon_days: params.horizonDays || 30,
        season: params.season,
        temperature: params.temperature,
        humidity: params.humidity,
        aqi: params.aqi,
        outbreak_risk: params.outbreakRisk,
        provider: params.provider || 'rules',
      },
    });
    return response.data;
  },

  getHospitalSummary: async (params: Omit<ForecastRequestParams, 'medicineId'>): Promise<HospitalForecastSummary> => {
    const response = await apiClient.get<HospitalForecastSummary>('/forecasts/hospital-summary', {
      params: {
        hospital_id: params.hospitalId,
        horizon_days: params.horizonDays || 30,
        season: params.season,
        temperature: params.temperature,
        humidity: params.humidity,
        aqi: params.aqi,
        outbreak_risk: params.outbreakRisk,
      },
    });
    return response.data;
  },
};

