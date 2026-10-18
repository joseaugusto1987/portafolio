/* HIPERNOVA — duotone + halftone for cover photos.
   <img class="duo"> already shows a smooth yellow/black duotone (CSS filter).
   This upgrades it to a canvas render with halftone dots when the image server allows pixel access (CORS);
   otherwise the smooth duotone simply stays.
   HN_CONFIG.COVER_STYLE: "mix" (smooth duotone + dot screen) | "halftone" (yellow paper + black dots) | "smooth" */
(function(){
"use strict";
/* Broken cover → try Drive's other image host once, then fall back to the generative texture. */
document.addEventListener("error", e => {
  const t = e.target; if (!t || t.tagName !== "IMG" || !t.classList.contains("duo") || !t.closest("#app")) return;
  const id = (t.src.match(/[?&]id=([\w-]{15,})/) || [])[1];
  if (id && !t.dataset.alt){ t.dataset.alt = "1"; t.src = `https://lh3.googleusercontent.com/d/${id}=w1600`; return; }
  const cv = document.createElement("canvas");
  if (t.dataset.k === "card"){ cv.className = "ht"; cv.dataset.m = MOTIF[t.dataset.t] || "dots"; cv.dataset.seed = t.dataset.s; t.replaceWith(cv); halftone(cv); }
  else { cv.dataset.hnTexture = t.dataset.t; cv.dataset.tone = "ink"; cv.dataset.seed = t.dataset.s; t.replaceWith(cv); window.HN && HN.refresh(); }
}, true);

const STYLE = (window.HN_CONFIG && HN_CONFIG.COVER_STYLE) || "mix";
if (STYLE === "smooth") return;
const done = new WeakSet(), cache = new Map();
const YEL = [253, 238, 61], INK = [34, 34, 34];

function load(src){
  if (!cache.has(src)) cache.set(src, new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer"; im.onload = () => res(im); im.onerror = rej; im.src = src; }));
  return cache.get(src);
}
function paint(cv, im){
  const par = cv.parentElement, dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(par.clientWidth * dpr), H = Math.round(par.clientHeight * dpr); if (!W || !H) return;
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d", {willReadFrequently: true}); x.imageSmoothingQuality = "high";
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  x.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const id = x.getImageData(0, 0, W, H), d = id.data;        // throws when the canvas is tainted
  const lum = new Float32Array(W * H), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++){ const l = (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]); lum[j] = l / 255; hist[l | 0]++; }
  let lo = 0, hi = 255, acc = 0; const n = W * H;
  for (let k = 0; k < 256; k++){ acc += hist[k]; if (acc > n * .02){ lo = k; break; } }
  acc = 0; for (let k = 255; k >= 0; k--){ acc += hist[k]; if (acc > n * .02){ hi = k; break; } }
  const span = Math.max(40, hi - lo), norm = l => Math.min(1, Math.max(0, (l * 255 - lo) / span));
  const bg = STYLE === "halftone";
  for (let i = 0, j = 0; i < d.length; i += 4, j++){
    const l = bg ? 1 : norm(lum[j]) * .85 + .1;           // mix: smooth duotone base; halftone: flat yellow paper
    d[i] = INK[0] + (YEL[0] - INK[0]) * l; d[i + 1] = INK[1] + (YEL[1] - INK[1]) * l; d[i + 2] = INK[2] + (YEL[2] - INK[2]) * l;
  }
  x.putImageData(id, 0, 0);
  const cell = Math.max(3 * dpr, Math.round(W / 190)), a = Math.PI * 2;
  x.fillStyle = "#222222";
  for (let cy = 0, row = 0; cy < H + cell; cy += cell * .866, row++){
    for (let cx = (row % 2) * cell / 2; cx < W + cell; cx += cell){
      let sum = 0, c = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++){
        const px = Math.min(W - 1, Math.max(0, (cx + ox * cell / 3) | 0)), py = Math.min(H - 1, Math.max(0, (cy + oy * cell / 3) | 0));
        sum += lum[py * W + px]; c++;
      }
      const dark = 1 - norm(sum / c);                      // 0 = highlight, 1 = deepest shadow
      const r = bg ? cell * .62 * Math.pow(dark, .9) : cell * .4 * Math.pow(Math.max(0, dark - .2) / .8, .9);
      if (r > .6){ x.beginPath(); x.arc(cx, cy, r, 0, a); x.fill(); }
    }
  }
}
function enhance(img){
  if (done.has(img)) return; done.add(img);
  load(img.currentSrc || img.src).then(im => {
    const cv = document.createElement("canvas"); cv.className = "duo duo-ht";
    img.after(cv);
    try { paint(cv, im); } catch(e){ cv.remove(); return; }
    img.style.display = "none";
    let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { try { paint(cv, im); } catch(e){} }, 120); }).observe(cv.parentElement);
  }).catch(() => {});
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ io.unobserve(e.target); enhance(e.target); } }), {rootMargin: "300px"});
const scan = root => (root.querySelectorAll ? root.querySelectorAll("#app img.duo, img.duo") : []).forEach(i => { if (i.closest("#app") && !done.has(i)) io.observe(i); });
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1){ if (n.matches && n.matches("img.duo")) { if (n.closest("#app")) io.observe(n); } else scan(n); } }))).observe(document.body, {childList: true, subtree: true});
scan(document);
})();
