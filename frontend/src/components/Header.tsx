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
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Factory Status */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-white font-mono">FACTORY COPILOT</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  PLANT 01
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">10 Stations Active</span>
                </span>
                <span>•</span>
                <span>Calibrated ML Classifier (21.0% Threshold)</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Pills */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'fleet'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Plant Floor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono">10</span>
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'incidents'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Incidents</span>
              {incidentCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white font-mono">
                  {incidentCount}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono">0</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>Diagnostics &amp; Specs</span>
            </button>
          </nav>

          {/* Right Actions: Persistent Copilot Button */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden lg:flex items-center space-x-2 text-xs text-slate-400 font-mono pr-2">
              <span className="text-[11px]">WhatsApp:</span>
              <span className={`font-semibold ${health?.messaging === 'configured' ? 'text-emerald-400' : 'text-slate-500'}`}>
                {health?.messaging === 'configured' ? 'Active' : 'Standby'}
              </span>
            </div>

            <button
              onClick={onToggleCopilot}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
                isCopilotOpen
                  ? 'bg-blue-600 text-white shadow-blue-900/40'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600'
              }`}
            >
              <Bot className="w-4 h-4 text-blue-400" />
              <span>AI Copilot</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex space-x-1 pb-2.5 pt-1 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'fleet' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
          >
            Plant Floor (10)
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center space-x-1 ${activeTab === 'incidents' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
          >
            <span>Incidents</span>
            {incidentCount > 0 && <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[10px]">{incidentCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'analytics' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
          >
            Analytics &amp; Specs
          </button>
        </div>
      </div>
    </header>
  );
};
