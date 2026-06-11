#!/usr/bin/env python3
"""
generate_duplication_page.py — SGA Backend Edition
Genera una página HTML profesional para reportes de código duplicado (jscpd).
Paleta: blanco / índigo / slate (consistente con el resto del proyecto)

Métricas mostradas (igual que SonarQube):
  - % duplicación global
  - Rating A-E
  - Bloques duplicados
  - Líneas duplicadas
  - Top archivos afectados
  - Vista detallada de cada bloque duplicado

Uso:
  python3 generate_duplication_page.py <jscpd-report.json> <output_dir>
    [--repo REPO] [--branch BRANCH] [--run-id RUN_ID]
    [--min-lines N] [--threshold N]
"""

import sys
import json
import datetime
import argparse
from pathlib import Path
from collections import defaultdict


# ─────────────────────────────────────────────────────────────
# RATING — igual que SonarQube
# ─────────────────────────────────────────────────────────────
# A: 0-3%  B: 3-5%  C: 5-10%  D: 10-20%  E: >20%

def get_rating(pct: float) -> tuple[str, str, str, str]:
    """Retorna (letra, label, color, bg)"""
    if pct <= 3:
        return ("A", "Excelente",  "#059669", "#ECFDF5")
    elif pct <= 5:
        return ("B", "Bueno",      "#16A34A", "#F0FDF4")
    elif pct <= 10:
        return ("C", "Aceptable",  "#D97706", "#FFFBEB")
    elif pct <= 20:
        return ("D", "Alto",       "#EA580C", "#FFF7ED")
    else:
        return ("E", "Crítico",    "#DC2626", "#FEF2F2")


SGA_MODULES = {
    "assignments": "Asignaciones",
    "auth":        "Autenticación",
    "curriculum":  "Malla Curricular",
    "formulas":    "Fórmulas",
    "permissions": "Permisos",
    "syllabus":    "Sílabos",
    "teacher":     "Docentes",
    "lib":         "Librería",
    "utils":       "Utilidades",
    "db":          "Base de Datos",
}

MODULE_COLORS = {
    "Autenticación":    "#2563EB",
    "Asignaciones":     "#D97706",
    "Malla Curricular": "#059669",
    "Sílabos":          "#7C3AED",
    "Docentes":         "#0284C7",
    "Fórmulas":         "#DB2777",
    "Permisos":         "#EA580C",
    "Base de Datos":    "#DC2626",
    "Librería":         "#94A3B8",
    "Utilidades":       "#94A3B8",
    "Otros":            "#CBD5E1",
}


def detect_module(path: str) -> str:
    parts = path.replace("\\", "/").lower().split("/")
    for part in parts:
        if part in SGA_MODULES:
            return SGA_MODULES[part]
    return "Otros"


def shorten_path(full_path: str) -> str:
    p = full_path.replace("\\", "/")
    if "/src/" in p:
        return "src/" + p.split("/src/")[-1]
    parts = p.split("/")
    return "/".join(parts[-3:]) if len(parts) > 3 else p


# ─────────────────────────────────────────────────────────────
# PARSER
# ─────────────────────────────────────────────────────────────

def parse_report(json_path: Path) -> dict:
    if not json_path.exists():
        return _empty_report()
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return _empty_report()

    stats      = data.get("statistics", {})
    duplicates = data.get("duplicates", [])
    total      = stats.get("total", {})

    lines_total = total.get("lines", 0)
    lines_dup   = total.get("duplicatedLines", 0)
    pct         = round(lines_dup / lines_total * 100, 2) if lines_total > 0 else 0.0

    # Por lenguaje
    by_lang = {}
    for lang, lang_stats in stats.get("byLanguage", {}).items():
        lt = lang_stats.get("total", {})
        ll = lt.get("lines", 0)
        ld = lt.get("duplicatedLines", 0)
        by_lang[lang] = {
            "lines":     ll,
            "dup_lines": ld,
            "pct":       round(ld / ll * 100, 2) if ll > 0 else 0.0,
            "clones":    lt.get("clones", 0),
        }

    # Bloques duplicados normalizados
    blocks = []
    file_counts: dict[str, int]  = defaultdict(int)
    module_lines: dict[str, int] = defaultdict(int)

    for dup in duplicates:
        f1 = dup.get("firstFile",  {})
        f2 = dup.get("secondFile", {})
        path1 = shorten_path(f1.get("name", ""))
        path2 = shorten_path(f2.get("name", ""))
        mod1  = detect_module(f1.get("name", ""))
        mod2  = detect_module(f2.get("name", ""))

        lines_count = dup.get("lines", dup.get("fragment", "").count("\n") + 1)
        tokens      = dup.get("tokens", 0)
        fragment    = dup.get("fragment", "")[:500]

        block = {
            "file1":       path1,
            "file2":       path2,
            "line1_start": f1.get("start", ""),
            "line1_end":   f1.get("end",   ""),
            "line2_start": f2.get("start", ""),
            "line2_end":   f2.get("end",   ""),
            "lines":       lines_count,
            "tokens":      tokens,
            "fragment":    fragment,
            "module1":     mod1,
            "module2":     mod2,
        }
        blocks.append(block)
        file_counts[path1] += 1
        file_counts[path2] += 1
        module_lines[mod1] += lines_count
        module_lines[mod2] += lines_count

    # Top archivos
    top_files = sorted(file_counts.items(), key=lambda x: -x[1])[:15]

    # Top módulos
    top_modules = dict(sorted(module_lines.items(), key=lambda x: -x[1]))

    return {
        "lines_total": lines_total,
        "lines_dup":   lines_dup,
        "pct":         pct,
        "clones":      len(duplicates),
        "by_lang":     by_lang,
        "blocks":      blocks,
        "top_files":   top_files,
        "top_modules": top_modules,
        "rating":      get_rating(pct),
    }


