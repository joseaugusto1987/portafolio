/**
 * HIPERNOVA portfolio — Google Sheets API
 * Bound to the spreadsheet (Extensions → Apps Script). Deploy as Web app:
 *   Execute as: Me · Who has access: Anyone
 *
 * GET  ?action=read                       → published content (public)
 * POST {action:'login', password}         → {ok, token}
 * POST {action:'readAdmin', token}        → {data}  (includes drafts)
 * POST {action:'save', token, data}       → {ok}    (overwrites the sheets)
 *
 * The admin password is NOT in the website. Set it in
 * Project Settings → Script properties → ADMIN_PASSWORD.
 */

var TOKEN_TTL = 6 * 60 * 60; // seconds

var SCHEMA = {
  Projects:   ['order','status','slug','title','sub','year','client','industry','type','role','country','highlight','link','texture','cover','excerpt','body_html','title_es','sub_es','excerpt_es','body_html_es'],
  Principles: ['order','title','text','symbol','title_es','text_es'],
  Experience: ['order','title','html','title_es','html_es'],
  Pages:      ['key','value','value_es'],
  Config:     ['key','value','value_es'],
  Translations: ['en','es']
};

/* ------------------------------------------------------------ endpoints */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'read';
  if (action === 'read') return json_(readAll_(false));
  if (action === 'posts') return json_({posts: posts_()});
  return json_({error: 'unknown action'});
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.action === 'login') return json_(login_(req.password));
    if (!validToken_(req.token)) return json_({error: 'unauthorized'});
    if (req.action === 'readAdmin') return json_({data: readAll_(true)});
    if (req.action === 'save') {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { saveAll_(req.data); } finally { lock.releaseLock(); }
      return json_({ok: true});
    }
    return json_({error: 'unknown action'});
  } catch (err) {
    return json_({error: String(err && err.message || err)});
  }
}

/* ------------------------------------------------------------ auth */
function login_(password) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) return {ok: false, error: 'ADMIN_PASSWORD is not set in Script properties'};
  if (String(password || '') !== real) {
    Utilities.sleep(1200); // slow down guessing
    return {ok: false, error: 'Wrong password'};
  }
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + token, '1', TOKEN_TTL);
  return {ok: true, token: token};
}
function validToken_(t) {
  return !!t && CacheService.getScriptCache().get('tok_' + t) === '1';
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------ sheet helpers */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold').setBackground('#FDEE3D');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Rows as objects, keyed by the header row (column order in the sheet doesn't matter). */
function rows_(name) {
  var sh = sheet_(name), vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0].map(String), out = [];
  for (var i = 1; i < vals.length; i++) {
    var o = {empty: true, _row: i};
    for (var c = 0; c < head.length; c++) {
      o[head[c]] = vals[i][c];
      if (vals[i][c] !== '' && vals[i][c] !== null) o.empty = false;
    }
    if (!o.empty) out.push(o);
  }
  return out;
}
function byOrder_(arr) {
  return arr.sort(function (a, b) {
    var x = parseFloat(a.order), y = parseFloat(b.order);
    x = isNaN(x) ? 1e9 : x; y = isNaN(y) ? 1e9 : y;
    return x === y ? a._row - b._row : x - y;
  });
}
function str_(v) {
  return Object.prototype.toString.call(v) === '[object Date]'
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd.MM.yyyy') : String(v);
}
function list_(v, sep) { return String(v || '').split(sep).map(function (s) { return s.trim(); }).filter(String); }
function bool_(v) { return v === true || /^(true|yes|si|sí|x|1|verdadero)$/i.test(String(v).trim()); }

