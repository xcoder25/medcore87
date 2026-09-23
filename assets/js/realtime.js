/* ============================================================
   HOSPITAL OS — REALTIME ENGINE (WebSocket + fallback)
   Connects to Hospital Gateway /ws for live clinical events
   ============================================================ */
window.Realtime = (() => {
  const listeners = new Map();
  let ws = null;
  let reconnectTimer = null;
  let clockTimer = null;
  let intentionalClose = false;
  let connected = false;
  let token = null;

  const WS_URL = (() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  })();

  function on(event, cb) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => listeners.get(event)?.delete(cb);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (set) set.forEach((cb) => { try { cb(payload); } catch (e) { console.warn('[Realtime]', e); } });
    window.dispatchEvent(new CustomEvent('hos:' + event, { detail: payload }));
  }

  function updateClocks() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    document.querySelectorAll('[data-live-clock]').forEach((el) => { el.textContent = timeStr; });
    document.querySelectorAll('[data-live-date]').forEach((el) => { el.textContent = dateStr; });
    emit('clock', { time: timeStr, date: dateStr, now });
  }

  function setConnectionUI(online) {
    connected = online;
    document.querySelectorAll('[data-ws-status]').forEach((el) => {
      el.textContent = online ? 'Live' : 'Reconnecting…';
      el.style.color = online ? 'var(--success)' : 'var(--warning)';
    });
    document.querySelectorAll('.live-dot').forEach((el) => {
      el.style.opacity = online ? '1' : '0.4';
    });
  }

  function handleServerEvent(envelope) {
    const { topic, payload } = envelope || {};
    if (!topic) return;
    const D = window.HOS_DATA;

    switch (topic) {
      case 'CONNECTED':
      case 'AUTH_OK':
        setConnectionUI(true);
        emit('connected', payload);
        break;

      case 'VITALS_UPDATED':
        if (D && payload?.patientId) {
          const p = D.patients?.find((x) => x.id === payload.patientId);
          if (p && payload.vitals) p.vitals = { ...p.vitals, ...payload.vitals };
        }
        emit('vitals', {
          patientId: payload.patientId,
          vitals: payload.vitals,
          patient: payload,
        });
        if (payload?.patientId && payload.vitals) {
          const pulseEl = document.querySelector(`[data-vital-pulse="${payload.patientId}"]`);
          const spo2El = document.querySelector(`[data-vital-spo2="${payload.patientId}"]`);
          if (pulseEl) {
            pulseEl.textContent = Math.round(payload.vitals.pulse);
            pulseEl.style.color = payload.vitals.pulse > 110 ? 'var(--critical)' : '';
          }
          if (spo2El) {
            spo2El.textContent = Math.round(payload.vitals.spo2) + '%';
            spo2El.style.color = payload.vitals.spo2 < 92 ? 'var(--critical)' : '';
          }
        }
        break;

      case 'QUEUES_UPDATED':
        if (D && D.queues) Object.assign(D.queues, payload);
        emit('queues', payload);
        break;

      case 'PHARMACY_UPDATED':
        if (D && payload?.item) {
          const idx = D.pharmacyQueue?.findIndex((x) => x.id === payload.item.id);
          if (idx >= 0) D.pharmacyQueue[idx] = payload.item;
        }
        emit('pharmacy', payload);
        break;

      case 'LAB_UPDATED':
        if (D && payload?.item) {
          const idx = D.labQueue?.findIndex((x) => x.id === payload.item.id);
          if (idx >= 0) D.labQueue[idx] = payload.item;
        }
        emit('lab', payload);
        break;

      case 'NOTIFICATION':
        if (D && D.notifications && payload) {
          D.notifications.unshift(payload);
        }
        emit('notification', payload);
        emit('badge-update', {});
        break;

      case 'BED_BOARD_UPDATED':
        if (D) {
          if (payload.bedBoard) D.bedBoard = payload.bedBoard;
          if (payload.metrics) Object.assign(D.facilityMetrics || {}, payload.metrics);
        }
        emit('beds', payload);
        break;

      case 'NURSING_TASK_UPDATED':
        if (D && payload?.task) {
          const idx = D.nursingTasks?.findIndex((x) => x.id === payload.task.id);
          if (idx >= 0) D.nursingTasks[idx] = payload.task;
        }
        emit('nursing-task', payload);
        break;

      default:
        emit(String(topic).toLowerCase(), payload);
    }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      console.warn('[Realtime] WebSocket unavailable, will retry', e);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setConnectionUI(true);
      if (token) ws.send(JSON.stringify({ action: 'AUTH', token }));
      ws.send(JSON.stringify({ action: 'SUBSCRIBE', topics: ['*'], app: 'HOSPITAL_OS' }));
      emit('ws-open', {});
    };

    ws.onmessage = (ev) => {
      try {
        handleServerEvent(JSON.parse(ev.data));
      } catch (_) {}
    };

    ws.onclose = () => {
      setConnectionUI(false);
      ws = null;
      if (!intentionalClose) scheduleReconnect();
    };

    ws.onerror = () => setConnectionUI(false);
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  function start(authToken) {
    intentionalClose = false;
    if (authToken) token = authToken;
    updateClocks();
    if (!clockTimer) clockTimer = setInterval(updateClocks, 1000);
    connect();
    setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'PING' }));
      }
    }, 25000);
  }

  function stop() {
    intentionalClose = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    if (ws) { try { ws.close(); } catch (_) {} ws = null; }
    setConnectionUI(false);
  }

  function isConnected() {
    return connected && ws && ws.readyState === WebSocket.OPEN;
  }

  function setToken(t) {
    token = t;
    if (ws && ws.readyState === WebSocket.OPEN && t) {
      ws.send(JSON.stringify({ action: 'AUTH', token: t }));
    }
  }

  return { on, emit, start, stop, isConnected, setToken, updateClocks };
})();
