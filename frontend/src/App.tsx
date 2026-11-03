import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FleetOverview } from './components/FleetOverview';
import { IncidentManager } from './components/IncidentManager';
import { AnalyticsView } from './components/AnalyticsView';
import { RAGChatbot } from './components/RAGChatbot';
import { api } from './api/client';
import { AlertCircle, RefreshCw, Bot, Sparkles } from 'lucide-react';
import type { FleetMachine } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'incidents' | 'analytics'>('fleet');
  const [health, setHealth] = useState<{ status: string; stage: number; model_ready: boolean; messaging: string } | null>(null);
  const [fleet, setFleet] = useState<FleetMachine[]>([]);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Persistent AI Copilot Drawer State
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotMachineId, setCopilotMachineId] = useState<string>('all');

  const fetchHealthAndIncidents = async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
      setBackendError(null);
    } catch {
      setBackendError('Backend service unreachable at 127.0.0.1:8000. Start with: .venv/Scripts/python -m uvicorn backend.main:app');
    }

    try {
      const f = await api.getFleet();
      setFleet(f);
    } catch {
      // ignore
    }

    try {
      const incs = await api.getIncidents();
      setIncidentCount(incs.filter(i => i.status !== 'resolved').length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHealthAndIncidents();
    const interval = setInterval(fetchHealthAndIncidents, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCopilot = (machineId?: string) => {
    if (machineId) {
      setCopilotMachineId(machineId);
    }
    setIsCopilotOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        health={health}
        incidentCount={incidentCount}
        onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        isCopilotOpen={isCopilotOpen}
      />

      {backendError && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{backendError}</span>
          </div>
          <button
            onClick={fetchHealthAndIncidents}
            className="flex items-center space-x-1 underline hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'fleet' && (
          <FleetOverview
            onSelectMachineIncident={() => setActiveTab('incidents')}
            onNavigateToIncidents={() => setActiveTab('incidents')}
            onOpenCopilotForMachine={handleOpenCopilot}
          />
        )}
        {activeTab === 'incidents' && (
          <IncidentManager
            onRefresh={fetchHealthAndIncidents}
            onOpenCopilotForIncident={() => handleOpenCopilot()}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>

      {/* Persistent AI Copilot Slide-Over Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] lg:w-[560px] transform transition-transform duration-300 ease-in-out ${
          isCopilotOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <RAGChatbot
          fleet={fleet}
          initialMachineId={copilotMachineId}
          isDrawer={true}
          onClose={() => setIsCopilotOpen(false)}
        />
      </div>

      {/* Drawer Backdrop Overlay */}
      {isCopilotOpen && (
        <div
          onClick={() => setIsCopilotOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Persistent Floating Copilot Trigger Button (Bottom Right) */}
      {!isCopilotOpen && (
        <button
          onClick={() => handleOpenCopilot()}
          className="fixed bottom-6 right-6 z-30 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xl shadow-blue-900/40 flex items-center space-x-2 transition hover:scale-105 border border-blue-400/30"
          title="Open AI Maintenance Copilot (Available on all screens)"
        >
          <Bot className="w-4 h-4 text-white" />
          <span>AI Copilot</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </button>
      )}

      {/* Clean Industrial Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-3.5 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
          <div>
            <span>Factory Copilot • 10-Station CNC Milling Floor • Grounded RAG Assistant</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>FastAPI: <code className="text-slate-400">127.0.0.1:8000</code></span>
            <span>HGB Classifier (F2 @ 21%)</span>
            <span>SHAP 0.49.1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
