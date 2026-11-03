import React from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Cpu, 
  BarChart3, 
  FileText, 
  MessageSquare,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  health: { status: string; stage: number; model_ready: boolean; messaging: string } | null;
  incidentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  incidentCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">FACTORY COPILOT</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  STAGE {health?.stage || 5}
                </span>
              </div>
              <p className="text-xs text-slate-400">Machine Health • SHAP Explainability • Maintenance Lifecycle</p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className={`w-2 h-2 rounded-full ${health?.model_ready ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-slate-300 font-medium">Model:</span>
              <span className="text-slate-100 font-semibold">{health?.model_ready ? 'Calibrated HGB (21% Threshold)' : 'Offline'}</span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300 font-medium">WhatsApp:</span>
              <span className={`font-semibold ${health?.messaging === 'configured' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {health?.messaging === 'configured' ? 'Live Sandbox' : 'Simulated Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 -mb-px overflow-x-auto pt-1">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center space-x-2 py-2.5 px-4 border-b-2 text-sm font-medium transition-all ${
              activeTab === 'monitor'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Monitor & Replay</span>
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center space-x-2 py-2.5 px-4 border-b-2 text-sm font-medium transition-all ${
              activeTab === 'incidents'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Incidents & Workflow</span>
            {incidentCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                {incidentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center space-x-2 py-2.5 px-4 border-b-2 text-sm font-medium transition-all ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Machine Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center space-x-2 py-2.5 px-4 border-b-2 text-sm font-medium transition-all ${
              activeTab === 'evaluation'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Model Evaluation</span>
          </button>
        </div>
      </div>
    </header>
  );
};