def _empty_report() -> dict:
    return {
        "lines_total": 0, "lines_dup": 0, "pct": 0.0,
        "clones": 0, "by_lang": {}, "blocks": [],
        "top_files": [], "top_modules": {},
        "rating": get_rating(0.0),
    }


# ─────────────────────────────────────────────────────────────
# HTML COMPONENTS
# ─────────────────────────────────────────────────────────────

def block_card(idx: int, b: dict) -> str:
    frag_html = ""
    if b["fragment"].strip():
        escaped = (b["fragment"]
                   .replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;"))
        frag_html = f'<pre class="code-fragment">{escaped}</pre>'

    mod1_el = (
        f'<span class="module-badge" style="background:var(--purple-bg);color:var(--purple);'
        f'border:1px solid var(--purple-border);">{b["module1"]}</span>'
        if b["module1"] and b["module1"] != "Otros" else ""
    )
    mod2_el = (
        f'<span class="module-badge" style="background:var(--blue-bg);color:var(--blue);'
        f'border:1px solid var(--blue-border);">{b["module2"]}</span>'
        if b["module2"] and b["module2"] != "Otros" and b["module2"] != b["module1"] else ""
    )

    same_file = b["file1"] == b["file2"]
    same_badge = (
        '<span class="same-file-badge">Mismo archivo</span>'
        if same_file else ""
    )

    return f"""
<div class="block-card" data-module1="{b['module1']}" data-module2="{b['module2']}">
  <div class="block-header">
    <div class="block-meta">
      <span class="lines-badge">{b['lines']} líneas</span>
      {'<span class="tokens-badge">' + str(b['tokens']) + ' tokens</span>' if b['tokens'] else ''}
      {mod1_el}
      {mod2_el}
      {same_badge}
    </div>
    <span class="block-idx">#{idx}</span>
  </div>

  <div class="files-grid">
    <div class="file-entry">
      <div class="file-label">Archivo A</div>
      <div class="file-path">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        {b['file1']}
        {'<span class="line-range">L{} – L{}</span>'.format(b['line1_start'], b['line1_end'])
          if b['line1_start'] else ''}
      </div>
    </div>
    <div class="file-entry">
      <div class="file-label">Archivo B</div>
      <div class="file-path">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        {b['file2']}
        {'<span class="line-range">L{} – L{}</span>'.format(b['line2_start'], b['line2_end'])
          if b['line2_start'] else ''}
      </div>
    </div>
  </div>

  {frag_html}
</div>"""


def top_files_table(top_files: list) -> str:
    if not top_files:
        return ""
    rows = ""
    max_count = top_files[0][1] if top_files else 1
    for path, count in top_files:
        mod   = detect_module(path)
        color = MODULE_COLORS.get(mod, "#CBD5E1")
        pct   = round(count / max_count * 100)
        rows += f"""<tr>
          <td style="font-family:var(--mono);font-size:12px;">{path}</td>
          <td><span class="module-badge" style="background:{color}20;color:{color};
              border:1px solid {color}40;">{mod}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                <div style="width:{pct}%;height:100%;background:var(--accent);border-radius:3px;"></div>
              </div>
              <span style="font-family:var(--mono);font-weight:700;color:var(--accent);
                           font-size:12px;min-width:20px;">{count}</span>
            </div>
          </td>
        </tr>"""
    return f"""
    <div class="section-card">
      <h3 class="section-title">📁 Archivos con más clones</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Archivo</th><th>Módulo</th><th>Clones</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>"""


def modules_chart(top_modules: dict) -> str:
    if not top_modules:
        return ""
    total_lines = sum(top_modules.values()) or 1
    items = ""
    for mod, lines in list(top_modules.items())[:10]:
        color = MODULE_COLORS.get(mod, "#CBD5E1")
        pct   = round(lines / total_lines * 100)
        items += f"""
        <div class="module-bar-item">
          <div class="module-bar-label">
            <span class="method-dot" style="background:{color}"></span>
            <span>{mod}</span>
          </div>
          <div class="module-bar-track">
            <div class="module-bar-fill" style="width:{pct}%;background:{color};"></div>
          </div>
          <span class="module-bar-val">{lines} líneas</span>
        </div>"""
    return f"""
    <div class="section-card">
      <h3 class="section-title">📦 Duplicados por módulo SGA</h3>
      <div class="modules-bars">{items}</div>
    </div>"""


def lang_table(by_lang: dict) -> str:
    if not by_lang:
        return ""
    rows = ""
    for lang, s in sorted(by_lang.items(), key=lambda x: -x[1].get("pct", 0)):
        r_letter, r_label, r_color, r_bg = get_rating(s["pct"])
        rows += f"""<tr>
          <td style="font-weight:600;text-transform:capitalize;">{lang}</td>
          <td style="font-family:var(--mono);">{s['lines']:,}</td>
          <td style="font-family:var(--mono);color:var(--red);">{s['dup_lines']:,}</td>
          <td style="font-family:var(--mono);font-weight:700;color:{r_color};">{s['pct']}%</td>
          <td><span class="rating-badge"
               style="background:{r_bg};color:{r_color};border:1px solid {r_color}40;">
               {r_letter} — {r_label}</span></td>
        </tr>"""
    return f"""
    <div class="section-card">
      <h3 class="section-title">🔤 Por lenguaje</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Lenguaje</th><th>Total líneas</th>
            <th>Duplicadas</th><th>%</th><th>Rating</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>"""


# ─────────────────────────────────────────────────────────────
# HTML GENERATOR
# ─────────────────────────────────────────────────────────────

def generate_html(
    data:       dict,
    repo:       str,
    branch:     str,
    run_id:     str,
    min_lines:  str,
    threshold:  str,
    build_date: str,
) -> str:
    pct    = data["pct"]
    clones = data["clones"]
    r_letter, r_label, r_color, r_bg = data["rating"]
    passed = pct == 0.0

    blocks_html = "".join(block_card(i+1, b) for i, b in enumerate(data["blocks"]))

    empty_blocks = """
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" style="color:var(--green);margin-bottom:12px;">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      <h3>Sin código duplicado detectado</h3>
      <p>No se encontraron bloques duplicados con los umbrales configurados.</p>
    </div>"""

    run_link = (
        f'<div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">'
        f'Run #{run_id}</div>'
    ) if run_id else ""

    # Sidebar módulos
    module_sidebar = ""
    if data["top_modules"]:
        module_sidebar = '<div class="sidebar-divider"></div><div class="sidebar-label">Módulos afectados</div>'
        for mod, lines in data["top_modules"].items():
            color = MODULE_COLORS.get(mod, "#CBD5E1")
            safe  = mod.replace("'", "\\'")
            module_sidebar += (
                f'<div class="sidebar-item" onclick="filterModule(\'{safe}\')">'
                f'<span class="method-dot" style="background:{color}"></span>{mod}'
                f'<span class="sev-counter" style="background:var(--surface2);color:var(--text2);'
                f'border:1px solid var(--border);margin-left:auto;font-size:10px;">{lines}L</span>'
                f'</div>'
            )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Code Duplication Report — SGA Backend</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after {{ box-sizing:border-box; margin:0; padding:0; }}
    :root {{
      --bg:#F0F4F9; --bg2:#FFFFFF; --bg3:#F8FAFC; --surface2:#F1F5F9;
      --border:#E2E8F0; --border2:#CBD5E1;
      --accent:#2563EB; --accent-h:#1D4ED8; --accent-light:#EFF6FF; --accent-mid:#BFDBFE;
      --green:#059669; --green-bg:#ECFDF5; --green-border:#A7F3D0;
      --blue:#0284C7; --blue-bg:#F0F9FF; --blue-border:#BAE6FD;
      --amber:#D97706; --amber-bg:#FFFBEB; --amber-border:#FDE68A;
      --red:#DC2626; --red-bg:#FEF2F2; --red-border:#FECACA;
      --purple:#7C3AED; --purple-bg:#F5F3FF; --purple-border:#DDD6FE;
      --slate:#0F172A; --slate2:#1E293B; --text:#0F172A; --text2:#475569;
      --text3:#94A3B8; --text4:#CBD5E1;
      --font:'Inter',system-ui,sans-serif; --mono:'JetBrains Mono',monospace;
      --radius:10px; --radius-sm:7px; --radius-lg:14px;
      --shadow-sm:0 1px 3px rgba(15,23,42,.08); --shadow:0 4px 16px rgba(15,23,42,.10);
      --sidebar-w:268px; --header-h:60px;
    }}
    html {{ scroll-behavior:smooth; }}
    body {{ font-family:var(--font); background:var(--bg); color:var(--text);
            min-height:100vh; -webkit-font-smoothing:antialiased; }}
    ::-webkit-scrollbar {{ width:5px; }} ::-webkit-scrollbar-track {{ background:var(--bg3); }}
    ::-webkit-scrollbar-thumb {{ background:var(--border2); border-radius:3px; }}

    /* HEADER */
    .header {{
      position:fixed; top:0; left:0; right:0; height:var(--header-h);
      background:rgba(255,255,255,0.92); backdrop-filter:blur(12px);
      border-bottom:1px solid var(--border);
      display:flex; align-items:center; justify-content:space-between;
      padding:0 24px; z-index:1000; box-shadow:var(--shadow-sm);
    }}
    .header-left {{ display:flex; align-items:center; gap:12px; }}
    .logo-mark {{
      width:34px; height:34px; background:var(--amber); border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:800; color:#fff;
      box-shadow:0 2px 8px rgba(217,119,6,.35); flex-shrink:0;
    }}
    .header-title {{ font-size:14px; font-weight:700; color:var(--slate);
                     white-space:nowrap; max-width:380px; overflow:hidden; text-overflow:ellipsis; }}
    .header-divider {{ width:1px; height:18px; background:var(--border); }}
    .header-subtitle {{ font-size:12px; color:var(--text3); }}
    .header-right {{ display:flex; align-items:center; gap:8px; }}
    .badge {{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px;
              border-radius:20px; font-size:11px; font-weight:600; font-family:var(--mono); }}
    .badge-branch {{ background:var(--purple-bg); color:var(--purple); border:1px solid var(--purple-border); }}
    .badge-ok   {{ background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }}
    .badge-ok::before {{ content:''; width:6px; height:6px; background:var(--green);
                         border-radius:50%; animation:pulse 2s infinite; }}
    .badge-warn {{ background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }}
    .badge-fail {{ background:var(--red-bg); color:var(--red); border:1px solid var(--red-border); }}
    @keyframes pulse {{ 0%,100%{{opacity:1;transform:scale(1)}} 50%{{opacity:.5;transform:scale(.7)}} }}

    /* LAYOUT */
    .layout {{ display:flex; padding-top:var(--header-h); min-height:100vh; }}

    /* SIDEBAR */
    .sidebar {{
      width:var(--sidebar-w); flex-shrink:0; background:var(--bg2);
      border-right:1px solid var(--border);
      position:fixed; top:var(--header-h); bottom:0; left:0;
      overflow-y:auto; padding:16px 0;
    }}
    .sidebar-label {{ padding:0 16px 6px; font-size:10px; font-weight:700;
                      letter-spacing:.08em; text-transform:uppercase; color:var(--text3); }}
    .sidebar-item {{ display:flex; align-items:center; gap:9px; padding:7px 16px; cursor:pointer;
                     font-size:13px; font-weight:500; color:var(--text2);
                     border-left:2px solid transparent; transition:all .14s; margin:1px 0;
                     white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
    .sidebar-item:hover {{ color:var(--accent); background:var(--accent-light); border-left-color:var(--accent-mid); }}
    .sidebar-item.active {{ color:var(--accent); background:var(--accent-light); border-left-color:var(--accent); font-weight:600; }}
    .method-dot {{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }}
    .sidebar-divider {{ height:1px; background:var(--border); margin:8px 16px; }}
    .sev-counter {{ margin-left:auto; font-size:11px; font-weight:700; font-family:var(--mono);
                    padding:1px 7px; border-radius:10px; flex-shrink:0; }}

    .search-wrap {{ padding:12px 12px 8px; }}
    .search-box {{ position:relative; }}
    .search-icon {{ position:absolute; left:10px; top:50%; transform:translateY(-50%);
                    color:var(--text3); pointer-events:none; }}
    .search-input {{
      width:100%; background:var(--bg3); border:1px solid var(--border);
      border-radius:var(--radius-sm); padding:8px 12px 8px 32px;
      font-size:12px; color:var(--text); font-family:var(--font);
      outline:none; transition:border-color .15s;
    }}
    .search-input:focus {{ border-color:var(--accent); box-shadow:0 0 0 3px rgba(37,99,235,.12); }}
    .search-input::placeholder {{ color:var(--text3); }}

    /* MAIN */
    .main {{ flex:1; margin-left:var(--sidebar-w); }}

    /* HERO */
    .hero {{
      background:var(--bg2); border-bottom:1px solid var(--border);
      padding:40px 48px 36px; position:relative; overflow:hidden;
    }}
    .hero::after {{
      content:''; position:absolute; top:0; right:0; bottom:0; width:340px;
      background:linear-gradient(135deg, var(--amber-bg) 0%, transparent 70%);
      pointer-events:none;
    }}
    .hero-eyebrow {{
      display:inline-flex; align-items:center; gap:6px; padding:4px 10px;
      border-radius:20px; background:var(--surface2); border:1px solid var(--border2);
      font-size:10px; font-weight:700; color:var(--text2);
      letter-spacing:.07em; text-transform:uppercase; margin-bottom:14px;
    }}
    .hero h1 {{ font-size:28px; font-weight:800; color:var(--slate);
               line-height:1.15; margin-bottom:10px; letter-spacing:-.5px; }}
    .hero h1 em {{ font-style:normal; color:var(--amber); }}
    .hero-sub {{ font-size:14px; color:var(--text2); line-height:1.65; max-width:560px; margin-bottom:24px; }}
    .hero-pills {{ display:flex; flex-wrap:wrap; gap:8px; }}
    .hero-pill {{ display:inline-flex; align-items:center; gap:5px; padding:4px 12px;
                  border-radius:6px; font-size:11px; font-weight:500; color:var(--text2);
                  background:var(--bg3); border:1px solid var(--border); }}

    /* STATUS BANNER */
    .status-banner {{
      display:flex; align-items:center; gap:14px; margin:0 48px;
      padding:14px 20px; border-radius:var(--radius); border:1px solid var(--border);
      background:var(--bg2); transform:translateY(20px); box-shadow:var(--shadow-sm);
    }}
    .status-icon {{ width:36px; height:36px; border-radius:50%; display:flex; align-items:center;
                    justify-content:center; font-size:15px; font-weight:800; flex-shrink:0; }}
    .si-ok   {{ background:var(--green-bg); color:var(--green); border:2px solid var(--green-border); }}
    .si-warn {{ background:var(--amber-bg); color:var(--amber); border:2px solid var(--amber-border); }}
    .si-fail {{ background:var(--red-bg);   color:var(--red);   border:2px solid var(--red-border);   }}
    .status-text h2 {{ font-size:14px; font-weight:700; color:var(--slate); margin-bottom:1px; }}
    .status-text p  {{ font-size:12px; color:var(--text3); }}
    .status-meta {{ margin-left:auto; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }}

    /* STATS */
    .stats {{ display:grid; grid-template-columns:repeat(5,1fr);
              border-bottom:1px solid var(--border); background:var(--bg2); margin-top:28px; }}
    .stat-item {{ padding:18px 20px; display:flex; flex-direction:column; gap:3px;
                  border-right:1px solid var(--border); }}
    .stat-item:last-child {{ border-right:none; }}
    .stat-value {{ font-size:22px; font-weight:800; font-family:var(--mono);
                   line-height:1; letter-spacing:-1px; }}
    .c-green  {{ color:var(--green);  }}
    .c-amber  {{ color:var(--amber);  }}
    .c-red    {{ color:var(--red);    }}
    .c-accent {{ color:var(--accent); }}
    .c-slate  {{ color:var(--slate);  }}
    .stat-label {{ font-size:10px; color:var(--text3); font-weight:600;
                   text-transform:uppercase; letter-spacing:.06em; }}

    /* RATING CARD — igual que SonarQube */
    .rating-section {{
      background:var(--bg2); border-bottom:1px solid var(--border);
      padding:24px 48px; display:flex; gap:32px; align-items:center; flex-wrap:wrap;
    }}
    .rating-card {{
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:20px 28px; border-radius:var(--radius-lg);
      border:2px solid; min-width:120px;
    }}
    .rating-letter {{ font-size:48px; font-weight:800; font-family:var(--mono); line-height:1; }}
    .rating-label  {{ font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }}
    .rating-desc   {{ font-size:11px; color:var(--text3); margin-top:2px; }}
    .rating-metrics {{ display:flex; flex-direction:column; gap:12px; }}
    .rating-metric  {{ display:flex; flex-direction:column; gap:2px; }}
    .rating-metric-val {{ font-size:24px; font-weight:800; font-family:var(--mono);
                          color:var(--slate); line-height:1; }}
    .rating-metric-lbl {{ font-size:10px; color:var(--text3); font-weight:600;
                          text-transform:uppercase; letter-spacing:.06em; }}
    .threshold-info {{ font-size:12px; color:var(--text3); padding:12px 16px;
                       background:var(--bg3); border:1px solid var(--border);
                       border-radius:var(--radius-sm); }}

    /* CONTENT */
    .content {{ padding:32px 48px 64px; display:flex; flex-direction:column; gap:24px; }}

    /* SECTION CARD */
    .section-card {{
      background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius);
      padding:24px; box-shadow:var(--shadow-sm);
    }}
    .section-title {{ font-size:14px; font-weight:800; color:var(--slate);
                      margin-bottom:16px; text-transform:uppercase; letter-spacing:.5px; }}

    /* BLOCK CARDS */
    .blocks-list {{ display:flex; flex-direction:column; gap:12px; }}
    .block-card {{
      background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius);
      padding:18px 20px; box-shadow:var(--shadow-sm);
      border-left:4px solid var(--amber); transition:box-shadow .15s;
    }}
    .block-card:hover {{ box-shadow:var(--shadow); }}
    .block-header {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }}
    .block-meta   {{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }}
    .block-idx    {{ font-size:11px; color:var(--text4); font-family:var(--mono); }}

    .lines-badge {{
      font-size:11px; font-weight:700; padding:2px 9px; border-radius:12px;
      background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border);
      font-family:var(--mono);
    }}
    .tokens-badge {{
      font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
      background:var(--blue-bg); color:var(--blue); border:1px solid var(--blue-border);
      font-family:var(--mono);
    }}
    .module-badge {{
      font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
      font-family:var(--mono);
    }}
    .same-file-badge {{
      font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
      background:var(--red-bg); color:var(--red); border:1px solid var(--red-border);
      font-family:var(--mono);
    }}
    .rating-badge {{
      font-size:11px; font-weight:700; padding:2px 9px; border-radius:12px;
      font-family:var(--mono);
    }}

    .files-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px; }}
    .file-entry {{ background:var(--bg3); border:1px solid var(--border);
                   border-radius:var(--radius-sm); padding:10px 12px; }}
    .file-label {{ font-size:10px; font-weight:700; color:var(--text3);
                   text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }}
    .file-path  {{ display:flex; align-items:center; gap:5px; font-size:11px;
                   font-family:var(--mono); color:var(--accent); flex-wrap:wrap; }}
    .line-range {{ font-size:10px; color:var(--text3); background:var(--bg2);
                   border:1px solid var(--border); padding:1px 6px; border-radius:4px;
                   margin-left:4px; }}

    .code-fragment {{
      background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm);
      font-family:var(--mono); font-size:11px; color:var(--slate2);
      padding:12px 14px; overflow-x:auto; margin-top:10px;
      white-space:pre; max-height:160px; overflow-y:auto;
    }}

    /* TABLES */
    .table-container {{ overflow-x:auto; }}
    .data-table {{ width:100%; border-collapse:collapse; }}
    .data-table th {{ background:var(--bg3); color:var(--text3); font-size:10px; font-weight:700;
                      padding:8px 14px; border-bottom:1px solid var(--border);
                      text-transform:uppercase; letter-spacing:.04em; text-align:left; }}
    .data-table td {{ padding:10px 14px; border-bottom:1px solid var(--bg3);
                      font-size:13px; color:var(--text); }}
    .data-table tr:last-child td {{ border-bottom:none; }}
    .data-table tr:hover td {{ background:var(--bg3); }}

    /* MODULE BARS */
    .modules-bars {{ display:flex; flex-direction:column; gap:10px; }}
    .module-bar-item {{ display:flex; align-items:center; gap:12px; }}
    .module-bar-label {{ display:flex; align-items:center; gap:6px; font-size:13px;
                         color:var(--text2); min-width:150px; }}
    .module-bar-track {{ flex:1; height:8px; background:var(--border);
                         border-radius:4px; overflow:hidden; }}
    .module-bar-fill  {{ height:100%; border-radius:4px; transition:width .3s; }}
    .module-bar-val   {{ font-size:11px; font-family:var(--mono); color:var(--text3);
                         min-width:70px; text-align:right; }}

    /* TOOLBAR */
    .toolbar {{ display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }}
    .toolbar-label {{ font-size:13px; font-weight:600; color:var(--text2); }}
    .filter-btn {{
      padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600;
      cursor:pointer; border:1px solid var(--border); background:var(--bg2);
      color:var(--text2); transition:all .14s; font-family:var(--font);
    }}
    .filter-btn:hover {{ border-color:var(--border2); background:var(--bg3); }}
    .filter-btn.active {{ border-color:var(--accent); background:var(--accent-light); color:var(--accent); }}

    /* EMPTY STATE */
    .empty-state {{ display:flex; flex-direction:column; align-items:center;
                    padding:64px 24px; text-align:center; }}
    .empty-state h3 {{ font-size:17px; font-weight:700; color:var(--slate); margin-bottom:8px; }}
    .empty-state p  {{ font-size:14px; color:var(--text3); }}

    /* FOOTER */
    .footer {{ background:var(--bg2); border-top:1px solid var(--border);
               padding:18px 48px; display:flex; align-items:center;
               justify-content:space-between; font-size:11px; color:var(--text3); }}
    .footer a {{ color:var(--text3); text-decoration:none; }}
    .footer a:hover {{ color:var(--accent); }}

    @media (max-width:900px) {{
      :root {{ --sidebar-w:0px; }} .sidebar {{ display:none; }}
      .hero, .content, .rating-section, .footer {{ padding-left:20px; padding-right:20px; }}
      .status-banner {{ margin:0 20px; }} .stats {{ grid-template-columns:repeat(3,1fr); }}
      .files-grid {{ grid-template-columns:1fr; }}
    }}
  </style>
