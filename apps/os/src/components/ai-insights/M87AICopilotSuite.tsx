'use client';

import { geminiGenerate, hasGeminiKey } from '../../lib/geminiClient';
import { runM87Training, buildM87RagContext, retrieveRelevantExamples } from '../../lib/m87Train';
import { addFeedback, getModelState, subscribeM87Learn } from '../../lib/m87LearningStore';
import { liveAlert } from '../../lib/manualActions';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  parseStaffAutomationIntent,
  createStaffAccountWithCard,
  bulkCreateStaff,
} from '../../lib/staffAutomation';
import { emitLiveAction } from '../../lib/liveActions';
import {
  Brain, Send, Sparkles, AlertTriangle, TrendingUp,
  ShieldCheck, Activity, DollarSign, Stethoscope, RefreshCw,
  Clock, CheckCircle2, User, ChevronRight, Zap
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'm87';
  text: string;
  timestamp: string;
  category?: 'clinical' | 'operational' | 'financial';
}

const INITIAL_MESSAGES: ChatMessage[] = [];

interface Props {
  session?: UserSession;
}


/** Streams assistant text with cursor — premium chat feel */
function StreamingText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? '' : text);
  const [done, setDone] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setShown(text);
      setDone(true);
      return;
    }
    setShown('');
    setDone(false);
    let i = 0;
    const step = Math.max(1, Math.floor(text.length / 80));
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => window.clearInterval(id);
  }, [text, animate]);

  return (
    <>
      {shown}
      {!done && <span className="mc-stream-cursor" aria-hidden />}
    </>
  );
}

