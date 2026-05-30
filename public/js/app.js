/* ═══════════════════════════════════════════════════════════
   N.E.X.U.S. — Main Application Logic v2.0
   Voice + Text + Socket.io + System Commands
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────
  const app          = document.getElementById('app');
  const bootScreen   = document.getElementById('boot-screen');
  const bootLog      = document.getElementById('boot-log');
  const messagesEl   = document.getElementById('messages-container');
  const welcomeEl    = document.getElementById('welcome-msg');
  const textInput    = document.getElementById('text-input');
  const sendBtn      = document.getElementById('send-btn');
  const micBtn       = document.getElementById('mic-btn');
  const micLabel     = document.getElementById('mic-label');
  const clearBtn     = document.getElementById('clear-btn');
  const typingEl     = document.getElementById('typing-indicator');
  const interimEl    = document.getElementById('interim-text');
  const hudLabel     = document.querySelector('.hud-label');
  const msgCountEl   = document.getElementById('msg-count');
  const apiDot       = document.getElementById('api-dot');
  const apiLabel     = document.getElementById('api-label');
  const cmdLogList   = document.getElementById('cmd-log-list');
  const skillChips   = document.querySelectorAll('.skill-chip');

  // Sys info els
  const sOs    = document.getElementById('s-os');
  const sCpu   = document.getElementById('s-cpu');
  const sCores = document.getElementById('s-cores');
  const sRam   = document.getElementById('s-ram');
  const sUp    = document.getElementById('s-uptime');
  const sHost  = document.getElementById('s-host');
  const sNet   = document.getElementById('s-net');
  const memFill = document.getElementById('mem-fill');
  const memPct  = document.getElementById('mem-pct');

  // ── State ─────────────────────────────────────────────────
  let socket       = null;
  let recognition  = null;
  let isListening  = false;
  let isSpeaking   = false;
  let msgHistory   = []; // for AI context
  let msgCount     = 0;
  let audioCtx     = null;
  let analyser     = null;
  let micStream    = null;
  let ttsEnabled   = true;
  let currentAIRow = null;
  let currentAIBubble = null;
  let currentAIText = '';
  let streamCursor  = null;
  let toastTimer    = null;

  // ── Boot sequence ─────────────────────────────────────────
  const bootLines = [
    '> Initializing neural core…',
    '> Loading language models…',
    '> Establishing secure socket…',
    '> Calibrating voice pipeline…',
    '> Mounting system interfaces…',
    '> Loading command registry…',
    '> Warming up TTS engine…',
    '> N.E.X.U.S. v2.0 READY ✓'
  ];

  function addBootLine(txt) {
    const d = document.createElement('div');
    d.className = 'log-line';
    d.textContent = txt;
    bootLog.appendChild(d);
    bootLog.scrollTop = bootLog.scrollHeight;
  }

  function runBoot() {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootLines.length) addBootLine(bootLines[i++]);
      else {
        clearInterval(interval);
        setTimeout(() => {
          bootScreen.classList.add('fade-out');
          app.classList.remove('hidden');
          initApp();
        }, 500);
      }
    }, 320);
  }

  // ── Clock ─────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').textContent =
      now.toLocaleTimeString('en-GB', { hour12: false });
    document.getElementById('clock-date').textContent =
      now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, type = 'info', dur = 3200) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.className = type;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), dur);
  }

  // ── Command log ───────────────────────────────────────────
  function logCommand(txt) {
    const entry = document.createElement('div');
    entry.className = 'cmd-log-entry';
    const now = new Date();
    const ts = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<span class="cmd-time">${ts}</span><span class="cmd-txt">${txt.slice(0, 48)}</span>`;
    cmdLogList.insertBefore(entry, cmdLogList.firstChild);
    while (cmdLogList.children.length > 20) cmdLogList.removeChild(cmdLogList.lastChild);
  }

  // ── Socket.io ─────────────────────────────────────────────
  function initSocket() {
    socket = io();

    socket.on('connect', () => {
      apiDot.className = 'status-dot connected';
      apiLabel.textContent = 'LIVE';
      toast('Socket connected', 'success', 2000);
      socket.emit('get_sysinfo');
      socket.emit('ping');
    });

    socket.on('disconnect', () => {
      apiDot.className = 'status-dot error';
      apiLabel.textContent = 'LOST';
      toast('Connection lost – check server', 'error', 5000);
    });

    socket.on('pong', ({ ts, platform }) => {
      const ping = Date.now() - ts;
      apiLabel.textContent = `${ping}ms`;
    });

    socket.on('sysinfo', info => updateSysInfo(info));

    socket.on('ai_stream', ({ token, done, full }) => {
      if (!currentAIBubble) return;
      if (token) {
        currentAIText += token;
        if (streamCursor) streamCursor.remove();
        currentAIBubble.innerHTML = markdownToHTML(currentAIText);
        streamCursor = document.createElement('span');
        streamCursor.className = 'stream-cursor';
        currentAIBubble.appendChild(streamCursor);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        NexusOrb.setAmplitude(0.4 + Math.random() * 0.3);
      }
      if (done) {
        if (streamCursor) { streamCursor.remove(); streamCursor = null; }
        currentAIBubble.innerHTML = markdownToHTML(full || currentAIText);
        addTimestamp(currentAIRow);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        currentAIRow = null;
        currentAIBubble = null;
        currentAIText = '';
        typingEl.classList.add('hidden');
        NexusOrb.setState('IDLE');
        if (ttsEnabled && full) speakText(extractSpeakable(full));
      }
    });

    socket.on('ai_error', ({ message }) => {
      typingEl.classList.add('hidden');
      NexusOrb.setState('IDLE');
      addMessage('system', `⚠ ${message}`);
      toast(message.slice(0, 80), 'error', 5000);
    });

    socket.on('command_result', data => {
      if (data.type === 'system_info' && data.info) updateSysInfo(data.info);
      if (data.error) toast(`Error: ${data.error}`, 'error');
      else if (data.message) toast(data.message, 'success');
    });
  }

  // ── System info ───────────────────────────────────────────
  function updateSysInfo(info) {
    sOs.textContent    = info.os || '—';
    sCpu.textContent   = (info.cpu || '—').slice(0, 26);
    sCores.textContent = info.cores || '—';
    sRam.textContent   = `${info.memory_used || '?'} / ${info.memory_total || '?'}`;
    sUp.textContent    = info.uptime || '—';
    sHost.textContent  = info.hostname || '—';
    sNet.textContent   = (info.network?.[0] || '—').slice(0, 22);
    const pct = parseInt(info.memory_pct) || 0;
    memFill.style.width = pct + '%';
    memPct.textContent  = pct + '%';
  }

  // ── Voice Recognition ─────────────────────────────────────
  function initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition not supported in this browser';
      micLabel.textContent = 'UNSUPPORTED';
      return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = 'LISTENING';
      hudLabel.textContent = 'LISTENING';
      NexusOrb.setState('LISTENING');
      startMicVisualizer();
    };

    recognition.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += t) : (interim += t);
      }
      interimEl.textContent = interim || final;
      if (final) processInput(final.trim());
    };

    recognition.onend = () => stopListening();
    recognition.onerror = e => {
      stopListening();
      if (e.error !== 'no-speech' && e.error !== 'aborted')
        toast(`Mic error: ${e.error}`, 'error');
    };
  }

  function startListening() {
    if (!recognition) return toast('Speech not supported', 'error');
    try { recognition.start(); } catch (_) {}
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'ACTIVATE';
    hudLabel.textContent = 'READY';
    interimEl.textContent = '';
    stopMicVisualizer();
    if (NexusOrb) NexusOrb.setState('IDLE');
  }

  // ── Mic audio visualizer ──────────────────────────────────
  async function startMicVisualizer() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const src = audioCtx.createMediaStreamSource(micStream);
      src.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      NexusOrb.setAnalyser(analyser, freqData);
    } catch (e) {
      // Permission denied or not available – fallback to fake waveform
    }
  }

  function stopMicVisualizer() {
    NexusOrb.setAnalyser(null, null);
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (audioCtx)  { audioCtx.close(); audioCtx = null; }
    analyser = null;
  }

  // ── TTS ───────────────────────────────────────────────────
  function speakText(text) {
    if (!text || !ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 1.0;
    utter.pitch = 0.95;
    utter.volume = 0.9;

    // Pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v =>
      v.name.includes('Google UK') || v.name.includes('Daniel') ||
      v.name.includes('Alex')      || v.lang === 'en-GB'
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (pref) utter.voice = pref;

    utter.onstart  = () => { isSpeaking = true;  NexusOrb.setState('SPEAKING'); };
    utter.onend    = () => { isSpeaking = false; NexusOrb.setState('IDLE'); };
    utter.onerror  = () => { isSpeaking = false; NexusOrb.setState('IDLE'); };
    window.speechSynthesis.speak(utter);
  }

  function extractSpeakable(md) {
    return md
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 300);
  }

  // ── Command parser ────────────────────────────────────────
  const CMD_PATTERNS = [
    // Open URL / website
    { re: /^(?:open|go to|launch|navigate to|visit)\s+(https?:\/\/\S+|\S+\.\S+)/i,
      fn: m => execCommand('open_url', { url: m[1] }), label: m => `Opening ${m[1]}` },

    // Google Maps navigation
    { re: /(?:navigate|directions?|get directions?|open (?:google )?maps)\s+(?:from\s+(.+?)\s+to\s+(.+)|to\s+(.+))/i,
      fn: m => {
        const dest = m[3] || m[2], orig = m[1];
        const q = orig ? `${orig} to ${dest}` : dest;
        execCommand('open_url', { url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${orig ? '&origin=' + encodeURIComponent(orig) : ''}` });
        return `Opening Google Maps: ${q}`;
      }, label: m => `Maps: ${m[3] || m[2]}` },

    // YouTube search
    { re: /(?:play|search youtube for|youtube)\s+(.+)/i,
      fn: m => execCommand('open_url', { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(m[1])}` }),
      label: m => `YouTube: ${m[1]}` },

    // Web search
    { re: /^(?:search|google|look up|find)\s+(.+)/i,
      fn: m => execCommand('open_url', { url: `https://www.google.com/search?q=${encodeURIComponent(m[1])}` }),
      label: m => `Searching: ${m[1]}` },

    // Wikipedia
    { re: /^(?:wiki(?:pedia)?|what is|define)\s+(.+)/i,
      fn: m => execCommand('open_url', { url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(m[1])}` }),
      label: m => `Wikipedia: ${m[1]}` },

    // Open app
    { re: /^(?:open|launch|start|run)\s+(notepad|calculator|calc|explorer|file explorer|cmd|terminal|powershell|paint|vs code|vscode|code|chrome|firefox|edge|spotify|discord|slack|task manager|taskmgr|control panel|settings|vlc|steam|zoom|telegram|whatsapp)/i,
      fn: m => execCommand('open_app', { app: m[1] }), label: m => `Launching ${m[1]}` },

    // System info
    { re: /^(?:system info|sys info|computer info|system status|what.s my (?:cpu|ram|memory|computer|system))/i,
      fn: () => { socket.emit('get_sysinfo'); execCommand('system_info', {}); },
      label: () => 'Fetching system info', reply: () => buildSysInfoReply() },

    // Volume
    { re: /^(?:volume|vol)\s+(up|down|mute)/i,
      fn: m => execCommand('volume', { action: m[1].toLowerCase() }),
      label: m => `Volume ${m[1]}` },
    { re: /^(?:mute|unmute)$/i,
      fn: () => execCommand('volume', { action: 'mute' }), label: () => 'Muting/unmuting' },

    // Screenshot
    { re: /^(?:screenshot|take a screenshot|capture screen|screen capture)/i,
      fn: () => execCommand('screenshot', {}), label: () => 'Taking screenshot' },

    // Time / date
    { re: /^(?:what(?:'s| is) the (?:time|date|day)|current time|what time is it)/i,
      fn: null,
      label: () => 'Time',
      reply: () => {
        const now = new Date();
        return `**Current time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n**Date:** ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
      }
    },

    // Help
    { re: /^(?:help|what can you do|capabilities|commands|show commands)/i,
      fn: null, label: () => 'Help',
      reply: () => `**N.E.X.U.S. Capabilities:**\n\n**Browser Control**\n- "open youtube.com"\n- "navigate from Hyderabad to Bangalore"\n- "search for AI news"\n- "play lo-fi music on YouTube"\n\n**App Launch**\n- "open notepad", "launch Chrome", "start calculator"\n\n**System**\n- "system info" — CPU, RAM, uptime\n- "volume up / down / mute"\n- "screenshot"\n\n**AI Chat**\n- Just ask anything — I'll respond with full intelligence.\n\n**Voice**\n- Click the mic button and speak naturally.`
    }
  ];

  function execCommand(type, data) {
    if (!socket) return;
    socket.emit('command', { type, ...data });
  }

  function buildSysInfoReply() {
    const t = v => v || '—';
    return `**System Information:**\n\n- **OS:** ${t(sOs.textContent)}\n- **CPU:** ${t(sCpu.textContent)}\n- **Cores:** ${t(sCores.textContent)}\n- **RAM:** ${t(sRam.textContent)}\n- **Uptime:** ${t(sUp.textContent)}\n- **Host:** ${t(sHost.textContent)}\n- **Network:** ${t(sNet.textContent)}`;
  }

  // ── Process user input ────────────────────────────────────
  function processInput(input) {
    const text = input.trim();
    if (!text) return;

    // Hide welcome screen
    if (welcomeEl) welcomeEl.remove();

    addMessage('user', text);
    logCommand(text);
    msgHistory.push({ role: 'user', content: text });
    if (msgHistory.length > 20) msgHistory = msgHistory.slice(-20);

    // Check local commands first
    for (const pat of CMD_PATTERNS) {
      const m = text.match(pat.re);
      if (m) {
        if (pat.fn) pat.fn(m);
        const label = pat.label(m);
        const reply = pat.reply ? pat.reply(m) : `✓ ${label}`;
        toast(label, 'success', 2000);
        addMessage('ai', reply);
        msgHistory.push({ role: 'assistant', content: reply });
        return;
      }
    }

    // Send to AI
    sendToAI();
  }

  function sendToAI() {
    if (!socket) return;
    typingEl.classList.remove('hidden');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    NexusOrb.setState('THINKING');
    hudLabel.textContent = 'PROCESSING';

    currentAIText = '';
    currentAIRow  = createAIRow();
    currentAIBubble = currentAIRow.querySelector('.msg-bubble');

    socket.emit('ai_chat', { messages: msgHistory });

    setTimeout(() => {
      typingEl.classList.add('hidden');
      hudLabel.textContent = 'READY';
    }, 500);
  }

  // ── Message rendering ─────────────────────────────────────
  function addMessage(role, text) {
    msgCount++;
    msgCountEl.textContent = msgCount;

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    if (role !== 'system') {
      const av = document.createElement('div');
      av.className = 'msg-avatar';
      av.textContent = role === 'user' ? 'U' : 'N';
      row.appendChild(av);
    }

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = markdownToHTML(text);
    row.appendChild(bubble);

    if (role === 'ai') addTimestamp(row);

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function createAIRow() {
    msgCount++;
    msgCountEl.textContent = msgCount;

    const row = document.createElement('div');
    row.className = 'msg-row ai';

    const av = document.createElement('div');
    av.className = 'msg-avatar';
    av.textContent = 'N';
    row.appendChild(av);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    row.appendChild(bubble);

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function addTimestamp(row) {
    let meta = row.querySelector('.msg-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'msg-meta';
      row.appendChild(meta);
    }
    const now = new Date();
    meta.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Simple Markdown → HTML ────────────────────────────────
  function markdownToHTML(md) {
    if (!md) return '';
    let html = md
      // Code blocks
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code class="lang-${lang}">${escapeHtml(code.trim())}</code></pre>`)
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Headers
      .replace(/^#{1,3}\s(.+)$/gm, '<strong>$1</strong>')
      // Bullet lists
      .replace(/^\s*[-*]\s(.+)$/gm, '• $1')
      // Line breaks
      .replace(/\n/g, '<br>');
    return html;
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Event listeners ───────────────────────────────────────
  sendBtn.addEventListener('click', () => {
    const val = textInput.value.trim();
    if (!val) return;
    processInput(val);
    textInput.value = '';
  });

  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  micBtn.addEventListener('click', () => {
    if (isListening) { recognition?.stop(); stopListening(); }
    else startListening();
  });

  clearBtn.addEventListener('click', () => {
    messagesEl.innerHTML = '';
    msgHistory = [];
    msgCount = 0;
    msgCountEl.textContent = 0;
    // Re-add welcome
    const w = document.createElement('div');
    w.id = 'welcome-msg';
    w.className = 'welcome';
    w.innerHTML = `
      <div class="welcome-icon">⬡</div>
      <div class="welcome-title">N.E.X.U.S. ONLINE</div>
      <div class="welcome-sub">Speak or type a command · Ask anything · I control your system</div>
      <div class="welcome-hints">
        <span class="hint">Try: "open YouTube"</span>
        <span class="hint">Try: "what's my CPU?"</span>
        <span class="hint">Try: "search for AI news"</span>
      </div>`;
    messagesEl.appendChild(w);
    toast('Conversation cleared', 'success', 2000);
  });

  skillChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd;
      if (!cmd) return;
      if (cmd.endsWith(' ')) {
        textInput.value = cmd;
        textInput.focus();
      } else {
        processInput(cmd);
      }
    });
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.ctrlKey) { e.preventDefault(); micBtn.click(); }
    if (e.code === 'Slash' && !e.ctrlKey && document.activeElement !== textInput) {
      textInput.focus();
    }
  });

  // ── Init ──────────────────────────────────────────────────
  function initApp() {
    initSocket();
    initSpeech();
    // Sysinfo refresh every 30s
    setInterval(() => { if (socket?.connected) socket.emit('get_sysinfo'); }, 30000);
    NexusOrb.setState('IDLE');
    toast('N.E.X.U.S. ONLINE — Ready for commands', 'success', 3000);
  }

  // ── Start boot ────────────────────────────────────────────
  runBoot();
})();
