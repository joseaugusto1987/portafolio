/* =====================================================================
   HIPERNOVA — data layer + hidden admin (CMS)
   · Public site reads  : GET  API_URL?action=read            (Google Apps Script → Google Sheet)
   · Admin writes       : POST API_URL {action:'save', token}  (password checked server-side)
   · No API_URL         : DEMO mode — data lives in this browser's localStorage
   Uses globals from the site script: DATA, setData(), route(), esc(), pad(), $
   ===================================================================== */
(function(){
"use strict";
const CFG = Object.assign({API_URL: "", DEMO_PASSWORD: "hipernova", CLICKS: 5}, window.HN_CONFIG || {});
const DEMO = !CFG.API_URL;
const store = (s) => ({
  get(k){ try { return s.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { s.setItem(k, v); } catch(e){} },
  del(k){ try { s.removeItem(k); } catch(e){} }
});
const LS = store(window.localStorage), SS = store(window.sessionStorage);
const clone = o => JSON.parse(JSON.stringify(o));
const TEXTURES = ["halftone","flow","topo","dither","moire","grain","particles"];
const SYMBOLS = ["nucleo","expansion","orbita","campo","transicion","halftone","onda","topografia","particulas","superposicion","vector"];
const LISTS = ["client","industry","type","role","country"];
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const ea = s => String(s ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const et = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const ADM = {open:false, tab:"cases", editing:null, data:null, dirty:false, token:SS.get("hn_tok") || null, busy:false};

/* ---------------------------------------------------------------- API */
async function api(payload){
  const r = await fetch(CFG.API_URL, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(payload)});
  if (!r.ok) throw new Error("Server error " + r.status);
  return r.json();
}
function normalize(d){
  d.projects = (d.projects || []).map(p => {
    LISTS.forEach(k => p[k] = Array.isArray(p[k]) ? p[k] : []);
    p.status = p.status === "draft" ? "draft" : "published";
    p.highlight = !!p.highlight; p.link = p.link || "";
    p.sub = p.sub || ""; p.excerpt = p.excerpt || ""; p.html = p.html || "";
    p.texture = TEXTURES.includes(p.texture) ? p.texture : "halftone"; p.cover = p.cover || "";
    return p;
  });
  d.config = d.config || {}; d.pages = d.pages || {};
  ["home","approach","about","thinking"].forEach(k => d.pages[k] = d.pages[k] || {});
  const A = d.pages.approach, B = d.pages.about, T = d.pages.thinking;
  A.principles = A.principles || []; B.experience = B.experience || [];
  ["education","certifications","disciplines"].forEach(k => B[k] = B[k] || []);
  T.publications = T.publications || []; d.config.disciplines = d.config.disciplines || [];
  return d;
}
async function login(pw){
  if (DEMO){ if (pw !== CFG.DEMO_PASSWORD) throw new Error("Wrong password"); ADM.token = "demo"; }
  else { const r = await api({action:"login", password:pw}); if (!r.ok) throw new Error(r.error || "Wrong password"); ADM.token = r.token; }
  SS.set("hn_tok", ADM.token);
}
async function loadAdminData(){
  if (DEMO){ const s = LS.get("hn_demo_data"); return normalize(s ? JSON.parse(s) : clone(SEED)); }
  const r = await api({action:"readAdmin", token:ADM.token});
  if (r.error){ const e = new Error(r.error); e.auth = r.error === "unauthorized"; throw e; }
  return normalize(r.data);
}
const stamp = () => { const d = new Date(); return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); };
const strip = (k, v) => k[0] === "_" ? undefined : v;

/* public data (what visitors see) */
async function loadPublic(){
  try {
    let d;
    if (DEMO){ const s = LS.get("hn_demo_data"); if (!s) return; d = JSON.parse(s); }
    else {
      const r = await fetch(CFG.API_URL + (CFG.API_URL.includes("?") ? "&" : "?") + "action=read&_=" + Date.now());
      d = await r.json(); if (!d || d.error || !d.projects) return;
      LS.set("hn_cache", JSON.stringify(d));
    }
    if (!window.ADMIN_ON && JSON.stringify(d) !== JSON.stringify(DATA)){ setData(d); route(); }
  } catch(e){ console.warn("[HN] could not refresh from Sheets:", e); }
}

/* ---------------------------------------------------------------- helpers */
function toast(msg, bad){
  qa(".toast").forEach(t => t.remove());
  const t = document.createElement("div"); t.className = "toast" + (bad ? " err" : ""); t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 2600);
}
const slugify = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80) || "case";
function uniqueSlug(base, except){
  let s = slugify(base), n = 2; const taken = x => ADM.data.projects.some(p => p !== except && p.slug === x);
  const root = s; while (taken(s)) s = root + "-" + n++;
  return s;
}
const getPath = (o, path) => path.split(".").reduce((a, k) => a == null ? a : a[k], o);
function setPath(o, path, v){ const ks = path.split("."), last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
function markDirty(on = true){
  ADM.dirty = on;
  const s = q("#adm-status"); if (s){ s.textContent = on ? "● Unsaved changes" : "All changes saved"; s.classList.toggle("dirty", on); }
  q("#adm-pill").classList.toggle("dirty", on);
}
function syncSite(){ setData(ADM.data); }

/* generic modal: fields → values (or null when cancelled). onSubmit may throw to show an inline error. */
function ask({title, note, fields, ok = "OK", onSubmit}){
  return new Promise(resolve => {
    const bg = document.createElement("div"); bg.className = "mdl-bg";
    bg.innerHTML = `<form class="mdl" autocomplete="off"><h3>${et(title)}</h3>${note ? `<p class="mdl-note">${note}</p>` : ""}
      ${fields.map(f => `<div class="fld"><label>${et(f.label)}</label><input name="${f.name}" type="${f.type || "text"}" value="${ea(f.value || "")}" placeholder="${ea(f.placeholder || "")}"></div>`).join("")}
      <div class="err"></div><div class="btns"><button class="hn-btn sm accent" type="submit">${et(ok)}</button><button class="hn-btn sm outline" type="button" data-x>Cancel</button></div></form>`;
    document.body.append(bg);
    const form = q("form", bg), err = q(".err", bg);
    const close = v => { bg.remove(); document.removeEventListener("keydown", esc2, true); resolve(v); };
    const esc2 = e => { if (e.key === "Escape"){ e.stopPropagation(); close(null); } };
    document.addEventListener("keydown", esc2, true);
    q("[data-x]", bg).onclick = () => close(null);
    bg.addEventListener("mousedown", e => { if (e.target === bg) close(null); });
    form.onsubmit = async e => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(form).entries());
      try { const res = onSubmit ? await onSubmit(vals) : vals; close(res === undefined ? vals : res); }
      catch(x){ err.textContent = x.message || String(x); }
    };
    setTimeout(() => q("input", bg).focus(), 30);
  });
}

