/* ===== HIPERNOVA i18n (EN / ES) — inlined into the site script before the data bindings =====
   · Content   : d.es (site texts) and project.es {title, sub, excerpt, html}; empty → falls back to English.
   · UI + tags : exact-text dictionary EN→ES (d.i18n.es from the Sheet "Translations" tab, over the built-in one).
   · setData() builds the localized view; the DOM pass translates fixed UI text after every render. */
let LANG = (() => {
  try { const q = new URLSearchParams(location.search).get("lang"); if (q === "es" || q === "en") { localStorage.setItem("hn_lang", q); return q; } } catch(e){}
  try { const s = localStorage.getItem("hn_lang"); if (s === "es" || s === "en") return s; } catch(e){}
  return "en";
})();
let I18N_DICT = {};   // UI + tag translations come from the Sheet ("Translations" tab)
function i18nLoad(d){ I18N_DICT = (d && d.i18n && d.i18n.es) || {}; }
function tr(s){
  if (LANG !== "es" || s == null) return s;
  const t = String(s).trim(); if (!t) return s;
  const lead = String(s).match(/^\s*/)[0], trail = String(s).match(/\s*$/)[0];
  let out = trText(t);
  return out === t ? s : lead + out + trail;
}
function trText(t){
  const D = I18N_DICT; if (D[t]) return D[t];
  let m;
  if ((m = t.match(/^All (\d+) projects$/))) return `Todos los ${m[1]} proyectos`;
  if ((m = t.match(/^Index · (\d+) projects · (.+)$/))) return `Índice · ${m[1]} proyectos · ${m[2]}`;
  if ((m = t.match(/^Case (\d+) \/ (\d+)$/))) return `Caso ${m[1]} / ${m[2]}`;
  if ((m = t.match(/^Next project · (\d+)$/))) return `Siguiente proyecto · ${m[1]}`;
  if ((m = t.match(/^(\d+) articles?$/))) return `${m[1]} artículos`;
  if ((m = t.match(/^(\d+) — (.+)$/)) && D[m[2]]) return `${m[1]} — ${D[m[2]]}`;
  for (const sep of [" · ", ", ", " / "]){
    if (t.includes(sep)){
      const parts = t.split(sep), tp = parts.map(p => D[p] || p);
      if (tp.some((p, i) => p !== parts[i])) return tp.join(sep);
    }
  }
  return t;
}
const TR_SKIP = "#adm,script,style,.prose,[data-phrase],[data-nt],.mdl-bg,.toast";
const trOrig = new WeakMap();   // text node → original English, so EN can be restored
function trNode(n){
  if (n.nodeType === 3){
    if (n.parentElement && n.parentElement.closest(TR_SKIP)) return;
    if (!trOrig.has(n)) trOrig.set(n, n.nodeValue);
    const o = tr(trOrig.get(n)); if (n.nodeValue !== o) n.nodeValue = o;
  } else if (n.nodeType === 1){
    if (n.matches && n.matches(TR_SKIP)) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x; const arr = [];
    while ((x = w.nextNode())) arr.push(x);
    arr.forEach(trNode);
  }
}
function trDocTitle(){
  if (LANG !== "es") return;
  const parts = document.title.split(" — "); parts[0] = tr(parts[0]); document.title = parts.join(" — ");
}
let trObs = null;
function i18nDom(){
  document.documentElement.lang = LANG;
  if (trObs){ trObs.disconnect(); trObs = null; }
  if (LANG !== "es"){
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let x;
    while ((x = w.nextNode())) if (trOrig.has(x) && x.nodeValue !== trOrig.get(x)) x.nodeValue = trOrig.get(x);
    return;
  }
  trNode(document.body); trDocTitle();
  trObs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(trNode)));
  trObs.observe(document.body, {childList: true, subtree: true});
}
/* deep merge of Spanish site texts over English (empty/missing → English) */
function i18nMerge(b, e){
  if (e == null || e === "" || (Array.isArray(e) && !e.length)) return b;
  if (Array.isArray(b)){
    if (!Array.isArray(e)) return b;
    if (!b.length || b.every(x => typeof x === "string")) return e;
    return b.map((x, i) => Array.isArray(x) ? x.map((y, j) => (e[i] && e[i][j]) || y) : ((e[i] != null && e[i] !== "") ? e[i] : x));
  }
  if (b && typeof b === "object"){ const o = Object.assign({}, b); for (const k in e) o[k] = i18nMerge(b[k], e[k]); return o; }
  return e;
}
function i18nLocalize(d){
  i18nLoad(d);
  if (LANG !== "es") return d;
  const es = d.es || {};
  const out = Object.assign({}, d);
  out.config = i18nMerge(d.config, es.config || {});
  out.pages = i18nMerge(d.pages, es.pages || {});
  out.projects = d.projects.map(p => {
    const e = p.es || {}, q = Object.assign({}, p);
    if (e.title) q.title = e.title; if (e.sub) q.sub = e.sub; if (e.excerpt) q.excerpt = e.excerpt;
    q.html = e.html ? e.html : `<p class="no-es"><em>${tr("This case is available in English only for now.")}</em></p>` + (p.html || "");
    return q;
  });
  return out;
}
function setLang(l){
  if (l !== "es" && l !== "en") return;
  LANG = l; try { localStorage.setItem("hn_lang", l); } catch(e){}
  setData(DATA); route();
  document.querySelectorAll(".lang button").forEach(b => { b.classList.toggle("on", b.dataset.l === LANG); b.setAttribute("aria-pressed", b.dataset.l === LANG); });
  i18nDom();
  window.dispatchEvent(new Event("hn-lang"));
}
window.HN_I18N = {tr, get lang(){ return LANG; }, setLang};
