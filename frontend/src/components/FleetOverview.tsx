import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Cpu, 
  Flame, 
  Play, 
  Pause, 
  ShieldAlert, 
  Wrench, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Bot,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { FleetMachine } from '../types';

interface FleetOverviewProps {
  onSelectMachineIncident: (incidentId: string) => void;
  onNavigateToIncidents: () => void;
  onOpenCopilotForMachine?: (machineId: string) => void;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({ 
  onNavigateToIncidents,
  onOpenCopilotForMachine,
}) => {
  const [fleet, setFleet] = useState<FleetMachine[]>([]);
  const [selectedId, setSelectedId] = useState<string>('M-01');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const streamInterval = 2000;
  const [loading, setLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadFleet();
  }, []);

  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.tickFleet();
        setFleet(updated);
      } catch (err) {
        console.error('Fleet tick error:', err);
      }
    }, streamInterval);

    return () => clearInterval(interval);
  }, [isLiveStreaming, streamInterval]);

  const loadFleet = async () => {
    setLoading(true);
    try {
      const data = await api.getFleet();
      setFleet(data);
    } catch (err) {
      console.error('Failed to load fleet:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualTick = async () => {
    setLoading(true);
    try {
      const updated = await api.tickFleet();
      setFleet(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInjectFault = async (machineId: string, mode: string | null) => {
    try {
      await api.injectFault(machineId, mode || undefined);
      setActionNotice(mode ? `Fault injected on ${machineId}: ${mode.replace('_', ' ').toUpperCase()}` : `Fault cleared on ${machineId}`);
      setTimeout(() => setActionNotice(null), 4000);
      handleManualTick();
    } catch (err: any) {
      setActionNotice(`Failed: ${err.message}`);
    }
  };

  const handleReplaceTool = async (machineId: string) => {
    try {
      await api.replaceTool(machineId);
      setActionNotice(`Tool replaced on ${machineId}. Tool wear reset to 0 min.`);
      setTimeout(() => setActionNotice(null), 4000);
      handleManualTick();
    } catch (err: any) {
      setActionNotice(`Failed: ${err.message}`);
    }
  };

  const selectedMachine = fleet.find(m => m.machine_id === selectedId) || fleet[0];

  const nominalCount = fleet.filter(m => m.status === 'nominal').length;
  const warningCount = fleet.filter(m => m.status === 'warning').length;
  const criticalCount = fleet.filter(m => m.status === 'critical').length;
  const fleetHealth = Math.round(((nominalCount * 1.0 + warningCount * 0.5) / (fleet.length || 10)) * 100);

  if (fleet.length === 0) {
    return (
      <div className="p-16 text-center text-slate-400 space-y-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-200">Connecting to Plant Floor Telemetry Stream...</p>
        <p className="text-xs text-slate-500">Establishing real-time sensor loop for 10 stations</p>
      </div>
    );
  }

  const line1 = fleet.filter(m => ['M-01', 'M-02', 'M-03', 'M-04', 'M-05'].includes(m.machine_id));
  const line2 = fleet.filter(m => ['M-06', 'M-07', 'M-08', 'M-09', 'M-10'].includes(m.machine_id));

  return (
    <div className="space-y-6">
      {/* Top Plant KPI Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Plant Production Floor (10 CNC Stations)</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-800 text-slate-300 border border-slate-700">
                2.0s Telemetry Poll
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous thermal drift, spindle load dynamics, tool flank wear, and automated incident triage.
            </p>
          </div>
        </div>

        {/* Status Breakdown & Stream Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-emerald-400 font-semibold">{nominalCount} Nominal</span>
            <span className="text-slate-700">•</span>
            <span className="text-amber-400 font-semibold">{warningCount} Warning</span>
            <span className="text-slate-700">•</span>
            <span className="text-rose-400 font-semibold">{criticalCount} Critical</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Plant Health: </span>
            <span className={`font-bold ${fleetHealth >= 85 ? 'text-emerald-400' : fleetHealth >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
              {fleetHealth}%
            </span>
          </div>

          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              isLiveStreaming
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Pause className="w-3.5 h-3.5" />
                <span>Live Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Paused</span>
              </>
            )}
          </button>

          <button
            onClick={handleManualTick}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Tick 1 Cycle</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800 text-blue-200 text-xs font-mono flex items-center justify-between">
          <span>⚡ {actionNotice}</span>
          <span className="text-[11px] text-blue-300 font-sans">Active</span>
        </div>
      )}

      {/* Main Floor Layout: 10-Station Grid (8 cols) vs Inspector Drawer (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Floor Cards (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Line 1 Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Line 1: Heavy Roughing &amp; Contouring (Stations M-01 to M-05)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Product Variants L &amp; M</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {line1.map((m) => renderMachineCard(m))}
            </div>
          </div>

          {/* Line 2 Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Line 2: High-Precision &amp; Finishing (Stations M-06 to M-10)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Product Variants M &amp; H</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {line2.map((m) => renderMachineCard(m))}
            </div>
          </div>
        </div>

        {/* Selected Machine Inspector (4 cols) */}
        <div className="lg:col-span-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 sticky top-20 shadow-sm">
            {/* Inspector Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white font-mono">{selectedMachine.machine_id}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    selectedMachine.status === 'critical'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                      : selectedMachine.status === 'warning'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}>
                    {selectedMachine.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMachine.name}</p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-500 block">Failure Risk</span>
                <span className={`text-base font-bold ${
                  (selectedMachine.assessment?.probability ?? 0) >= 0.21 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {((selectedMachine.assessment?.probability ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Ask Copilot for this Machine Action */}
            <button
              onClick={() => onOpenCopilotForMachine?.(selectedMachine.machine_id)}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ask Copilot about {selectedMachine.machine_id}</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </button>

            {/* Live Measurements */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Live Telemetry</span>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                  <span className="text-slate-500">Air Temp:</span>
                  <span>{selectedMachine.reading.air_temperature_k} K</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                  <span className="text-slate-500">Process Temp:</span>
                  <span>{selectedMachine.reading.process_temperature_k} K</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                  <span className="text-slate-500">Spindle Speed:</span>
                  <span>{selectedMachine.reading.rotational_speed_rpm} RPM</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                  <span className="text-slate-500">Torque:</span>
                  <span>{selectedMachine.reading.torque_nm} Nm</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                  <span className="text-slate-500">Tool Wear:</span>
                  <span className={`font-semibold ${selectedMachine.tool_wear_min >= 200 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {selectedMachine.tool_wear_min} min
                  </span>
                </div>
              </div>
            </div>

            {/* SHAP Factors */}
            {selectedMachine.assessment?.explanation?.status === 'available' && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Top SHAP Log-Odds Factors</span>
                <div className="space-y-1">
                  {selectedMachine.assessment.explanation.top_factors?.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-950">
                      <span className="text-slate-300 capitalize text-[11px]">{f.feature.replace(/_/g, ' ')}</span>
                      <span className={`font-mono text-xs font-semibold flex items-center ${f.contribution > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {f.contribution > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {f.contribution > 0 ? '+' : ''}{f.contribution.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Incident Alert */}
            {selectedMachine.active_incident_id && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Incident Opened</span>
                  </span>
                  <span className="font-mono text-rose-300 font-bold">{selectedMachine.active_incident_id}</span>
                </div>
                <button
                  onClick={onNavigateToIncidents}
                  className="w-full py-1.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-medium flex items-center justify-center space-x-1 transition"
                >
                  <span>Review in Incidents</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Maintenance & Stress Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Station Maintenance &amp; Stress</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'overheat')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="truncate text-[11px]">Overheat</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'wear_spike')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate text-[11px]">Tool Wear Spike</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'power_strain')}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate text-[11px]">Power Strain</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, null)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate text-[11px]">Clear Fault</span>
                </button>
              </div>

              <button
                onClick={() => handleReplaceTool(selectedMachine.machine_id)}
                className="w-full py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Replace Tool (Reset Flank Wear)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function renderMachineCard(m: FleetMachine) {
    const isSelected = selectedId === m.machine_id;
    const prob = m.assessment?.probability ?? 0;
    const isCritical = m.status === 'critical';
    const isWarning = m.status === 'warning';

    return (
      <div
        key={m.machine_id}
        onClick={() => setSelectedId(m.machine_id)}
        className={`p-3.5 rounded-xl border cursor-pointer transition space-y-2.5 ${
          isSelected
            ? 'bg-slate-800/90 border-blue-500 shadow-md shadow-blue-900/10'
            : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold font-mono text-white">{m.machine_id}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                Var {m.product_type}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-[170px]">{m.name}</p>
          </div>

          <div className="text-right">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              isCritical
                ? 'bg-rose-950/60 text-rose-300 border-rose-800 animate-pulse'
                : isWarning
                ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
            }`}>
              {m.status}
            </span>
          </div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono bg-slate-950 p-2 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-slate-500 text-[10px] block">Speed</span>
            <span className="text-slate-200 font-medium">{m.reading.rotational_speed_rpm} RPM</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Torque</span>
            <span className="text-slate-200 font-medium">{m.reading.torque_nm} Nm</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Proc. Temp</span>
            <span className="text-slate-200 font-medium">{m.reading.process_temperature_k} K</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Tool Wear</span>
            <span className={`font-medium ${m.tool_wear_min >= 200 ? 'text-rose-400' : 'text-slate-200'}`}>
              {m.tool_wear_min} min
            </span>
          </div>
        </div>

        {/* Failure Risk Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-slate-400">Failure Risk</span>
            <span className={`font-bold ${prob >= 0.21 ? 'text-rose-400' : prob >= 0.12 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(prob * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                prob >= 0.21 ? 'bg-rose-500' : prob >= 0.12 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, prob * 100))}%` }}
            />
          </div>
        </div>

        {/* Card Footer: Ask Copilot trigger */}
        <div className="pt-1 flex items-center justify-between text-[11px] border-t border-slate-800/60">
          <span className="text-slate-500 font-mono text-[10px]">
            {m.fault_mode ? `⚠️ ${m.fault_mode}` : 'Nominal profile'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCopilotForMachine?.(m.machine_id);
            }}
            className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition"
          >
            <Bot className="w-3 h-3" />
            <span>Ask Copilot</span>
          </button>
        </div>
      </div>
    );
  }
};
