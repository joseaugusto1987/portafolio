#!/usr/bin/env python3
"""Builds portafolio-cms from the original portafolio.html.

  python3 build.py [path/to/portafolio.html]

Outputs
  index.html                          site + hidden admin (single file, deploy anywhere)
  database/hipernova-portafolio-db.xlsx   seed for the Google Sheet (import it into Drive)
  database/seed.json                  the same content as JSON (reference)

Needs `openpyxl` only for the .xlsx (pip install openpyxl).
"""
import json, re, sys, pathlib

HERE = pathlib.Path(__file__).parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "source" / "portafolio.html"
lines = SRC.read_text(encoding="utf8").split("\n")

# ---- 1. pull the embedded DATA out of the original -------------------------
i = next(n for n, l in enumerate(lines) if l.startswith("const DATA = "))
raw = lines[i][len("const DATA = "):].rstrip().rstrip(";")
data = json.loads(raw)
for p in data["projects"]:
    p["status"] = "published"
    p.setdefault("cover", "")
    p["link"] = p.get("link") or ""
(HERE / "database").mkdir(exist_ok=True)
(HERE / "database" / "seed.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf8")

# ---- 2. rewire the site script: data comes from Sheets (or cache / seed) ----
lines[i] = "const SEED = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
j = next(n for n, l in enumerate(lines) if l.startswith("const P = DATA.projects"))
lines[j] = """let DATA, P, C, PG;
function setData(d){
  const dv = u => (u || "").replace(/https:\/\/drive\.google\.com\/thumbnail\?id=([\w-]+)[^"'\s]*/g, "https://lh3.googleusercontent.com/d/$1=w1600");
  d.projects.forEach(p => { p.cover = dv(p.cover); p.html = dv(p.html || "").replace(/<img (?![^>]*referrerpolicy)/g, '<img referrerpolicy="no-referrer" '); });
  DATA = d; const adm = !!window.ADMIN_ON;
  P = d.projects.filter(p => adm || p.status !== "draft"); C = d.config; PG = d.pages;
}
function initialData(){
  try { const s = localStorage.getItem(HN_CONFIG.API_URL ? "hn_cache" : "hn_demo_data"); if (s) { const d = JSON.parse(s); d.projects.forEach(p => p.status = p.status || "published"); return d; } } catch(e){}
  return SEED;
}
setData(initialData());"""
html = "\n".join(lines)

# cover photo (duotone) in cards and case band; texture stays as fallback
CARD_OLD = '<canvas class="ht" data-m="${MOTIF[p.texture] || "dots"}" data-seed="${P.indexOf(p) + 3}"></canvas>'
CARD_NEW = '${p.cover ? `<img class="duo" referrerpolicy="no-referrer" src="${esc(p.cover)}" alt="" loading="lazy" data-k="card" data-t="${esc(p.texture)}" data-s="${P.indexOf(p) + 3}">` : `' + CARD_OLD + '`}'
BAND_OLD = '<canvas data-hn-texture="${p.texture}" data-tone="ink" data-seed="${i + 7}"></canvas>'
BAND_NEW = '${p.cover ? `<img class="duo" referrerpolicy="no-referrer" src="${esc(p.cover)}" alt="" data-k="band" data-t="${esc(p.texture)}" data-s="${i + 7}">` : `' + BAND_OLD + '`}'
assert CARD_OLD in html and BAND_OLD in html
html = html.replace(CARD_OLD, CARD_NEW).replace(BAND_OLD, BAND_NEW)
DUO = """<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="hn-duo" color-interpolation-filters="sRGB">
<feColorMatrix type="matrix" values="0.33 0.5 0.17 0 0  0.33 0.5 0.17 0 0  0.33 0.5 0.17 0 0  0 0 0 1 0"/>
<feComponentTransfer><feFuncR type="table" tableValues="0.133 0.992"/><feFuncG type="table" tableValues="0.133 0.933"/><feFuncB type="table" tableValues="0.133 0.239"/></feComponentTransfer></filter></defs></svg>
<style>.duo{filter:url(#hn-duo);width:100%;height:100%;object-fit:cover;display:block}.band .duo{position:absolute;inset:0}.card .viz .duo{position:absolute;inset:0}.duo-ht{filter:none!important}</style>
"""
html = html.replace("<body class=\"s-space\">", "<body class=\"s-space\">\n" + DUO, 1)

