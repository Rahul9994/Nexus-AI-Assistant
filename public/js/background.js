/* ═══════════════════════════════════════════════
   N.E.X.U.S. — Animated Background
   Particle field + grid + floating hexagons
═══════════════════════════════════════════════ */

(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;

  window.addEventListener('resize', () => {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    initGrid();
  });

  // ── Particles ──────────────────────────────────
  const NPARTICLES = 90;
  const particles = [];
  for (let i = 0; i < NPARTICLES; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.6 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      color: Math.random() < 0.15 ? '#7c3aed' : '#00e5ff'
    });
  }

  // ── Grid ────────────────────────────────────────
  let gridLines = [];
  function initGrid() {
    gridLines = [];
    const spacing = 60;
    for (let x = 0; x < W; x += spacing) gridLines.push({ type: 'v', pos: x });
    for (let y = 0; y < H; y += spacing) gridLines.push({ type: 'h', pos: y });
  }
  initGrid();

  // ── Hexagons ────────────────────────────────────
  const hexagons = [];
  for (let i = 0; i < 8; i++) {
    hexagons.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 18 + 8,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.005,
      vy: (Math.random() - 0.5) * 0.1,
      vx: (Math.random() - 0.5) * 0.1,
      alpha: Math.random() * 0.06 + 0.02,
      phase: Math.random() * Math.PI * 2
    });
  }

  function hexPath(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  let t = 0;
  let mouseX = W / 2, mouseY = H / 2;
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t++;

    // ── Grid ──
    ctx.lineWidth = 0.4;
    gridLines.forEach(gl => {
      const dist = gl.type === 'v'
        ? Math.abs(gl.pos - mouseX) : Math.abs(gl.pos - mouseY);
      const proximity = Math.max(0, 1 - dist / 220);
      const alpha = 0.03 + proximity * 0.07;
      ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
      ctx.beginPath();
      if (gl.type === 'v') { ctx.moveTo(gl.pos, 0); ctx.lineTo(gl.pos, H); }
      else                 { ctx.moveTo(0, gl.pos); ctx.lineTo(W, gl.pos); }
      ctx.stroke();
    });

    // Dot intersections near mouse
    const sp = 60;
    for (let gx = 0; gx < W; gx += sp) {
      for (let gy = 0; gy < H; gy += sp) {
        const dist = Math.hypot(gx - mouseX, gy - mouseY);
        if (dist < 160) {
          const alpha = (1 - dist / 160) * 0.25;
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,229,255,${alpha})`;
          ctx.fill();
        }
      }
    }

    // ── Hexagons ──
    hexagons.forEach(h => {
      h.rot += h.vrot;
      h.x += h.vx; h.y += h.vy;
      if (h.x < -40) h.x = W + 40;
      if (h.x > W + 40) h.x = -40;
      if (h.y < -40) h.y = H + 40;
      if (h.y > H + 40) h.y = -40;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.01 + h.phase);
      hexPath(ctx, h.x, h.y, h.r, h.rot);
      ctx.strokeStyle = `rgba(0,229,255,${h.alpha * (0.5 + pulse * 0.5)})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // ── Particles ──
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.twinkle += p.twinkleSpeed;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.twinkle));
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grd.addColorStop(0, p.color.replace(')', `,${a})`).replace('rgb', 'rgba').replace('#00e5ff', `rgba(0,229,255,${a})`).replace('#7c3aed', `rgba(124,58,237,${a})`));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color === '#00e5ff'
        ? `rgba(0,229,255,${a})` : `rgba(124,58,237,${a})`;
      ctx.fill();
    });

    // ── Particle connections ──
    ctx.lineWidth = 0.4;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if (d < 90) {
          const alpha = (1 - d / 90) * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
          ctx.stroke();
        }
      }
    }

    // ── Mouse repulsion glow ──
    const mg = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 180);
    mg.addColorStop(0, 'rgba(0,229,255,0.03)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 180, 0, Math.PI * 2);
    ctx.fillStyle = mg;
    ctx.fill();

    requestAnimationFrame(draw);
  }

  draw();
})();
