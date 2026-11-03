import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FleetOverview } from './components/FleetOverview';
import { RAGChatbot } from './components/RAGChatbot';
import { LiveMonitor } from './components/LiveMonitor';
import { IncidentManager } from './components/IncidentManager';
import { MachineProfileView } from './components/MachineProfileView';
import { EvaluationDashboard } from './components/EvaluationDashboard';
import { api } from './api/client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { FleetMachine } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'chat' | 'monitor' | 'incidents' | 'profile' | 'evaluation'>('fleet');
  const [health, setHealth] = useState<{ status: string; stage: number; model_ready: boolean; messaging: string } | null>(null);
  const [fleet, setFleet] = useState<FleetMachine[]>([]);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [backendError, setBackendError] = useState<string | null>(null);

  const fetchHealthAndIncidents = async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
      setBackendError(null);
    } catch {
      setBackendError('FastAPI Backend is currently unreachable. Start it with: python -m uvicorn backend.main:app --port 8000');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        health={health}
        incidentCount={incidentCount}
      />

      {backendError && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2.5 text-xs flex items-center justify-between">
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'fleet' && (
          <FleetOverview
            onSelectMachineIncident={() => setActiveTab('incidents')}
            onNavigateToIncidents={() => setActiveTab('incidents')}
          />
        )}
        {activeTab === 'chat' && (
          <RAGChatbot
            fleet={fleet}
          />
        )}
        {activeTab === 'monitor' && <LiveMonitor onIncidentCreated={fetchHealthAndIncidents} />}
        {activeTab === 'incidents' && <IncidentManager onRefresh={fetchHealthAndIncidents} />}
        {activeTab === 'profile' && <MachineProfileView />}
        {activeTab === 'evaluation' && <EvaluationDashboard />}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span>Factory Copilot • Industrial Plant Fleet Management (10 Stations) • RAG Assistant</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>FastAPI REST: <code className="text-slate-400">127.0.0.1:8000</code></span>
            <span>SHAP 0.49.1</span>
            <span>Scikit-Learn 1.7.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
