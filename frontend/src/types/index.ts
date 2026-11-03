export interface Reading {
  air_temperature_k: number;
  process_temperature_k: number;
  rotational_speed_rpm: number;
  torque_nm: number;
  tool_wear_min: number;
  product_type: 'L' | 'M' | 'H';
  profile_id?: string;
  machine_id?: string;
}

export interface MachineTelemetryHistory {
  timestamp: string;
  air_temperature_k: number;
  process_temperature_k: number;
  rotational_speed_rpm: number;
  torque_nm: number;
  tool_wear_min: number;
  probability: number;
}

export interface FleetMachine {
  machine_id: string;
  name: string;
  product_type: 'L' | 'M' | 'H';
  status: 'nominal' | 'warning' | 'critical';
  reading: Reading;
  assessment?: AssessmentResult | null;
  tool_wear_min: number;
  fault_mode?: string | null;
  active_incident_id?: string | null;
  history: MachineTelemetryHistory[];
}

export interface Factor {
  feature: string;
  contribution: number;
  sign: string;
}

export interface ExplanationResult {
  status: 'available' | 'unavailable';
  factors?: Factor[];
  top_factors?: Factor[];
  base_value?: number;
  raw_output?: number;
  output_scale?: string;
  limitations?: string;
}

export interface Source {
  id: string;
  source_title: string;
  url: string;
  section: string;
  excerpt: string;
  applicability: string;
}

export interface InspectionGuidance {
  evidence_id: string;
  text: string;
}

export interface GuidanceResult {
  status: 'reference_only' | 'insufficient_evidence';
  mode: string;
  summary: string;
  sources: Source[];
  evidence_ids: string[];
  inspection_guidance: InspectionGuidance[];
  equipment_match: boolean;
  limitations: string;
  corpus_sha256?: string;
}

export interface AssessmentResult {
  probability: number;
  flagged: boolean;
  threshold: number;
  model_version: string;
  explanation?: ExplanationResult;
  model_evidence?: Factor[];
  guidance?: GuidanceResult;
}

export interface Incident {
  id: string;
  event_id: string;
  reading: Reading;
  status: 'new' | 'acknowledged' | 'confirmed' | 'no_issue' | 'inconclusive' | 'resolved';
  delivery_status: 'not_sent' | 'sending' | 'provider_accepted' | 'unknown' | 'delivered' | 'failed';
  provider_sid?: string | null;
  probability?: number | null;
  threshold?: number | null;
  model_version?: string | null;
  model_evidence?: Factor[];
  guidance?: GuidanceResult;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  incident_id: string;
  from_status: string;
  to_status: string;
  action_code: number;
  raw_command: string;
  source: 'simulated' | 'whatsapp' | 'system';
  created_at: string;
}

export interface MachineProfile {
  machine_id: string;
  profile_id: string;
  name: string;
  description: string;
  operating_ranges: {
    air_temperature_k: { min: number; max: number; unit: string };
    process_temperature_k: { min: number; max: number; unit: string };
    rotational_speed_rpm: { min: number; max: number; unit: string };
    torque_nm: { min: number; max: number; unit: string };
    tool_wear_min: { min: number; max: number; unit: string };
  };
  model_id?: string;
  alert_threshold?: number;
  dataset?: string;
  messaging_mode?: string;
  replay_cooldown_seconds?: number;
}

export interface EvaluationMetrics {
  version: string;
  test_rows: number;
  selected_model: string;
  threshold: number;
  metrics: {
    average_precision: number;
    precision: number;
    recall: number;
    f2_score?: number;
    brier_score: number;
    confusion: {
      tn: number;
      fp: number;
      fn: number;
      tp: number;
    };
  };
  rule_baseline: {
    confusion: {
      tn: number;
      fp: number;
      fn: number;
      tp: number;
    };
  };
}

export interface ReplayEvent {
  event_id: string;
  scenario: string;
  action: string;
  duplicate: boolean;
  incident_id?: string | null;
  assessment: {
    probability: number;
    flagged: boolean;
  };
  created_at?: string;
}
