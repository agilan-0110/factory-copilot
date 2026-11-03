import React, { useState, useEffect } from 'react';
import { 
  Play, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  ShieldAlert, 
  TrendingUp, 
  Zap, 
  Sliders, 
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { api } from '../api/client';
import type { Reading, AssessmentResult, ReplayEvent } from '../types';

interface LiveMonitorProps {
  onIncidentCreated: () => void;
}

const DEFAULT_READING: Reading = {
  air_temperature_k: 298.1,
  process_temperature_k: 308.6,
  rotational_speed_rpm: 1551,
  torque_nm: 42.8,
  tool_wear_min: 0,
  product_type: 'L',
  profile_id: 'ai4i-demo-v1',
};

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ onIncidentCreated }) => {
  const [reading, setReading] = useState<Reading>(DEFAULT_READING);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scope, setScope] = useState<'benchmark_reference' | 'equipment_specific'>('benchmark_reference');
  
  // Replay state
  const [replaying, setReplaying] = useState(false);
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([]);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);

  // Load initial assessment and replay history
  useEffect(() => {
    handleAssess(DEFAULT_READING);
    loadReplayHistory();
  }, []);

  const loadReplayHistory = async () => {
    try {
      const history = await api.getReplayHistory();
      setReplayEvents(history.slice(-10).reverse());
    } catch {
      // ignore
    }
  };

  const handleAssess = async (currentReading = reading) => {
    setLoading(true);
    setIncidentMessage(null);
    try {
      const result = await api.explain(currentReading, scope);
      setAssessment(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = async (newScope: 'benchmark_reference' | 'equipment_specific') => {
    setScope(newScope);
    try {
      const result = await api.explain(reading, newScope);
      setAssessment(result);
    } catch (err: any) {
      console.error(err);
    }
  };

  const applyPreset = (presetName: string) => {
    let newReading: Reading;
    switch (presetName) {
      case 'nominal':
        newReading = { ...DEFAULT_READING };
        break;
      case 'overheat':
        newReading = {
          air_temperature_k: 302.8,
          process_temperature_k: 312.4,
          rotational_speed_rpm: 1390,
          torque_nm: 54.2,
          tool_wear_min: 65,
          product_type: 'M',
          profile_id: 'ai4i-demo-v1',
        };
        break;
      case 'high_wear':
        newReading = {
          air_temperature_k: 298.5,
          process_temperature_k: 308.7,
          rotational_speed_rpm: 1420,
          torque_nm: 49.0,
          tool_wear_min: 220,
          product_type: 'H',
          profile_id: 'ai4i-demo-v1',
        };
        break;
      case 'power_strain':
        newReading = {
          air_temperature_k: 299.2,
          process_temperature_k: 309.5,
          rotational_speed_rpm: 1210,
          torque_nm: 72.5,
          tool_wear_min: 135,
          product_type: 'L',
          profile_id: 'ai4i-demo-v1',
        };
        break;
      default:
        newReading = { ...DEFAULT_READING };
    }
    setReading(newReading);
    handleAssess(newReading);
  };

  const handleCreateIncident = async () => {
    setCreatingIncident(true);
    setIncidentMessage(null);
    try {
      const eventId = `manual-${Date.now().toString(36)}`;
      const res = await api.createIncident(reading, eventId);
      setIncidentMessage({
        type: 'success',
        text: `Incident ${res.id} created successfully! (Delivery status: ${res.delivery_status})`,
      });
      onIncidentCreated();
    } catch (err: any) {
      setIncidentMessage({ type: 'error', text: err.message || 'Failed to create incident' });
    } finally {
      setCreatingIncident(false);
    }
  };

  const handlePlayDemoReplay = async () => {
    setReplaying(true);
    setReplayStatus('Starting step 1/2: Low Score Nominal Sample...');
    try {
      // Step 1: Low Score
      const eventId1 = `replay-low-${Date.now()}`;
      const res1 = await api.replaySample('low_score', eventId1);
      setReplayStatus(`Step 1 complete: Probability ${(res1.assessment.probability * 100).toFixed(1)}% (${res1.action}). Waiting 2.5s for Step 2...`);
      await loadReplayHistory();

      // Step 2: High Score after delay
      setTimeout(async () => {
        try {
          setReplayStatus('Running step 2/2: High Score Anomaly Sample...');
          const eventId2 = `replay-high-${Date.now()}`;
          const res2 = await api.replaySample('high_score', eventId2);
          setReplayStatus(`Step 2 complete: Probability ${(res2.assessment.probability * 100).toFixed(1)}% -> Action: ${res2.action} (${res2.incident_id || 'linked'})`);
          await loadReplayHistory();
          onIncidentCreated();
        } catch (e: any) {
          setReplayStatus(`Error in step 2: ${e.message}`);
        } finally {
          setReplaying(false);
        }
      }, 2500);
    } catch (err: any) {
      setReplayStatus(`Error in replay: ${err.message}`);
      setReplaying(false);
    }
  };

  const prob = assessment?.probability ?? 0;
  const isFlagged = assessment?.flagged ?? false;
  const threshold = assessment?.threshold ?? 0.21;

  return (
    <div className="space-y-6">
      {/* Automated Demo Replay Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Stage 5 End-to-End Replay Player</h3>
            <p className="text-xs text-slate-400">
              Streams recorded AI4I validation samples (low score then high score) with 300s cooldown policy.
            </p>
            {replayStatus && (
              <p className="text-xs font-medium text-cyan-300 mt-1 animate-pulse">
                {replayStatus}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handlePlayDemoReplay}
          disabled={replaying}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          <span>{replaying ? 'Replaying Samples...' : 'Run 2-Sample Benchmark Demo'}</span>
        </button>
      </div>

      {replayEvents.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Recent Replay Activity</span>
            <span className="font-mono text-[11px]">{replayEvents.length} events logged</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {replayEvents.slice(0, 4).map((evt, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono flex items-center space-x-2">
                <span className="text-slate-300 capitalize">{evt.scenario}:</span>
                <span className="text-cyan-400 font-semibold">{evt.action}</span>
                <span className="text-slate-500">({(evt.assessment.probability * 100).toFixed(1)}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Inputs vs Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Parameter Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm text-slate-100">Telemetry Input Station</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Profile: ai4i-demo-v1</span>
            </div>

            {/* Presets */}
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Quick Scenario Presets</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyPreset('nominal')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-left"
                >
                  🟢 Nominal (Safe)
                </button>
                <button
                  onClick={() => applyPreset('overheat')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-left"
                >
                  🔥 Heat Dissipation
                </button>
                <button
                  onClick={() => applyPreset('high_wear')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-left"
                >
                  ⚙️ High Tool Wear
                </button>
                <button
                  onClick={() => applyPreset('power_strain')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-left"
                >
                  ⚡ Power Strain
                </button>
              </div>
            </div>

            {/* Sliders and number inputs */}
            <div className="space-y-3.5 pt-2">
              {/* Air Temp */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Air Temperature</span>
                  <span className="font-mono text-cyan-400 font-semibold">{reading.air_temperature_k} K ({(reading.air_temperature_k - 273.15).toFixed(1)} °C)</span>
                </div>
                <input
                  type="range"
                  min="295"
                  max="305"
                  step="0.1"
                  value={reading.air_temperature_k}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setReading(r => ({ ...r, air_temperature_k: val }));
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded h-1.5 cursor-pointer"
                />
              </div>

              {/* Process Temp */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Process Temperature</span>
                  <span className="font-mono text-cyan-400 font-semibold">{reading.process_temperature_k} K ({(reading.process_temperature_k - 273.15).toFixed(1)} °C)</span>
                </div>
                <input
                  type="range"
                  min="305"
                  max="315"
                  step="0.1"
                  value={reading.process_temperature_k}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setReading(r => ({ ...r, process_temperature_k: val }));
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded h-1.5 cursor-pointer"
                />
              </div>

              {/* Rotational Speed */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Rotational Speed</span>
                  <span className="font-mono text-cyan-400 font-semibold">{reading.rotational_speed_rpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="1150"
                  max="2900"
                  step="10"
                  value={reading.rotational_speed_rpm}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setReading(r => ({ ...r, rotational_speed_rpm: val }));
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded h-1.5 cursor-pointer"
                />
              </div>

              {/* Torque */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Torque</span>
                  <span className="font-mono text-cyan-400 font-semibold">{reading.torque_nm} Nm</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="80"
                  step="0.5"
                  value={reading.torque_nm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setReading(r => ({ ...r, torque_nm: val }));
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded h-1.5 cursor-pointer"
                />
              </div>

              {/* Tool Wear */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Tool Wear</span>
                  <span className="font-mono text-cyan-400 font-semibold">{reading.tool_wear_min} min</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="260"
                  step="1"
                  value={reading.tool_wear_min}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setReading(r => ({ ...r, tool_wear_min: val }));
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded h-1.5 cursor-pointer"
                />
              </div>

              {/* Product Type */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Product Quality Variant</span>
                  <span className="font-mono text-cyan-400 font-semibold">Variant {reading.product_type}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['L', 'M', 'H'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReading(r => ({ ...r, product_type: type }))}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                        reading.product_type === type
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      Type {type} ({type === 'L' ? '50%' : type === 'M' ? '30%' : '20%'})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 flex gap-2">
              <button
                onClick={() => handleAssess()}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-600/20 disabled:opacity-50"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{loading ? 'Evaluating...' : 'Re-Evaluate Reading'}</span>
              </button>

              <button
                onClick={handleCreateIncident}
                disabled={creatingIncident}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition flex items-center space-x-1 disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Open Incident</span>
              </button>
            </div>

            {incidentMessage && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                incidentMessage.type === 'success' 
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}>
                {incidentMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{incidentMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Assessment & Explainability (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Health Gauge & Score Card */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Classifier Assessment</h3>
                <p className="text-xs text-slate-400">Calibrated benchmark failure probability from 5,000 training rows</p>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 border ${
                isFlagged 
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800' 
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isFlagged ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
                <span>{isFlagged ? 'Anomaly Flagged' : 'Nominal State'}</span>
              </div>
            </div>

            {/* Score Bar with Threshold Marker */}
            <div className="space-y-2 pt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                  {(prob * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Alert Threshold: <span className="text-amber-400 font-semibold">{(threshold * 100).toFixed(1)}%</span>
                </span>
              </div>

              {/* Progress bar with marker */}
              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    prob >= threshold 
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, prob * 100))}%` }}
                />
              </div>

              {/* Legend */}
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>0.0% (Safe)</span>
                <span className="text-amber-400 font-medium">▲ F2 Cutoff: 21.0%</span>
                <span>100.0% (Failure)</span>
              </div>
            </div>
          </div>

          {/* SHAP Factors Section */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">SHAP Evidence Factors</h4>
                <p className="text-xs text-slate-400">Additive log-odds contributions explaining raw model output</p>
              </div>

              {assessment?.explanation?.status === 'available' && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Additivity Verified
                </span>
              )}
            </div>

            {assessment?.explanation?.status === 'available' ? (
              <div className="space-y-3">
                {assessment.explanation.top_factors?.map((f, idx) => {
                  const isPositive = f.contribution > 0;
                  const absVal = Math.abs(f.contribution);
                  const maxVal = 2.5; // scaling
                  const widthPercent = Math.min(100, (absVal / maxVal) * 100);

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200 capitalize">
                          {f.feature.replace(/_/g, ' ')}
                        </span>
                        <span className={`font-mono font-semibold flex items-center ${isPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                          {isPositive ? '+' : ''}{f.contribution.toFixed(3)}
                        </span>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${isPositive ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(5, widthPercent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Base Value: {assessment.explanation.base_value?.toFixed(3)}</span>
                    <span>Raw Output: {assessment.explanation.raw_output?.toFixed(3)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    {assessment.explanation.limitations}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-800/40 text-center text-xs text-slate-400">
                SHAP explanation unavailable for this record. Numerical probability is unaffected.
              </div>
            )}
          </div>

          {/* Educational Guidance & Reference Retrieval */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Curated Reference & Retrieval</h4>
                <p className="text-xs text-slate-400">Source provenance from AI4I dataset and Haas educational references</p>
              </div>

              {/* Abstention toggle */}
              <button
                onClick={() => handleScopeChange(scope === 'benchmark_reference' ? 'equipment_specific' : 'benchmark_reference')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                  scope === 'equipment_specific'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {scope === 'equipment_specific' ? '⚠️ Testing Abstention (Active)' : 'Test Equipment Abstention'}
              </button>
            </div>

            {assessment?.guidance?.status === 'reference_only' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/50 text-xs text-cyan-200">
                  {assessment.guidance.summary}
                </div>

                <div className="space-y-2">
                  {assessment.guidance.sources.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">[{s.id}] {s.source_title}</span>
                        <a 
                          href={s.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 text-xs"
                        >
                          <span>{s.section}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-xs text-slate-300">"{s.excerpt}"</p>
                      <p className="text-[11px] text-slate-400 italic">Applicability: {s.applicability}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 space-y-1">
                <p className="font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 mr-1 text-amber-400" />
                  <span>Abstention Triggered: Insufficient Evidence</span>
                </p>
                <p>
                  No verified equipment-specific inspection guidance available. As required for safety, the model abstains from inventing unvalidated repair steps. Technician inspection required.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