/* ------------------------------------------------------------ read */
function readAll_(includeDrafts) {
  var projects = byOrder_(rows_('Projects')).filter(function (r) {
    return r.slug && r.title && (includeDrafts || String(r.status).toLowerCase() !== 'draft');
  }).map(function (r) {
    return {
      id: String(r.slug), slug: String(r.slug), title: String(r.title), sub: String(r.sub || ''),
      year: r.year === '' ? null : Number(r.year),
      client: list_(r.client, '|'), industry: list_(r.industry, '|'), type: list_(r.type, '|'),
      role: list_(r.role, '|'), country: list_(r.country, '|'),
      highlight: bool_(r.highlight), link: String(r.link || ''), texture: String(r.texture || 'halftone'),
      cover: String(r.cover || ''), excerpt: String(r.excerpt || ''), html: String(r.body_html || ''),
      status: String(r.status).toLowerCase() === 'draft' ? 'draft' : 'published',
      es: {title: String(r.title_es || ''), sub: String(r.sub_es || ''), excerpt: String(r.excerpt_es || ''), html: String(r.body_html_es || '')}
    };
  });

  var pg = {}, cf = {}, pe = {}, ce = {};
  rows_('Pages').forEach(function (r) { pg[String(r.key)] = str_(r.value); pe[String(r.key)] = str_(r.value_es); });
  rows_('Config').forEach(function (r) { cf[String(r.key)] = str_(r.value); ce[String(r.key)] = str_(r.value_es); });
  var princ = byOrder_(rows_('Principles')), exper = byOrder_(rows_('Experience')), dict = {};
  rows_('Translations').forEach(function (r) { if (r.en && r.es) dict[String(r.en)] = String(r.es); });
  var es = {
    config: {disciplines: list_(ce.disciplines, '|')},
    pages: {
      home: {hero: pe['home.hero'] || '', phrases: list_(pe['home.phrases'], '\n'), bio: pe['home.bio'] || ''},
      approach: {lead: pe['approach.lead'] || '', principles: princ.map(function (r) { return [String(r.title_es || ''), String(r.text_es || '')]; })},
      about: {
        intro: pe['about.intro'] || '', quote: pe['about.quote'] || '',
        experience: exper.map(function (r) { return [String(r.title_es || ''), String(r.html_es || '')]; }),
        education: list_(pe['about.education'], '\n'), certifications: list_(pe['about.certifications'], '\n'),
        disciplines: list_(pe['about.disciplines'], '\n'), teaching: pe['about.teaching'] || ''
      },
      thinking: {lead: pe['thinking.lead'] || '', substack: pe['thinking.substack'] || '', medium: pe['thinking.medium'] || ''}
    }
  };

  return {
    config: {
      name: cf.name || '', role: cf.role || '', disciplines: list_(cf.disciplines, '|'),
      substack: cf.substack || '', linkedin: cf.linkedin || '', email: cf.email || '', date: cf.date || ''
    },
    pages: {
      home: {lead: pg['home.lead'] || '', bio: pg['home.bio'] || '', hero: pg['home.hero'] || '', phrases: list_(pg['home.phrases'], '\n')},
      approach: {
        lead: pg['approach.lead'] || '',
        principles: princ.map(function (r) { return [String(r.title), String(r.text), String(r.symbol || 'nucleo')]; })
      },
      about: {
        intro: pg['about.intro'] || '', quote: pg['about.quote'] || '',
        experience: exper.map(function (r) { return [String(r.title), String(r.html)]; }),
        education: list_(pg['about.education'], '\n'), certifications: list_(pg['about.certifications'], '\n'),
        disciplines: list_(pg['about.disciplines'], '\n'), teaching: pg['about.teaching'] || ''
      },
      thinking: {
        lead: pg['thinking.lead'] || '', substack: pg['thinking.substack'] || '', medium: pg['thinking.medium'] || '',
        publications: list_(pg['thinking.publications'], '\n')
      }
    },
    projects: projects,
    es: es,
    i18n: {es: dict}
  };
}

/* ------------------------------------------------------------ Substack articles (public, cached 1 h) */
/** Reads the whole Substack archive server-side (browsers can't: no CORS). Uses Config → substack, default below. */
function posts_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('posts_v1');
  if (hit) return JSON.parse(hit);
  var cf = {};
  rows_('Config').forEach(function (r) { cf[String(r.key)] = str_(r.value); });
  var base = String(cf.substack || 'https://hipernova.substack.com').replace(/\/+$/, '');
  var out = [], offset = 0;
  while (offset < 1000) {
    var res = UrlFetchApp.fetch(base + '/api/v1/archive?sort=new&limit=50&offset=' + offset, {muteHttpExceptions: true});
    if (res.getResponseCode() !== 200) break;
    var arr = JSON.parse(res.getContentText());
    arr.forEach(function (p) {
      if (p.type === 'thread' || !p.canonical_url) return;
      out.push({
        title: String(p.title || ''), description: String(p.subtitle || p.description || '').slice(0, 240),
        image: String(p.cover_image || ''), url: String(p.canonical_url), date: String(p.post_date || '')
      });
    });
    if (arr.length < 50) break;
    offset += 50;
  }
  var s = JSON.stringify(out);
  if (out.length && s.length < 95000) cache.put('posts_v1', s, 3600);
  return out;
}

/* ------------------------------------------------------------ write */
function overwrite_(name, rows) {
  var sh = sheet_(name), cols = SCHEMA[name], n = cols.length;
  // header-driven: add any column missing from the sheet (e.g. "cover") at the end, then map by header
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  cols.forEach(function (c) {
    if (head.indexOf(c) < 0) {
      head.push(c);
      sh.getRange(1, head.length).setValue(c).setFontWeight('bold').setBackground('#FDEE3D');
    }
  });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, head.length).clearContent();
  if (rows.length) {
    var idx = cols.map(function (c) { return head.indexOf(c); });
    var out = rows.map(function (r) {
      var line = new Array(head.length).fill('');
      for (var k = 0; k < n; k++) line[idx[k]] = r[k];
      return line;
    });
    var rg = sh.getRange(2, 1, out.length, head.length);
    if (name === 'Pages' || name === 'Config') rg.setNumberFormat('@'); // keep "08.10.2026" etc. as text
    rg.setValues(out);
  }
}

