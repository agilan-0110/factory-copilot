import React from 'react';
import { 
  Cpu, 
  Layers, 
  AlertTriangle, 
  BarChart3, 
  Bot, 
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  health: { status: string; stage: number; model_ready: boolean; messaging: string } | null;
  incidentCount: number;
  onToggleCopilot: () => void;
  isCopilotOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  incidentCount,
  onToggleCopilot,
  isCopilotOpen,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Factory Status */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-slate-900 font-mono">FACTORY COPILOT</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  PLANT 01
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700 font-medium">10 Stations Active</span>
                </span>
                <span>•</span>
                <span>Calibrated ML Classifier (21.0% Threshold)</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Pills */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'fleet'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Plant Floor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">10</span>
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'incidents'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Incidents</span>
              {incidentCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white font-mono">
                  {incidentCount}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-mono">0</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span>Diagnostics &amp; Specs</span>
            </button>
          </nav>

          {/* Right Actions: Persistent Copilot Button */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden lg:flex items-center space-x-2 text-xs text-slate-500 font-mono pr-2">
              <span className="text-[11px]">WhatsApp:</span>
              <span className={`font-semibold ${health?.messaging === 'configured' ? 'text-emerald-700' : 'text-slate-400'}`}>
                {health?.messaging === 'configured' ? 'Active' : 'Standby'}
              </span>
            </div>

            <button
              onClick={onToggleCopilot}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs ${
                isCopilotOpen
                  ? 'bg-blue-700 text-white shadow-blue-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Bot className="w-4 h-4 text-white" />
              <span>AI Copilot</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex space-x-1 pb-2.5 pt-1 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'fleet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Plant Floor (10)
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center space-x-1 ${activeTab === 'incidents' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            <span>Incidents</span>
            {incidentCount > 0 && <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[10px]">{incidentCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Diagnostics &amp; Specs
          </button>
        </div>
      </div>
    </header>
  );
};
