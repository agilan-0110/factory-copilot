import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Trash2, 
  BookOpen, 
  ExternalLink, 
  Cpu, 
  CheckCircle2,
  Key,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { ChatMessage, KnowledgeDoc, FleetMachine } from '../types';

interface RAGChatbotProps {
  fleet: FleetMachine[];
  initialMachineId?: string;
  isDrawer?: boolean;
  onClose?: () => void;
}

const DEFAULT_SUGGESTIONS = [
  "What triggers Heat Dissipation Failure (HDF)?",
  "Why is station M-09 at elevated risk?",
  "Overstrain Failure (OSF) limits for Product L/M/H",
  "Standard tool insert replacement procedure (TWF)",
  "Technician incident response lifecycle (Commands 1–5)",
];

export const RAGChatbot: React.FC<RAGChatbotProps> = ({ 
  fleet, 
  initialMachineId, 
  isDrawer = false,
  onClose 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: (
        "Hello, I am your **Factory Copilot Technical Assistant**.\n\n" +
        "I am grounded in engineering operating manuals (AI4I Benchmark & Haas CNC specifications), " +
        "failure physics equations (HDF, OSF, PWF, TWF), and **live telemetry from all 10 plant stations**.\n\n" +
        "Ask any maintenance question or select a station below for live diagnostics."
      ),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || 'all');
  const [loading, setLoading] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('factory_gemini_api_key') || '');
  const [tempKey, setTempKey] = useState<string>(apiKey);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
    }
  }, [initialMachineId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {
    try {
      const docs = await api.getKnowledge();
      setKnowledgeDocs(docs);
    } catch {
      // ignore
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const machineScope = selectedMachineId === 'all' ? undefined : selectedMachineId;
      const response = await api.chatRAG(textToSend, machineScope, apiKey || undefined);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: response.retrieved_sources,
        machineContext: response.machine_context,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error fetching response: ${err.message || 'Backend unreachable.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "Chat cleared. What technical maintenance procedure or machine telemetry would you like to review?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  return (
    <div className={`flex flex-col h-full bg-white border border-slate-200 ${isDrawer ? 'rounded-l-2xl border-r-0 shadow-2xl' : 'rounded-2xl shadow-lg'} overflow-hidden`}>
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">AI Maintenance Copilot</h3>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-100 text-slate-700 border border-slate-200">
                RAG Grounded
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Physics formulas • Haas manuals • Live telemetry</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              setTempKey(apiKey);
              setShowKeyModal(true);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center space-x-1.5 transition ${
              apiKey
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
            title="Configure Gemini API Key"
          >
            <Key className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">{apiKey ? 'Gemini Active' : 'API Key'}</span>
          </button>

          <button
            onClick={() => setShowDocs(!showDocs)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center space-x-1.5 transition ${
              showDocs
                ? 'bg-blue-900/40 text-blue-300 border-blue-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <BookOpen className="w-3 h-3 text-blue-400" />
            <span className="hidden sm:inline">{showDocs ? 'Hide Docs' : 'Docs'}</span>
          </button>

          <button
            onClick={clearChat}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {isDrawer && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition ml-1"
              title="Close Copilot Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Machine Context Selector Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400 font-medium">Context Station:</span>
        </div>
        <select
          value={selectedMachineId}
          onChange={(e) => setSelectedMachineId(e.target.value)}
          className="bg-white text-slate-800 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="all">🌐 Entire Fleet Overview</option>
          {fleet.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              {m.machine_id}: {m.name} ({m.status.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Docs Drawer when toggled */}
      {showDocs && (
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 max-h-56 overflow-y-auto space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Indexed Technical Knowledge Base ({knowledgeDocs.length} Docs)</span>
            <button onClick={() => setShowDocs(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {knowledgeDocs.map((doc) => (
              <div key={doc.id} className="p-2 rounded bg-white border border-slate-200 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-400 text-[10px]">[{doc.id}]</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">{doc.category}</span>
                </div>
                <p className="font-medium text-slate-800 text-[11px] truncate">{doc.title}</p>
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 hover:text-blue-400 flex items-center space-x-1">
                  <span className="truncate">{doc.source}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-4 py-3 text-xs leading-relaxed space-y-2.5 shadow-sm ${
                  isUser
                    ? 'bg-blue-600 text-slate-900 font-medium rounded-br-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Grounded Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Retrieved Citations ({msg.sources.length} Sources Grounded)</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((s) => (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-white text-[11px] font-mono text-blue-700 hover:text-blue-800 font-semibold border border-slate-700 hover:border-blue-500 transition"
                        >
                          <span>[{s.id}] {s.title}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono px-1">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Consulting engineering docs & live machine telemetry...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto whitespace-nowrap shrink-0">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Quick:</span>
          {DEFAULT_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedMachineId === 'all'
                ? "Ask about plant fleet, failure mechanics (HDF, OSF, PWF, TWF), or protocols..."
                : `Ask about station ${selectedMachineId} telemetry, diagnostics, or tool wear...`
            }
            className="flex-1 bg-slate-50 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-slate-900 text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Key className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Google Gemini API Key</h3>
                  <p className="text-[11px] text-slate-400">Enhance RAG synthesis with generative LLM reasoning</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter a Google Gemini API key (<code className="text-blue-400 font-mono">AIzaSy...</code>) to power the copilot with Google Gemini. If omitted, the assistant seamlessly runs the offline deterministic grounded synthesizer.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Gemini API Key
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-slate-900 px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:underline flex items-center space-x-1"
              >
                <span>Get free key at Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex items-center space-x-2">
                {apiKey && (
                  <button
                    onClick={() => {
                      setApiKey('');
                      setTempKey('');
                      localStorage.removeItem('factory_gemini_api_key');
                      setShowKeyModal(false);
                    }}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg border border-rose-900/60 transition"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={() => {
                    const clean = tempKey.trim();
                    setApiKey(clean);
                    if (clean) {
                      localStorage.setItem('factory_gemini_api_key', clean);
                    } else {
                      localStorage.removeItem('factory_gemini_api_key');
                    }
                    setShowKeyModal(false);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-lg shadow transition"
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
