import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  BookOpen, 
  ExternalLink, 
  Cpu, 
  CheckCircle2, 
} from 'lucide-react';
import { api } from '../api/client';
import type { ChatMessage, KnowledgeDoc, FleetMachine } from '../types';

interface RAGChatbotProps {
  fleet: FleetMachine[];
  initialMachineId?: string;
}

const DEFAULT_SUGGESTIONS = [
  "What are the exact physical conditions for Heat Dissipation Failure (HDF)?",
  "Why is machine M-09 showing a warning or high failure probability?",
  "Explain Overstrain Failure (OSF) limits for Product Variants L, M, and H",
  "How should a technician respond to an alert on Line 1 (Commands 1–5)?",
  "What does a positive SHAP contribution for torque indicate?",
  "What is the recommended replacement window for Tool Wear Failure (TWF)?"
];

export const RAGChatbot: React.FC<RAGChatbotProps> = ({ fleet, initialMachineId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: (
        "Hello! I am your **Factory Copilot Technical Maintenance Assistant**.\n\n" +
        "I am grounded in engineering operating manuals (UCI AI4I Benchmark & Haas CNC specifications), " +
        "failure physics definitions (HDF, OSF, PWF, TWF), SHAP explainability standards, and **live telemetry from all 10 plant stations**.\n\n" +
        "Ask me about any machine fault, failure equation, technician protocol, or select a station below to analyze its live status!"
      ),
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || 'all');
  const [loading, setLoading] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [showDocs, setShowDocs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const machineScope = selectedMachineId === 'all' ? undefined : selectedMachineId;
      const response = await api.chatRAG(textToSend, machineScope);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString(),
        sources: response.retrieved_sources,
        machineContext: response.machine_context,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error fetching response: ${err.message || 'Backend unreachable.'}`,
        timestamp: new Date().toLocaleTimeString(),
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
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Chat Interface (8 cols) */}
      <div className="lg:col-span-8 flex flex-col h-[740px] rounded-xl bg-slate-900 border border-slate-800 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">AI Copilot RAG Assistant</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Grounded in Real Telemetry</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Strictly grounded in technical documentation, failure physics, and plant telemetry</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showDocs ? 'Hide Docs' : 'Browse Docs'}</span>
            </button>

            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Machine Scope Filter Bar */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Scope Query to Station:</span>
          </div>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">🌐 Entire Fleet (Global Scope)</option>
            {fleet.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.name} ({m.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2.5 ${
                    isUser
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-xs shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-bl-xs shadow-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Grounded Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider flex items-center space-x-1">
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
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900/90 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 border border-cyan-800/60 transition"
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
            <div className="flex items-center space-x-2 text-xs text-slate-400 p-3 rounded-lg bg-slate-800/40 border border-slate-800 w-fit">
              <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Retrieving technical corpus & synthesizing grounded diagnosis...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center space-x-2 overflow-x-auto">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold shrink-0">
            Suggested:
          </span>
          {DEFAULT_SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSend(sug)}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 whitespace-nowrap transition"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about machine faults, failure equations, technician commands, or station status..."
            className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-cyan-500 transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/20 disabled:opacity-50"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Column: Knowledge Base Corpus Explorer (4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 h-[740px] overflow-y-auto">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">Indexed Knowledge Corpus</h3>
          </div>
          <p className="text-xs text-slate-400">
            Technical documents, engineering failure physics equations, and maintenance manuals available to the RAG retriever:
          </p>

          <div className="space-y-3">
            {knowledgeDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1.5 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-cyan-300">[{doc.id}]</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {doc.category}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-200">{doc.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">{doc.summary}</p>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 pt-1"
                >
                  <span>{doc.source}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