config = """<script>
/* ===== HIPERNOVA CMS — connection ==========================================
   API_URL : the "Web app" URL of your Google Apps Script (see README).
             Leave empty = DEMO mode (edits are saved in this browser only).
   COVER_STYLE : "mix" (duotone + halftone dots) | "halftone" | "smooth" (duotone only)
   Admin   : click the logo 5 times. The real password lives in Apps Script
             (Script properties → ADMIN_PASSWORD); DEMO_PASSWORD only applies in demo mode. */
window.HN_CONFIG = { API_URL: "https://script.google.com/macros/s/AKfycbyycJ9eKejbK9EVGD9u4uhAKZiGzBTWVBMu-IAgh_NnSGicahm5metHqxcpCDT6DUKcOw/exec", DEMO_PASSWORD: "hipernova", CLICKS: 5, COVER_STYLE: "mix" };
</script>
"""
css = (HERE / "src" / "admin.css").read_text(encoding="utf8")
js = (HERE / "src" / "admin.js").read_text(encoding="utf8") + "\n" + (HERE / "src" / "duo.js").read_text(encoding="utf8")
html = html.replace("</head>", config + "<style>\n" + css + "</style>\n</head>", 1)
html = html.replace("</body>", "<script>\n" + js + "\n</script>\n</body>", 1)
(HERE / "index.html").write_text(html, encoding="utf8")
print("index.html", len(html) // 1024, "KB;", len(data["projects"]), "projects")

# ---- 3. the Google Sheet seed ------------------------------------------------
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
except ImportError:
    print("openpyxl not installed → skipped .xlsx"); sys.exit(0)

wb = Workbook()
HEAD = PatternFill("solid", fgColor="FDEE3D")
def sheet(name, headers, rows, widths, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = name; ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color="222222"); c.fill = HEAD
    for r in rows: ws.append(r)
    for k, w in enumerate(widths): ws.column_dimensions[chr(65 + k)].width = w
    ws.freeze_panes = "A2"
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(vertical="top", wrap_text=False)
    return ws

J = lambda a: " | ".join(a)
sheet("Projects",
      ["order", "status", "slug", "title", "sub", "year", "client", "industry", "type", "role", "country", "highlight", "link", "texture", "cover", "excerpt", "body_html"],
      [[n + 1, p["status"], p["slug"], p["title"], p["sub"], p["year"], J(p["client"]), J(p["industry"]), J(p["type"]), J(p["role"]), J(p["country"]),
        bool(p["highlight"]), p["link"], p["texture"], p.get("cover", ""), p["excerpt"], p["html"]] for n, p in enumerate(data["projects"])],
      [7, 11, 34, 44, 44, 7, 24, 22, 22, 26, 16, 10, 24, 11, 40, 50, 60], first=True)
A, B, T, H = data["pages"]["approach"], data["pages"]["about"], data["pages"]["thinking"], data["pages"]["home"]
sheet("Principles", ["order", "title", "text", "symbol"], [[n + 1, *x] for n, x in enumerate(A["principles"])], [7, 32, 90, 16])
sheet("Experience", ["order", "title", "html"], [[n + 1, *x] for n, x in enumerate(B["experience"])], [7, 24, 120])
L = lambda a: "\n".join(a)
sheet("Pages", ["key", "value"], [
    ["home.lead", H["lead"]], ["home.bio", H["bio"]], ["approach.lead", A["lead"]],
    ["about.intro", B["intro"]], ["about.quote", B["quote"]], ["about.education", L(B["education"])],
    ["about.certifications", L(B["certifications"])], ["about.disciplines", L(B["disciplines"])], ["about.teaching", B["teaching"]],
    ["thinking.lead", T["lead"]], ["thinking.substack", T["substack"]], ["thinking.medium", T["medium"]], ["thinking.publications", L(T["publications"])],
], [26, 140])
c = data["config"]
sheet("Config", ["key", "value"], [
    ["name", c["name"]], ["role", c["role"]], ["disciplines", J(c["disciplines"])], ["substack", c["substack"]],
    ["linkedin", c["linkedin"]], ["email", c["email"]], ["date", c["date"]],
], [18, 80])
out = HERE / "database" / "hipernova-portafolio-db.xlsx"
wb.save(out); print(out.name)
