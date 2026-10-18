/* HIPERNOVA — home › "What is HIPERNOVA?": scroll-driven particle field that walks through the
   behaviour of a hypernova (accumulation → tension → release → expansion → transformation → emergence).
   Ported from the HIPERNOVA studio page; English text here, Spanish via the i18n dictionary. */
(function(){
"use strict";
const WORDS = ["Accumulation", "Tension", "Release", "Expansion", "Transformation", "Emergence"];
const TEXTS = [
  "Energy concentrates before something changes. Questions, signals and discomforts build up, often without a name.",
  "What exists no longer suffices to contain what is starting to appear. Tension isn't a problem to eliminate: it's information.",
  "Something lets go: an assumption, a way of seeing, a way of deciding. The contained energy finds a way out.",
  "What is released alters its surroundings. Perspectives, relationships and futures appear that weren't available before.",
  "Conditions change, and so do the people who inhabit them. It isn't an improvement on what came before: it's another configuration.",
  "Something emerges that couldn't have been planned in advance. A new order born from everything that moved."
];
const IDLE = "Scroll to move through the behavior of a hypernova.";
let stopAll = null;

function initMeaning(){
  if (stopAll){ stopAll(); stopAll = null; }
  const sec = document.querySelector("#app .mean-s"); if (!sec) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = sec.querySelector("canvas"), q = k => sec.querySelector(`[data-mm="${k}"]`);
  const S = {word: -1, mouse: null}; const stops = [];

  /* words list + side card */
  const ul = q("words"); ul.innerHTML = WORDS.map(w => `<li>${w}.</li>`).join("");
  const lis = [...ul.children];
  const paint = () => {
    lis.forEach((li, i) => { li.style.color = i === S.word ? "#FDEE3D" : i < S.word ? "#F4F4EE" : "rgba(244,244,238,.16)"; li.style.transform = `translateX(${i === S.word ? "-0.18em" : "0"})`; });
    q("count").textContent = "Signal — 0" + (S.word + 1) + " / 06";
    q("title").textContent = S.word < 0 ? "" : WORDS[S.word];
    q("text").textContent = S.word < 0 ? IDLE : TEXTS[S.word];
  };
  paint();
  const onScroll = () => {
    const r = sec.getBoundingClientRect(), span = r.height - innerHeight; let w = -1;
    if (r.top < innerHeight * .4){ const p = Math.min(.999, Math.max(0, -r.top / span)); w = Math.floor(p * 6); }
    if (w !== S.word){ S.word = w; paint(); }
  };
  addEventListener("scroll", onScroll, {passive: true}); onScroll();
  const onMove = e => { S.mouse = {x: e.clientX, y: e.clientY}; };
  addEventListener("pointermove", onMove, {passive: true});
  stops.push(() => { removeEventListener("scroll", onScroll); removeEventListener("pointermove", onMove); });

  /* particle field */
  const ctx = cv.getContext("2d"); let w = 0, h = 0, raf, visible = true, t = 0, P = [];
  const resize = () => {
    const b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(1540 * Math.min(1, Math.max(.45, w / 1280)));
    while (P.length < n) P.push({a: Math.random() * 6.283, r0: Math.random(), s: .0008 + Math.random() * .003, z: Math.random() * 1.5 + .6, sx: Math.random(), sy: Math.random(), ray: Math.floor(Math.random() * 40), layer: Math.floor(Math.random() * 7), x: Math.random() * w, y: Math.random() * h});
    P.length = n; if (reduced) for (let i = 0; i < 90; i++) frame();
  };
  const target = (p, i, n, mode) => {
    const cx = w / 2, cy = h / 2, M = Math.min(w, h), X = Math.max(w, h);
    switch (mode){
      case 0: { const r = Math.sqrt(p.r0) * M * .1; return [cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r]; }
      case 1: { const r = Math.sqrt(p.r0) * M * .065, j = Math.sin(t * .09 + i) * 2.2; return [cx + Math.cos(p.a) * r + j, cy + Math.sin(p.a) * r - j]; }
      case 2: { const a = p.ray / 40 * 6.283, r = M * .06 + Math.pow(p.r0, .7) * X * .62; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
      case 3: { const r = M * .36 + (p.r0 - .5) * M * .08; return [cx + Math.cos(p.a) * r * 1.35, cy + Math.sin(p.a) * r * .95]; }
      case 4: { const x = p.sx * w, y = h * (.2 + p.layer * .1) + Math.sin(x * .006 + t * .012 + p.layer) * h * .06; return [x, y]; }
      default: { const cols = Math.max(8, Math.round(Math.sqrt(n * w / h))), rows = Math.ceil(n / cols); return [((i % cols) + .5) * w / cols, (Math.floor(i / cols) + .5) * h / rows]; }
    }
  };
  const frame = () => {
    if (!cv.isConnected) return;
    t++; ctx.fillStyle = "#222"; ctx.fillRect(0, 0, w, h);
    const n = P.length, mb = S.mouse ? cv.getBoundingClientRect() : null;
    const mx = mb ? S.mouse.x - mb.left : -9999, my = mb ? S.mouse.y - mb.top : -9999, mode = Math.max(0, S.word);
    for (let i = 0; i < n; i++){
      const p = P[i], [tx, ty] = target(p, i, n, mode), e = reduced ? 1 : .055;
      p.x += (tx - p.x) * e; p.y += (ty - p.y) * e;
      if (!reduced && mode !== 5) p.a += p.s * .5;
      const d = Math.hypot(p.x - w / 2, p.y - h / 2);
      const yellow = mode === 5 ? d < Math.min(w, h) * .18 : mode >= 2 ? p.r0 < .18 : p.r0 < .5;
      let px = p.x, py = p.y; const dx = px - mx, dy = py - my, dd = Math.hypot(dx, dy);
      if (dd < 130 && dd > 0){ const f = (1 - dd / 130) * 26; px += dx / dd * f; py += dy / dd * f; }
      ctx.globalAlpha = yellow ? 1 : .55; ctx.fillStyle = yellow ? "#FDEE3D" : "#F4F4EE"; ctx.fillRect(px, py, p.z, p.z);
    }
    ctx.globalAlpha = 1;
    if (!reduced && visible) raf = requestAnimationFrame(frame);
  };
  const ro = new ResizeObserver(resize); ro.observe(cv); resize();
  const io = new IntersectionObserver(es => es.forEach(e => { const was = visible; visible = e.isIntersecting; if (visible && !was && !reduced) raf = requestAnimationFrame(frame); })); io.observe(cv);
  if (!reduced) raf = requestAnimationFrame(frame);
  stops.push(() => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); });
  stopAll = () => stops.forEach(f => f());
}
window.initMeaning = initMeaning;
initMeaning();
})();
