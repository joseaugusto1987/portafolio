/* HIPERNOVA — Thinking › Writings: every Substack article as a card (image, title, short description).
   Source of truth: the Apps Script `?action=posts` endpoint, which reads the Substack archive
   (so it updates by itself whenever you publish). Cached in the browser for instant paint. */
(function(){
"use strict";
const DEFAULT_SUBSTACK = "https://hipernova.substack.com";
const KEY = "hn_posts";
const TEX = ["halftone", "topo", "flow", "moire", "dither", "grain", "particles"];
const fmt = d => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString(window.HN_I18N && HN_I18N.lang === "es" ? "es-CO" : "en-US", {month: "short", day: "numeric", year: "numeric"}); };
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; };

async function fetchPosts(){
  const api = window.HN_CONFIG && HN_CONFIG.API_URL, base = ((typeof C !== "undefined" && C.substack) || DEFAULT_SUBSTACK).replace(/\/+$/, "");
  if (api){
    try {
      const r = await fetch(api + (api.includes("?") ? "&" : "?") + "action=posts&_=" + Math.floor(Date.now() / 600000));
      const j = await r.json(); if (j && Array.isArray(j.posts) && j.posts.length) return j.posts;
    } catch(e){ /* endpoint not authorized yet → fall back to the public feed */ }
  }
  // fallback: public RSS → JSON (latest ~10)
  const r = await fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(base + "/feed"));
  const j = await r.json(); if (j.status !== "ok") throw new Error("feed");
  return j.items.map(it => ({title: it.title, description: clip(it.description.replace(/<[^>]+>/g, " "), 200), image: (it.enclosure && it.enclosure.link) || it.thumbnail || "", url: it.link, date: it.pubDate}));
}
function render(box, posts){
  if (!posts.length){ box.innerHTML = ""; return; }
  const home = box.id === "home-posts"; if (home) posts = posts.slice(0, 3);
  box.innerHTML = (home ? "" : `<p class="t-meta posts-n">${String(posts.length).padStart(2, "0")} articles</p>`) + `<div class="cards">` + posts.map((p, i) => {
    const m = ["rings", "lines", "dots"][i % 3];
    const media = p.image ? `<img class="duo" referrerpolicy="no-referrer" src="${esc(p.image)}" alt="" loading="lazy" data-k="card" data-t="${TEX[i % TEX.length]}" data-s="${i + 3}">`
                          : `<canvas class="ht" data-m="${m}" data-seed="${i + 3}"></canvas>`;
    return `<a class="card" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="viz">${media}<span class="num">${String(i + 1).padStart(2, "0")} —</span></div>
      <span class="t-meta">${esc(fmt(p.date))}</span>
      <h3>${esc(p.title)}</h3>${p.description ? `<p>${esc(clip(p.description, 160))}</p>` : ""}
      <span class="t-meta meta">Read on Substack ↗</span></a>`;
  }).join("") + "</div>";
  box.querySelectorAll("canvas.ht").forEach(c => io.observe(c));
}
async function initPosts(){
  const box = document.querySelector("#app #posts, #app #home-posts"); if (!box) return;
  let cached = null; try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch(e){}
  if (cached && cached.length) render(box, cached); else box.innerHTML = `<p class="t-meta">Loading articles…</p>`;
  try {
    const posts = await fetchPosts();
    if (!box.isConnected) return;
    try { localStorage.setItem(KEY, JSON.stringify(posts)); } catch(e){}
    if (JSON.stringify(posts) !== JSON.stringify(cached)) render(box, posts);
  } catch(e){
    if (!cached) box.innerHTML = `<p class="t-meta">Couldn't load the articles right now. <a href="${esc(((typeof C !== "undefined" && C.substack) || DEFAULT_SUBSTACK))}" target="_blank" rel="noopener"><u>Read them on Substack ↗</u></a></p>`;
  }
}
window.initPosts = initPosts;
window.addEventListener("hn-lang", () => { try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); const box = document.querySelector("#app #posts, #app #home-posts"); if (box && c) render(box, c); } catch(e){} });
initPosts();
})();