/* ---------------------------------------------------------------- URL helpers */
const driveId = u => { const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{15,})/) || u.match(/docs\.google\.com\/[^?#]*\/d\/([\w-]{15,})/); return m && m[1]; };
function imageUrl(u){
  u = u.trim(); const id = driveId(u);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w1600`;
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders|drive\.google\.com\/(drive|folderview)/i.test(u)) throw new Error("That is a folder link. Open the image in Drive → Share → Copy link.");
  if (/(drive|docs)\.google\.com/i.test(u)) throw new Error("Couldn't find the file id in that link. Use Drive → Share → Copy link on the image itself.");
  if (!/^https?:\/\//i.test(u)) throw new Error("Paste a link that starts with https://");
  return u;
}
function videoUrl(u){
  u = u.trim(); let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{6,})/))) return "https://www.youtube-nocookie.com/embed/" + m[1];
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return "https://player.vimeo.com/video/" + m[1];
  const id = driveId(u); if (id) return `https://drive.google.com/file/d/${id}/preview`;
  throw new Error("Use a YouTube, Vimeo or Google Drive video link");
}
const safeHref = h => { h = (h || "").trim(); return /^(https?:|mailto:|#)/i.test(h) ? h : (/^[\w.-]+\.[a-z]{2,}/i.test(h) ? "https://" + h : ""); };

/* ---------------------------------------------------------------- HTML sanitizer / serializer */
function inline(n){
  let o = "";
  n.childNodes.forEach(c => {
    if (c.nodeType === 3){ o += et(c.nodeValue.replace(/ /g, " ")); return; }
    if (c.nodeType !== 1) return;
    const t = c.tagName;
    if (t === "BR") o += "<br>";
    else if (t === "B" || t === "STRONG" || /font-weight:\s*(bold|[6-9]00)/.test(c.getAttribute("style") || "")) o += "<strong>" + inline(c) + "</strong>";
    else if (t === "I" || t === "EM" || /font-style:\s*italic/.test(c.getAttribute("style") || "")) o += "<em>" + inline(c) + "</em>";
    else if (t === "A"){ const h = safeHref(c.getAttribute("href")); o += h ? `<a href="${ea(h)}" target="_blank" rel="noopener">${inline(c)}</a>` : inline(c); }
    else if (c.classList.contains("fig-x") || t === "SCRIPT" || t === "STYLE" || t === "IMG" || t === "IFRAME") { /* skip */ }
    else o += inline(c);
  });
  return o;
}
const clean = s => s.replace(/(<br>)+$/, "").replace(/^(<br>)+/, "").trim();
function blocks(root, numbered, ctx = {n:0}){
  let out = "";
  root.childNodes.forEach(c => {
    if (c.nodeType === 3){ const t = c.nodeValue.trim(); if (t) out += `<p>${et(t)}</p>\n`; return; }
    if (c.nodeType !== 1) return;
    const t = c.tagName;
    if (t === "H1" || t === "H2"){ const x = clean(inline(c)); if (x){ ctx.n++; out += `<h2 class="c-h2">${numbered ? `<span class="idx">${pad(ctx.n)} —</span>` : ""}${x}</h2>\n`; } }
    else if (/^H[3-6]$/.test(t)){ const x = clean(inline(c)); if (x) out += `<h3 class="c-h3">${x}</h3>\n`; }
    else if (t === "BLOCKQUOTE"){ const x = clean(inline(c)); if (x) out += `<blockquote class="c-quote">${x}</blockquote>\n`; }
    else if (t === "UL" || t === "OL"){
      const lis = [...c.children].filter(li => li.tagName === "LI").map(li => clean(inline(li))).filter(Boolean);
      const tag = t.toLowerCase(); if (lis.length) out += `<${tag}>${lis.map(x => `<li>${x}</li>`).join("")}</${tag}>\n`;
    }
    else if (t === "FIGURE"){
      const img = q("img", c), ifr = q("iframe", c);
      if (img && img.getAttribute("src")) out += `<figure class="c-img"><img src="${ea(img.getAttribute("src"))}" alt="${ea(img.getAttribute("alt") || "")}" loading="lazy"></figure>\n`;
      else if (ifr && ifr.getAttribute("src")) out += `<figure class="c-video"><iframe src="${ea(ifr.getAttribute("src"))}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></figure>\n`;
    }
    else if ((t === "P" || t === "DIV" || t === "SECTION" || t === "ARTICLE") && c.querySelector("p,h1,h2,h3,h4,ul,ol,blockquote,figure,div")) out += blocks(c, numbered, ctx);
    else if (t === "SCRIPT" || t === "STYLE" || t === "IMG" || t === "IFRAME") { /* skip */ }
    else { const x = clean(inline(c)); if (x) out += `<p>${x}</p>\n`; }
  });
  return out.trim();
}

/* ---------------------------------------------------------------- editor */
const ED = {el:null, range:null, project:null};
function figureEl(kind, src, alt){
  const f = document.createElement("figure"); f.className = kind; f.contentEditable = "false";
  f.innerHTML = kind === "c-img" ? `<img referrerpolicy="no-referrer" src="${ea(src)}" alt="${ea(alt || "")}">` : `<iframe src="${ea(src)}" title="Video" allowfullscreen></iframe>`;
  const x = document.createElement("button"); x.type = "button"; x.className = "fig-x"; x.textContent = "Remove"; x.contentEditable = "false"; f.append(x);
  const im = q("img", f); if (im) im.onerror = () => { if (!q(".fig-bad", f)) f.insertAdjacentHTML("beforeend", `<div class="fig-bad">Image could not load. If it's from Drive, share the file as “Anyone with the link”.</div>`); };
  return f;
}
function loadIntoEditor(html){
  const tmp = document.createElement("div"); tmp.innerHTML = html;
  qa(".idx", tmp).forEach(e => e.remove());
  qa("figure", tmp).forEach(f => {
    const im = q("img", f), fr = q("iframe", f);
    f.replaceWith(im ? figureEl("c-img", im.getAttribute("src"), im.getAttribute("alt")) : fr ? figureEl("c-video", fr.getAttribute("src")) : document.createComment(""));
  });
  ED.el.innerHTML = tmp.innerHTML;
  if (!ED.el.children.length) ED.el.innerHTML = "<p><br></p>";
  fixBlocks(); flagEmpty();
}
function fixBlocks(){
  [...ED.el.children].forEach(c => {
    const t = c.tagName, want = t === "H2" ? "c-h2" : t === "H3" ? "c-h3" : t === "BLOCKQUOTE" ? "c-quote" : null;
    if (t === "FIGURE") return;
    if (want){ if (c.className !== want) c.className = want; } else if (c.className) c.removeAttribute("class");
    if (c.hasAttribute("style")) c.removeAttribute("style");
  });
}
function flagEmpty(){
  const e = ED.el; e.classList.toggle("empty", e.children.length <= 1 && !e.textContent.trim() && !q("figure", e));
}
function edHTML(){
  const c = ED.el.cloneNode(true);
  return blocks(c, true);
}
let saveT;
function changed(){
  fixBlocks(); flagEmpty(); positionPlus();
  clearTimeout(saveT); saveT = setTimeout(commitBody, 250);
  markDirty();
}
function commitBody(){
  if (!ED.project || !ED.el) return;
  ED.project.html = edHTML();
}
function currentBlock(){
  const s = getSelection(); if (!s.rangeCount) return null;
  let n = s.anchorNode; if (!n || !ED.el.contains(n)) return null;
  while (n && n.parentNode !== ED.el) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}
function saveRange(){ const s = getSelection(); if (s.rangeCount && ED.el.contains(s.anchorNode)) ED.range = s.getRangeAt(0).cloneRange(); }
function restoreRange(){
  ED.el.focus();
  if (ED.range){ const s = getSelection(); s.removeAllRanges(); s.addRange(ED.range); }
}
function placeCaret(el){ const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ED.range = r.cloneRange(); }
function setBlock(tag){
  ED.el.focus(); const b = currentBlock();
  if (b && tag !== "p" && b.tagName.toLowerCase() === tag) tag = "p";
  document.execCommand("formatBlock", false, tag); changed();
}
function insertFigure(fig){
  restoreRange(); const b = currentBlock();
  if (b && b.tagName === "P" && !b.textContent.trim() && !q("img", b)) b.replaceWith(fig);
  else if (b) b.after(fig); else ED.el.append(fig);
  let nx = fig.nextElementSibling;
  if (!nx || nx.tagName !== "P"){ nx = document.createElement("p"); nx.innerHTML = "<br>"; fig.after(nx); }
  placeCaret(nx); changed();
}
async function addImage(){
  saveRange();
  const v = await ask({title:"Add image", note:"Paste a Google Drive share link (file set to “Anyone with the link”) or any image URL.", ok:"Insert",
    fields:[{name:"url", label:"Image link", placeholder:"https://drive.google.com/file/d/…/view"}, {name:"alt", label:"Description (alt text)", placeholder:"What the image shows"}],
    onSubmit: x => ({url:imageUrl(x.url), alt:x.alt})});
  if (v) insertFigure(figureEl("c-img", v.url, v.alt)); else restoreRange();
}
async function addVideo(){
  saveRange();
  const v = await ask({title:"Add video", note:"YouTube, Vimeo or Google Drive video link.", ok:"Insert",
    fields:[{name:"url", label:"Video link", placeholder:"https://www.youtube.com/watch?v=…"}], onSubmit: x => ({url:videoUrl(x.url)})});
  if (v) insertFigure(figureEl("c-video", v.url)); else restoreRange();
}
async function addLink(){
  saveRange(); const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed){ toast("Select some text first"); return; }
  const cur = (sel.anchorNode.parentElement.closest("a") || {}).href || "";
  const v = await ask({title:"Link", note:"Leave empty to remove the link.", ok:"Apply", fields:[{name:"url", label:"URL", value:cur, placeholder:"https://…"}], onSubmit: x => ({url:x.url.trim()})});
  restoreRange(); if (!v) return;
  const h = safeHref(v.url);
  if (!h) document.execCommand("unlink"); else document.execCommand("createLink", false, h);
  changed();
}
function runTool(act){
  ED.el.focus();
  switch(act){
    case "h2": return setBlock("h2");
    case "h3": return setBlock("h3");
    case "p": return setBlock("p");
    case "quote": return setBlock("blockquote");
    case "ul": document.execCommand("insertUnorderedList"); return changed();
    case "ol": document.execCommand("insertOrderedList"); return changed();
    case "b": document.execCommand("bold"); return changed();
    case "i": document.execCommand("italic"); return changed();
    case "link": return addLink();
    case "img": return addImage();
    case "video": return addVideo();
    case "undo": document.execCommand("undo"); return changed();
  }
}
/* floating "+" (empty line) and selection bubble */
function positionPlus(){
  const plus = q("#adm-plus"); if (!plus) return;
  const b = currentBlock(), s = getSelection();
  if (b && b.tagName === "P" && !b.textContent.trim() && !q("img", b) && s.isCollapsed){
    const r = b.getBoundingClientRect(), h = ED.el.getBoundingClientRect();
    plus.style.display = "block"; plus.style.top = (r.top - h.top + Math.max(0, (r.height - 28) / 2)) + "px";
  } else { plus.style.display = "none"; q("#adm-plusmenu").classList.remove("open"); }
}
function positionBubble(){
  const bub = q("#adm-bub"); if (!bub) return;
  const s = getSelection();
  if (!ED.el || !s.rangeCount || s.isCollapsed || !ED.el.contains(s.anchorNode) || !ED.el.contains(s.focusNode)) { bub.classList.remove("open"); return; }
  const r = s.getRangeAt(0).getBoundingClientRect(); if (!r.width && !r.height) { bub.classList.remove("open"); return; }
  bub.classList.add("open");
  const w = bub.offsetWidth; bub.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; bub.style.top = Math.max(8, r.top - 46) + "px";
}
document.addEventListener("selectionchange", () => { if (ADM.open && ED.el && ED.el.isConnected){ positionBubble(); positionPlus(); } });

function bindEditor(){
  const e = ED.el;
  document.execCommand("defaultParagraphSeparator", false, "p");
  e.addEventListener("input", changed);
  e.addEventListener("keyup", () => { saveRange(); positionPlus(); });
  e.addEventListener("mouseup", () => { saveRange(); });
  e.addEventListener("blur", commitBody);
  e.addEventListener("keydown", ev => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k"){ ev.preventDefault(); addLink(); return; }
    if (ev.key === " " && !ev.metaKey && !ev.ctrlKey){
      const b = currentBlock(), s = getSelection();
      if (b && b.tagName === "P" && s.isCollapsed){
        const t = b.textContent, map = {"##":"h2", "###":"h3", ">":"blockquote"};
        if (map[t]){ ev.preventDefault(); b.innerHTML = "<br>"; setBlock(map[t]); return; }
        if (t === "-" || t === "*"){ ev.preventDefault(); b.innerHTML = "<br>"; document.execCommand("insertUnorderedList"); changed(); return; }
        if (t === "1."){ ev.preventDefault(); b.innerHTML = "<br>"; document.execCommand("insertOrderedList"); changed(); return; }
      }
    }
  });
  e.addEventListener("paste", ev => {
    ev.preventDefault();
    const html = ev.clipboardData.getData("text/html"), txt = ev.clipboardData.getData("text/plain");
    let out;
    if (html){ const t = document.createElement("div"); t.innerHTML = html; out = blocks(t, false); }
    if (!out) out = txt.split(/\n+/).filter(Boolean).map(l => `<p>${et(l)}</p>`).join("");
    document.execCommand("insertHTML", false, out); changed();
  });
  e.addEventListener("click", ev => {
    const x = ev.target.closest(".fig-x"); if (x){ x.closest("figure").remove(); if (!e.children.length) e.innerHTML = "<p><br></p>"; changed(); return; }
    qa("figure.sel", e).forEach(f => f.classList.remove("sel"));
    const f = ev.target.closest("figure"); if (f) f.classList.add("sel");
  });
  e.addEventListener("keydown", ev => {
    if ((ev.key === "Backspace" || ev.key === "Delete")){
      const f = q("figure.sel", e); if (f){ ev.preventDefault(); f.remove(); changed(); }
    }
  });
}

/* ---------------------------------------------------------------- views */
const coverHTML = p => p.cover ? `<img class="duo" referrerpolicy="no-referrer" src="${ea(p.cover)}" alt=""><button type="button" class="ib" data-act="cover-clear">Remove cover</button>` : `<div class="cover-none">No cover — the “${et(p.texture)}” texture is used</div>`;
const chipsHTML = (key, vals) => {
  const opts = [...new Set(ADM.data.projects.flatMap(p => p[key]))].sort();
  return `<div class="chipsin" data-chips="${key}">${vals.map((v, i) => `<span class="tagchip">${et(v)}<button type="button" data-act="chip-del" data-k="${key}" data-i="${i}" aria-label="Remove ${ea(v)}">×</button></span>`).join("")}<input list="dl-${key}" data-chip-in="${key}" placeholder="${vals.length ? "" : "Type and press Enter"}"></div><datalist id="dl-${key}">${opts.map(o => `<option value="${ea(o)}">`).join("")}</datalist>`;
};
function viewCases(){
  const P = ADM.data.projects, pub = P.filter(p => p.status === "published").length;
  return `<div class="row-h"><div><h1>Cases</h1><p class="muted" style="margin:0">${P.length} cases · ${pub} published · ${P.length - pub} draft. Order here = order on the site.</p></div>
    <button class="hn-btn accent" data-act="new">New case</button></div>
    <div class="cl">${P.map((p, i) => `<div class="cl-r">
      <span class="n">${pad(i + 1)}</span>
      <button class="tt" data-act="edit" data-i="${i}">${et(p.title || "Untitled")}</button>
      <span class="n yr">${p.year || "—"}</span>
      <span class="cc">${et(p.client.join(", ") || "—")}</span>
      <span class="stc"><button class="st ${p.status === "published" ? "pub" : "draft"}" data-act="status" data-i="${i}" title="Click to toggle">${p.status}</button></span>
      <span class="cl-act">
        <button class="ib ${p.highlight ? "on" : ""}" data-act="star" data-i="${i}" title="Highlight on home">${p.highlight ? "★" : "☆"}</button>
        <button class="ib" data-act="up" data-i="${i}" title="Move up">▲</button><button class="ib" data-act="down" data-i="${i}" title="Move down">▼</button>
        <button class="ib" data-act="view" data-i="${i}" title="View on site">View</button>
        <button class="ib" data-act="dup" data-i="${i}" title="Duplicate">Copy</button>
        <button class="ib" data-act="del" data-i="${i}" title="Delete">Del</button>
      </span></div>`).join("")}</div>`;
}
function viewEditor(){
  const p = ADM.data.projects[ADM.editing];
  return `<div class="row-h"><button class="hn-btn sm outline" data-act="back">← All cases</button>
      <span class="adm-status" style="opacity:.6">Case ${pad(ADM.editing + 1)} / ${pad(ADM.data.projects.length)}</span></div>
    <div class="ed-wrap">
      <div>
        <textarea class="ed-title" rows="1" data-f="title" placeholder="Case title">${et(p.title)}</textarea>
        <textarea class="ed-sub" rows="1" data-f="sub" placeholder="Subtitle — one line that frames the case">${et(p.sub)}</textarea>
        <div class="ed-tools" id="adm-tools">
          <button data-t="h2" title="Section heading">Section</button><button data-t="h3" title="Subhead">Subhead</button><button data-t="p" title="Normal text">Text</button><button data-t="quote" title="Quote block">Quote</button>
          <span class="sep"></span><button data-t="ul">• List</button><button data-t="ol">1. List</button>
          <span class="sep"></span><button data-t="b"><b>B</b></button><button data-t="i"><i>I</i></button><button data-t="link">Link</button>
          <span class="sep"></span><button data-t="img">+ Image</button><button data-t="video">+ Video</button>
          <span class="sep"></span><button data-t="undo">Undo</button>
        </div>
        <div style="position:relative">
          <button class="plus" id="adm-plus" type="button" title="Add block" contenteditable="false">+</button>
          <div class="ed prose" id="adm-ed" contenteditable="true" spellcheck="true"></div>
        </div>
      </div>
      <aside class="ed-side">
        <div class="fld"><label>Status</label><select data-f="status"><option value="published" ${p.status === "published" ? "selected" : ""}>Published</option><option value="draft" ${p.status === "draft" ? "selected" : ""}>Draft (hidden)</option></select></div>
        <label class="chk fld"><input type="checkbox" data-f="highlight" ${p.highlight ? "checked" : ""}> Highlight on home</label>
        <div class="g2"><div class="fld"><label>Year</label><input type="number" data-f="year" value="${ea(p.year || "")}"></div>
          <div class="fld"><label>Texture</label><select data-f="texture">${TEXTURES.map(t => `<option ${p.texture === t ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
        <div class="fld"><span class="l">Cover photo (duotone)</span>
          <div class="cover-prev" id="cover-prev">${coverHTML(p)}</div>
          <input data-cover value="${ea(p.cover)}" placeholder="Paste a Drive link or image URL">
          <span class="hint">Upload the original photo to Drive (“Anyone with the link”). The Hipernova yellow/black filter is applied automatically. Used in the case band and the card thumbnail.</span></div>
        <div class="fld"><label>Slug (URL)</label><input data-f="slug" value="${ea(p.slug)}"></div>
        ${[["client","Client"],["industry","Industry"],["type","Type"],["role","Role"],["country","Country"]].map(([k, l]) => `<div class="fld"><span class="l">${l}</span><div id="chips-${k}">${chipsHTML(k, p[k])}</div></div>`).join("")}
        <div class="fld"><label>External link (optional)</label><input data-f="link" value="${ea(p.link)}" placeholder="https://"></div>
        <div class="fld"><label>Card excerpt</label><textarea rows="4" data-f="excerpt" placeholder="Empty = generated from the first paragraph">${et(p.excerpt)}</textarea></div>
      </aside>
    </div>
    <div class="bub" id="adm-bub"><button data-t="b"><b>B</b></button><button data-t="i"><i>I</i></button><button data-t="link">Link</button><button data-t="h2">H2</button><button data-t="h3">H3</button><button data-t="quote">Quote</button><button data-t="ul">• List</button></div>
    <div class="plusmenu" id="adm-plusmenu"><button data-t="img">Image</button><button data-t="video">Video</button><button data-t="h2">Section heading</button><button data-t="h3">Subhead</button><button data-t="quote">Quote</button><button data-t="ul">Bullet list</button><button data-t="ol">Numbered list</button></div>`;
}
const F = (label, path, o = {}) => {
  const v = getPath(ADM.data, path), lines = Array.isArray(v), val = lines ? v.join("\n") : (v ?? "");
  const area = o.area || lines;
  return `<div class="fld"><label>${label}</label>${area ? `<textarea rows="${o.rows || (lines ? 5 : 3)}" data-bind="${path}" ${lines ? 'data-kind="lines"' : ""}>${et(val)}</textarea>` : `<input data-bind="${path}" value="${ea(val)}" placeholder="${ea(o.ph || "")}">`}${o.hint ? `<span class="hint">${o.hint}</span>` : ""}</div>`;
};
function listEditor(list, pathBase, rows){
  return rows.map((r, i) => `<div class="card-box"><div class="top"><span class="t-meta">${pad(i + 1)} —</span><span class="cl-act">
    <button class="ib" data-act="lop" data-op="up" data-list="${list}" data-i="${i}">▲</button><button class="ib" data-act="lop" data-op="down" data-list="${list}" data-i="${i}">▼</button><button class="ib" data-act="lop" data-op="del" data-list="${list}" data-i="${i}">Del</button></span></div>
    ${F("Title", `${pathBase}.${i}.0`)}${F(list === "principles" ? "Text" : "Text (HTML allowed: &lt;strong&gt;, &lt;a&gt;)", `${pathBase}.${i}.1`, {area:true, rows:4})}
    ${list === "principles" ? `<div class="fld"><label>Symbol</label><select data-bind="${pathBase}.${i}.2">${SYMBOLS.map(s => `<option ${r[2] === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>` : ""}</div>`).join("");
}
function viewSite(){
  const D = ADM.data;
  return `<h1>Site texts</h1><p class="muted">Everything that isn't a case. Lists use one item per line.</p>
  <h2 class="sh">Identity & contact</h2><div class="g2">${F("Name", "config.name")}${F("Role", "config.role")}</div>
  ${F("Disciplines (one per line)", "config.disciplines")}
  <div class="g2">${F("Email", "config.email", {ph:"you@email.com", hint:"Shows the “Write to me” button when filled"})}${F("LinkedIn URL", "config.linkedin")}</div>${F("Substack URL", "config.substack")}
  <h2 class="sh">Home</h2>${F("Lead (hero)", "pages.home.lead", {area:true, rows:2})}${F("Bio (Practice section)", "pages.home.bio", {area:true, rows:5})}
  <h2 class="sh">Approach</h2>${F("Lead", "pages.approach.lead", {area:true, rows:4})}
  <div class="row-h"><span class="t-meta">Principles</span><button class="hn-btn sm" data-act="ladd" data-list="principles">Add principle</button></div>${listEditor("principles", "pages.approach.principles", D.pages.approach.principles)}
  <h2 class="sh">About</h2>${F("Intro", "pages.about.intro", {area:true, rows:5})}${F("Quote / belief (format: “Statement — Highlight. Rest of text.”)", "pages.about.quote", {area:true, rows:4})}
  <div class="row-h"><span class="t-meta">Experience</span><button class="hn-btn sm" data-act="ladd" data-list="experience">Add block</button></div>${listEditor("experience", "pages.about.experience", D.pages.about.experience)}
  ${F("Education (one per line)", "pages.about.education")}${F("Certifications (one per line)", "pages.about.certifications")}${F("Disciplines & frameworks (one per line)", "pages.about.disciplines")}${F("Teaching", "pages.about.teaching", {area:true, rows:3})}
  <h2 class="sh">Thinking</h2>${F("Lead", "pages.thinking.lead", {area:true, rows:3})}${F("Substack blurb", "pages.thinking.substack", {area:true, rows:4})}${F("Medium / IxDF blurb", "pages.thinking.medium", {area:true, rows:2})}
  ${F("Publications (one per line, HTML allowed)", "pages.thinking.publications", {rows:8})}`;
}
function render(){
  const root = q("#adm-body"); if (!root) return;
  q("#adm").classList.toggle("open", ADM.open);
  qa(".adm-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === ADM.tab && ADM.editing == null));
  if (ADM.tab === "site"){ root.innerHTML = viewSite(); }
  else if (ADM.editing != null){
    root.innerHTML = viewEditor();
    ED.el = q("#adm-ed"); ED.project = ADM.data.projects[ADM.editing]; ED.range = null;
    loadIntoEditor(ED.project.html); bindEditor(); autosize();
  } else { root.innerHTML = viewCases(); ED.el = null; ED.project = null; }
  q("#adm").scrollTop = 0; barH();
}
const barH = () => { const b = q(".adm-bar"); if (b) q("#adm").style.setProperty("--bar-h", b.offsetHeight + "px"); };
window.addEventListener("resize", () => { if (ADM.open) barH(); });
const autosize = () => qa(".ed-title,.ed-sub").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });

/* ---------------------------------------------------------------- shell */
function buildShell(){
  document.body.insertAdjacentHTML("beforeend", `
  <div class="adm" id="adm" role="dialog" aria-label="Admin">
    <div class="adm-bar s-matter">
      <span class="brand-a">Hipernova <span class="hl">/ Admin</span></span>
      <div class="adm-tabs"><button data-tab="cases">Cases</button><button data-tab="site">Site texts</button></div>
      <span class="adm-sp"></span>
      <span class="adm-status" id="adm-status">All changes saved</span>
      <button class="hn-btn sm outline" data-act="preview">Preview site</button>
      <button class="hn-btn sm accent" data-act="save" id="adm-save">Save to Sheets</button>
      <button class="hn-btn sm outline" data-act="logout">Log out</button>
    </div>
    ${DEMO ? `<div class="adm-demo">Demo mode — no Google Sheet connected. Changes are saved in this browser only. Set API_URL in HN_CONFIG to connect the Sheet.</div>` : ""}
    <div class="adm-body" id="adm-body"></div>
  </div>
  <button class="adm-pill" id="adm-pill">Admin</button>`);
}
function showPill(){ q("#adm-pill").classList.add("show"); }
async function enterAdmin(){
  if (!ADM.data){
    try { ADM.data = await loadAdminData(); }
    catch(e){ if (e.auth){ ADM.token = null; SS.del("hn_tok"); q("#adm-pill").classList.remove("show"); toast("Session expired — click the logo 5 times", true); } else toast("Could not load: " + e.message, true); return; }
  }
  ADM.open = true; document.body.style.overflow = "hidden"; window.ADMIN_ON = true; syncSite(); showPill(); render(); markDirty(ADM.dirty);
}
function closeAdmin(){ commitBody(); ADM.open = false; document.body.style.overflow = ""; q("#adm").classList.remove("open"); syncSite(); route(); }
async function persist(){
  if (ADM.busy) return; commitBody();
  const D = ADM.data;
  for (const p of D.projects){
    if (!p.title.trim()) return toast(`A case has no title (#${D.projects.indexOf(p) + 1})`, true);
    if (p.html.length > 49000) return toast(`“${p.title}” is too long for one Sheets cell (${p.html.length} chars, max 49 000)`, true);
    if (!p.excerpt.trim()){ const m = p.html.match(/<p>([\s\S]*?)<\/p>/); if (m){ const t = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim(); p.excerpt = t.length > 200 ? t.slice(0, 200).trimEnd() + "…" : t; } }
  }
  D.config.date = stamp();
  const out = JSON.parse(JSON.stringify(D, strip));
  const btn = q("#adm-save"); ADM.busy = true; btn.disabled = true; btn.textContent = "Saving…";
  try {
    if (DEMO){ LS.set("hn_demo_data", JSON.stringify(out)); }
    else {
      const r = await api({action:"save", token:ADM.token, data:out});
      if (r.error){ const e = new Error(r.error); e.auth = r.error === "unauthorized"; throw e; }
      LS.set("hn_cache", JSON.stringify({...out, projects:out.projects.filter(p => p.status !== "draft")}));
    }
    markDirty(false); toast(DEMO ? "Saved in this browser (demo)" : "Saved to Google Sheets ✓ " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}));
  } catch(e){
    if (e.auth){ ADM.token = null; SS.del("hn_tok"); toast("Session expired — log in again (your edits are still here)", true); closeAdmin(); }
    else toast("Save failed: " + e.message, true);
  } finally { ADM.busy = false; btn.disabled = false; btn.textContent = "Save to Sheets"; }
}
async function logout(){
  if (ADM.dirty && !confirm("You have unsaved changes. Log out anyway?")) return;
  ADM.open = false; ADM.data = null; ADM.token = null; ADM.dirty = false; ADM.editing = null; window.ADMIN_ON = false;
  SS.del("hn_tok"); document.body.style.overflow = ""; q("#adm").classList.remove("open"); q("#adm-pill").classList.remove("show");
  try { const s = LS.get(DEMO ? "hn_demo_data" : "hn_cache"); if (s) setData(JSON.parse(s)); else setData(SEED); } catch(e){ setData(SEED); }
  route(); loadPublic();
}

/* actions */
function swap(arr, i, j){ if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
const blank = list => list === "principles" ? ["New principle", "Describe it in two sentences.", "nucleo"] : ["New block", "Describe it."];
const listRef = l => l === "principles" ? ADM.data.pages.approach.principles : ADM.data.pages.about.experience;
async function onClick(e){
  const t = e.target.closest("[data-act],[data-tab],[data-t]"); if (!t) return;
  if (t.dataset.tab){ commitBody(); ADM.tab = t.dataset.tab; ADM.editing = null; return render(); }
  if (t.dataset.t){ e.preventDefault(); q("#adm-plusmenu").classList.remove("open"); return runTool(t.dataset.t); }
  const act = t.dataset.act, i = +t.dataset.i, P = ADM.data.projects;
  switch(act){
    case "save": return persist();
    case "logout": return logout();
    case "preview": { commitBody(); const p = ADM.editing != null ? P[ADM.editing] : null; ADM.open = false; document.body.style.overflow = ""; q("#adm").classList.remove("open"); syncSite(); location.hash = p ? "#/work/" + p.slug : "#/"; route(); return; }
    case "view": { ADM.open = false; document.body.style.overflow = ""; q("#adm").classList.remove("open"); syncSite(); location.hash = "#/work/" + P[i].slug; route(); return; }
    case "back": commitBody(); ADM.editing = null; return render();
    case "edit": ADM.editing = i; return render();
    case "new": {
      const y = new Date().getFullYear(), p = {slug:"", title:"Untitled case", sub:"", year:y, client:[], industry:[], type:[], role:[], country:[], highlight:false, link:"", texture:TEXTURES[Math.floor(Math.random() * TEXTURES.length)], cover:"", excerpt:"", html:"<p><br></p>", status:"draft", _auto:true};
      p.slug = uniqueSlug("untitled-case", p); P.unshift(p); ADM.editing = 0; markDirty(); syncSite(); return render();
    }
    case "dup": { const c = clone(P[i]); c.title += " (copy)"; c.status = "draft"; c.slug = uniqueSlug(c.slug + "-copy", c); P.splice(i + 1, 0, c); markDirty(); syncSite(); return render(); }
    case "del": if (confirm(`Delete “${P[i].title}”? This is applied when you save.`)){ P.splice(i, 1); markDirty(); syncSite(); render(); } return;
    case "up": swap(P, i, i - 1); markDirty(); syncSite(); return render();
    case "down": swap(P, i, i + 1); markDirty(); syncSite(); return render();
    case "star": P[i].highlight = !P[i].highlight; markDirty(); syncSite(); return render();
    case "status": P[i].status = P[i].status === "published" ? "draft" : "published"; markDirty(); syncSite(); return render();
    case "cover-clear": { const p = P[ADM.editing]; p.cover = ""; q("#cover-prev").innerHTML = coverHTML(p); q("[data-cover]").value = ""; markDirty(); return; }
    case "chip-del": { const p = P[ADM.editing]; p[t.dataset.k].splice(+t.dataset.i, 1); q("#chips-" + t.dataset.k).innerHTML = chipsHTML(t.dataset.k, p[t.dataset.k]); markDirty(); return; }
    case "lop": { const L = listRef(t.dataset.list), op = t.dataset.op; if (op === "del") L.splice(i, 1); else swap(L, i, op === "up" ? i - 1 : i + 1); markDirty(); return render(); }
    case "ladd": listRef(t.dataset.list).push(blank(t.dataset.list)); markDirty(); return render();
  }
}
function onInput(e){
  const el = e.target;
  if (el.dataset.bind){
    let v = el.value; if (el.dataset.kind === "lines") v = v.split("\n").map(s => s.trim()).filter(Boolean);
    setPath(ADM.data, el.dataset.bind, v); return markDirty();
  }
  if (el.dataset.f && ADM.editing != null){
    const p = ADM.data.projects[ADM.editing], f = el.dataset.f;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (f === "year") v = v === "" ? null : +v;
    p[f] = v;
    if (f === "title" && p._auto){ p.slug = uniqueSlug(v || "case", p); const s = q('[data-f="slug"]'); if (s) s.value = p.slug; }
    if (f === "slug"){ p._auto = false; }
    if (el.classList.contains("ed-title") || el.classList.contains("ed-sub")) autosize();
    markDirty();
  }
}
function onChange(e){
  const el = e.target;
  if (el.dataset.cover !== undefined && ADM.editing != null){
    const p = ADM.data.projects[ADM.editing], v = el.value.trim();
    try { p.cover = v ? imageUrl(v) : ""; el.value = p.cover; } catch(x){ toast(x.message, true); return; }
    q("#cover-prev").innerHTML = coverHTML(p); markDirty(); return;
  }
  if (el.dataset.f === "slug"){ const p = ADM.data.projects[ADM.editing]; p.slug = uniqueSlug(el.value || p.title, p); el.value = p.slug; }
}
function onKey(e){
  const el = e.target;
  if (el.dataset && el.dataset.chipIn && (e.key === "Enter" || e.key === ",")){
    e.preventDefault(); const k = el.dataset.chipIn, v = el.value.trim().replace(/,$/, ""); if (!v) return;
    const p = ADM.data.projects[ADM.editing]; if (!p[k].includes(v)) p[k].push(v);
    q("#chips-" + k).innerHTML = chipsHTML(k, p[k]); q(`[data-chip-in="${k}"]`).focus(); markDirty();
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && ADM.open){ e.preventDefault(); persist(); }
  if (e.key === "Enter" && el.classList && (el.classList.contains("ed-title") || el.classList.contains("ed-sub"))){ e.preventDefault(); if (ED.el) ED.el.focus(); }
}

/* ---------------------------------------------------------------- hidden entrance: click the logo 5×  */
function bindEntrance(){
  const brand = q(".brand"); let n = 0, tm;
  brand.addEventListener("click", () => {
    n++; clearTimeout(tm); tm = setTimeout(() => n = 0, 2500);
    if (n >= CFG.CLICKS){ n = 0; openLogin(); }
  });
}
async function openLogin(){
  if (ADM.token){ return enterAdmin(); }
  const ok = await ask({title:"Admin access", ok:"Enter", fields:[{name:"pw", label:"Password", type:"password"}],
    note: DEMO ? "Demo mode: the password is <b>" + et(CFG.DEMO_PASSWORD) + "</b>. In production it is checked by your Google Apps Script." : "",
    onSubmit: async v => { try { await login(v.pw); return true; } catch(e){ throw new Error(e.message === "Failed to fetch" ? "Cannot reach the Apps Script URL" : e.message); } }});
  if (ok) enterAdmin();
}

/* ---------------------------------------------------------------- boot */
buildShell();
const adm = q("#adm");
adm.addEventListener("click", onClick); adm.addEventListener("input", onInput); adm.addEventListener("change", onChange); adm.addEventListener("keydown", onKey);
adm.addEventListener("mousedown", e => { if (e.target.closest("#adm-tools button,#adm-bub button,#adm-plusmenu button")) e.preventDefault(); });
q("#adm-pill").addEventListener("click", enterAdmin);
document.addEventListener("click", e => {
  const pl = e.target.closest("#adm-plus");
  if (pl){ saveRange(); const m = q("#adm-plusmenu"), r = pl.getBoundingClientRect(); m.style.left = (r.right + 8) + "px"; m.style.top = r.top + "px"; m.classList.toggle("open"); }
  else if (!e.target.closest("#adm-plusmenu")) { const m = q("#adm-plusmenu"); if (m) m.classList.remove("open"); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && ADM.open && !q(".mdl-bg")) { const m = q("#adm-plusmenu"); if (m && m.classList.contains("open")) m.classList.remove("open"); } });
window.addEventListener("beforeunload", e => { if (ADM.dirty){ e.preventDefault(); e.returnValue = ""; } });
/* broken public images disappear (same behaviour as the original site) */
document.addEventListener("error", e => { const t = e.target; if (t && t.tagName === "IMG" && t.closest("#app .prose .c-img")) t.closest("figure").remove(); }, true);
bindEntrance();
if (ADM.token) showPill();
loadPublic();
window.HN_ADMIN = {open:openLogin};
})();