/** Writes by the canonical column order (SCHEMA). Keep the header row as created / imported. */
function saveAll_(d) {
  if (!d || !d.projects || !d.pages || !d.config) throw new Error('Invalid payload');
  var seen = {};
  var proj = d.projects.map(function (p, i) {
    if (!p.slug || !p.title) throw new Error('Case #' + (i + 1) + ' needs a title and slug');
    if (seen[p.slug]) throw new Error('Duplicate slug: ' + p.slug);
    seen[p.slug] = 1;
    if ((p.html || '').length > 49000) throw new Error('"' + p.title + '" exceeds the cell limit');
    return [i + 1, p.status === 'draft' ? 'draft' : 'published', p.slug, p.title, p.sub || '', p.year || '',
      (p.client || []).join(' | '), (p.industry || []).join(' | '), (p.type || []).join(' | '),
      (p.role || []).join(' | '), (p.country || []).join(' | '), !!p.highlight, p.link || '',
      p.texture || 'halftone', p.cover || '', p.excerpt || '', p.html || '',
      (p.es && p.es.title) || '', (p.es && p.es.sub) || '', (p.es && p.es.excerpt) || '', (p.es && p.es.html) || ''];
  });
  var A = d.pages.approach, B = d.pages.about, T = d.pages.thinking, H = d.pages.home, C = d.config;
  var j = function (a) { return (a || []).join('\n'); };
  var E = d.es || {}, EP = (E.pages || {}), EH = EP.home || {}, EA = EP.approach || {}, EB = EP.about || {}, ET = EP.thinking || {}, EC = E.config || {};
  var eprin = EA.principles || [], eexp = EB.experience || [];

  // snapshot before overwriting (kept in a "Backup" tab, one copy: the previous save)
  backup_();

  overwrite_('Projects', proj);
  overwrite_('Principles', (A.principles || []).map(function (x, i) { var e = eprin[i] || []; return [i + 1, x[0], x[1], x[2], e[0] || '', e[1] || '']; }));
  overwrite_('Experience', (B.experience || []).map(function (x, i) { var e = eexp[i] || []; return [i + 1, x[0], x[1], e[0] || '', e[1] || '']; }));
  overwrite_('Pages', [
    ['home.lead', H.lead, ''], ['home.bio', H.bio, EH.bio || ''], ['home.hero', H.hero || '', EH.hero || ''],
    ['home.phrases', j(H.phrases), j(EH.phrases)], ['approach.lead', A.lead, EA.lead || ''],
    ['about.intro', B.intro, EB.intro || ''], ['about.quote', B.quote, EB.quote || ''],
    ['about.education', j(B.education), j(EB.education)], ['about.certifications', j(B.certifications), j(EB.certifications)],
    ['about.disciplines', j(B.disciplines), j(EB.disciplines)], ['about.teaching', B.teaching, EB.teaching || ''],
    ['thinking.lead', T.lead, ET.lead || ''], ['thinking.substack', T.substack, ET.substack || ''],
    ['thinking.medium', T.medium, ET.medium || ''], ['thinking.publications', j(T.publications), '']
  ]);
  overwrite_('Config', [
    ['name', C.name, ''], ['role', C.role, ''], ['disciplines', (C.disciplines || []).join(' | '), (EC.disciplines || []).join(' | ')],
    ['substack', C.substack, ''], ['linkedin', C.linkedin, ''], ['email', C.email, ''], ['date', C.date, '']
  ]);
  var dict = (d.i18n && d.i18n.es) || {};
  overwrite_('Translations', Object.keys(dict).map(function (k) { return [k, dict[k]]; }));
}

/** Keeps the previous version of the whole database as JSON text in a hidden "Backup" tab. */
function backup_() {
  try {
    var json = JSON.stringify(readAll_(true));
    var sh = ss_().getSheetByName('Backup') || ss_().insertSheet('Backup');
    sh.getRange(1, 1, 1, 2).setValues([['saved_at', 'json (split in 40k chunks)']]);
    sh.getRange(2, 1, 1, 1).setValue(new Date());
    var chunks = json.match(/[\s\S]{1,40000}/g) || [''];
    sh.getRange(2, 2, 1, Math.max(chunks.length, 1)).clearContent();
    sh.getRange(2, 2, 1, chunks.length).setValues([chunks]);
    sh.hideSheet();
  } catch (e) { /* backup must never block a save */ }
}

/* ------------------------------------------------------------ one-time helpers (run from the editor) */
/** Run once: creates any missing tab with its headers. Not needed if you imported the seed .xlsx. */
function setup() { Object.keys(SCHEMA).forEach(sheet_); }

/** Run to check what the public site will receive. View → Logs. */
function testRead() { Logger.log(JSON.stringify(readAll_(false)).slice(0, 800)); }
