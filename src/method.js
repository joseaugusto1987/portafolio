/* HIPERNOVA — Approach › Method: "a cycle of four movements".
   Animated orbit diagram (canvas) + clickable nodes + auto-advance while visible.
   Ported from the HIPERNOVA studio page (section "Cómo trabajamos"), translated to English. */
(function(){
"use strict";
const STEPS = [
  ["OBSERVE",     "Make visible what the system stopped seeing.",                          "50%", "8%",  "SIGNAL"],
  ["EXPAND",      "Bring in other perspectives, futures and questions.",                   "92%", "50%", "FIELD"],
  ["RECONFIGURE", "Explore new relationships between the elements of the system.",         "50%", "92%", "SYSTEM"],
  ["ACTIVATE",    "Turn possibilities into experiments, decisions and actions.",           "8%",  "50%", "EXPERIMENT"]
];
let stopAll = null;

function initMethod(){
  if (stopAll){ stopAll(); stopAll = null; }
  const sec = document.querySelector("#app .method-s"); if (!sec) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = sec.querySelector("canvas"), nodes = sec.querySelector('[data-m="nodes"]');
  const $m = k => sec.querySelector(`[data-m="${k}"]`);
  const S = {step: 0, lastPick: 0, visible: false, mouse: null};
  const stops = [];

  /* nodes */
  nodes.innerHTML = STEPS.map((s, i) => `<button type="button" data-i="${i}" class="method-node" style="left:${s[2]};top:${s[3]}"><span>0${i + 1}</span><b>${s[0]}</b></button>`).join("");
  const paint = () => {
    const s = STEPS[S.step];
    $m("num").textContent = "0" + (S.step + 1) + " / 04"; $m("name").textContent = s[0]; $m("desc").textContent = s[1]; $m("mode").textContent = s[4];
    nodes.querySelectorAll("button").forEach((b, i) => { b.classList.toggle("on", i === S.step); b.setAttribute("aria-pressed", i === S.step); });
    if (reduced && S.redraw) S.redraw();
  };
  nodes.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.lastPick = Date.now(); S.step = +b.dataset.i; paint(); });
  paint();
  const io0 = new IntersectionObserver(es => es.forEach(e => { S.visible = e.isIntersecting; }), {threshold: .35}); io0.observe(sec);
  const timer = setInterval(() => { if (reduced || !S.visible || Date.now() - S.lastPick < 9000) return; S.step = (S.step + 1) % 4; paint(); }, 3600);
  const onMove = e => { S.mouse = {x: e.clientX, y: e.clientY}; };
  addEventListener("pointermove", onMove, {passive: true});
  stops.push(() => { clearInterval(timer); io0.disconnect(); removeEventListener("pointermove", onMove); });

  /* orbit canvas */
  const ctx = canvas.getContext("2d"); let w = 0, h = 0, raf, visible = true, t = 0, last = -1, stepAt = performance.now();
  const N = 900, P = [];
  for (let i = 0; i < N; i++) P.push({a: Math.random() * 6.283, r0: Math.random(), sx: Math.random(), sy: Math.random(), layer: i % 6, k: i % 4, sp: .4 + Math.random(), z: Math.random() * 1.4 + .7, x: 0, y: 0, life: Math.random()});
  const resize = () => {
    const b = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = b.width; h = b.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.forEach(p => { p.x = p.sx * w; p.y = p.sy * h; });
    ctx.clearRect(0, 0, w, h);
    if (reduced) for (let i = 0; i < 90; i++) frame(true);
  };
  const NA = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const frame = still => {
    if (!canvas.isConnected) return;
    t++;
    const now = performance.now(), st = S.step;
    if (st !== last){ last = st; stepAt = now; }
    const prog = Math.min(1, (now - stepAt) / 3600);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .375;
    ctx.globalAlpha = 1;
    if (reduced) ctx.clearRect(0, 0, w, h);
    else { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = "source-over"; }
    ctx.strokeStyle = "rgba(244,244,238,.22)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    const a0 = NA[st];
    ctx.strokeStyle = "#FDEE3D"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (Math.PI / 2) * (reduced ? 1 : prog)); ctx.stroke();
    const scan = t * .025;
    const mb = S.mouse ? canvas.getBoundingClientRect() : null;
    const mx = mb ? S.mouse.x - mb.left : -9999, my = mb ? S.mouse.y - mb.top : -9999;
    const centers = [];
    if (st === 2) for (let k = 0; k < 4; k++){ const a = t * .006 + k * 1.571 + Math.sin(t * .01 + k) * .5, rr = R * (.45 + .15 * Math.sin(t * .013 + k * 2)); centers.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    for (let i = 0; i < N; i++){
      const p = P[i]; let tx, ty, yellow = false, e = .06;
      if (st === 0){
        const ang = Math.atan2(p.sy - .5, p.sx - .5), d = ((ang - scan) % 6.283 + 6.283) % 6.283;
        if (d < .7){ const rr = R * (.2 + p.r0 * .8); tx = cx + Math.cos(ang) * rr; ty = cy + Math.sin(ang) * rr; yellow = d < .25; e = .12; }
        else { tx = p.sx * w + Math.sin(t * .01 + i) * 6; ty = p.sy * h + Math.cos(t * .012 + i) * 6; e = .03; }
      } else if (st === 1){
        p.a += .004 * (1 + p.layer * .35) * (p.layer % 2 ? 1 : -1);
        const rr = R * (.25 + p.layer * .16) * (1 + Math.sin(t * .03 - p.layer) * .04);
        tx = cx + Math.cos(p.a) * rr; ty = cy + Math.sin(p.a) * rr; yellow = p.layer === Math.floor(t / 30) % 6 && p.r0 < .6;
      } else if (st === 2){
        const c = centers[p.k], rr = Math.sqrt(p.r0) * R * .2; p.a += .01 * p.sp;
        tx = c[0] + Math.cos(p.a) * rr; ty = c[1] + Math.sin(p.a) * rr; yellow = p.r0 < .06;
      } else {
        p.a += .012 * p.sp; p.life += .006 * p.sp;
        if (p.life > 1) p.life = 0;
        const out = p.r0 < .35 ? Math.pow(p.life, 2) * R * 1.1 : 0;
        tx = cx + Math.cos(p.a) * (R + out) + Math.cos(p.a + 1.571) * out * .6; ty = cy + Math.sin(p.a) * (R + out) + Math.sin(p.a + 1.571) * out * .6;
        yellow = out > 2; e = .14;
      }
      if (still === true || reduced) e = Math.max(e, .2);
      p.x += (tx - p.x) * e; p.y += (ty - p.y) * e;
      let px = p.x, py = p.y; const dx = px - mx, dy = py - my, dd = Math.hypot(dx, dy);
      if (dd < 90 && dd > 0){ const f = (1 - dd / 90) * 20; px += dx / dd * f; py += dy / dd * f; }
      ctx.globalAlpha = yellow ? 1 : .6; ctx.fillStyle = yellow ? "#FDEE3D" : "#F4F4EE";
      ctx.fillRect(px, py, p.z, p.z);
    }
    ctx.globalAlpha = 1;
    if (st === 2){
      const pair = Math.floor(t / 70) % 3, links = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][pair];
      ctx.strokeStyle = "#FDEE3D"; ctx.lineWidth = 1.5;
      links.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(centers[a][0], centers[a][1]); ctx.lineTo(centers[b][0], centers[b][1]); ctx.stroke(); });
      ctx.strokeStyle = "rgba(244,244,238,.3)"; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++){ const c = centers[k], n = centers[(k + 1) % 4]; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(n[0], n[1]); ctx.stroke(); }
    }
    if (st === 0){ ctx.strokeStyle = "rgba(253,238,61,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(scan) * R * 1.15, cy + Math.sin(scan) * R * 1.15); ctx.stroke(); }
    const ha = a0 + (Math.PI / 2) * prog;
    ctx.fillStyle = "#FDEE3D"; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * R, cy + Math.sin(ha) * R, 4 + Math.sin(t * .15) * 1.5, 0, 6.283); ctx.fill();
    if (still !== true && !reduced && visible) raf = requestAnimationFrame(() => frame());
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(es => es.forEach(e => { const was = visible; visible = e.isIntersecting; if (visible && !was && !reduced) raf = requestAnimationFrame(() => frame()); })); io.observe(canvas);
  if (!reduced) raf = requestAnimationFrame(() => frame()); else S.redraw = () => { for (let i = 0; i < 90; i++) frame(true); };
  stops.push(() => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); });
  stopAll = () => stops.forEach(f => f());
}
window.initMethod = initMethod;
initMethod();
})();
