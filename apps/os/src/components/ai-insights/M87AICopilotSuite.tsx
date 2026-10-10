'use client';

import { geminiGenerate, hasGeminiKey, probeGeminiConfigured } from '../../lib/geminiClient';
import {
  resolveFrontDeskAction,
  extractReceptionJobWithAI,
  registerNewPatientWithFolderFee,
  sendPatientToAccounts,
  canAutomateReception,
  receptionAutomationRefusal,
  lookupPatientSummary,
  listWaitingQueueSummary,
  registryCountSummary,
  registryListSummary,
  checkInPatientByRef,
  assignDoctorByRef,
  bookAppointmentByRef,
  type ReceptionRegJob,
  type ChatTurn,
} from '../../lib/frontDeskAutomation';
import { runM87Training, buildM87RagContext, retrieveRelevantExamples } from '../../lib/m87Train';
import { addFeedback, getModelState, subscribeM87Learn } from '../../lib/m87LearningStore';
import { liveAlert } from '../../lib/manualActions';
import {
  normalizeRoleKey,
  refuseIfOutOfRole,
  canAutomateStaff,
  canChangeRoleVisibility,
  staffAutomationRefusal,
  roleVisibilityRefusal,
  buildCelestiaSystemPrompt,
} from '../../lib/celestiaRoleGuard';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { pauseAnimationsWhenHidden } from '../../lib/motion';
import type { UserSession } from '../auth/AuthScreen';
import {
  parseStaffAutomationIntent,
  createStaffAccountWithCard,
  bulkCreateStaff,
} from '../../lib/staffAutomation';
import { emitLiveAction } from '../../lib/liveActions';
import {
  Brain, Send, Sparkles, Plus, Activity, Users, Wallet, Stethoscope, RotateCcw, Copy, Check, X, BedDouble,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'm87';
  text: string;
  timestamp: string;
  category?: 'clinical' | 'operational' | 'financial';
}

const INITIAL_MESSAGES: ChatMessage[] = [];

type TaskStepStatus = 'pending' | 'active' | 'done' | 'error';
type TaskStep = { id: string; label: string; status: TaskStepStatus };

