import React, { useState, useEffect } from 'react';
import { 
  Settings2, 
  Info,
  Layers,
  Thermometer,
  RotateCw,
  Gauge,
  Wrench
} from 'lucide-react';
import { api } from '../api/client';
import type { MachineProfile } from '../types';

export const MachineProfileView: React.FC = () => {
  const [profile, setProfile] = useState<MachineProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading machine profile specifications...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white">{profile?.name || 'AI4I Demonstration Milling Station'}</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              {profile?.profile_id || 'ai4i-demo-v1'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {profile?.description || 'Calibrated synthetic benchmark machine representing standard 3-axis CNC milling operations.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-right">
            <span className="text-[11px] text-slate-400 block">Alert Threshold</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {profile?.alert_threshold !== undefined ? `${(profile.alert_threshold * 100).toFixed(1)}%` : '21.0%'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-right">
            <span className="text-[11px] text-slate-400 block">Cooldown Window</span>
            <span className="text-base font-bold font-mono text-cyan-400">
              {profile?.replay_cooldown_seconds || 300}s
            </span>
          </div>
        </div>
      </div>

      {/* Operating Ranges Grid */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Settings2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-100">Declared Input Envelope & Operating Ranges</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Thermometer className="w-4 h-4 text-rose-400" />
              <span>Air Temperature</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Nominal Range:</span> <span className="text-cyan-400 font-bold">295.3 - 304.5 K</span></div>
              <div className="flex justify-between text-slate-400"><span>Celsius Equivalent:</span> <span>22.1 - 31.4 °C</span></div>
              <div className="flex justify-between text-slate-500"><span>Bounds Check:</span> <span>[250.0, 350.0] K</span></div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Thermometer className="w-4 h-4 text-amber-400" />
              <span>Process Temperature</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Nominal Range:</span> <span className="text-cyan-400 font-bold">305.7 - 313.8 K</span></div>
              <div className="flex justify-between text-slate-400"><span>Celsius Equivalent:</span> <span>32.5 - 40.7 °C</span></div>
              <div className="flex justify-between text-slate-500"><span>Bounds Check:</span> <span>[250.0, 350.0] K</span></div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <RotateCw className="w-4 h-4 text-blue-400" />
              <span>Rotational Speed</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Operating Range:</span> <span className="text-cyan-400 font-bold">1168 - 2886 RPM</span></div>
              <div className="flex justify-between text-slate-400"><span>Normal Median:</span> <span>1503 RPM</span></div>
              <div className="flex justify-between text-slate-500"><span>Bounds Check:</span> <span>[500, 5000] RPM</span></div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Gauge className="w-4 h-4 text-purple-400" />
              <span>Spindle Torque</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Operating Range:</span> <span className="text-cyan-400 font-bold">3.8 - 76.6 Nm</span></div>
              <div className="flex justify-between text-slate-400"><span>Normal Median:</span> <span>40.1 Nm</span></div>
              <div className="flex justify-between text-slate-500"><span>Bounds Check:</span> <span>[1.0, 150.0] Nm</span></div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>Tool Wear</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Operating Lifetime:</span> <span className="text-cyan-400 font-bold">0 - 253 min</span></div>
              <div className="flex justify-between text-slate-400"><span>Failure Window:</span> <span>200 - 240 min</span></div>
              <div className="flex justify-between text-slate-500"><span>Bounds Check:</span> <span>[0, 500] min</span></div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Product Quality Variants</span>
            </div>
            <div className="text-xs space-y-1 font-mono text-slate-300">
              <div className="flex justify-between"><span>Variant L (Low):</span> <span className="text-cyan-400 font-bold">50% volume</span></div>
              <div className="flex justify-between"><span>Variant M (Medium):</span> <span>30% volume</span></div>
              <div className="flex justify-between"><span>Variant H (High):</span> <span>20% volume</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Failure Mode Engineering Definitions */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-100">Benchmark Failure Mode Physics (AI4I Synthetic Labels)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Tool Wear Failure (TWF)</span>
            <p className="text-slate-400">Occurs when tool wear reaches between 200 and 240 minutes, causing tool replacement requirement.</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Heat Dissipation Failure (HDF)</span>
            <p className="text-slate-400">Triggered when air-process temperature difference is &lt; 8.6 K while rotational speed is below 1380 RPM.</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Power Failure (PWF)</span>
            <p className="text-slate-400">Occurs when mechanical power (Torque × Rotational Speed × 2π / 60) falls outside the 3500 W – 9000 W operating envelope.</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Overstrain Failure (OSF)</span>
            <p className="text-slate-400">Occurs when the product of tool wear and torque exceeds variant strain limits (11,000 for L, 12,000 for M, 13,000 for H min·Nm).</p>
          </div>
        </div>
      </div>
    </div>
  );
};