export const M87AICopilotSuite: React.FC<Props> = ({ session }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState('');
  const [activeAITab, setActiveAITab] = useState<'copilot' | 'forecasting' | 'anomalies' | 'orchestrator'>('copilot');
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [trainSummary, setTrainSummary] = useState<string | null>(null);
  const [modelVer, setModelVer] = useState<string | null>(() => getModelState()?.version || null);
  const [isTraining, setIsTraining] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const sync = () => setModelVer(getModelState()?.version || null);
    sync();
    return subscribeM87Learn(sync);
  }, []);

  useEffect(() => {
    if (isThinking) return;
    const last = messages[messages.length - 1];
    if (last?.sender === 'm87') setStreamingId(last.id);
  }, [isThinking]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const query = inputPrompt;
    setInputPrompt('');
    setIsThinking(true);

    const facilityId = session?.hospitalId || 'IGH-EKT';
    const facilityName = session?.facility || 'Hospital';

    // Role visibility automation
    const lowerQ = query.toLowerCase();
    if (
      (lowerQ.includes('role') && (lowerQ.includes('can see') || lowerQ.includes('permission') || lowerQ.includes('visibility') || lowerQ.includes('module'))) ||
      lowerQ.startsWith('allow ') ||
      lowerQ.startsWith('deny ') ||
      lowerQ.includes('enable module') ||
      lowerQ.includes('set role')
    ) {
      try {
        const { applyRoleModules, setRoleModule, getModulesForRole, CONFIGURABLE_ROLES, MODULE_CATALOG } = await import('../../lib/rolePermissionsStore');
        let reply = '';
        // allow nurses emr, beds
        const allow = query.match(/allow\s+(\w+)\s+(.+)/i);
        const deny = query.match(/deny\s+(\w+)\s+(.+)/i);
        const setAll = query.match(/set\s+role\s+(\w+)\s+(?:to\s+)?(.+)/i);
        const roleWord = (w: string) => {
          const x = w.toLowerCase().replace(/s$/, '');
          return (
            CONFIGURABLE_ROLES.find((r) => r.roleKey === x || r.label.toLowerCase().includes(x))?.roleKey ||
            x
          );
        };
        const parseMods = (s: string) =>
          s.split(/[,\s]+/).map((m) => m.trim().toLowerCase()).filter(Boolean).map((m) => {
            const hit = MODULE_CATALOG.find((c) => c.key === m || c.label.toLowerCase().includes(m));
            return hit?.key || m;
          });
        if (allow) {
          const rk = roleWord(allow[1]);
          const mods = parseMods(allow[2]);
          mods.forEach((m) => setRoleModule(rk, m, true));
          reply = `M87 Role Visibility: enabled for **${rk}**: ${mods.join(', ')}. Current: ${getModulesForRole(rk).join(', ')}`;
        } else if (deny) {
          const rk = roleWord(deny[1]);
          const mods = parseMods(deny[2]);
          mods.forEach((m) => setRoleModule(rk, m, false));
          reply = `M87 Role Visibility: disabled for **${rk}**: ${mods.join(', ')}. Current: ${getModulesForRole(rk).join(', ')}`;
        } else if (setAll) {
          const rk = roleWord(setAll[1]);
          const mods = parseMods(setAll[2]);
          applyRoleModules(rk, mods);
          reply = `M87 Role Visibility: **${rk}** modules set to: ${getModulesForRole(rk).join(', ')}`;
        } else {
          reply =
            'Role visibility commands:\n• allow nurse emr beds\n• deny doctor analytics\n• set role reception to dashboard patient-card patient-flow cashier\n\nOr open Role Visibility page for tick boxes.';
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'm87',
            text: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'operational',
          },
        ]);
      } catch (err: unknown) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'm87',
            text: (err as Error)?.message || 'Role permission automation failed',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'operational',
          },
        ]);
      }
      setIsThinking(false);
      return;
    }

    const staffIntent = parseStaffAutomationIntent(query, facilityId, facilityName);
    if (staffIntent.handled) {
      let reply = staffIntent.replyIfEmpty || '';
      let cat: ChatMessage['category'] = 'operational';
      try {
        if (staffIntent.jobs.length === 1) {
          const r = await createStaffAccountWithCard(staffIntent.jobs[0]);
          reply = r.ok
            ? `M87 Access Automation: Account created and ID card issued.\n\n• Name: ${staffIntent.jobs[0].fullName}\n• Badge: ${r.badgeId}\n• Role: ${staffIntent.jobs[0].roleKey}\n• PIN: (as specified / default 123456)\n\nStaff can Sign in with ID No. using badge + PIN. Open Staff Access Control to view the card.`
            : `M87 could not create account: ${r.error || 'unknown error'}`;
          if (r.ok) emitLiveAction(`M87 enrolled ${r.badgeId}`, { module: 'ai-access' });
        } else if (staffIntent.jobs.length > 1) {
          const { summary } = await bulkCreateStaff(staffIntent.jobs);
          reply = `M87 Bulk Access Automation\n\n${summary}\n\nAll successful accounts have ID cards and badge login. Review under Staff Access Control.`;
          emitLiveAction(`M87 bulk enrol ×${staffIntent.jobs.length}`, { module: 'ai-access' });
        }
      } catch (err: unknown) {
        reply = `M87 automation error: ${(err as Error)?.message || 'failed'}`;
      }
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'm87',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: cat,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsThinking(false);
      return;
    }

    // Gemini (when key configured) → else local advisory
    let reply =
      'M87: I can automate hospital admin tasks. Try:\n• enrol nurse Ada Okon pin 123456\n• bulk enrol: Emeka doctor; Chioma reception; Amaka nurse\n• create 5 nurses\n\nOr ask about beds, revenue, or clinical topics.';
    let cat: ChatMessage['category'] = 'clinical';

    const fid = session?.hospitalId || 'IGH-EKT';
    const rag = buildM87RagContext(query, fid);
    const localHits = retrieveRelevantExamples(query, fid, 1);
    const gemini = await geminiGenerate(
      query,
      `You are M87, MedCore hospital OS copilot. Facility context: staff assistant. Keep answers short. Never invent patient identifiers. Prefer learned hospital knowledge when provided.`,
      rag
    );
    if (gemini.ok && gemini.text) {
      reply = gemini.text;
      cat = 'clinical';
    } else if (localHits[0]) {
      reply = localHits[0].idealOutput + '\n\n— M87 local model (train for fresher live data)';
      cat = 'operational';
    } else {
      const lower = query.toLowerCase();
      if (lower.includes('bed') || lower.includes('surge') || lower.includes('capacity')) {
        reply =
          'Operational Forecasting: Review Bed & Ward Occupancy for live counts. I can enrol ward staff in bulk if you need more nurses on duty.';
        cat = 'operational';
      } else if (lower.includes('money') || lower.includes('revenue') || lower.includes('hmo') || lower.includes('billing')) {
        reply = 'Financial Intelligence: Open Revenue & Cashier for live tills. I automate staff access accounts, not payment posting.';
        cat = 'financial';
      } else if (lower.includes('access') || lower.includes('id card') || lower.includes('badge')) {
        reply =
          'Access Control: Say “enrol doctor Full Name pin 123456” or “bulk enrol: Name role; Name role” and I will create accounts + ID cards automatically.';
        cat = 'operational';
      } else if (gemini.usedGemini && gemini.text) {
        reply = gemini.text + '\n\n(Falling back — check Gemini API key if this persists.)';
      }
    }

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      sender: 'm87',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: cat,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsThinking(false);
  };


  const handleTrainM87 = () => {
    setIsTraining(true);
    try {
      const fid = session?.hospitalId || 'IGH-EKT';
      const { summary, model } = runM87Training(fid);
      setTrainSummary(summary);
      setModelVer(model.version);
      liveAlert(summary, 'm87-ai', fid);
      emitLiveAction(summary, { module: 'm87-ai' });
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-train-${Date.now()}`,
          sender: 'm87',
          text: `🧠 Training complete\n\n${summary}\n\nI will use harvested OPD/lab/bed facts and your 👍 feedback on future answers.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'operational',
        },
      ]);
    } finally {
      setIsTraining(false);
    }
  };

  const rateMessage = (msg: ChatMessage, rating: 1 | -1) => {
    const fid = session?.hospitalId || 'IGH-EKT';
    const lastUser = [...messages].reverse().find((m) => m.sender === 'user');
    addFeedback({
      facilityId: fid,
      messageId: msg.id,
      prompt: lastUser?.text || '',
      response: msg.text,
      rating,
    });
    liveAlert(rating === 1 ? 'Thanks — saved to M87 training set' : 'Feedback noted', 'm87-ai', fid);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 420,
        gap: 0,
        background: 'transparent',
      }}
    >
      {/* Context chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 0 12px' }}>
        {[
          { id: 'copilot' as const, label: 'Chat' },
          { id: 'forecasting' as const, label: 'Forecast' },
          { id: 'anomalies' as const, label: 'Alerts' },
          { id: 'orchestrator' as const, label: 'Ops' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveAITab(tab.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: activeAITab === tab.id ? 'none' : '1px solid #E2E8F0',
              background:
                activeAITab === tab.id
                  ? 'linear-gradient(135deg, #7C3AED, #0284C7)'
                  : '#fff',
              color: activeAITab === tab.id ? '#fff' : '#64748B',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="mc-btn-live"
          onClick={handleTrainM87}
          disabled={isTraining}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px',
            borderRadius: 999,
            border: 'none',
            background: isTraining ? '#94A3B8' : 'linear-gradient(135deg, #0D9488, #2563EB)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: isTraining ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={14} />
          {isTraining ? 'Training…' : 'Train M87'}
        </button>
      </div>
      {modelVer && (
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
          Local model: <strong>{modelVer}</strong>
          {trainSummary ? ` · ${trainSummary.slice(0, 80)}…` : ' · Run Train to harvest live hospital data'}
          {hasGeminiKey() ? ' · Gemini key detected' : ' · Set NEXT_PUBLIC_GEMINI_API_KEY for cloud ML'}
        </div>
      )}

      {activeAITab === 'copilot' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 40%)',
            overflow: 'hidden',
          }}
        >
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.length === 0 && !isThinking && (
              <div style={{ textAlign: 'center', padding: '28px 12px' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    margin: '0 auto 12px',
                    background: 'linear-gradient(135deg, #7C3AED, #0284C7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)',
                  }}
                >
                  <Sparkles size={26} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>M87 Assistant</div>
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 1.5 }}>
                  Ask about patients, queue, staff access, or beds.
                  {session?.roleKey === 'reception'
                    ? ' Reception: check-in, walk-in, and payment guidance.'
                    : ' Admin: enrol staff, role visibility, bulk accounts.'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  {(session?.roleKey === 'reception'
                    ? ['How do I check in a walk-in?', 'Unpaid patients in queue', 'Book appointment tips']
                    : ['enrol nurse Ada Okon pin 123456', 'allow reception patient-card cashier', 'Bed capacity overview']
                  ).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInputPrompt(q)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 999,
                        border: '1px solid #E2E8F0',
                        background: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const mine = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    gap: 8,
                  }}
                >
                  {!mine && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #7C3AED, #0284C7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    >
                      <Brain size={14} color="#fff" />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: mine
                        ? 'linear-gradient(135deg, #0284C7, #0D9488)'
                        : '#fff',
                      color: mine ? '#fff' : '#0F172A',
                      border: mine ? 'none' : '1px solid #E2E8F0',
                      boxShadow: mine
                        ? '0 4px 14px rgba(2,132,199,0.25)'
                        : '0 2px 8px rgba(15,23,42,0.04)',
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.sender === 'm87' ? (
                      <>
                        <StreamingText text={msg.text} animate={msg.id === streamingId} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button
                            type="button"
                            className="mc-btn-live"
                            onClick={() => rateMessage(msg, 1)}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            👍 Teach
                          </button>
                          <button
                            type="button"
                            className="mc-btn-live"
                            onClick={() => rateMessage(msg, -1)}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            👎
                          </button>
                        </div>
                      </>
                    ) : (
                      msg.text
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 6,
                        opacity: 0.7,
                        fontWeight: 600,
                      }}
                    >
                      {msg.timestamp}
                      {msg.category ? ` · ${msg.category}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="mc-ai-msg-in" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
                <div
                  className="mc-gradient-fluid"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={14} color="#fff" />
                </div>
                <div className="mc-typing-dots" aria-label="M87 is thinking">
                  <span /><span /><span />
                </div>
                <span style={{ fontWeight: 600 }}>M87 is composing…</span>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            style={{
              padding: 12,
              borderTop: '1px solid #E2E8F0',
              background: '#fff',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <input
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Message M87…"
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                fontSize: 14,
                outline: 'none',
                background: '#F8FAFC',
              }}
            />
            <button
              type="submit"
              disabled={isThinking || !inputPrompt.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: 'none',
                background:
                  isThinking || !inputPrompt.trim()
                    ? '#CBD5E1'
                    : 'linear-gradient(135deg, #7C3AED, #0284C7)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isThinking || !inputPrompt.trim() ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {activeAITab === 'forecasting' && (
        <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E2E8F0', background: '#fff' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Operational forecast</div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
            Live bed and surge models use facility data as it accumulates. Open Bed & Ward Occupancy and the reception queue for current numbers — M87 will not invent occupancy figures.
          </p>
        </div>
      )}

      {activeAITab === 'anomalies' && (
        <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E2E8F0', background: '#fff' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Desk alerts</div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
            Unpaid queue tickets, long waits, and POS risk flags surface on the reception and payment desks. Ask in Chat for guidance on the next action.
          </p>
        </div>
      )}

      {activeAITab === 'orchestrator' && (
        <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E2E8F0', background: '#fff' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Ops automation</div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 10px' }}>
            Try in Chat: enrol staff, bulk enrol, allow/deny role modules. Changes write through controlled EMR APIs — never silent clinical writes.
          </p>
        </div>
      )}
    </div>
  );
};

