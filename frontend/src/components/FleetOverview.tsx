import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Cpu, 
  Flame, 
  Play, 
  Pause, 
  ShieldAlert, 
  Sliders, 
  Wrench, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';
import { api } from '../api/client';
import type { FleetMachine } from '../types';

interface FleetOverviewProps {
  onSelectMachineIncident: (incidentId: string) => void;
  onNavigateToIncidents: () => void;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({ 
  onSelectMachineIncident: _onSelectMachineIncident,
  onNavigateToIncidents 
}) => {
  const [fleet, setFleet] = useState<FleetMachine[]>([]);
  const [selectedId, setSelectedId] = useState<string>('M-01');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const streamInterval = 2000; // 2 seconds continuous live tick
  const [loading, setLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    loadFleet();
  }, []);

  // Continuous live stream interval
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
      setActionNotice(`Tool replaced on ${machineId}. Wear reset to 0.0 min.`);
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

  return (
    <div className="space-y-6">
      {/* Top Plant KPI & Continuous Stream Controller */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-md flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">INDUSTRIAL PLANT FLEET: 10 CNC STATIONS</h2>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                LIVE TELEMETRY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous multi-machine sensor measurements, tool wear accumulation, and real-time failure classification.
            </p>
          </div>
        </div>

        {/* Live Controls & Fleet Summary */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Breakdown Pills */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
            <span className="text-emerald-400 font-bold">{nominalCount} Normal</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-bold">{warningCount} Warning</span>
            <span className="text-slate-600">•</span>
            <span className="text-rose-400 font-bold">{criticalCount} Critical</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
            <span className="text-slate-400">Plant Health: </span>
            <span className={`font-bold ${fleetHealth >= 85 ? 'text-emerald-400' : fleetHealth >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
              {fleetHealth}%
            </span>
          </div>

          {/* Toggle Streaming Button */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              isLiveStreaming
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800 shadow-sm shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Pause className="w-3.5 h-3.5" />
                <span>Live Streaming (2s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Stream Paused</span>
              </>
            )}
          </button>

          <button
            onClick={handleManualTick}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Step Cycle</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-200 text-xs font-mono animate-fadeIn flex items-center justify-between">
          <span>⚡ {actionNotice}</span>
          <span className="text-[11px] text-cyan-400 font-sans">Active</span>
        </div>
      )}

      {/* Main Grid: 10-Machine Fleet Grid (8 cols) vs Selected Machine Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Fleet Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Plant Floor Grid (10 Stations)</span>
            </h3>
            <span className="text-xs text-slate-400">Click any machine to inspect</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {fleet.map((m) => {
              const isSelected = selectedId === m.machine_id;
              const prob = m.assessment?.probability ?? 0;
              const isCritical = m.status === 'critical';
              const isWarning = m.status === 'warning';

              return (
                <div
                  key={m.machine_id}
                  onClick={() => setSelectedId(m.machine_id)}
                  className={`p-4 rounded-xl border cursor-pointer transition relative space-y-3 ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900 hover:bg-slate-800/50 border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold font-mono text-white">{m.machine_id}</span>
                        <span className="text-[11px] text-slate-400">Variant {m.product_type}</span>
                      </div>
                      <p className="text-xs text-slate-300 truncate max-w-[190px]">{m.name}</p>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        isCritical
                          ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                          : isWarning
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {m.status}
                      </span>
                      {m.fault_mode && (
                        <span className="block text-[10px] font-mono text-rose-400 font-semibold mt-0.5">
                          Fault: {m.fault_mode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Real-time Telemetry Snapshot */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Proc. Temp</span>
                      <span className="text-slate-200 font-semibold">{m.reading.process_temperature_k} K</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Speed</span>
                      <span className="text-slate-200 font-semibold">{m.reading.rotational_speed_rpm} RPM</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Torque</span>
                      <span className="text-slate-200 font-semibold">{m.reading.torque_nm} Nm</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Tool Wear</span>
                      <span className={`font-semibold ${m.tool_wear_min >= 200 ? 'text-rose-400' : m.tool_wear_min >= 150 ? 'text-amber-400' : 'text-slate-200'}`}>
                        {m.tool_wear_min} min
                      </span>
                    </div>
                  </div>

                  {/* Failure Probability Bar */}
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
                        style={{ width: `${Math.min(100, Math.max(3, prob * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Mini Trend Line from History */}
                  {m.history && m.history.length > 2 && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Recent 15-cycle risk:</span>
                      <div className="flex items-end space-x-1 h-4">
                        {m.history.map((h, idx) => {
                          const height = Math.max(2, Math.min(16, h.probability * 16));
                          return (
                            <div
                              key={idx}
                              className={`w-1 rounded-sm ${h.probability >= 0.21 ? 'bg-rose-500' : h.probability >= 0.12 ? 'bg-amber-500' : 'bg-cyan-500/60'}`}
                              style={{ height: `${height}px` }}
                              title={`Cycle ${idx}: ${(h.probability * 100).toFixed(1)}%`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Machine Inspector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-5 sticky top-20">
            {/* Inspector Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white font-mono">{selectedMachine.machine_id}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    selectedMachine.status === 'critical'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : selectedMachine.status === 'warning'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}>
                    {selectedMachine.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{selectedMachine.name}</p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-500 block">Current Risk</span>
                <span className={`text-lg font-bold ${
                  (selectedMachine.assessment?.probability ?? 0) >= 0.21 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {((selectedMachine.assessment?.probability ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Live Measurements */}
            <div className="space-y-2 text-xs">
              <span className="text-xs font-semibold text-slate-300 block">Live Telemetry Readings</span>
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Air Temperature:</span>
                  <span className="text-slate-200">{selectedMachine.reading.air_temperature_k} K</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Process Temperature:</span>
                  <span className="text-slate-200">{selectedMachine.reading.process_temperature_k} K</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Rotational Speed:</span>
                  <span className="text-slate-200">{selectedMachine.reading.rotational_speed_rpm} RPM</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Spindle Torque:</span>
                  <span className="text-slate-200">{selectedMachine.reading.torque_nm} Nm</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Tool Wear:</span>
                  <span className={`font-bold ${selectedMachine.tool_wear_min >= 200 ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {selectedMachine.tool_wear_min} min
                  </span>
                </div>
              </div>
            </div>

            {/* Live SHAP Explanation for this machine */}
            {selectedMachine.assessment?.explanation?.status === 'available' && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Top Contributing Factors (SHAP)</span>
                <div className="space-y-1.5">
                  {selectedMachine.assessment.explanation.top_factors?.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-800/40">
                      <span className="text-slate-300 capitalize">{f.feature.replace(/_/g, ' ')}</span>
                      <span className={`font-mono font-bold flex items-center ${f.contribution > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {f.contribution > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {f.contribution > 0 ? '+' : ''}{f.contribution.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Incident Link */}
            {selectedMachine.active_incident_id && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300 flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    <span>Active Incident Opened</span>
                  </span>
                  <span className="font-mono text-rose-400">{selectedMachine.active_incident_id}</span>
                </div>
                <button
                  onClick={onNavigateToIncidents}
                  className="w-full py-1.5 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs font-medium flex items-center justify-center space-x-1"
                >
                  <span>Open in Incidents Tab</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Fault Injection Simulation Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block">Plant Stress Testing (Inject Condition)</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'overheat')}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="truncate">Overheat Anomaly</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'wear_spike')}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Tool Wear Spike</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, 'power_strain')}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Power Strain</span>
                </button>

                <button
                  onClick={() => handleInjectFault(selectedMachine.machine_id, null)}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center space-x-1 transition text-left"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Clear Fault</span>
                </button>
              </div>

              {/* Maintenance Action */}
              <button
                onClick={() => handleReplaceTool(selectedMachine.machine_id)}
                className="w-full py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Replace Tool (Reset Wear to 0 min)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
