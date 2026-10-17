import apiClient from './client';
import { AssistantMessage } from '../types';

interface AssistantResponse {
  answer: string;
  suggested_actions: string[];
  explanation?: string | null;
  explanation_provider?: string;
}

export interface ExplanationProvider { id: string; label: string; available: boolean }

export const assistantApi = {
  sendMessage: async (
    query: string,
    context?: { hospital_id?: string; user_role?: string },
    provider = 'rules',
  ): Promise<AssistantMessage> => {
    const response = await apiClient.post<AssistantResponse>('/assistant/query', {
      query,
      hospital_id: context?.hospital_id ? Number(context.hospital_id) : undefined,
      provider,
    });
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response.data.answer,
      timestamp: new Date().toISOString(),
      suggested_actions: response.data.suggested_actions,
      explanation: response.data.explanation ?? undefined,
      explanation_provider: response.data.explanation_provider ?? 'rules',
    };
  },

  getProviders: async (): Promise<ExplanationProvider[]> => {
    const response = await apiClient.get<{ providers: ExplanationProvider[] }>('/assistant/providers');
    return response.data.providers;
  },
};