interface Props {
  session?: UserSession;
  inDrawer?: boolean;
  onClose?: () => void;
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

function renderInlineMarkdown(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="celestia-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="celestia-code-pill">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedAssistantMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="celestia-formatted-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="celestia-line-spacer" />;
        }
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          return (
            <div key={idx} className="celestia-bullet-line">
              <span className="celestia-bullet-dot" aria-hidden>✦</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="celestia-text-p">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
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

  if (done) {
    return <FormattedAssistantMessage text={text} />;
  }

  return (
    <div className="celestia-streaming-wrap">
      {shown}
      <span className="mc-stream-cursor" aria-hidden />
    </div>
  );
}

export const M87AICopilotSuite: React.FC<Props> = ({ session, inDrawer, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [taskRun, setTaskRun] = useState<{ title: string; steps: TaskStep[] } | null>(null);
  const [pendingReceptionJob, setPendingReceptionJob] = useState<ReceptionRegJob | null>(null);
  const [lastPatientRef, setLastPatientRef] = useState<string | null>(null);
  const [pendingSendAccounts, setPendingSendAccounts] = useState(false);
  const [geminiOnline, setGeminiOnline] = useState<boolean | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [modelVer, setModelVer] = useState<string | null>(() => getModelState()?.version || null);
  const [engineReady, setEngineReady] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 1 | -1>>({});
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
        const { model } = runM87Training(fid);
        if (cancelled) return;
        setModelVer(model?.version || getModelState()?.version || null);
        setEngineReady(true);
        // Training stays silent — no toast noise on open
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

  // Header Online/Offline tracks network + Gemini without reload
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const refresh = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) setGeminiOnline(false);
        return;
      }
      void probeGeminiConfigured().then((ok) => {
        if (!cancelled) setGeminiOnline(ok);
      });
    };

    refresh();

    const onOnline = () => {
      // Network returned — re-probe Gemini immediately
      if (!cancelled) setGeminiOnline(null); // brief "Ready" while probing
      refresh();
      // Second probe shortly after in case first races DNS
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 1500);
    };
    const onOffline = () => {
      if (!cancelled) setGeminiOnline(false);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVis);

    // While offline, poll lightly so recovery is detected even if `online` event is flaky
    const poll = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) setGeminiOnline(false);
        return;
      }
      // Only re-probe if we think we're offline/unknown
      if (cancelled) return;
      setGeminiOnline((prev) => {
        if (prev === true) return prev;
        void probeGeminiConfigured().then((ok) => {
          if (!cancelled) setGeminiOnline(ok);
        });
        return prev;
      });
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (isThinking) return;
    const last = messages[messages.length - 1];
    if (last?.sender === 'm87') setStreamingId(last.id);
  }, [isThinking]); // eslint-disable-line react-hooks/exhaustive-deps



  const naturalDeskReply = (query: string): string | null => {
    const q = query.trim().toLowerCase();
    const first = (session?.name || 'there').split(/\s+/)[0] || 'there';
    const rk = normalizeRoleKey(session);
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|gm|morning)[!., ]*$/i.test(q)) {
      const tips =
        rk === 'reception' || rk === 'records'
          ? 'What are we doing — register, check-in, or queue?'
          : rk === 'hospital_admin' || rk === 'admin'
            ? 'What do you need — staff, beds, or the desk?'
            : 'What do you need on the desk?';
      return `Hey ${first}. ${tips}`;
    }
    if (/^(ok|okay|k|alright|cool|fine|sure|got it|noted)[!., ]*$/i.test(q)) {
      return 'Alright — say when you need the next step.';
    }
    if (/^(thanks|thank you|thx|ty)[!., ]*$/i.test(q)) {
      return 'Anytime.';
    }
    if (/^(yes|yep|yeah|y)[!., ]*$/i.test(q)) {
      return 'Okay — go ahead with the details when ready.';
    }
    if (/^(no|nope|nah)[!., ]*$/i.test(q)) {
      return 'No problem. What else?';
    }
    return null;
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault?.();
    const text = (overrideText ?? inputPrompt).trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const query = text;
    setInputPrompt('');
    setTaskRun(null);
    setIsThinking(true);

    const facilityId = session?.hospitalId || 'IGH-EKT';
    const facilityName = session?.facility || 'Hospital';
    const actorRole = normalizeRoleKey(session);

    // Hard stop: out-of-role requests
    const refusal = refuseIfOutOfRole(query, actorRole);
    if (refusal) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ai`,
          sender: 'm87',
          text: refusal,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'operational',
        },
      ]);
      setIsThinking(false);
      return;
    }

    
    // Tiny chat — natural one-liners
    const tiny = naturalDeskReply(query);
    if (tiny) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ai`,
          sender: 'm87',
          text: tiny,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'operational',
        },
      ]);
      setIsThinking(false);
      return;
    }




    // Front desk automation (full desk) — uses recent chat so follow-ups keep memory
    if (canAutomateReception(actorRole) || true) {
      const recentTurns: ChatTurn[] = messages
        .slice(-12)
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          text: m.text,
        }))
        .concat([{ role: 'user', text: query }]);

      let action = resolveFrontDeskAction(query, {
        recentTurns,
        lastPatientRef,
        pendingSendAccounts,
        pendingReceptionJob,
      });

      // AI fill for natural register if needed
      if (action.type === 'none' || (action.type === 'register' && !('job' in action))) {
        /* continue */
      }
      if (action.type === 'none' && /\b(register|enrol|patient|folder|check\s*-?in|queue|accounts?)\b/i.test(query)) {
        try {
          const aiJob = await extractReceptionJobWithAI(
            recentTurns.filter((x) => x.role === 'user').map((x) => x.text).slice(-4).join(' · '),
            facilityId
          );
          if (aiJob) action = { type: 'register', job: aiJob };
        } catch {
          /* ignore */
        }
      }

      if (action.type !== 'none') {
        if (!canAutomateReception(actorRole)) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-ai`,
              sender: 'm87',
              text: receptionAutomationRefusal(actorRole),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              category: 'operational',
            },
          ]);
          setIsThinking(false);
          return;
        }

        const runSteps = async (
          title: string,
          labels: string[],
          work: () => Promise<string>
        ) => {
          const steps = labels.map((label, i) => ({
            id: `s${i}`,
            label,
            status: 'pending' as TaskStepStatus,
          }));
          setTaskRun({ title, steps });
          const mark = (i: number, status: TaskStepStatus) => {
            setTaskRun((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map((s, idx) => {
                  if (idx === i) return { ...s, status };
                  if (status === 'active' && s.status === 'active') return { ...s, status: 'done' };
                  return s;
                }),
              };
            });
          };
          try {
            for (let i = 0; i < labels.length - 1; i++) {
              mark(i, 'active');
              await sleep(280 + (i === 0 ? 120 : 0));
              mark(i, 'done');
            }
            mark(labels.length - 1, 'active');
            const text = await work();
            mark(labels.length - 1, 'done');
            return text;
          } catch (e) {
            mark(labels.length - 1, 'error');
            throw e;
          }
        };

        let reply = '';
        try {
          if (action.type === 'confirm_pending') {
            reply =
              lastPatientRef
                ? `Still on **${lastPatientRef}**. Say check-in, send to accounts, or assign Dr Name.`
                : 'What should I run? Register a patient, send to accounts, check-in, or show the queue.';
          } else if (action.type === 'queue_list') {
            reply = await runSteps(
              'Celestia Queue',
              ['Initiating MedCore Celestial Power…', 'Reading live OPD queue…', 'Done'],
              async () => listWaitingQueueSummary(facilityId)
            );
          } else if (action.type === 'registry_count') {
            reply = await runSteps(
              'Celestia Registry',
              ['Initiating MedCore Celestial Power…', 'Counting facility registry…', 'Done'],
              async () => registryCountSummary(facilityId)
            );
          } else if (action.type === 'registry_list') {
            reply = await runSteps(
              'Celestia Registry',
              ['Initiating MedCore Celestial Power…', 'Loading patient names…', 'Done'],
              async () => registryListSummary(facilityId)
            );
          } else if (action.type === 'lookup') {
            const ref = action.patientRef;
            reply = await runSteps(
              'Celestia Lookup',
              ['Initiating MedCore Celestial Power…', `Finding ${ref}…`, 'Done'],
              async () => {
                setLastPatientRef(ref);
                return lookupPatientSummary(facilityId, ref);
              }
            );
          } else if (action.type === 'send_accounts_need_patient') {
            setPendingSendAccounts(true);
            reply = lastPatientRef
              ? `Send **${lastPatientRef}** to Accounts? Say **yes** or give another hospital number.`
              : 'Which patient? Name or hospital number (e.g. IGH-PT-2CKAR3).';
          } else if (action.type === 'send_accounts') {
            const ref = action.patientRef;
            reply = await runSteps(
              'Celestia → Accounts',
              [
                'Initiating MedCore Celestial Power…',
                `Looking up ${ref}…`,
                'Checking charges & handoffs…',
                'Routing to Accounts…',
                'Done',
              ],
              async () => {
                const result = sendPatientToAccounts({
                  facilityId,
                  facilityName,
                  patientRef: ref,
                  actorName: session?.name,
                  actorBadge: session?.badgeId,
                });
                if (result.hospitalNumber) setLastPatientRef(result.hospitalNumber);
                setPendingSendAccounts(false);
                try {
                  emitLiveAction(`Celestia → Accounts ${result.hospitalNumber || ref}`, {
                    module: 'reception',
                  });
                } catch {
                  /* ignore */
                }
                return result.message;
              }
            );
          } else if (action.type === 'check_in') {
            const ref = action.patientRef;
            reply = await runSteps(
              'Celestia Check-in',
              [
                'Initiating MedCore Celestial Power…',
                `Opening visit for ${ref}…`,
                'Writing queue ticket…',
                'Done',
              ],
              async () => {
                const r = checkInPatientByRef({
                  facilityId,
                  patientRef: ref,
                  department: action.department,
                  doctor: action.doctor,
                });
                setLastPatientRef(ref);
                if (r.ok) {
                  try {
                    emitLiveAction(`Celestia check-in ${ref}`, { module: 'reception' });
                  } catch {
                    /* ignore */
                  }
                }
                return r.message;
              }
            );
          } else if (action.type === 'assign_doctor') {
            reply = await runSteps(
              'Celestia Assign Doctor',
              ['Initiating MedCore Celestial Power…', 'Updating assignment…', 'Notifying clinician…', 'Done'],
              async () => {
                const r = assignDoctorByRef({
                  facilityId,
                  patientRef: action.patientRef,
                  doctor: action.doctor,
                });
                return r.message;
              }
            );
          } else if (action.type === 'book_appointment') {
            reply = await runSteps(
              'Celestia Appointment',
              ['Initiating MedCore Celestial Power…', 'Booking slot…', 'Done'],
              async () => {
                const r = bookAppointmentByRef({
                  facilityId,
                  patientRef: action.patientRef,
                  department: action.department,
                  doctor: action.doctor,
                });
                return r.message;
              }
            );
          } else if (action.type === 'register') {
            let job: ReceptionRegJob | undefined = action.job;
            if (!job) {
              try {
                const extracted = await extractReceptionJobWithAI(
                  recentTurns
                    .filter((x) => x.role === 'user')
                    .map((x) => x.text)
                    .slice(-4)
                    .join(' · '),
                  facilityId
                );
                if (extracted) job = extracted;
              } catch {
                /* ignore */
              }
            }
            if (!job) {
              reply =
                'Who should I register? Name and sex is enough — e.g. *Michael James, male, new to the hospital*.';
            } else {
              setPendingReceptionJob(job);
              reply = await runSteps(
                'Celestia Front Desk Automation',
                [
                  'Initiating MedCore Celestial Power…',
                  `Opening folder for ${job.firstName} ${job.lastName}…`,
                  'Writing patient to registry…',
                  'Creating folder fee…',
                  'Sending invoice to Accounts…',
                  'Done',
                ],
                async () => {
                  const r = registerNewPatientWithFolderFee({
                    job: job!,
                    facilityId,
                    facilityName,
                    actorName: session?.name,
                    actorBadge: session?.badgeId,
                  });
                  if (!r.ok) throw new Error(r.error || 'Registration failed');
                  if (r.hospitalNumber) setLastPatientRef(r.hospitalNumber);
                  setPendingReceptionJob(null);
                  try {
                    emitLiveAction(`Celestia registered ${r.hospitalNumber}`, { module: 'reception' });
                  } catch {
                    /* ignore */
                  }
                  const full = [job!.firstName, job!.middleName, job!.lastName].filter(Boolean).join(' ');
                  return (
                    `Done — **${full}** is on the registry.\n\n` +
                    `• Hospital No: **${r.hospitalNumber}**\n` +
                    `• Sex: ${job!.sex}\n` +
                    (r.invoiceNumber
                      ? `• Folder fee: **₦${(r.amountNgn || 0).toLocaleString()}** · Invoice **${r.invoiceNumber}** → Accounts (PENDING)\n\n` +
                        `Patient pays at Cashier, then returns here for check-in / queue.`
                      : `\nFolder opened. Continue on Patient Flow when ready.`)
                  );
                }
              );
            }
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
          setIsThinking(false);
          window.setTimeout(() => setTaskRun(null), 2200);
          return;
        } catch (err: unknown) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-ai`,
              sender: 'm87',
              text: `Front desk automation error: ${(err as Error)?.message || 'failed'}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              category: 'operational',
            },
          ]);
          setIsThinking(false);
          setTaskRun(null);
          return;
        }
      }
    }

    // Role visibility automation    // Role visibility automation
    const lowerQ = query.toLowerCase();
    if (
      (lowerQ.includes('role') && (lowerQ.includes('can see') || lowerQ.includes('permission') || lowerQ.includes('visibility') || lowerQ.includes('module'))) ||
      lowerQ.startsWith('allow ') ||
      lowerQ.startsWith('deny ') ||
      lowerQ.includes('enable module') ||
      lowerQ.includes('set role')
    ) {
      if (!canChangeRoleVisibility(actorRole)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'm87',
            text: roleVisibilityRefusal(actorRole),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'operational',
          },
        ]);
        setIsThinking(false);
        return;
      }
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
      if (!canAutomateStaff(actorRole)) {
        reply = staffAutomationRefusal(actorRole);
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
        setIsThinking(false);
        setTaskRun(null);
        return;
      }

      const jobCount = staffIntent.jobs.length;
      const steps: TaskStep[] = [
        { id: 'power', label: 'Initiating MedCore Celestial Power…', status: 'pending' },
        { id: 'parse', label: 'Reading staff enrolment request…', status: 'pending' },
        {
          id: 'create',
          label:
            jobCount > 1
              ? `Creating ${jobCount} staff accounts…`
              : `Creating account for ${staffIntent.jobs[0]?.fullName || 'staff'}…`,
          status: 'pending',
        },
        { id: 'card', label: 'Issuing ID cards & access rights…', status: 'pending' },
        { id: 'sync', label: 'Syncing facility cloud directory…', status: 'pending' },
        { id: 'done', label: 'Finalizing automation…', status: 'pending' },
      ];
      setTaskRun({ title: 'Celestia Access Automation', steps });

      const mark = (id: string, status: TaskStepStatus) => {
        setTaskRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            steps: prev.steps.map((s) => {
              if (s.id === id) return { ...s, status };
              if (status === 'active' && s.status === 'active') return { ...s, status: 'done' };
              return s;
            }),
          };
        });
      };

      try {
        mark('power', 'active');
        await sleep(450);
        mark('power', 'done');
        mark('parse', 'active');
        await sleep(350);
        mark('parse', 'done');
        mark('create', 'active');
        await sleep(200);

        if (jobCount === 1) {
          const r = await createStaffAccountWithCard(staffIntent.jobs[0]);
          if (r.ok) {
            mark('create', 'done');
            mark('card', 'active');
            await sleep(400);
            mark('card', 'done');
            mark('sync', 'active');
            await sleep(300);
            mark('sync', 'done');
            mark('done', 'active');
            await sleep(250);
            mark('done', 'done');
            reply = `Celestia Access Automation complete.\n\n• Name: ${staffIntent.jobs[0].fullName}\n• Badge: ${r.badgeId}\n• Role: ${staffIntent.jobs[0].roleKey}\n• PIN: (as specified / default 123456)\n\nStaff can Sign in with ID No. using badge + PIN. Open Staff Access Control to view the card.`;
            emitLiveAction(`Celestia enrolled ${r.badgeId}`, { module: 'ai-access' });
          } else {
            mark('create', 'error');
            reply = `Celestia could not create account: ${r.error || 'unknown error'}`;
          }
        } else if (jobCount > 1) {
          const { summary } = await bulkCreateStaff(staffIntent.jobs);
          mark('create', 'done');
          mark('card', 'active');
          await sleep(400);
          mark('card', 'done');
          mark('sync', 'active');
          await sleep(300);
          mark('sync', 'done');
          mark('done', 'active');
          await sleep(250);
          mark('done', 'done');
          reply = `Celestia Bulk Access Automation complete.\n\n${summary}\n\nAll successful accounts have ID cards and badge login. Review under Staff Access Control.`;
          emitLiveAction(`Celestia bulk enrol ×${jobCount}`, { module: 'ai-access' });
        } else {
          mark('parse', 'done');
          mark('done', 'done');
        }
      } catch (err: unknown) {
        setTaskRun((prev) =>
          prev
            ? {
                ...prev,
                steps: prev.steps.map((s) =>
                  s.status === 'active' ? { ...s, status: 'error' as const } : s
                ),
              }
            : prev
        );
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
      // Keep task trail visible briefly then clear
      window.setTimeout(() => setTaskRun(null), 2200);
      return;
    }

    // Gemini when available → else Celestia offline (local hospital knowledge)
    let reply =
      'Celestia is offline for full chat right now. Ask about beds, revenue, or the queue — or if you are admin, say enrol nurse Ada Okon pin 123456.';
    let cat: ChatMessage['category'] = 'clinical';
    let offlineMode = false;

    const fid = session?.hospitalId || 'IGH-EKT';
    const rag = buildM87RagContext(query, fid);
    const localHits = retrieveRelevantExamples(query, fid, 1);
    const gemini = await geminiGenerate(query, buildCelestiaSystemPrompt(session), rag, fid);
    setGeminiOnline(Boolean(gemini.ok && gemini.usedGemini));

    if (gemini.ok && gemini.text) {
      reply = gemini.text;
      cat = 'clinical';
      offlineMode = false;
    } else {
      offlineMode = true;
      const lower = query.toLowerCase();
      if (localHits[0]) {
        reply =
          localHits[0].idealOutput +
          '\n\n— Celestia offline · using hospital knowledge base.';
        cat = 'operational';
      } else if (lower.includes('bed') || lower.includes('surge') || lower.includes('capacity') || lower.includes('ward')) {
        reply =
          'Beds are under **Bed & Ward Occupancy** — live counts, >90% wards, and long-stay. Open that screen for the board.';
        cat = 'operational';
      } else if (lower.includes('money') || lower.includes('revenue') || lower.includes('hmo') || lower.includes('billing') || lower.includes('payment')) {
        reply =
          'For money and unpaid bills, open **Accounts / Cashier**. Front desk still queues payment in realtime after enrolment.';
        cat = 'financial';
      } else if (lower.includes('access') || lower.includes('id card') || lower.includes('badge') || lower.includes('enrol') || lower.includes('staff')) {
        reply = canAutomateStaff(actorRole)
          ? 'Chat model is offline, but enrolment automation still works. Say enrol doctor Full Name pin 123456 and I will run the steps.'
          : staffAutomationRefusal(actorRole);
        cat = 'operational';
      } else if (lower.includes('queue') || lower.includes('opd') || lower.includes('waiting')) {
        reply =
          'Live OPD queue is on **Reception / Front Desk** — visits and payment gates update without reload.';
        cat = 'operational';
      } else {
        reply =
          "I'm offline for deep chat right now. I can still point you to beds, revenue, or the queue — or run staff enrolment if you are admin. What do you need?";
        cat = 'operational';
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
    setFeedbackState((prev) => ({ ...prev, [msg.id]: rating }));
    liveAlert(rating === 1 ? 'Saved to Celestia training set' : 'Feedback noted', 'm87-ai', fid);
  };

  const handleCopy = (id: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 2000);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputPrompt('');
    setIsThinking(false);
    setStreamingId(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  };

  const handleInputChange = (val: string) => {
    setInputPrompt(val);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const roleKey = String(session?.roleKey || '').toLowerCase();

  const roleIntro = useMemo(() => {
    const map: Record<string, { title: string; sub: string }> = {
      reception: {
        title: 'Ready for the front desk?',
        sub: 'Your reception copilot. Check-ins, live queue, appointments, and send patients to Accounts — without leaving the desk.',
      },
      records: {
        title: 'Ready for records?',
        sub: 'Your records copilot. Find patients, open folders, and keep registration and flow accurate in real time.',
      },
      doctor: {
        title: 'Ready for clinic?',
        sub: 'Your clinical copilot. Patients on your list, results, prescriptions, and ward notes — clear next steps, not noise.',
      },
      surgeon: {
        title: 'Ready for theatre?',
        sub: 'Your surgical copilot. Lists, PACU beds, post-op orders, and urgent results when you need them.',
      },
      nurse: {
        title: 'Ready for the ward?',
        sub: 'Your nursing copilot. Beds, e-MAR tasks, vitals, and who needs attention on your unit now.',
      },
      midwife: {
        title: 'Ready for maternity?',
        sub: 'Your midwifery copilot. Labour board, maternal–newborn flow, and urgent alerts for your bay.',
      },
      pharmacist: {
        title: 'Ready for pharmacy?',
        sub: 'Your pharmacy copilot. Pending Rx, stock, patient lookup, and dispense follow-up in one place.',
      },
      lab: {
        title: 'Ready for the lab?',
        sub: 'Your lab copilot. Pending orders, TAT, critical values, and what to release to the doctor desk.',
      },
      radiologist: {
        title: 'Ready for imaging?',
        sub: 'Your radiology copilot. Open studies, report drafts, and critical findings for the clinical team.',
      },
      cashier: {
        title: 'Ready for Accounts?',
        sub: 'Your accounts copilot. Awaiting payment from Front Desk, collections today, and open hospital bills.',
      },
      accountant: {
        title: 'Ready for the AR desk?',
        sub: 'Your finance copilot. Debtors, HMO claims, daily collections, and what needs follow-up now.',
      },
      hospital_admin: {
        title: 'Ready to run the hospital?',
        sub: 'Your admin copilot. Staff on duty, access, occupancy, revenue signals, and what needs your decision.',
      },
      admin: {
        title: 'Ready to run the hospital?',
        sub: 'Your admin copilot. Staff on duty, access, occupancy, revenue signals, and what needs your decision.',
      },
    };
    return (
      map[roleKey] || {
        title: 'What can I coordinate for you?',
        sub: 'Your MedCore hospital copilot. Ask about the work on your desk — queues, patients, orders, or ops — in plain language.',
      }
    );
  }, [roleKey]);

  const suggestions = useMemo(() => {
    const byRole: Record<string, { label: string; icon: typeof Users; tag: string }[]> = {
      reception: [
        { label: 'Who is waiting in OPD?', icon: Users, tag: 'Queue' },
        { label: 'Send next patient to Accounts', icon: Wallet, tag: 'Billing' },
        { label: 'Today’s appointments', icon: Activity, tag: 'Appts' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      doctor: [
        { label: 'My patients waiting', icon: Users, tag: 'Clinic' },
        { label: 'Unreviewed lab results', icon: Activity, tag: 'Results' },
        { label: 'Pending prescriptions', icon: Activity, tag: 'Rx' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      nurse: [
        { label: 'Beds on my ward', icon: BedDouble, tag: 'Beds' },
        { label: 'Tasks due now', icon: Activity, tag: 'Tasks' },
        { label: 'Patients needing vitals', icon: Users, tag: 'Ward' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      pharmacist: [
        { label: 'Pending prescriptions', icon: Activity, tag: 'Rx' },
        { label: 'Low stock items', icon: Activity, tag: 'Stock' },
        { label: 'Lookup patient by ID', icon: Users, tag: 'Patient' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      lab: [
        { label: 'Pending lab orders', icon: Activity, tag: 'Orders' },
        { label: 'Critical values today', icon: Activity, tag: 'Critical' },
        { label: 'TAT status', icon: Activity, tag: 'Ops' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      cashier: [
        { label: 'Awaiting payment queue', icon: Wallet, tag: 'Pay' },
        { label: 'Collected today', icon: Wallet, tag: 'Cash' },
        { label: 'Open hospital bills', icon: Wallet, tag: 'AR' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      accountant: [
        { label: 'Awaiting payment queue', icon: Wallet, tag: 'Pay' },
        { label: 'HMO claims status', icon: Wallet, tag: 'HMO' },
        { label: 'Aged debtors', icon: Wallet, tag: 'AR' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      hospital_admin: [
        { label: 'Staff logged in now', icon: Users, tag: 'Staff' },
        { label: 'Bed occupancy', icon: BedDouble, tag: 'Ops' },
        { label: 'Revenue today', icon: Wallet, tag: 'Finance' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
      admin: [
        { label: 'Staff logged in now', icon: Users, tag: 'Staff' },
        { label: 'Bed occupancy', icon: BedDouble, tag: 'Ops' },
        { label: 'Revenue today', icon: Wallet, tag: 'Finance' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ],
    };
    return (
      byRole[roleKey] || [
        { label: 'Who is waiting in OPD?', icon: Users, tag: 'Queue' },
        { label: 'Bed occupancy & ICU status', icon: BedDouble, tag: 'Operations' },
        { label: 'Unpaid bills today', icon: Wallet, tag: 'Billing' },
        { label: 'What needs attention?', icon: Activity, tag: 'Desk' },
      ]
    );
  }, [roleKey]);

  return (
    <div
      className={`m87-chat-shell celestia-cosmic celestia-grok${inDrawer ? ' is-in-drawer' : ' is-fullscreen'}`}
      ref={shellRef}
    >
      {/* Looping cosmic space video background with fallback gradient */}
      <video
        className="celestia-bg-video"
        src="/celestia-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      <div className="celestia-bg-veil" aria-hidden />

      {/* Header — Always Persistent to eliminate layout shifts */}
      <header className="m87-chat-header celestia-header">
        <div className="celestia-header-brand">
          <div className="celestia-avatar-mark celestia-avatar-header" aria-hidden>
            <img src="/celestia-logo.png" alt="" />
          </div>
          <div className="m87-header-text">
            <div className="m87-title-row">
              <h1 className="m87-title celestia-wordmark">celestia</h1>
              <span
                className={`m87-live-dot${geminiOnline === false ? ' is-offline' : geminiOnline ? ' is-online' : ''}`}
                title={
                  geminiOnline === false
                    ? 'Offline — local desk mode'
                    : geminiOnline
                      ? 'Online — cloud model ready'
                      : 'Checking connection…'
                }
              />
              <span className="m87-live-label">
                {geminiOnline === false ? 'Offline' : geminiOnline ? 'Online' : engineReady ? 'Ready' : '…'}
              </span>
              <span className="celestia-facility-tag">{session?.hospitalId || 'IGH-EKT'}</span>
            </div>
            <div className="celestia-header-sub">
              Hospital Intelligence {modelVer ? `· v${modelVer}` : ''}
            </div>
          </div>
        </div>

        <div className="celestia-header-actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="celestia-hdr-action-btn mc-btn-live"
              onClick={handleNewChat}
              title="Start a new chat session"
            >
              <RotateCcw size={13} />
              <span>New Chat</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="celestia-hdr-action-btn celestia-hdr-close-btn"
              onClick={onClose}
              title="Close Celestia"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Message List & Empty State View */}
      <div className="m87-messages celestia-messages" ref={listRef}>
        <div className="celestia-messages-inner">
          {messages.length === 0 && !isThinking && (
            <div className="m87-empty celestia-hero celestia-empty-grok">
              <h2 className="m87-empty-title celestia-hello">{roleIntro.title}</h2>
              <p className="m87-empty-sub">{roleIntro.sub}</p>
              <div className="m87-suggestions">
                {suggestions.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      className="m87-chip mc-btn-live"
                      onClick={() => {
                        void handleSend(undefined, s.label);
                      }}
                    >
                      <Icon size={14} className="celestia-chip-icon" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const mine = msg.sender === 'user';
            const hasCopied = copiedId === msg.id;
            const currentRating = feedbackState[msg.id];

            return (
              <div
                key={msg.id}
                className={mine ? 'm87-row m87-row-user mc-user-msg-in' : 'm87-row m87-row-ai mc-ai-msg-in'}
              >
                {!mine && (
                  <div className="celestia-avatar-mark celestia-avatar-msg" aria-hidden>
                    <img src="/celestia-logo.png" alt="" />
                  </div>
                )}
                <div className={mine ? 'm87-bubble m87-bubble-user' : 'm87-bubble m87-bubble-ai'}>
                  {!mine ? (
                    <>
                      <StreamingText text={msg.text} animate={streamingId === msg.id} />
                      <div className="m87-feedback">
                        <button
                          type="button"
                          className={`m87-fb mc-btn-live${hasCopied ? ' is-active' : ''}`}
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy reply"
                        >
                          {hasCopied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                          <span style={{ fontSize: 10, marginLeft: 3 }}>
                            {hasCopied ? 'Copied' : 'Copy'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`m87-fb mc-btn-live${currentRating === 1 ? ' is-active' : ''}`}
                          onClick={() => rateMessage(msg, 1)}
                          title="Good response — teach Celestia"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={`m87-fb mc-btn-live${currentRating === -1 ? ' is-active' : ''}`}
                          onClick={() => rateMessage(msg, -1)}
                          title="Not helpful"
                        >
                          👎
                        </button>
                        <span className="m87-time">{msg.timestamp}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="celestia-user-text">{msg.text}</div>
                      <div className="m87-time m87-time-user">{msg.timestamp}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {(isThinking || taskRun) && (
            <div className="m87-row m87-row-ai mc-ai-msg-in">
              <div className="celestia-avatar-mark celestia-avatar-msg" aria-hidden>
                <img src="/celestia-logo.png" alt="" />
              </div>
              <div className={`m87-bubble m87-bubble-ai m87-thinking${taskRun ? ' celestia-task-run' : ''}`}>
                {taskRun ? (
                  <div className="celestia-task-panel">
                    <div className="celestia-task-title">{taskRun.title}</div>
                    <ul className="celestia-task-steps">
                      {taskRun.steps.map((s) => (
                        <li key={s.id} className={`celestia-task-step is-${s.status}`}>
                          <span className="celestia-task-ico" aria-hidden>
                            {s.status === 'done' ? '✓' : s.status === 'error' ? '!' : s.status === 'active' ? '◉' : '○'}
                          </span>
                          <span className="celestia-task-label">{s.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    <div className="mc-typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="m87-thinking-label">
                      {geminiOnline === false ? 'Celestia offline · local desk…' : 'Celestia is analyzing…'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer Input Form */}
      <form
        className="m87-composer celestia-composer"
        onSubmit={(e) => {
          void handleSend(e);
        }}
      >
        <div className="celestia-composer-container">
          <div className="m87-composer-inner">
            <button
              type="button"
              className="celestia-plus"
              aria-label="New chat"
              onClick={handleNewChat}
              title="Reset conversation"
            >
              <RotateCcw size={16} />
            </button>
            <textarea
              ref={inputRef}
              className="m87-input"
              rows={1}
              placeholder="Message Celestia…"
              value={inputPrompt}
              onChange={(e) => handleInputChange(e.target.value)}
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
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/** @deprecated use Celestia naming — same component */
export const CelestiaAICopilotSuite = M87AICopilotSuite;