</head>
<body>

  <header class="header">
    <div class="header-left">
      <div class="logo-mark">SGA</div>
      <span class="header-title">{repo}</span>
      <div class="header-divider" style="width:1px;height:18px;background:var(--border);"></div>
      <span class="header-subtitle">Code Duplication Report</span>
    </div>
    <div class="header-right">
      <span class="badge" style="background:var(--amber-bg);color:var(--amber);
            border:1px solid var(--amber-border);font-size:10px;">jscpd</span>
      <span class="badge badge-branch">⎇ {branch}</span>
      {'<span class="badge badge-ok">A — Clean</span>' if passed else
       f'<span class="badge badge-{"warn" if pct <= 10 else "fail"}">{r_letter} — {pct}%</span>'}
    </div>
  </header>

  <div class="layout">

    <aside class="sidebar">
      <div class="search-wrap">
        <div class="search-box">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input class="search-input" type="text" id="searchInput" placeholder="Buscar en bloques..."/>
        </div>
      </div>

      <div class="sidebar-label" style="margin-top:8px;">Filtrar</div>
      <div class="sidebar-item active" onclick="filterAll()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        Todos los bloques
        <span class="sev-counter" style="background:var(--surface2);color:var(--text2);
              border:1px solid var(--border);">{clones}</span>
      </div>
      <div class="sidebar-item" onclick="filterSameFile()">
        <span class="method-dot" style="background:var(--red)"></span>
        Mismo archivo
      </div>
      <div class="sidebar-item" onclick="filterDiffFile()">
        <span class="method-dot" style="background:var(--amber)"></span>
        Archivos distintos
      </div>

      {module_sidebar}

      <div class="sidebar-divider"></div>
      <div class="sidebar-label">Configuración</div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        Mín. líneas: {min_lines}
      </div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        Umbral: {threshold}%
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-label">Análisis</div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        {repo}
      </div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {build_date}
      </div>
      {run_link}
    </aside>

    <main class="main">

      <section class="hero">
        <div class="hero-eyebrow">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          jscpd · Code Duplication · SAST
        </div>
        <h1>Duplication <em>Report</em></h1>
        <p class="hero-sub">
          Análisis de código duplicado sobre <strong>SGA-BACKEND</strong> usando jscpd.
          Detecta bloques de código copiado entre archivos TypeScript con métricas
          equivalentes a SonarQube — rating A-E, % duplicación y vista de bloques.
        </p>
        <div class="hero-pills">
          <span class="hero-pill">TypeScript · JavaScript</span>
          <span class="hero-pill">Mín. {min_lines} líneas</span>
          <span class="hero-pill">Umbral {threshold}%</span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {build_date}
          </span>
        </div>
      </section>

      <div class="status-banner">
        <div class="status-icon {'si-ok' if passed else ('si-warn' if pct <= 10 else 'si-fail')}">
          {'✓' if passed else '!'}
        </div>
        <div class="status-text">
          <h2>{'Sin duplicados detectados' if passed else f'Duplicación: {pct}% — {clones} bloque{"s" if clones != 1 else ""}'}</h2>
          <p>{'El código no tiene bloques duplicados con los umbrales configurados.' if passed else
              'Revisa los bloques duplicados y considera refactorizar a funciones o servicios compartidos.'}</p>
        </div>
        <div class="status-meta">
          <span class="badge" style="background:{r_bg};color:{r_color};
                border:1px solid {r_color}40;font-size:13px;font-weight:800;padding:4px 14px;">
            Rating {r_letter}
          </span>
        </div>
      </div>

      <div class="stats">
        <div class="stat-item">
          <span class="stat-value" style="color:{r_color};">{pct}%</span>
          <span class="stat-label">Duplicación</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" style="color:{r_color};font-size:32px;">{r_letter}</span>
          <span class="stat-label">Rating</span>
        </div>
        <div class="stat-item">
          <span class="stat-value c-amber">{clones}</span>
          <span class="stat-label">Bloques</span>
        </div>
        <div class="stat-item">
          <span class="stat-value c-red">{data['lines_dup']:,}</span>
          <span class="stat-label">Líneas dup.</span>
        </div>
        <div class="stat-item">
          <span class="stat-value c-slate">{data['lines_total']:,}</span>
          <span class="stat-label">Total líneas</span>
        </div>
      </div>

      <!-- RATING CARD estilo SonarQube -->
      <div class="rating-section">
        <div class="rating-card"
             style="background:{r_bg};border-color:{r_color}40;color:{r_color};">
          <span class="rating-letter">{r_letter}</span>
          <span class="rating-label">{r_label}</span>
          <span class="rating-desc">Duplicación</span>
        </div>
        <div class="rating-metrics">
          <div class="rating-metric">
            <span class="rating-metric-val" style="color:{r_color};">{pct}%</span>
            <span class="rating-metric-lbl">Porcentaje duplicado</span>
          </div>
          <div class="rating-metric">
            <span class="rating-metric-val">{data['lines_dup']:,}</span>
            <span class="rating-metric-lbl">Líneas duplicadas de {data['lines_total']:,}</span>
          </div>
          <div class="rating-metric">
            <span class="rating-metric-val">{clones}</span>
            <span class="rating-metric-lbl">Bloques duplicados detectados</span>
          </div>
        </div>
        <div class="threshold-info">
          <strong>Escala de rating (como SonarQube):</strong><br>
          A ≤ 3% · B ≤ 5% · C ≤ 10% · D ≤ 20% · E &gt; 20%<br><br>
          <strong>Umbral configurado:</strong> {threshold}%
          {'<br><span style="color:var(--green)">✓ Por debajo del umbral</span>' if pct <= float(threshold or 100) else
           '<br><span style="color:var(--red)">✗ Supera el umbral</span>'}
        </div>
      </div>

      <div class="content">

        {lang_table(data['by_lang'])}
        {modules_chart(data['top_modules'])}
        {top_files_table(data['top_files'])}

        <!-- BLOQUES DUPLICADOS -->
        <div class="section-card">
          <div class="toolbar">
            <h3 class="section-title" style="margin-bottom:0;">🔁 Bloques duplicados</h3>
            <div style="margin-left:auto;display:flex;gap:8px;">
              <button class="filter-btn active" onclick="filterBtnBlocks(this,'all')">Todos ({clones})</button>
              <button class="filter-btn" onclick="filterBtnBlocks(this,'same')">Mismo archivo</button>
              <button class="filter-btn" onclick="filterBtnBlocks(this,'diff')">Distintos</button>
            </div>
          </div>
          <div class="blocks-list" id="blocksList" style="margin-top:16px;">
            {blocks_html if blocks_html else empty_blocks}
          </div>
        </div>

      </div>

      <footer class="footer">
        <span>{repo} · {build_date}</span>
        <span>Powered by <a href="https://github.com/kucherenko/jscpd" target="_blank">jscpd</a></span>
      </footer>
    </main>
  </div>

  <script>
    function filterAll() {{
      document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.querySelectorAll('.block-card').forEach(c => c.style.display = '');
    }}

    function filterSameFile() {{
      document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.querySelectorAll('.block-card').forEach(function(c) {{
        const f1 = c.querySelector('.file-entry:first-child .file-path');
        const f2 = c.querySelector('.file-entry:last-child .file-path');
        const same = f1 && f2 && f1.textContent.trim() === f2.textContent.trim();
        c.style.display = same ? '' : 'none';
      }});
    }}

    function filterDiffFile() {{
      document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.querySelectorAll('.block-card').forEach(function(c) {{
        const f1 = c.querySelector('.file-entry:first-child .file-path');
        const f2 = c.querySelector('.file-entry:last-child .file-path');
        const diff = f1 && f2 && f1.textContent.trim() !== f2.textContent.trim();
        c.style.display = diff ? '' : 'none';
      }});
    }}

    function filterModule(mod) {{
      document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.querySelectorAll('.block-card').forEach(function(c) {{
        const m1 = c.dataset.module1;
        const m2 = c.dataset.module2;
        c.style.display = (m1 === mod || m2 === mod) ? '' : 'none';
      }});
    }}

    function filterBtnBlocks(btn, type) {{
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.block-card').forEach(function(c) {{
        if (type === 'all') {{ c.style.display = ''; return; }}
        const f1 = c.querySelector('.file-entry:first-child .file-path');
        const f2 = c.querySelector('.file-entry:last-child .file-path');
        const same = f1 && f2 && f1.textContent.trim() === f2.textContent.trim();
        c.style.display = (type === 'same' ? same : !same) ? '' : 'none';
      }});
    }}

    document.getElementById('searchInput').addEventListener('input', function() {{
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.block-card').forEach(function(c) {{
        c.style.display = !q || c.textContent.toLowerCase().includes(q) ? '' : 'none';
      }});
    }});
  </script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Genera página HTML de reporte jscpd — SGA Backend"
    )
    parser.add_argument("json_report", help="Archivo jscpd-report.json")
    parser.add_argument("output_dir",  help="Directorio de salida para index.html")
    parser.add_argument("--repo",      default="TALLER-PROYECTOS-2026-I/SGA_BACKEND")
    parser.add_argument("--branch",    default="dev")
    parser.add_argument("--run-id",    default="")
    parser.add_argument("--min-lines", default="5")
    parser.add_argument("--threshold", default="0")
    args = parser.parse_args()

    json_path  = Path(args.json_report)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    data = parse_report(json_path)
    r_letter = data["rating"][0]
    print(f"🔁 Duplicación: {data['pct']}%  Rating: {r_letter}  "
          f"Bloques: {data['clones']}  Líneas dup: {data['lines_dup']}")

    build_date = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")

    html = generate_html(
        data       = data,
        repo       = args.repo,
        branch     = args.branch,
        run_id     = args.run_id,
        min_lines  = args.min_lines,
        threshold  = args.threshold,
        build_date = build_date,
    )

    out = output_dir / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"✅ Reporte guardado: {out}")


if __name__ == "__main__":
    main()
