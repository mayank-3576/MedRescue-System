import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, CornerDownLeft, ShieldCheck, ArrowRight } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import { assistantApi, ExplanationProvider } from '../../api/assistant';
import { useAuth } from '../../hooks/useAuth';
import { AssistantMessage } from '../../types';

export const MedicineAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello ${user?.full_name || 'Doctor'}! I am your MedRescue System Clinical & Logistics Assistant. I continuously monitor regional hospital formularies, predict medicine expiration risks, and calculate Pareto-optimal redistribution routes. How can I assist you today?`,
      timestamp: new Date().toISOString(),
      suggested_actions: [
        'Check Remdesivir expiry risk',
        'Analyze regional hospital network',
        'Inspect cold-chain delivery protocols',
        'How many batches expire in 30 days?',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('rules');
  const [providers, setProviders] = useState<ExplanationProvider[]>([{ id: 'rules', label: 'Rule based', available: true }]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    assistantApi.getProviders().then(setProviders).catch(() => undefined);
  }, []);

  const handleSend = async (textToSend?: string) => {
    const queryText = textToSend || input;
    if (!queryText.trim() || sending) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setSending(true);

    try {
      const response = await assistantApi.sendMessage(queryText, {
        hospital_id: user?.hospital_id,
        user_role: user?.role,
      }, provider);
      setMessages((prev) => [...prev, response]);
    } catch (e) {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'I encountered an issue processing your medical query. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        title="AI Clinical & Logistics Assistant"
        subtitle="Conversational copilot for querying surplus inventory, cold-chain transport criteria, and algorithm recommendations."
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card flex flex-col h-[650px] overflow-hidden">
        {/* Assistant Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">MedRescue Autonomous Copilot</h3>
              <p className="text-[10px] text-teal-300 font-medium">Database facts with optional grounded LLM explanations</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Rules ready
          </span>
        </div>

        <div className="border-b border-slate-100 bg-teal-50 px-4 py-2 text-[11px] text-teal-900">
          OpenAI and Claude can explain database results when configured. Forecast quantities and other numeric facts are computed by the backend and are not changed by the LLM.
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 shadow-xs text-xs sm:text-sm ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none leading-relaxed'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
                {msg.explanation && <div className="mt-3 border-t border-slate-100 pt-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-teal-700">Explanation · {msg.explanation_provider || 'rules'}</p><p className="whitespace-pre-line text-xs text-slate-600">{msg.explanation}</p></div>}

                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.suggested_actions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(action)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-full text-[11px] font-medium transition-colors border border-slate-200"
                      >
                        <Sparkles className="w-3 h-3 text-teal-600" />
                        <span>{action}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span
                  className={`text-[9px] mt-1.5 block ${
                    msg.role === 'user' ? 'text-teal-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="max-w-32 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs" aria-label="Explanation provider">
              {providers.map((item) => <option key={item.id} value={item.id} disabled={item.id !== 'rules' && !item.available}>{item.label}{item.id !== 'rules' && !item.available ? ' (not configured)' : ''}</option>)}
            </select>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything (e.g. 'What medicines can we redistribute to Apollo Hospital?')..."
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default MedicineAssistantPage;
