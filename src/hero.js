/* HIPERNOVA — home hero: particle field + rotating phrase with "signal noise" transition.
   Adapted from the HIPERNOVA studio page. Headline and phrases come from the Sheet
   (Pages: home.hero, home.phrases). */
(function(){
"use strict";
const GLYPHS = "abcdeghknopqrsuvxyz0123456789#/+*:";
const HOLD = 3200;
let stopAll = null;

function initHero(){
  if (stopAll){ stopAll(); stopAll = null; }
  const sec = document.querySelector("#app .hero-d"); if (!sec) return;
  const cv = sec.querySelector("canvas"), box = sec.querySelector("[data-phrase]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const home = (typeof PG !== "undefined" && PG.home) || {};
  const phrases = (home.phrases || []).filter(Boolean);
  const stops = [];

  /* ---------- rotating phrase ---------- */
  if (box && phrases.length){
    box.innerHTML = "";
    const sr = document.createElement("span"); sr.setAttribute("aria-live", "polite");
    sr.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    box.append(sr);
    phrases.forEach(p => { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.style.cssText = "grid-area:1/1;visibility:hidden"; s.textContent = p; box.append(s); }); // reserves the tallest phrase
    const live = document.createElement("span"); live.setAttribute("aria-hidden", "true");
    live.style.cssText = "position:absolute;top:0;left:0;right:0;white-space:pre-wrap"; box.append(live);
    let idx = 0, t0 = performance.now(), raf, lastDraw = 0, lastIdx = -1;
    sr.textContent = phrases[0];
    const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const tick = now => {
      if (!live.isConnected) return;
      if (now - t0 >= HOLD){ idx = (idx + 1) % phrases.length; t0 = now; sr.textContent = phrases[idx]; }
      const txt = phrases[idx], tt = now - t0;
      const inP = Math.min(1, tt / 760), outP = Math.max(0, (tt - (HOLD - 520)) / 440);
      let out = "";
      for (let k = 0; k < txt.length; k++){
        const c = txt[k], f = k / txt.length;
        if (c === " "){ out += " "; continue; }
        out += (inP > f * .85 + Math.random() * .15 && outP < (1 - f) * .7 + Math.random() * .3) ? c : rnd();
      }
      if (now - lastDraw > 45 || (inP >= 1 && outP === 0 && lastIdx !== idx + "s")){ live.textContent = out; lastDraw = now; }
      const noisy = inP < 1 || outP > 0;
      live.style.opacity = noisy ? (.55 + Math.random() * .45).toFixed(2) : 1;
      live.style.transform = noisy && Math.random() < .25 ? `translateX(${(Math.random() * 6 - 3).toFixed(1)}px)` : "none";
      raf = requestAnimationFrame(tick);
    };
    if (reduced) live.textContent = phrases[0]; else raf = requestAnimationFrame(tick);
    stops.push(() => cancelAnimationFrame(raf));
  }

  /* ---------- particle field ---------- */
  if (cv){
    const ctx = cv.getContext("2d"); let w = 0, h = 0, raf, visible = true, prog = 0, mouse = null, P = [];
    const resize = () => {
      const b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(1400 * Math.min(1, Math.max(.45, w / 1280)));
      while (P.length < n) P.push({a: Math.random() * 6.283, r0: Math.random(), s: .0008 + Math.random() * .003, z: Math.random() * 1.5 + .6, sx: Math.random(), sy: Math.random()});
      P.length = n; if (reduced) frame();
    };
    const frame = () => {
      if (!cv.isConnected) return;
      ctx.fillStyle = "#222"; ctx.fillRect(0, 0, w, h);
      const r0 = sec.getBoundingClientRect(); prog = Math.min(1, Math.max(0, -r0.top / r0.height));
      const k = prog * prog * (3 - 2 * prog);
      const cx = w < 800 ? w * .5 : w * .7, cy = h * .46, R = Math.min(w, h) * .46;
      const mb = mouse ? cv.getBoundingClientRect() : null, mx = mb ? mouse.x - mb.left : -9999, my = mb ? mouse.y - mb.top : -9999;
      for (let i = 0; i < P.length; i++){
        const p = P[i]; if (!reduced) p.a += p.s;
        const r = Math.pow(p.r0, 1.8) * R, yellow = r < R * .1;
        let px = (cx + Math.cos(p.a) * r * 1.5) * (1 - k) + p.sx * w * k, py = (cy + Math.sin(p.a) * r * .78) * (1 - k) + p.sy * h * k;
        const dx = px - mx, dy = py - my, dd = Math.hypot(dx, dy);
        if (dd < 130 && dd > 0){ const f = (1 - dd / 130) * 26; px += dx / dd * f; py += dy / dd * f; }
        ctx.globalAlpha = yellow ? 1 : .55; ctx.fillStyle = yellow ? "#FDEE3D" : "#F4F4EE"; ctx.fillRect(px, py, p.z, p.z);
      }
      ctx.globalAlpha = 1;
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    };
    const onMove = e => { mouse = {x: e.clientX, y: e.clientY}; };
    addEventListener("pointermove", onMove, {passive: true});
    const ro = new ResizeObserver(resize); ro.observe(cv); resize();
    const io = new IntersectionObserver(es => es.forEach(e => { const was = visible; visible = e.isIntersecting; if (visible && !was && !reduced) raf = requestAnimationFrame(frame); })); io.observe(cv);
    if (!reduced) raf = requestAnimationFrame(frame);
    stops.push(() => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener("pointermove", onMove); });
  }
  stopAll = () => stops.forEach(f => f());
}
window.initHero = initHero;
initHero();
})();
