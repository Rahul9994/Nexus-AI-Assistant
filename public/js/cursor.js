/* ═══════════════════════════════════════════════
   N.E.X.U.S. — Animated Cursor System
═══════════════════════════════════════════════ */

(function () {
  const outer = document.getElementById('cursor-outer');
  const inner = document.getElementById('cursor-inner');
  const canvas = document.getElementById('cursor-canvas');
  const ctx = canvas.getContext('2d');

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let ox = mx, oy = my;
  let trail = [];
  const TRAIL_LEN = 18;
  let isHovering = false;
  let isClicking = false;
  let angle = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    inner.style.left = mx + 'px';
    inner.style.top  = my + 'px';
    trail.push({ x: mx, y: my, t: Date.now() });
    if (trail.length > TRAIL_LEN) trail.shift();
  });

  document.addEventListener('mousedown', () => { isClicking = true; });
  document.addEventListener('mouseup',   () => { isClicking = false; });

  // Detect hoverable elements
  document.addEventListener('mouseover', e => {
    const el = e.target;
    isHovering = !!(el.matches('button, a, .skill-chip, .cap-item, input, [data-cmd]'));
  });
  document.addEventListener('mouseout', () => { isHovering = false; });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    angle += 0.04;

    // Outer ring lerp
    ox = lerp(ox, mx, 0.12);
    oy = lerp(oy, my, 0.12);

    const outerSize = isClicking ? 22 : isHovering ? 42 : 32;
    outer.style.width  = outerSize + 'px';
    outer.style.height = outerSize + 'px';
    outer.style.left   = ox + 'px';
    outer.style.top    = oy + 'px';
    outer.style.borderColor = isHovering ? '#00ff9d' : '#00e5ff';
    outer.style.boxShadow = isHovering
      ? '0 0 16px rgba(0,255,157,0.5)' : '0 0 10px rgba(0,229,255,0.4)';

    // Trail
    const now = Date.now();
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1], p1 = trail[i];
      const age = now - p1.t;
      if (age > 400) continue;
      const alpha = (1 - age / 400) * 0.45 * (i / trail.length);
      const w = (i / trail.length) * 2.5;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = isHovering
        ? `rgba(0,255,157,${alpha})` : `rgba(0,229,255,${alpha})`;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Rotating crosshair lines around outer ring
    if (isHovering) {
      const r = outerSize / 2 + 6;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(angle);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r + 8, 0);
        ctx.strokeStyle = 'rgba(0,255,157,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Scanning line effect on click
    if (isClicking) {
      ctx.beginPath();
      ctx.arc(mx, my, 24, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,229,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, 38, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,229,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
