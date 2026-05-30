/* ═══════════════════════════════════════════════
   N.E.X.U.S. — Neural Core Orb + Waveform
═══════════════════════════════════════════════ */

window.NexusOrb = (function () {
  const canvas  = document.getElementById('orb-canvas');
  const ctx     = canvas.getContext('2d');
  const wCanvas = document.getElementById('waveform-canvas');
  const wCtx    = wCanvas.getContext('2d');
  const stateEl = document.getElementById('orb-state-label');
  const pulseRing = document.getElementById('orb-pulse-ring');

  const W = 260, H = 260;
  let t = 0;
  let state = 'IDLE'; // IDLE | LISTENING | THINKING | SPEAKING
  let analyser = null;
  let freqData = null;
  let targetAmplitude = 0, currentAmplitude = 0;

  // ── State colors ──────────────────────────────
  const stateColors = {
    IDLE:       { core: '#00b8d4', glow: 'rgba(0,184,212,', outer: 'rgba(0,229,255,' },
    LISTENING:  { core: '#00ff9d', glow: 'rgba(0,255,157,', outer: 'rgba(0,255,157,' },
    THINKING:   { core: '#7c3aed', glow: 'rgba(124,58,237,', outer: 'rgba(167,139,250,' },
    SPEAKING:   { core: '#ff6e40', glow: 'rgba(255,110,64,',  outer: 'rgba(255,110,64,'  }
  };

  function getColors() { return stateColors[state] || stateColors.IDLE; }

  // ── Orb draw ──────────────────────────────────
  function drawOrb() {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const r = 80;
    const col = getColors();
    const amp = currentAmplitude;

    // Outer glow rings (pulsing)
    for (let i = 3; i >= 1; i--) {
      const gr = r + 14 * i + amp * 10 * i * 0.5;
      const alpha = (0.04 + amp * 0.05) / i;
      const grd = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, gr);
      grd.addColorStop(0, col.glow + alpha * 2.5 + ')');
      grd.addColorStop(1, col.glow + '0)');
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Main orb gradient
    const mainGrd = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r + amp * 8);
    mainGrd.addColorStop(0,   col.glow + '0.9)');
    mainGrd.addColorStop(0.4, col.glow + '0.5)');
    mainGrd.addColorStop(0.8, col.glow + '0.2)');
    mainGrd.addColorStop(1,   col.glow + '0.05)');
    ctx.beginPath();
    ctx.arc(cx, cy, r + amp * 8, 0, Math.PI * 2);
    ctx.fillStyle = mainGrd;
    ctx.fill();

    // Plasma surface noise
    if (state !== 'IDLE') {
      const noisePoints = 120;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + amp * 8 + 1, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < noisePoints; i++) {
        const a = (i / noisePoints) * Math.PI * 2;
        const noise = Math.sin(a * 7 + t * 0.06) * 5 * amp
                    + Math.sin(a * 13 - t * 0.04) * 3 * amp
                    + Math.cos(a * 5 + t * 0.08) * 4 * amp;
        const pr = r - 10 + noise;
        const px = cx + pr * Math.cos(a), py = cy + pr * Math.sin(a);
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = col.glow + (0.3 + amp * 0.4) + ')';
        ctx.fill();
      }
      ctx.restore();
    }

    // Inner bright core
    const coreGrd = ctx.createRadialGradient(cx - 20, cy - 20, 0, cx, cy, r * 0.7);
    coreGrd.addColorStop(0,   'rgba(255,255,255,0.9)');
    coreGrd.addColorStop(0.2, col.glow + '0.6)');
    coreGrd.addColorStop(1,   col.glow + '0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = coreGrd;
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.ellipse(cx - 22, cy - 22, 18, 12, -Math.PI / 5, 0, Math.PI * 2);
    const specGrd = ctx.createRadialGradient(cx - 22, cy - 22, 0, cx - 22, cy - 22, 18);
    specGrd.addColorStop(0, 'rgba(255,255,255,0.6)');
    specGrd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrd;
    ctx.fill();

    // Orbit particles
    const numOrbit = state === 'IDLE' ? 4 : 8;
    for (let i = 0; i < numOrbit; i++) {
      const angle = (i / numOrbit) * Math.PI * 2 + t * (state === 'IDLE' ? 0.008 : 0.02);
      const orr = r + 20 + amp * 15;
      const px = cx + orr * Math.cos(angle);
      const py = cy + orr * Math.sin(angle) * 0.4; // ellipse
      const pr = 2 + amp;
      const grd2 = ctx.createRadialGradient(px, py, 0, px, py, pr * 3);
      grd2.addColorStop(0, col.outer + '0.9)');
      grd2.addColorStop(1, col.outer + '0)');
      ctx.beginPath();
      ctx.arc(px, py, pr * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd2;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = col.core;
      ctx.fill();
    }

    // Scanning lines
    if (state === 'THINKING' || state === 'LISTENING') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + amp * 8 + 2, 0, Math.PI * 2);
      ctx.clip();
      const scanY = cy - r + ((t * 1.5) % (r * 2));
      const scanGrd = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 2);
      scanGrd.addColorStop(0, 'rgba(0,229,255,0)');
      scanGrd.addColorStop(1, 'rgba(0,229,255,0.35)');
      ctx.fillStyle = scanGrd;
      ctx.fillRect(cx - r - 10, scanY - 8, r * 2 + 20, 10);
      ctx.restore();
    }

    t++;
  }

  // ── Waveform draw ─────────────────────────────
  let fakeWave = 0;
  function drawWaveform() {
    const wW = wCanvas.width, wH = wCanvas.height;
    wCtx.clearRect(0, 0, wW, wH);

    const col = getColors();
    fakeWave += 0.07;

    wCtx.beginPath();
    wCtx.moveTo(0, wH / 2);

    for (let x = 0; x <= wW; x++) {
      const prog = x / wW;
      let y = wH / 2;

      if (analyser && freqData) {
        analyser.getByteTimeDomainData(freqData);
        const idx = Math.floor(prog * freqData.length);
        y = ((freqData[idx] - 128) / 128) * (wH / 2) * (0.5 + currentAmplitude) + wH / 2;
      } else {
        const amp = state === 'IDLE' ? 3 : 12 * currentAmplitude;
        y = wH / 2
          + Math.sin(prog * 30 + fakeWave) * amp
          + Math.sin(prog * 17 - fakeWave * 1.3) * amp * 0.5
          + Math.sin(prog * 50 + fakeWave * 0.7) * amp * 0.3;
      }
      x === 0 ? wCtx.moveTo(x, y) : wCtx.lineTo(x, y);
    }

    wCtx.strokeStyle = col.core;
    wCtx.lineWidth = 1.5;
    wCtx.shadowColor = col.core;
    wCtx.shadowBlur = 6;
    wCtx.stroke();
    wCtx.shadowBlur = 0;

    // Mirror
    wCtx.beginPath();
    for (let x = 0; x <= wW; x++) {
      const prog = x / wW;
      let y = wH / 2;
      if (analyser && freqData) {
        analyser.getByteTimeDomainData(freqData);
        const idx = Math.floor(prog * freqData.length);
        y = wH - (((freqData[idx] - 128) / 128) * (wH / 2) * (0.5 + currentAmplitude) + wH / 2) + wH / 2;
      } else {
        const amp = state === 'IDLE' ? 2 : 8 * currentAmplitude;
        y = wH / 2
          - Math.sin(prog * 30 + fakeWave) * amp
          - Math.sin(prog * 17 - fakeWave * 1.3) * amp * 0.5;
      }
      x === 0 ? wCtx.moveTo(x, y) : wCtx.lineTo(x, y);
    }
    wCtx.strokeStyle = col.glow + '0.35)';
    wCtx.lineWidth = 1;
    wCtx.stroke();
  }

  // ── Animation loop ────────────────────────────
  function loop() {
    // Smooth amplitude
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.1;
    if (state === 'IDLE') targetAmplitude = 0.08 + 0.06 * Math.sin(t * 0.03);
    else if (state === 'THINKING') targetAmplitude = 0.3 + 0.2 * Math.sin(t * 0.05);
    else if (state === 'LISTENING') targetAmplitude = 0.4 + 0.35 * Math.abs(Math.sin(t * 0.07));
    else if (state === 'SPEAKING') targetAmplitude = 0.5 + 0.4 * Math.abs(Math.sin(t * 0.09));
    drawOrb();
    drawWaveform();
    requestAnimationFrame(loop);
  }
  loop();

  // ── Public API ────────────────────────────────
  return {
    setState(newState) {
      state = newState.toUpperCase();
      stateEl.textContent = state;
      stateEl.classList.add('glitch-once');
      setTimeout(() => stateEl.classList.remove('glitch-once'), 500);
      if (state === 'LISTENING') pulseRing.classList.add('pulsing');
      else pulseRing.classList.remove('pulsing');
    },
    setAnalyser(a, fd) { analyser = a; freqData = fd; },
    setAmplitude(v) { targetAmplitude = v; }
  };
})();
