import type {
  Reading,
  AssessmentResult,
  Incident,
  AuditEvent,
  MachineProfile,
  EvaluationMetrics,
  ReplayEvent,
  FleetMachine,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = `Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) errorDetail = errorJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  getHealth: () => request<{ status: string; stage: number; model_ready: boolean; messaging: string }>('/health'),
  
  getFleet: () => request<FleetMachine[]>('/fleet'),

  tickFleet: () => request<FleetMachine[]>('/fleet/tick', { method: 'POST' }),

  injectFault: (machine_id: string, mode?: string) =>
    request<{ machine_id: string; mode?: string }>(`/fleet/machines/${machine_id}/inject-fault${mode ? `?mode=${mode}` : ''}`, {
      method: 'POST',
    }),

  replaceTool: (machine_id: string) =>
    request<{ machine_id: string; status: string }>(`/fleet/machines/${machine_id}/replace-tool`, {
      method: 'POST',
    }),

  getProfile: () => request<MachineProfile>('/profile'),
  
  validateReading: (reading: Reading) => 
    request<{ valid: boolean; reading: Reading; assessment_status: string }>('/readings/validate', {
      method: 'POST',
      body: JSON.stringify(reading),
    }),

  assess: (reading: Reading) => 
    request<AssessmentResult>('/predict', {
      method: 'POST',
      body: JSON.stringify(reading),
    }),

  explain: (reading: Reading, scope: 'benchmark_reference' | 'equipment_specific' = 'benchmark_reference') =>
    request<AssessmentResult>('/explain', {
      method: 'POST',
      body: JSON.stringify({ reading, scope }),
    }),

  getIncidents: () => request<Incident[]>('/incidents'),

  createIncident: (reading: Reading, event_id: string) =>
    request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify({ reading, event_id }),
    }),

  getIncidentHistory: (id: string) => request<AuditEvent[]>(`/incidents/${id}/history`),

  simulateReply: (id: string, command: number, source = 'simulated') =>
    request<{ success: boolean; new_status: string }>(`/incidents/${id}/simulate-reply`, {
      method: 'POST',
      body: JSON.stringify({ command, raw_command: String(command), source }),
    }),

  getNotificationPreview: (id: string) => 
    request<{ mode: string; text: string; configured: boolean }>(`/incidents/${id}/notification-preview`),

  sendWhatsApp: (id: string) =>
    request<{ status: string; duplicate: boolean }>(`/incidents/${id}/notify`, {
      method: 'POST',
    }),

  refreshDelivery: (id: string) =>
    request<{ status: string; provider_sid?: string }>(`/incidents/${id}/refresh-delivery`, {
      method: 'POST',
    }),

  replaySample: (scenario: 'low_score' | 'high_score', event_id: string) =>
    request<ReplayEvent>('/replay', {
      method: 'POST',
      body: JSON.stringify({ scenario, event_id }),
    }),

  getReplayHistory: () => request<ReplayEvent[]>('/replay'),

  getEvaluation: () => request<EvaluationMetrics>('/evaluation'),

  getSamples: () => request<Array<{ name: string; label: string; reading: Reading }>>('/samples'),
};
