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
} from 'lucide-react';
import { api } from '../api/client';
import type { Incident, AuditEvent } from '../types';

interface IncidentManagerProps {
  onRefresh: () => void;
}

export const IncidentManager: React.FC<IncidentManagerProps> = ({ onRefresh }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadIncidents();
  }, []);

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
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
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
                          ? 'bg-slate-800/90 border-cyan-500/60 shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-100">{inc.id}</span>
                        {getStatusBadge(inc.status)}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Event: <code className="text-slate-300">{inc.event_id}</code></span>
                        <span className="font-mono text-cyan-400 font-semibold">
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
                    <span className="font-mono text-cyan-400 font-bold block">[1] Acknowledge</span>
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
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
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
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white flex items-center space-x-1.5 transition shadow-sm"
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
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-200 whitespace-pre-wrap">
                    {previewText}
                  </div>
                )}
              </div>

              {/* Frozen Evidence Snapshot */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileSearch className="w-3.5 h-3.5 text-cyan-400" />
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
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-cyan-300 border border-slate-700">
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
                  <History className="w-3.5 h-3.5 text-cyan-400" />
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
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-950 text-cyan-300 font-mono">
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
    </div>
  );
};
