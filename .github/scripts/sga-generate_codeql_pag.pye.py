#!/usr/bin/env python3
"""
generate_codeql_page.py  —  SGA Backend Edition
Genera una página HTML profesional para reportes de CodeQL.
Paleta: blanco / índigo / slate (consistente con generate_swagger_page.py)

Proyecto: SGA-BACKEND — Azure Functions + TypeScript + Drizzle ORM + JWT

Uso:
  python3 generate_codeql_page.py <sarif_file_or_dir> <output_dir>
    [--repo REPO] [--branch BRANCH] [--run-id RUN_ID]
"""

import sys
import json
import datetime
import argparse
from pathlib import Path


# ─────────────────────────────────────────────────────────────
# SARIF PARSER
# ─────────────────────────────────────────────────────────────

SEVERITY_MAP = {
    "error":   ("critical", "Crítico"),
    "warning": ("high",     "Alto"),
    "note":    ("medium",   "Medio"),
    "none":    ("low",      "Bajo"),
}

LEVEL_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}

# Módulos del SGA Backend para categorizar hallazgos
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
    "drizzle":     "Drizzle ORM",
}


def detect_sga_module(file_path: str) -> str:
    """Detecta el módulo SGA al que pertenece un archivo."""
    parts = file_path.replace("\\", "/").lower().split("/")
    for part in parts:
        if part in SGA_MODULES:
            return SGA_MODULES[part]
    return "Otros"


def parse_sarif(sarif_path: Path) -> list[dict]:
    """Lee un archivo SARIF y retorna lista de hallazgos normalizados."""
    data = json.loads(sarif_path.read_text(encoding="utf-8"))
    findings = []

    for run in data.get("runs", []):
        tool = run.get("tool", {}).get("driver", {})
        tool_name = tool.get("name", "CodeQL")
        rules = {r["id"]: r for r in tool.get("rules", [])}

        for result in run.get("results", []):
            rule_id  = result.get("ruleId", "unknown")
            rule     = rules.get(rule_id, {})

            # Severidad
            raw_level = result.get("level", "warning")
            level_key, level_label = SEVERITY_MAP.get(raw_level, ("medium", "Medio"))

            # Descripción
            message = result.get("message", {})
            desc = message.get("text", "") if isinstance(message, dict) else str(message)

            # Ubicación
            locs       = result.get("locations", [])
            file_path  = ""
            line_start = ""
            snippet    = ""
            if locs:
                pl         = locs[0].get("physicalLocation", {})
                art        = pl.get("artifactLocation", {})
                file_path  = art.get("uri", "")
                region     = pl.get("region", {})
                line_start = region.get("startLine", "")
                snippet    = (
                    region.get("snippet", {}).get("text", "")
                    if isinstance(region.get("snippet"), dict)
                    else ""
                )

            # Metadatos de la regla
            rule_name  = rule.get("name", rule_id)
            rule_short = rule.get("shortDescription", {})
            rule_desc  = rule_short.get("text", "") if isinstance(rule_short, dict) else ""
            rule_help  = rule.get("help", {})
            rule_help_text = rule_help.get("text", "") if isinstance(rule_help, dict) else ""
            tags       = rule.get("properties", {}).get("tags", [])
            cwe        = [t for t in tags if t.startswith("external/cwe")]
            sec_sev    = rule.get("properties", {}).get("security-severity", "")

            findings.append({
                "rule_id":           rule_id,
                "rule_name":         rule_name,
                "rule_desc":         rule_desc or desc,
                "rule_help":         rule_help_text,
                "level":             level_key,
                "level_label":       level_label,
                "message":           desc,
                "file":              file_path,
                "line":              str(line_start),
                "snippet":           snippet,
                "tool":              tool_name,
                "cwe":               cwe,
                "security_severity": str(sec_sev),
                "sga_module":        detect_sga_module(file_path),
            })

    findings.sort(key=lambda x: LEVEL_ORDER.get(x["level"], 99))
    return findings


def scan_sarif_files(path: Path) -> list[Path]:
    """Encuentra todos los archivos .sarif en un archivo o directorio."""
    if not path.exists():
        return []
    if path.is_file() and path.suffix == ".sarif":
        return [path]
    return sorted(path.rglob("*.sarif"))


def count_by_level(findings: list[dict]) -> dict:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        counts[f["level"]] = counts.get(f["level"], 0) + 1
    return counts


def count_by_module(findings: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for f in findings:
        m = f.get("sga_module", "Otros")
        counts[m] = counts.get(m, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1]))


# ─────────────────────────────────────────────────────────────
# HTML GENERATOR
# ─────────────────────────────────────────────────────────────

