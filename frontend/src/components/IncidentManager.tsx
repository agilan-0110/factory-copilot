import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Eye, 
  AlertCircle,
  FileSearch,
  History,
  Settings,
  ExternalLink,
  X,
  Smartphone,
  ShieldCheck,
  Bot,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { Incident, AuditEvent, WhatsAppStatus } from '../types';

interface IncidentManagerProps {
  onRefresh: () => void;
  onOpenCopilotForIncident?: (incidentId: string) => void;
}

export const IncidentManager: React.FC<IncidentManagerProps> = ({ 
  onRefresh,
  onOpenCopilotForIncident,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waForm, setWaForm] = useState({
    account_sid: '',
    auth_token: '',
    from_number: 'whatsapp:+14155238886',
    to_number: '',
    webhook_url: '',
    api_key: '',
  });
  const [waTestStatus, setWaTestStatus] = useState<{ loading: boolean; message: string; error?: boolean } | null>(null);

  useEffect(() => {
    loadIncidents();
    loadWhatsAppStatus();
  }, []);

  const loadWhatsAppStatus = async () => {
    try {
      const s = await api.getWhatsAppStatus();
      setWhatsAppStatus(s);
      setWaForm(prev => ({
        ...prev,
        from_number: s.from_number || 'whatsapp:+14155238886',
        to_number: s.to_number || '',
        webhook_url: s.webhook_url || '',
      }));
    } catch {
      // ignore
    }
  };

  const handleSaveWhatsAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.saveWhatsAppConfig(waForm);
      setWhatsAppStatus(updated);
      setActionMessage({ type: 'success', text: 'WhatsApp configuration saved to .env!' });
      setShowWhatsAppModal(false);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to save configuration.' });
    }
  };

  const handleTestWhatsAppPing = async () => {
    setWaTestStatus({ loading: true, message: 'Sending test ping via Twilio...' });
    try {
      const res = await api.testWhatsAppSend();
      setWaTestStatus({
        loading: false,
        message: `Test alert sent successfully! SID: ${res.sid.slice(0, 10)}...`,
        error: false,
      });
    } catch (err: any) {
      setWaTestStatus({
        loading: false,
        message: `Failed: ${err.message || 'Check credentials'}`,
        error: true,
      });
    }
  };

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await api.getIncidents();
      setIncidents(data.reverse());
      if (data.length > 0 && !selectedIncident) {
        setSelectedIncident(data[0]);
        loadHistory(data[0].id);
      } else if (selectedIncident) {
        const updated = data.find(i => i.id === selectedIncident.id);
        if (updated) setSelectedIncident(updated);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (id: string) => {
    try {
      const trail = await api.getIncidentHistory(id);
      setAuditTrail(trail);
    } catch {
      setAuditTrail([]);
    }
  };

  const selectIncident = (inc: Incident) => {
    setSelectedIncident(inc);
    setActionMessage(null);
    setPreviewText(null);
    loadHistory(inc.id);
  };

  const handleSimulateReply = async (command: number) => {
    if (!selectedIncident) return;
    setActionMessage(null);
    try {
      await api.simulateReply(selectedIncident.id, command);
      setActionMessage({
        type: 'success',
        text: `Action ${command} applied successfully!`,
      });
      await loadIncidents();
      await loadHistory(selectedIncident.id);
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const handlePreviewNotification = async () => {
    if (!selectedIncident) return;
    try {
      const preview = await api.getNotificationPreview(selectedIncident.id);
      setPreviewText(preview.text);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Preview failed' });
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedIncident) return;
    setActionMessage(null);
    try {
      const res = await api.sendWhatsApp(selectedIncident.id);
      setActionMessage({
        type: 'success',
        text: `WhatsApp notification submitted: ${res.status}`,
      });
      await loadIncidents();
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'WhatsApp send failed' });
    }
  };

  const handleRefreshDelivery = async () => {
    if (!selectedIncident) return;
    setActionMessage(null);
    try {
      const res = await api.refreshDelivery(selectedIncident.id);
      setActionMessage({
        type: 'success',
        text: `Provider status refreshed: ${res.status}`,
      });
      await loadIncidents();
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Refresh failed' });
    }
  };

  const filteredIncidents = incidents.filter(i => {
    if (filter === 'all') return true;
    if (filter === 'open') return i.status !== 'resolved';
    return i.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">NEW</span>;
      case 'acknowledged':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">ACKNOWLEDGED</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">CONFIRMED</span>;
      case 'no_issue':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">NO ISSUE</span>;
      case 'inconclusive':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800">INCONCLUSIVE</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">RESOLVED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* WhatsApp Integration Channel Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            whatsAppStatus?.ready
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white">Twilio WhatsApp Notification Channel</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                whatsAppStatus?.ready
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {whatsAppStatus?.ready ? 'CONNECTED & READY' : 'SETUP REQUIRED'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {whatsAppStatus?.ready
                ? `Active WhatsApp alert delivery to technician ${whatsAppStatus.to_number} (From: ${whatsAppStatus.from_number})`
                : 'Connect your Twilio WhatsApp Sandbox to receive real-time plant alerts and reply with commands 1–5 from your phone'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {whatsAppStatus?.ready && (
            <button
              onClick={handleTestWhatsAppPing}
              disabled={waTestStatus?.loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-blue-400" />
              <span>{waTestStatus?.loading ? 'Sending...' : 'Send Test Ping'}</span>
            </button>
          )}
          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md flex items-center space-x-1.5 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{whatsAppStatus?.ready ? 'Configure Channel' : 'Setup WhatsApp'}</span>
          </button>
        </div>
      </div>

      {waTestStatus && (
        <div className={`p-3 rounded-lg text-xs font-mono border flex items-center justify-between ${
          waTestStatus.error
            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
            : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
        }`}>
          <span>{waTestStatus.message}</span>
          <button onClick={() => setWaTestStatus(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total Incidents</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">{incidents.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-rose-400 font-medium">Active / Open</span>
          <p className="text-2xl font-bold text-rose-300 mt-1 font-mono">
            {incidents.filter(i => i.status !== 'resolved').length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-amber-400 font-medium">In Inspection</span>
          <p className="text-2xl font-bold text-amber-300 mt-1 font-mono">
            {incidents.filter(i => ['acknowledged', 'confirmed', 'inconclusive'].includes(i.status)).length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-emerald-400 font-medium">Resolved</span>
          <p className="text-2xl font-bold text-emerald-300 mt-1 font-mono">
            {incidents.filter(i => i.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* Main Split View: Queue vs Incident Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incidents List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Incident Queue</h3>
              <button
                onClick={loadIncidents}
                disabled={loading}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Refresh Incidents"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['all', 'open', 'new', 'acknowledged', 'confirmed', 'resolved'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                    filter === f
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Incidents Table / Cards */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredIncidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No incidents matching filter.
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => selectIncident(inc)}
                      className={`p-3 rounded-lg border cursor-pointer transition text-left space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-blue-500/60 shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-100">{inc.id}</span>
                        {getStatusBadge(inc.status)}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Event: <code className="text-slate-300">{inc.event_id}</code></span>
                        <span className="font-mono text-blue-400 font-semibold">
                          {inc.probability !== null && inc.probability !== undefined
                            ? `${(inc.probability * 100).toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Delivery: {inc.delivery_status}</span>
                        <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Incident Detailed View (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {selectedIncident ? (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white font-mono">{selectedIncident.id}</h3>
                    {getStatusBadge(selectedIncident.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Created at {new Date(selectedIncident.created_at).toLocaleString()} • Event: <code className="text-slate-200">{selectedIncident.event_id}</code>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Recorded Score</span>
                  <p className="text-xl font-bold font-mono text-rose-400">
                    {selectedIncident.probability !== null && selectedIncident.probability !== undefined
                      ? `${(selectedIncident.probability * 100).toFixed(1)}%`
                      : 'None'}
                  </p>
                </div>
              </div>

              {/* Ask Copilot for this Incident Banner */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                <div className="flex items-center space-x-2 text-xs text-slate-200">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <span>Consult Technical Copilot on Incident {selectedIncident.id}</span>
                </div>
                <button
                  onClick={() => onOpenCopilotForIncident?.(selectedIncident.id)}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                >
                  <span>Ask Copilot</span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </button>
              </div>

              {/* Action Message Alert */}
              {actionMessage && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                  actionMessage.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}>
                  {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{actionMessage.text}</span>
                </div>
              )}

              {/* Workflow Actions (Simulate Technician Commands) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Technician Action Commands
                  </h4>
                  <span className="text-[11px] text-slate-400">Ordered transitions (1 → 2/3/4 → 5)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSimulateReply(1)}
                    disabled={selectedIncident.status !== 'new'}
                    className="p-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-left"
                  >
                    <span className="font-mono text-blue-400 font-bold block">[1] Acknowledge</span>
                    <span className="text-[10px] text-slate-400">Tech on site</span>
                  </button>

                  <button
                    onClick={() => handleSimulateReply(2)}
                    disabled={selectedIncident.status !== 'acknowledged'}
                    className="p-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-left"
                  >
                    <span className="font-mono text-rose-400 font-bold block">[2] Confirmed</span>
                    <span className="text-[10px] text-slate-400">Issue validated</span>
                  </button>

                  <button
                    onClick={() => handleSimulateReply(3)}
                    disabled={selectedIncident.status !== 'acknowledged'}
                    className="p-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-left"
                  >
                    <span className="font-mono text-emerald-400 font-bold block">[3] No Issue</span>
                    <span className="text-[10px] text-slate-400">False positive</span>
                  </button>

                  <button
                    onClick={() => handleSimulateReply(4)}
                    disabled={selectedIncident.status !== 'acknowledged'}
                    className="p-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-left"
                  >
                    <span className="font-mono text-purple-400 font-bold block">[4] Inconclusive</span>
                    <span className="text-[10px] text-slate-400">Needs review</span>
                  </button>

                  <button
                    onClick={() => handleSimulateReply(5)}
                    disabled={!['confirmed', 'no_issue', 'inconclusive'].includes(selectedIncident.status)}
                    className="p-2 rounded-lg text-xs font-medium bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-left col-span-2 sm:col-span-2"
                  >
                    <span className="font-mono text-emerald-300 font-bold block">[5] Resolve After Inspection</span>
                    <span className="text-[10px] text-emerald-400">Closes incident immutably</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Notification Management */}
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-slate-200">WhatsApp Notification Channel</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Status: <span className="text-amber-400 font-semibold">{selectedIncident.delivery_status}</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePreviewNotification}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Text</span>
                  </button>

                  {selectedIncident.delivery_status === 'not_sent' && selectedIncident.status !== 'resolved' && (
                    <button
                      onClick={handleSendWhatsApp}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center space-x-1.5 transition shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send WhatsApp Demo Alert</span>
                    </button>
                  )}

                  {selectedIncident.delivery_status !== 'not_sent' && selectedIncident.delivery_status !== 'unknown' && (
                    <button
                      onClick={handleRefreshDelivery}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Delivery Receipt</span>
                    </button>
                  )}
                </div>

                {previewText && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-blue-200 whitespace-pre-wrap">
                    {previewText}
                  </div>
                )}
              </div>

              {/* Frozen Evidence Snapshot */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileSearch className="w-3.5 h-3.5 text-blue-400" />
                  <span>Frozen Evidence Snapshot (At Creation)</span>
                </h4>

                <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 space-y-2 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                    <div>
                      <span className="text-slate-500 block">Air Temp:</span>
                      <span className="text-slate-200">{selectedIncident.reading.air_temperature_k} K</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Process Temp:</span>
                      <span className="text-slate-200">{selectedIncident.reading.process_temperature_k} K</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Rot. Speed:</span>
                      <span className="text-slate-200">{selectedIncident.reading.rotational_speed_rpm} RPM</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Torque:</span>
                      <span className="text-slate-200">{selectedIncident.reading.torque_nm} Nm</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tool Wear:</span>
                      <span className="text-slate-200">{selectedIncident.reading.tool_wear_min} min</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Product Type:</span>
                      <span className="text-slate-200">Variant {selectedIncident.reading.product_type}</span>
                    </div>
                  </div>

                  {selectedIncident.model_evidence && selectedIncident.model_evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block mb-1">Top Recorded Factors:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedIncident.model_evidence.map((f, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-blue-300 border border-slate-700">
                            {f.feature}: {f.contribution > 0 ? '+' : ''}{f.contribution.toFixed(3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Trail Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-blue-400" />
                  <span>Audit Trail</span>
                </h4>

                <div className="space-y-1.5">
                  {auditTrail.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No transition events recorded yet.</p>
                  ) : (
                    auditTrail.map((event) => (
                      <div
                        key={event.id}
                        className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-slate-400">{event.from_status} →</span>
                          <span className="font-bold text-slate-100">{event.to_status}</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-950 text-blue-300 font-mono">
                            code: {event.action_code}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                          <span className="capitalize text-slate-300">source: {event.source}</span>
                          <span className="font-mono">{new Date(event.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
              Select an incident from the queue to view details and action controls.
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Configuration Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Twilio WhatsApp Channel Configuration</h3>
                  <p className="text-[11px] text-slate-400">Deploy alerts to mobile technicians via WhatsApp sandbox</p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Setup Guide */}
            <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Twilio WhatsApp Sandbox Setup Guide</span>
              </span>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>Log in to <a href="https://console.twilio.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Twilio Console</a> and open <strong>Messaging &gt; Try it out &gt; Send a WhatsApp message</strong>.</li>
                <li>From your mobile phone WhatsApp, send the sandbox join keyword to <code className="text-emerald-300 font-mono">+1 415 523 8886</code>.</li>
                <li>Copy your <strong>Account SID</strong> and <strong>Auth Token</strong> below.</li>
                <li>To enable two-way replies (Commands 1–5), forward port 8000 using ngrok (<code className="text-blue-300 font-mono">ngrok http 8000</code>) and set the Twilio sandbox webhook to <code className="text-blue-300 font-mono">https://&lt;subdomain&gt;.ngrok-free.app/webhooks/whatsapp</code>.</li>
              </ol>
            </div>

            <form onSubmit={handleSaveWhatsAppConfig} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Twilio Account SID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={waForm.account_sid}
                    onChange={(e) => setWaForm({ ...waForm, account_sid: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Twilio Auth Token
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Auth Token"
                    value={waForm.auth_token}
                    onChange={(e) => setWaForm({ ...waForm, auth_token: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Twilio Sender (From)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="whatsapp:+14155238886"
                    value={waForm.from_number}
                    onChange={(e) => setWaForm({ ...waForm, from_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Technician Phone (To)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="whatsapp:+919876543210"
                    value={waForm.to_number}
                    onChange={(e) => setWaForm({ ...waForm, to_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Twilio Webhook URL (HTTPS Public URL)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://your-domain.ngrok-free.app/webhooks/whatsapp"
                  value={waForm.webhook_url}
                  onChange={(e) => setWaForm({ ...waForm, webhook_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Operator API Key (FACTORY_API_KEY)
                </label>
                <input
                  type="text"
                  placeholder="demo-operator-key (or leave blank to auto-generate)"
                  value={waForm.api_key}
                  onChange={(e) => setWaForm({ ...waForm, api_key: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <a
                  href="https://www.twilio.com/docs/whatsapp/sandbox"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:underline flex items-center space-x-1"
                >
                  <span>Twilio Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-md text-xs transition"
                  >
                    Save &amp; Activate
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
