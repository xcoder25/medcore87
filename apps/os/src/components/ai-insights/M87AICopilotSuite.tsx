'use client';

import { geminiGenerate, hasGeminiKey } from '../../lib/geminiClient';
import { runM87Training, buildM87RagContext, retrieveRelevantExamples } from '../../lib/m87Train';
import { addFeedback, getModelState, subscribeM87Learn } from '../../lib/m87LearningStore';
import { liveAlert } from '../../lib/manualActions';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pauseAnimationsWhenHidden } from '../../lib/motion';
import type { UserSession } from '../auth/AuthScreen';
import {
  parseStaffAutomationIntent,
  createStaffAccountWithCard,
  bulkCreateStaff,
} from '../../lib/staffAutomation';
import { emitLiveAction } from '../../lib/liveActions';
import {
  Brain, Send, Sparkles, Plus, Activity, Users, Wallet, Stethoscope,
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
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [modelVer, setModelVer] = useState<string | null>(() => getModelState()?.version || null);
  const [engineReady, setEngineReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Pause aurora / gradient loops when Celestia is off-screen or tab hidden
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    return pauseAnimationsWhenHidden(el);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const sync = () => setModelVer(getModelState()?.version || null);
    sync();
    return subscribeM87Learn(sync);
  }, []);

  // Background engine: train + harvest (no UI tabs for Forecast / Alerts / Train)
  useEffect(() => {
    const fid = session?.hospitalId || 'IGH-EKT';
    let cancelled = false;
    const run = () => {
      try {
        const { summary, model } = runM87Training(fid);
        if (cancelled) return;
        setModelVer(model?.version || getModelState()?.version || null);
        setEngineReady(true);
        if (summary) {
          try {
            liveAlert(summary, 'm87-ai', fid);
          } catch {
            /* quiet */
          }
        }
      } catch {
        if (!cancelled) setEngineReady(true);
      }
    };
    // Defer so chat paints first
    const t = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [session?.hospitalId]);

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
          reply = `Celestia Role Visibility: enabled for **${rk}**: ${mods.join(', ')}. Current: ${getModulesForRole(rk).join(', ')}`;
        } else if (deny) {
          const rk = roleWord(deny[1]);
          const mods = parseMods(deny[2]);
          mods.forEach((m) => setRoleModule(rk, m, false));
          reply = `Celestia Role Visibility: disabled for **${rk}**: ${mods.join(', ')}. Current: ${getModulesForRole(rk).join(', ')}`;
        } else if (setAll) {
          const rk = roleWord(setAll[1]);
          const mods = parseMods(setAll[2]);
          applyRoleModules(rk, mods);
          reply = `Celestia Role Visibility: **${rk}** modules set to: ${getModulesForRole(rk).join(', ')}`;
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
            ? `Celestia Access Automation: Account created and ID card issued.\n\n• Name: ${staffIntent.jobs[0].fullName}\n• Badge: ${r.badgeId}\n• Role: ${staffIntent.jobs[0].roleKey}\n• PIN: (as specified / default 123456)\n\nStaff can Sign in with ID No. using badge + PIN. Open Staff Access Control to view the card.`
            : `Celestia could not create account: ${r.error || 'unknown error'}`;
          if (r.ok) emitLiveAction(`Celestia enrolled ${r.badgeId}`, { module: 'ai-access' });
        } else if (staffIntent.jobs.length > 1) {
          const { summary } = await bulkCreateStaff(staffIntent.jobs);
          reply = `Celestia Bulk Access Automation\n\n${summary}\n\nAll successful accounts have ID cards and badge login. Review under Staff Access Control.`;
          emitLiveAction(`Celestia bulk enrol ×${staffIntent.jobs.length}`, { module: 'ai-access' });
        }
      } catch (err: unknown) {
        reply = `Celestia automation error: ${(err as Error)?.message || 'failed'}`;
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
      'Celestia: I can automate hospital admin tasks. Try:\n• enrol nurse Ada Okon pin 123456\n• bulk enrol: Emeka doctor; Chioma reception; Amaka nurse\n• create 5 nurses\n\nOr ask about beds, revenue, or clinical topics.';
    let cat: ChatMessage['category'] = 'clinical';

    const fid = session?.hospitalId || 'IGH-EKT';
    const rag = buildM87RagContext(query, fid);
    const localHits = retrieveRelevantExamples(query, fid, 1);
    const gemini = await geminiGenerate(
      query,
      `You are Celestia, MedCore hospital OS copilot. Facility context: staff assistant. Keep answers short. Never invent patient identifiers. Prefer learned hospital knowledge when provided.`,
      rag
    );
    if (gemini.ok && gemini.text) {
      reply = gemini.text;
      cat = 'clinical';
    } else if (localHits[0]) {
      reply = localHits[0].idealOutput + '\n\n— Celestia local model (from local hospital knowledge)';
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
    liveAlert(rating === 1 ? 'Thanks — saved to Celestia training set' : 'Feedback noted', 'm87-ai', fid);
  };

  const suggestions = [
    { label: 'Who is waiting in OPD?', icon: Users },
    { label: 'Unpaid bills today', icon: Wallet },
    { label: 'Enrol a new nurse', icon: Activity },
    { label: 'What needs attention?', icon: Stethoscope },
  ];

  return (
    <div className="m87-chat-shell celestia-cosmic" ref={shellRef}>
      <div className="celestia-stars" aria-hidden />
      <div className="celestia-nebula" aria-hidden />
      <div className="celestia-planet" aria-hidden />
      <div className="m87-aurora" aria-hidden />
      <div className="m87-aurora m87-aurora-2" aria-hidden />

      <header className="m87-chat-header celestia-header">
        <div className="celestia-logo-orbit">
          <div className="celestia-orbit-ring" />
          <div className="celestia-orbit-ring celestia-orbit-ring-2" />
          <div className="celestia-star-core">
            <Sparkles size={18} color="#fff" />
          </div>
        </div>
        <div className="m87-header-text">
          <div className="m87-title-row">
            <h1 className="m87-title">Celestia</h1>
            <span className="m87-live-dot" title="Online" />
            <span className="m87-live-label">{engineReady ? 'Online' : 'Warming up'}</span>
          </div>
          <p className="m87-subtitle">Your hospital AI companion, beyond.</p>
        </div>
      </header>

      <div className="m87-messages celestia-messages" ref={listRef}>
        {messages.length === 0 && !isThinking && (
          <div className="m87-empty celestia-hero">
            <div className="celestia-hero-logo">
              <div className="celestia-orbit-ring celestia-orbit-lg" />
              <div className="celestia-orbit-ring celestia-orbit-lg celestia-orbit-ring-2" />
              <div className="celestia-star-core celestia-star-lg">
                <Sparkles size={28} color="#fff" />
              </div>
              <div className="celestia-horizon" />
            </div>
            <h2 className="m87-empty-title">Hello, I&apos;m Celestia</h2>
            <p className="m87-empty-sub">
              I&apos;m here to help your hospital explore queues, billing, staff, and clinical ops — clearly and in real time.
            </p>
            <div className="celestia-try-label">Try asking me about…</div>
            <div className="m87-suggestions">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    type="button"
                    className="m87-chip mc-btn-live"
                    onClick={() => {
                      setInputPrompt(s.label);
                      inputRef.current?.focus();
                    }}
                  >
                    <Icon size={14} style={{ opacity: 0.9 }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const mine = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={mine ? 'm87-row m87-row-user mc-user-msg-in' : 'm87-row m87-row-ai mc-ai-msg-in'}
            >
              {!mine && (
                <div className="m87-msg-avatar celestia-msg-star">
                  <Sparkles size={12} color="#fff" />
                </div>
              )}
              <div className={mine ? 'm87-bubble m87-bubble-user' : 'm87-bubble m87-bubble-ai'}>
                {!mine ? (
                  <>
                    <StreamingText text={msg.text} animate={streamingId === msg.id} />
                    <div className="m87-feedback">
                      <button type="button" className="m87-fb mc-btn-live" onClick={() => rateMessage(msg, 1)} title="Teach Celestia">
                        👍
                      </button>
                      <button type="button" className="m87-fb mc-btn-live" onClick={() => rateMessage(msg, -1)} title="Not helpful">
                        👎
                      </button>
                      <span className="m87-time">{msg.timestamp}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {msg.text}
                    <div className="m87-time m87-time-user">{msg.timestamp}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="m87-row m87-row-ai mc-ai-msg-in">
            <div className="m87-msg-avatar celestia-msg-star">
              <Sparkles size={12} color="#fff" />
            </div>
            <div className="m87-bubble m87-bubble-ai m87-thinking">
              <div className="mc-typing-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="m87-thinking-label">Celestia is thinking…</span>
            </div>
          </div>
        )}
      </div>

      <form
        className="m87-composer celestia-composer"
        onSubmit={(e) => {
          void handleSend(e);
        }}
      >
        <div className="m87-composer-inner">
          <button type="button" className="celestia-plus" aria-label="More" tabIndex={-1}>
            <Plus size={18} />
          </button>
          <textarea
            ref={inputRef}
            className="m87-input"
            rows={1}
            placeholder="Message Celestia…"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(e as unknown as React.FormEvent);
              }
            }}
            disabled={isThinking}
          />
          <button
            type="submit"
            className={`m87-send mc-btn-live${isThinking ? ' is-busy' : ''}`}
            disabled={isThinking || !inputPrompt.trim()}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="m87-composer-hint">Enter to send · MedCore Hospital OS · Celestia</div>
      </form>
    </div>
  );
};


/** @deprecated use Celestia naming — same component */
export const CelestiaAICopilotSuite = M87AICopilotSuite;