def severity_badge_html(level: str, label: str) -> str:
    colors = {
        "critical": ("var(--red)",   "var(--red-bg)",   "var(--red-border)"),
        "high":     ("var(--amber)", "var(--amber-bg)", "var(--amber-border)"),
        "medium":   ("var(--blue)",  "var(--blue-bg)",  "var(--blue-border)"),
        "low":      ("var(--green)", "var(--green-bg)", "var(--green-border)"),
        "info":     ("var(--text3)", "var(--bg3)",      "var(--border)"),
    }
    c, bg, bd = colors.get(level, colors["info"])
    return (
        f'<span class="sev-badge sev-{level}" '
        f'style="color:{c};background:{bg};border-color:{bd};">'
        f'{label}</span>'
    )


def finding_card_html(idx: int, f: dict) -> str:
    sev = severity_badge_html(f["level"], f["level_label"])

    cwe_html = ""
    if f["cwe"]:
        pills = "".join(
            f'<span class="tag-pill">{c.replace("external/cwe/", "CWE-")}</span>'
            for c in f["cwe"][:4]
        )
        cwe_html = f'<div class="tags-row">{pills}</div>'

    snippet_html = ""
    if f["snippet"].strip():
        escaped = (
            f["snippet"]
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        snippet_html = f'<pre class="code-snippet">{escaped}</pre>'

    file_loc = ""
    if f["file"]:
        loc_txt = f["file"]
        if f["line"]:
            loc_txt += f":{f['line']}"
        file_loc = (
            f'<div class="finding-loc">'
            f'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
            f'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'
            f'</svg>{loc_txt}</div>'
        )

    help_html = ""
    if f["rule_help"]:
        short = f["rule_help"][:260].replace("<", "&lt;").replace(">", "&gt;")
        help_html = f'<p class="finding-help">{short}{"…" if len(f["rule_help"]) > 260 else ""}</p>'

    sec_sev = ""
    if f["security_severity"] and f["security_severity"] not in ("", "None", "0", "0.0"):
        sec_sev = (
            f'<span class="sec-score" title="CVSS security-severity">'
            f'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
            f'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
            f'&nbsp;{f["security_severity"]}</span>'
        )

    module_badge = (
        f'<span class="module-badge">{f["sga_module"]}</span>'
        if f.get("sga_module") else ""
    )

    return f"""
<div class="finding-card sev-card-{f['level']}"
     data-level="{f['level']}"
     data-rule="{f['rule_id']}"
     data-module="{f.get('sga_module', '')}">
  <div class="finding-header">
    <div class="finding-meta">
      {sev}
      {sec_sev}
      {module_badge}
      <span class="rule-id">{f['rule_id']}</span>
    </div>
    <span class="finding-idx">#{idx}</span>
  </div>
  <h3 class="finding-title">{f['rule_name'] or f['rule_id']}</h3>
  <p class="finding-desc">{f['message'] or f['rule_desc']}</p>
  {file_loc}
  {snippet_html}
  {help_html}
  {cwe_html}
</div>"""


def generate_html(
    findings:   list[dict],
    counts:     dict,
    by_module:  dict,
    repo:       str,
    branch:     str,
    run_id:     str,
    build_date: str,
) -> str:
    total  = len(findings)
    passed = total == 0

    status_icon  = "✓" if passed else "!"
    status_label = "Sin hallazgos" if passed else f"{total} hallazgo{'s' if total != 1 else ''}"

    cards_html = "".join(finding_card_html(i + 1, f) for i, f in enumerate(findings))

    if not cards_html:
        cards_html = """
<div class="empty-state">
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
       style="color:var(--green);margin-bottom:12px;">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
  <h3>Sin hallazgos de seguridad</h3>
  <p>El análisis CodeQL no encontró vulnerabilidades en el código.</p>
</div>"""

    rule_set = sorted({f["rule_id"] for f in findings})

    # Sidebar: reglas detectadas (máx 20)
    rules_sidebar = "".join(
        f'<div class="sidebar-item rule-filter" data-rule="{r}" onclick="filterRule(\'{r}\')">'
        f'<span class="method-dot" style="background:var(--text3)"></span>{r}</div>'
        for r in rule_set[:20]
    )

    # Sidebar: módulos SGA afectados
    modules_sidebar = ""
    if by_module:
        modules_sidebar = '<div class="sidebar-divider"></div><div class="sidebar-label">Módulos afectados</div>'
        module_colors = {
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
        }
        for mod, cnt in by_module.items():
            color = module_colors.get(mod, "#94A3B8")
            safe_mod = mod.replace("'", "\\'")
            modules_sidebar += (
                f'<div class="sidebar-item rule-filter" data-module="{mod}" onclick="filterModule(\'{safe_mod}\')">'
                f'<span class="method-dot" style="background:{color}"></span>'
                f'{mod}'
                f'<span class="sev-counter" style="background:var(--surface2);color:var(--text2);'
                f'border:1px solid var(--border);margin-left:auto;">{cnt}</span>'
                f'</div>'
            )

    run_link = (
        f'<div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">'
        f'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        f'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>'
        f'<line x1="12" y1="16" x2="12.01" y2="16"/></svg>Run #{run_id}</div>'
        if run_id else ""
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CodeQL — SGA Backend Security Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    :root {{
      --bg:          #F0F4F9;
      --bg2:         #FFFFFF;
      --bg3:         #F8FAFC;
      --surface2:    #F1F5F9;
      --border:      #E2E8F0;
      --border2:     #CBD5E1;
      --accent:      #2563EB;
      --accent-h:    #1D4ED8;
      --accent-light:#EFF6FF;
      --accent-mid:  #BFDBFE;
      --green:       #059669;
      --green-bg:    #ECFDF5;
      --green-border:#A7F3D0;
      --blue:        #0284C7;
      --blue-bg:     #F0F9FF;
      --blue-border: #BAE6FD;
      --amber:       #D97706;
      --amber-bg:    #FFFBEB;
      --amber-border:#FDE68A;
      --red:         #DC2626;
      --red-bg:      #FEF2F2;
      --red-border:  #FECACA;
      --purple:      #7C3AED;
      --purple-bg:   #F5F3FF;
      --purple-border:#DDD6FE;
      --slate:       #0F172A;
      --slate2:      #1E293B;
      --text:        #0F172A;
      --text2:       #475569;
      --text3:       #94A3B8;
      --text4:       #CBD5E1;
      --font:        'Inter', system-ui, sans-serif;
      --mono:        'JetBrains Mono', monospace;
      --radius:      10px;
      --radius-sm:   7px;
      --radius-lg:   14px;
      --shadow-sm:   0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06);
      --shadow:      0 4px 16px rgba(15,23,42,0.10);
      --shadow-lg:   0 10px 40px rgba(15,23,42,0.12);
      --sidebar-w:   268px;
      --header-h:    60px;
    }}

    html {{ scroll-behavior: smooth; }}
    body {{
      font-family: var(--font); background: var(--bg);
      color: var(--text); min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }}

    ::-webkit-scrollbar {{ width: 5px; height: 5px; }}
    ::-webkit-scrollbar-track {{ background: var(--bg3); }}
    ::-webkit-scrollbar-thumb {{ background: var(--border2); border-radius: 3px; }}
    ::-webkit-scrollbar-thumb:hover {{ background: var(--accent); }}

    /* ── HEADER ── */
    .header {{
      position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
      background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; z-index: 1000; box-shadow: var(--shadow-sm);
    }}
    .header-left {{ display: flex; align-items: center; gap: 12px; }}
    .logo-mark {{
      width: 34px; height: 34px; background: var(--red);
      border-radius: 9px; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #fff; letter-spacing: -0.5px;
      box-shadow: 0 2px 8px rgba(220,38,38,0.35); flex-shrink: 0;
    }}
    .header-title {{
      font-size: 14px; font-weight: 700; color: var(--slate);
      letter-spacing: -0.2px; white-space: nowrap; max-width: 380px;
      overflow: hidden; text-overflow: ellipsis;
    }}
    .header-divider {{ width: 1px; height: 18px; background: var(--border); }}
    .header-subtitle {{ font-size: 12px; color: var(--text3); }}
    .header-right {{ display: flex; align-items: center; gap: 8px; }}

    .badge {{
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600; font-family: var(--mono);
    }}
    .badge-branch {{ background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-border); }}
    .badge-status-ok {{ background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }}
    .badge-status-ok::before {{
      content:''; width:6px; height:6px; background:var(--green);
      border-radius:50%; animation: pulse 2s infinite;
    }}
    .badge-status-fail {{ background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); }}
    .badge-tech {{
      background: var(--blue-bg); color: var(--blue);
      border: 1px solid var(--blue-border); font-size: 10px;
    }}
    @keyframes pulse {{ 0%,100%{{opacity:1;transform:scale(1)}} 50%{{opacity:.5;transform:scale(.7)}} }}

    /* ── LAYOUT ── */
    .layout {{ display: flex; padding-top: var(--header-h); min-height: 100vh; }}

    /* ── SIDEBAR ── */
    .sidebar {{
      width: var(--sidebar-w); flex-shrink: 0; background: var(--bg2);
      border-right: 1px solid var(--border);
      position: fixed; top: var(--header-h); bottom: 0; left: 0;
      overflow-y: auto; padding: 16px 0;
    }}
    .sidebar-label {{
      padding: 0 16px 6px; font-size: 10px; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; color: var(--text3);
    }}
    .sidebar-item {{
      display: flex; align-items: center; gap: 9px;
      padding: 7px 16px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text2);
      border-left: 2px solid transparent; transition: all .14s; margin: 1px 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }}
    .sidebar-item:hover {{ color: var(--accent); background: var(--accent-light); border-left-color: var(--accent-mid); }}
    .sidebar-item.active {{ color: var(--accent); background: var(--accent-light); border-left-color: var(--accent); font-weight: 600; }}
    .method-dot {{ width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }}
    .sidebar-divider {{ height: 1px; background: var(--border); margin: 8px 16px; }}

    .search-wrap {{ padding: 12px 12px 8px; }}
    .search-box {{ position: relative; }}
    .search-icon {{ position: absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text3); pointer-events:none; }}
    .search-input {{
      width: 100%; background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 12px 8px 32px;
      font-size: 12px; color: var(--text); font-family: var(--font);
      outline: none; transition: border-color .15s, box-shadow .15s;
    }}
    .search-input:focus {{ border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }}
    .search-input::placeholder {{ color: var(--text3); }}

    .sev-counter {{
      margin-left: auto; font-size: 11px; font-weight: 700;
      font-family: var(--mono); padding: 1px 7px; border-radius: 10px; flex-shrink: 0;
    }}
    .sc-critical {{ background:var(--red-bg);   color:var(--red);   border:1px solid var(--red-border);   }}
    .sc-high     {{ background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }}
    .sc-medium   {{ background:var(--blue-bg);  color:var(--blue);  border:1px solid var(--blue-border);  }}
    .sc-low      {{ background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }}

    /* ── MAIN ── */
    .main {{ flex: 1; margin-left: var(--sidebar-w); min-height: calc(100vh - var(--header-h)); }}

    /* ── HERO ── */
    .hero {{
      background: var(--bg2); border-bottom: 1px solid var(--border);
      padding: 40px 48px 36px; position: relative; overflow: hidden;
    }}
    .hero::after {{
      content:''; position:absolute; top:0; right:0; bottom:0; width:340px;
      background: linear-gradient(135deg, #FEF2F2 0%, transparent 70%);
      pointer-events: none;
    }}
    .hero-eyebrow {{
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 20px;
      background: var(--surface2); border: 1px solid var(--border2);
      font-size: 10px; font-weight: 700; color: var(--text2);
      letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px;
    }}
    .hero h1 {{
      font-size: 28px; font-weight: 800; color: var(--slate);
      line-height: 1.15; margin-bottom: 10px; letter-spacing: -.5px;
    }}
    .hero h1 em {{ font-style: normal; color: var(--red); }}
    .hero-sub {{ font-size: 14px; color: var(--text2); line-height: 1.65; max-width: 560px; margin-bottom: 24px; }}
    .hero-pills {{ display: flex; flex-wrap: wrap; gap: 8px; }}
    .hero-pill {{
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 6px; font-size: 11px;
      font-weight: 500; color: var(--text2); background: var(--bg3); border: 1px solid var(--border);
    }}

    /* ── STATUS BANNER ── */
    .status-banner {{
      display: flex; align-items: center; gap: 14px;
      margin: 0 48px; padding: 14px 20px;
      border-radius: var(--radius); border: 1px solid var(--border);
      background: var(--bg2); position: relative; z-index: 1;
      transform: translateY(20px); box-shadow: var(--shadow-sm);
    }}
    .status-icon {{
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; flex-shrink: 0;
    }}
    .si-ok   {{ background:var(--green-bg); color:var(--green); border:2px solid var(--green-border); }}
    .si-fail {{ background:var(--red-bg);   color:var(--red);   border:2px solid var(--red-border);   }}
    .si-warn {{ background:var(--amber-bg); color:var(--amber); border:2px solid var(--amber-border); }}
    .status-text h2 {{ font-size: 14px; font-weight: 700; color: var(--slate); margin-bottom: 1px; }}
    .status-text p  {{ font-size: 12px; color: var(--text3); }}
    .status-meta {{ margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }}

    /* ── STATS ── */
    .stats {{
      display: grid; grid-template-columns: repeat(6, 1fr);
      border-bottom: 1px solid var(--border); background: var(--bg2); margin-top: 28px;
    }}
    .stat-item {{
      padding: 18px 20px; display: flex; flex-direction: column; gap: 3px;
      border-right: 1px solid var(--border);
    }}
    .stat-item:last-child {{ border-right: none; }}
    .stat-value {{
      font-size: 24px; font-weight: 800; color: var(--slate);
      font-family: var(--mono); line-height: 1; letter-spacing: -1px;
    }}
    .stat-value.c-accent {{ color: var(--accent); }}
    .stat-value.c-red    {{ color: var(--red);    }}
    .stat-value.c-amber  {{ color: var(--amber);  }}
    .stat-value.c-blue   {{ color: var(--blue);   }}
    .stat-value.c-green  {{ color: var(--green);  }}
    .stat-label {{ font-size: 10px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }}

    /* ── DONUT ── */
    .chart-section {{
      display: grid; grid-template-columns: 200px 1fr;
      gap: 28px; align-items: center;
      background: var(--bg2); border-bottom: 1px solid var(--border); padding: 24px 48px;
    }}
    .donut-wrap {{ position: relative; width: 160px; height: 160px; }}
    .donut-wrap svg {{ width: 100%; height: 100%; transform: rotate(-90deg); }}
    .donut-center {{
      position: absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      text-align: center; pointer-events: none;
    }}
    .donut-total {{ font-size: 28px; font-weight: 800; color: var(--slate); font-family: var(--mono); line-height:1; }}
    .donut-label {{ font-size: 10px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing:.06em; }}
    .legend {{ display: flex; flex-direction: column; gap: 10px; }}
    .legend-item {{ display: flex; align-items: center; gap: 10px; }}
    .legend-dot {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}
    .legend-name {{ font-size: 13px; color: var(--text2); flex: 1; }}
    .legend-count {{ font-size: 13px; font-weight: 700; font-family: var(--mono); color: var(--slate); }}
    .legend-bar {{ flex: 1; height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }}
    .legend-fill {{ height: 100%; border-radius: 2px; }}

    /* ── CONTENT ── */
    .content {{ padding: 32px 48px 64px; }}
    .toolbar {{ display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }}
    .toolbar-label {{ font-size: 13px; font-weight: 600; color: var(--text2); margin-right: 4px; }}
    .filter-btn {{
      padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: var(--bg2);
      color: var(--text2); transition: all .14s; font-family: var(--font);
    }}
    .filter-btn:hover {{ border-color: var(--border2); background: var(--bg3); }}
    .filter-btn.active {{ border-color: var(--accent); background: var(--accent-light); color: var(--accent); }}
    .filter-btn.fb-critical.active {{ border-color:var(--red);   background:var(--red-bg);   color:var(--red);   }}
    .filter-btn.fb-high.active    {{ border-color:var(--amber); background:var(--amber-bg); color:var(--amber); }}
    .filter-btn.fb-medium.active  {{ border-color:var(--blue);  background:var(--blue-bg);  color:var(--blue);  }}
    .filter-btn.fb-low.active     {{ border-color:var(--green); background:var(--green-bg); color:var(--green); }}

    .findings-list {{ display: flex; flex-direction: column; gap: 10px; }}

    /* ── FINDING CARD ── */
    .finding-card {{
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 18px 20px;
      box-shadow: var(--shadow-sm); border-left: 4px solid var(--border2);
      transition: box-shadow .15s, border-color .15s;
    }}
    .finding-card:hover {{ box-shadow: var(--shadow); }}
    .sev-card-critical {{ border-left-color: var(--red);   }}
    .sev-card-high     {{ border-left-color: var(--amber); }}
    .sev-card-medium   {{ border-left-color: var(--blue);  }}
    .sev-card-low      {{ border-left-color: var(--green); }}
    .finding-header {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }}
    .finding-meta {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
    .finding-idx {{ font-size: 11px; color: var(--text4); font-family: var(--mono); }}
    .sev-badge {{
      display: inline-flex; align-items: center; padding: 2px 9px;
      border-radius: 12px; font-size: 10px; font-weight: 700;
      font-family: var(--mono); letter-spacing: .04em; border: 1px solid;
    }}
    .rule-id {{
      font-size: 11px; font-family: var(--mono); color: var(--text3);
      background: var(--bg3); border: 1px solid var(--border);
      padding: 1px 7px; border-radius: 5px;
    }}
    .module-badge {{
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 5px;
      background: var(--purple-bg); color: var(--purple);
      border: 1px solid var(--purple-border); font-family: var(--mono);
    }}
    .sec-score {{
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; font-family: var(--mono);
      color: var(--amber); background: var(--amber-bg);
      border: 1px solid var(--amber-border); padding: 1px 7px; border-radius: 10px;
    }}
    .finding-title {{ font-size: 15px; font-weight: 700; color: var(--slate); margin-bottom: 6px; line-height: 1.3; }}
    .finding-desc {{ font-size: 13px; color: var(--text2); line-height: 1.6; margin-bottom: 8px; }}
    .finding-help {{ font-size: 12px; color: var(--text3); line-height: 1.55; margin-top: 6px; }}
    .finding-loc {{
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; font-family: var(--mono); color: var(--accent);
      background: var(--accent-light); border: 1px solid var(--accent-mid);
      padding: 2px 8px; border-radius: 5px; margin-bottom: 8px;
    }}
    .code-snippet {{
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); font-family: var(--mono);
      font-size: 11px; color: var(--slate2); padding: 10px 14px;
      overflow-x: auto; margin: 8px 0; white-space: pre-wrap;
      word-break: break-all; max-height: 120px; overflow-y: auto;
    }}
    .tags-row {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }}
    .tag-pill {{
      font-size: 10px; font-weight: 600; font-family: var(--mono);
      padding: 2px 8px; border-radius: 10px;
      background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border);
    }}

    /* ── EMPTY STATE ── */
    .empty-state {{ display:flex; flex-direction:column; align-items:center; padding:64px 24px; text-align:center; }}
    .empty-state h3 {{ font-size:17px; font-weight:700; color:var(--slate); margin-bottom:8px; }}
    .empty-state p  {{ font-size:14px; color:var(--text3); }}

    /* ── FOOTER ── */
    .footer {{
      background: var(--bg2); border-top: 1px solid var(--border);
      padding: 18px 48px; display: flex; align-items: center;
      justify-content: space-between; font-size: 11px; color: var(--text3);
    }}
    .footer a {{ color: var(--text3); text-decoration: none; }}
    .footer a:hover {{ color: var(--accent); }}

    @media (max-width: 900px) {{
      :root {{ --sidebar-w: 0px; }}
      .sidebar {{ display: none; }}
      .hero, .content, .chart-section, .footer {{ padding-left: 20px; padding-right: 20px; }}
      .status-banner {{ margin: 0 20px; }}
      .stats {{ grid-template-columns: repeat(3, 1fr); }}
      .chart-section {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>

  <header class="header">
    <div class="header-left">
      <div class="logo-mark">SGA</div>
      <span class="header-title">{repo}</span>
      <div class="header-divider" style="width:1px;height:18px;background:var(--border);"></div>
      <span class="header-subtitle">CodeQL Security Report</span>
    </div>
    <div class="header-right">
      <span class="badge badge-tech">Azure Functions · TS</span>
      <span class="badge badge-branch">⎇ {branch}</span>
      {'<span class="badge badge-status-ok">Passed</span>' if passed else '<span class="badge badge-status-fail">Failed</span>'}
    </div>
  </header>

  <div class="layout">

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="search-wrap">
        <div class="search-box">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" type="text" id="searchInput" placeholder="Buscar hallazgos..."/>
        </div>
      </div>

      <div class="sidebar-label" style="margin-top:8px;">Severidad</div>
      <div class="sidebar-item active" data-level="all" onclick="filterLevel('all')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Todos
        <span class="sev-counter" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);">{total}</span>
      </div>
      <div class="sidebar-item" data-level="critical" onclick="filterLevel('critical')">
        <span class="method-dot" style="background:var(--red)"></span>Crítico
        <span class="sev-counter sc-critical">{counts['critical']}</span>
      </div>
      <div class="sidebar-item" data-level="high" onclick="filterLevel('high')">
        <span class="method-dot" style="background:var(--amber)"></span>Alto
        <span class="sev-counter sc-high">{counts['high']}</span>
      </div>
      <div class="sidebar-item" data-level="medium" onclick="filterLevel('medium')">
        <span class="method-dot" style="background:var(--blue)"></span>Medio
        <span class="sev-counter sc-medium">{counts['medium']}</span>
      </div>
      <div class="sidebar-item" data-level="low" onclick="filterLevel('low')">
        <span class="method-dot" style="background:var(--green)"></span>Bajo
        <span class="sev-counter sc-low">{counts['low']}</span>
      </div>

      {'<div class="sidebar-divider"></div><div class="sidebar-label">Reglas detectadas</div>' + rules_sidebar if rules_sidebar else ''}
      {modules_sidebar}

      <div class="sidebar-divider"></div>
      <div class="sidebar-label">Análisis</div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        {repo}
      </div>
      <div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {build_date}
      </div>
      {run_link}
    </aside>

    <!-- MAIN -->
    <main class="main">

      <!-- HERO -->
      <section class="hero">
        <div class="hero-eyebrow">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          CodeQL · SAST · Azure Functions
        </div>
        <h1>Security <em>Report</em></h1>
        <p class="hero-sub">
          Análisis estático de seguridad sobre <strong>SGA-BACKEND</strong> —
          Azure Functions con TypeScript, Drizzle ORM, autenticación Microsoft Azure AD y JWT.
          Detecta inyecciones, manejo inseguro de tokens, exposición de datos sensibles
          y patrones inseguros en el código antes de que lleguen a producción.
        </p>
        <div class="hero-pills">
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            TypeScript / JavaScript
          </span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Azure Functions v4
          </span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            GitHub CodeQL v3
          </span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            security-and-quality
          </span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {build_date}
          </span>
        </div>
      </section>

      <!-- STATUS BANNER -->
      <div class="status-banner">
        <div class="status-icon {'si-ok' if passed else ('si-fail' if counts['critical'] > 0 else 'si-warn')}">{status_icon}</div>
        <div class="status-text">
          <h2>{'Análisis superado — sin hallazgos' if passed else status_label + ' encontrado' + ('s' if total != 1 else '')}</h2>
          <p>{'No se detectaron vulnerabilidades en el código analizado.' if passed else 'Revisa los hallazgos y aplica las correcciones sugeridas antes de fusionar a producción.'}</p>
        </div>
        <div class="status-meta">
          {'<span class="badge badge-status-ok">✓ Clean</span>' if passed else f'<span class="badge badge-status-fail">✗ {total} issue{"s" if total != 1 else ""}</span>'}
          {'<a href="https://github.com/' + repo + '/security/code-scanning" target="_blank" class="filter-btn" style="text-decoration:none;">Ver en GitHub →</a>' if repo and '/' in repo else ''}
        </div>
      </div>

      <!-- STATS -->
      <div class="stats">
        <div class="stat-item"><span class="stat-value c-accent">{total}</span><span class="stat-label">Total</span></div>
        <div class="stat-item"><span class="stat-value c-red">{counts['critical']}</span><span class="stat-label">Crítico</span></div>
        <div class="stat-item"><span class="stat-value c-amber">{counts['high']}</span><span class="stat-label">Alto</span></div>
        <div class="stat-item"><span class="stat-value c-blue">{counts['medium']}</span><span class="stat-label">Medio</span></div>
        <div class="stat-item"><span class="stat-value c-green">{counts['low']}</span><span class="stat-label">Bajo</span></div>
        <div class="stat-item">
          <span class="stat-value" style="color:var(--purple);">{len(rule_set)}</span>
          <span class="stat-label">Reglas</span>
        </div>
      </div>

      <!-- DONUT -->
      {_donut_section(counts, total) if total > 0 else ''}

      <!-- CONTENT -->
      <div class="content">
        <div class="toolbar">
          <span class="toolbar-label">Filtrar:</span>
          <button class="filter-btn active"      onclick="filterBtn(this,'all')">Todos ({total})</button>
          <button class="filter-btn fb-critical" onclick="filterBtn(this,'critical')">Crítico ({counts['critical']})</button>
          <button class="filter-btn fb-high"     onclick="filterBtn(this,'high')">Alto ({counts['high']})</button>
          <button class="filter-btn fb-medium"   onclick="filterBtn(this,'medium')">Medio ({counts['medium']})</button>
          <button class="filter-btn fb-low"      onclick="filterBtn(this,'low')">Bajo ({counts['low']})</button>
        </div>
        <div class="findings-list" id="findingsList">
          {cards_html}
        </div>
      </div>

      <footer class="footer">
        <span>{repo} · {build_date}</span>
        <span>Powered by <a href="https://codeql.github.com" target="_blank">GitHub CodeQL</a></span>
      </footer>

    </main>
  </div>

  <script>
    let _activeLevel  = 'all';
    let _activeRule   = null;
    let _activeModule = null;

    function applyFilters() {{
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      document.querySelectorAll('.finding-card').forEach(function(card) {{
        const lvl = card.dataset.level;
        const rul = card.dataset.rule;
        const mod = card.dataset.module;
        const txt = card.textContent.toLowerCase();
        const lvlOk = _activeLevel  === 'all' || lvl === _activeLevel;
        const rulOk = !_activeRule  || rul === _activeRule;
        const modOk = !_activeModule || mod === _activeModule;
        const txtOk = !q || txt.includes(q);
        card.style.display = (lvlOk && rulOk && modOk && txtOk) ? '' : 'none';
      }});
    }}

    function clearAllFilters() {{
      _activeLevel = 'all'; _activeRule = null; _activeModule = null;
      document.querySelectorAll('.sidebar-item[data-level]').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.rule-filter').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.filter-btn').forEach(el => el.classList.remove('active'));
    }}

    function filterLevel(level) {{
      clearAllFilters();
      _activeLevel = level;
      document.querySelectorAll('.sidebar-item[data-level]').forEach(function(el) {{
        el.classList.toggle('active', el.dataset.level === level);
      }});
      const match = document.querySelector('.filter-btn[onclick*="\'" + level + "\'"]');
      if (match) match.classList.add('active');
      applyFilters();
    }}

    function filterRule(ruleId) {{
      clearAllFilters();
      _activeRule = ruleId;
      document.querySelectorAll('.rule-filter[data-rule]').forEach(function(el) {{
        el.classList.toggle('active', el.dataset.rule === ruleId);
      }});
      applyFilters();
    }}

    function filterModule(moduleName) {{
      clearAllFilters();
      _activeModule = moduleName;
      document.querySelectorAll('.rule-filter[data-module]').forEach(function(el) {{
        el.classList.toggle('active', el.dataset.module === moduleName);
      }});
      applyFilters();
    }}

    function filterBtn(btn, level) {{
      clearAllFilters();
      _activeLevel = level;
      btn.classList.add('active');
      document.querySelectorAll('.sidebar-item[data-level]').forEach(function(el) {{
        el.classList.toggle('active', el.dataset.level === level);
      }});
      applyFilters();
    }}

    document.getElementById('searchInput').addEventListener('input', applyFilters);
  </script>
</body>
</html>"""


def _donut_section(counts: dict, total: int) -> str:
    if total == 0:
        return ""
    colors = {
        "critical": ("#DC2626", "Crítico"),
        "high":     ("#D97706", "Alto"),
        "medium":   ("#0284C7", "Medio"),
        "low":      ("#059669", "Bajo"),
    }
    r = 60; cx = cy = 80
    circumference = 2 * 3.14159 * r
    segments = []; offset = 0
    for key, (color, label) in colors.items():
        count = counts.get(key, 0)
        if count == 0:
            continue
        dash = circumference * count / total
        segments.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" '
            f'stroke-width="18" stroke-dasharray="{dash:.2f} {circumference:.2f}" '
            f'stroke-dashoffset="-{offset:.2f}" stroke-linecap="butt"/>'
        )
        offset += dash

    legend_items = ""
    for key, (color, label) in colors.items():
        count = counts.get(key, 0)
        pct   = round(count / total * 100) if total > 0 else 0
        legend_items += f"""
        <div class="legend-item">
          <span class="legend-dot" style="background:{color}"></span>
          <span class="legend-name">{label}</span>
          <div class="legend-bar"><div class="legend-fill" style="width:{pct}%;background:{color}"></div></div>
          <span class="legend-count">{count}</span>
        </div>"""

    return f"""
    <div class="chart-section">
      <div class="donut-wrap">
        <svg viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="60" fill="none" stroke="#E2E8F0" stroke-width="18"/>
          {chr(10).join(segments)}
        </svg>
        <div class="donut-center">
          <div class="donut-total">{total}</div>
          <div class="donut-label">issues</div>
        </div>
      </div>
      <div class="legend">{legend_items}</div>
    </div>"""


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Genera página HTML de reporte CodeQL — SGA Backend")
    parser.add_argument("sarif",      help="Archivo .sarif o directorio con archivos .sarif")
    parser.add_argument("output_dir", help="Directorio de salida para index.html")
    parser.add_argument("--repo",     default="TALLER-PROYECTOS-2026-I/SGA-BACKEND")
    parser.add_argument("--branch",   default="dev")
    parser.add_argument("--run-id",   default="")
    args = parser.parse_args()

    sarif_path = Path(args.sarif)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sarif_files = scan_sarif_files(sarif_path)
    if not sarif_files:
        print(f"⚠️  No se encontraron archivos .sarif en: {sarif_path}")
        print("   Generando página vacía (sin hallazgos)...")
        findings = []
    else:
        print(f"📄 Archivos SARIF: {len(sarif_files)}")
        findings = []
        for sf in sarif_files:
            print(f"   → Parseando: {sf.name}")
            findings.extend(parse_sarif(sf))
        print(f"🔍 Hallazgos totales: {len(findings)}")

    counts    = count_by_level(findings)
    by_module = count_by_module(findings)
    build_date = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")

    html = generate_html(
        findings   = findings,
        counts     = counts,
        by_module  = by_module,
        repo       = args.repo,
        branch     = args.branch,
        run_id     = args.run_id,
        build_date = build_date,
    )

    out_path = output_dir / "index.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"✅ Reporte guardado: {out_path}")
    print(f"   Crítico:{counts['critical']}  Alto:{counts['high']}  Medio:{counts['medium']}  Bajo:{counts['low']}")
    if by_module:
        print(f"   Módulos afectados: {', '.join(f'{k}({v})' for k,v in by_module.items())}")


if __name__ == "__main__":
    main()
