#!/usr/bin/env python3
"""
generate_trivy_page.py — SGA Backend Edition
Genera una página HTML profesional para reportes de Trivy.
Paleta: blanco / índigo / slate (consistente con el resto del proyecto)

Analiza 3 tipos de resultados:
  - npm-vulns.json    → CVEs en dependencias npm
  - secrets.json      → Secretos hardcodeados
  - misconfig.json    → Misconfiguraciones

Uso:
  python3 generate_trivy_page.py <results_dir> <output_dir>
    [--repo REPO] [--branch BRANCH] [--run-id RUN_ID] [--severity SEV]
"""

import sys
import json
import datetime
import argparse
from pathlib import Path


# ─────────────────────────────────────────────────────────────
# PARSERS
# ─────────────────────────────────────────────────────────────

SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}

SEV_LABELS = {
    "CRITICAL": ("Crítico",  "var(--red)",   "var(--red-bg)",   "var(--red-border)"),
    "HIGH":     ("Alto",     "var(--amber)", "var(--amber-bg)", "var(--amber-border)"),
    "MEDIUM":   ("Medio",    "var(--blue)",  "var(--blue-bg)",  "var(--blue-border)"),
    "LOW":      ("Bajo",     "var(--green)", "var(--green-bg)", "var(--green-border)"),
    "UNKNOWN":  ("Desconocido", "var(--text3)", "var(--bg3)", "var(--border)"),
}

# Módulos SGA para etiquetar hallazgos por ruta
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
}


def detect_module(path: str) -> str:
    parts = path.replace("\\", "/").lower().split("/")
    for part in parts:
        if part in SGA_MODULES:
            return SGA_MODULES[part]
    return ""


def parse_vulns(json_path: Path) -> list[dict]:
    """Parsea hallazgos de vulnerabilidades CVE."""
    if not json_path.exists():
        return []
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    findings = []
    for result in data.get("Results", []):
        target = result.get("Target", "")
        for vuln in (result.get("Vulnerabilities") or []):
            sev = vuln.get("Severity", "UNKNOWN").upper()
            findings.append({
                "type":          "vuln",
                "id":            vuln.get("VulnerabilityID", ""),
                "pkg":           vuln.get("PkgName", ""),
                "installed":     vuln.get("InstalledVersion", ""),
                "fixed":         vuln.get("FixedVersion", ""),
                "title":         vuln.get("Title", vuln.get("VulnerabilityID", "")),
                "description":   vuln.get("Description", "")[:300],
                "severity":      sev,
                "cvss":          _extract_cvss(vuln),
                "references":    (vuln.get("References") or [])[:3],
                "target":        target,
                "primary_url":   vuln.get("PrimaryURL", ""),
            })
    findings.sort(key=lambda x: SEV_ORDER.get(x["severity"], 99))
    return findings


def parse_secrets(json_path: Path) -> list[dict]:
    """Parsea secretos hardcodeados."""
    if not json_path.exists():
        return []
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    findings = []
    for result in data.get("Results", []):
        target = result.get("Target", "")
        for secret in (result.get("Secrets") or []):
            findings.append({
                "type":      "secret",
                "rule_id":   secret.get("RuleID", ""),
                "category":  secret.get("Category", ""),
                "title":     secret.get("Title", ""),
                "severity":  secret.get("Severity", "HIGH").upper(),
                "target":    target,
                "line":      str(secret.get("StartLine", "")),
                "match":     secret.get("Match", "")[:80],
                "module":    detect_module(target),
            })
    findings.sort(key=lambda x: SEV_ORDER.get(x["severity"], 99))
    return findings


def parse_misconfigs(json_path: Path) -> list[dict]:
    """Parsea misconfiguraciones."""
    if not json_path.exists():
        return []
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    findings = []
    for result in data.get("Results", []):
        target = result.get("Target", "")
        for m in (result.get("Misconfigurations") or []):
            sev = m.get("Severity", "LOW").upper()
            findings.append({
                "type":        "misconfig",
                "id":          m.get("ID", ""),
                "title":       m.get("Title", ""),
                "description": m.get("Description", "")[:300],
                "severity":    sev,
                "target":      target,
                "resolution":  m.get("Resolution", ""),
                "references":  (m.get("References") or [])[:2],
            })
    findings.sort(key=lambda x: SEV_ORDER.get(x["severity"], 99))
    return findings


def _extract_cvss(vuln: dict) -> str:
    """Extrae el score CVSS más relevante."""
    cvss = vuln.get("CVSS", {})
    for source in ["nvd", "ghsa", "redhat"]:
        for key, val in cvss.items():
            if source in key.lower():
                score = val.get("V3Score") or val.get("V2Score")
                if score:
                    return str(score)
    # Fallback: primer score disponible
    for key, val in cvss.items():
        score = val.get("V3Score") or val.get("V2Score")
        if score:
            return str(score)
    return ""


def count_by_severity(findings: list[dict]) -> dict:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        sev = f.get("severity", "LOW")
        if sev in counts:
            counts[sev] += 1
    return counts


# ─────────────────────────────────────────────────────────────
# HTML CARDS
# ─────────────────────────────────────────────────────────────

def sev_badge(severity: str) -> str:
    label, c, bg, bd = SEV_LABELS.get(severity, SEV_LABELS["UNKNOWN"])
    return (
        f'<span class="sev-badge" style="color:{c};background:{bg};border-color:{bd};">'
        f'{label}</span>'
    )


def vuln_card(idx: int, f: dict) -> str:
    badge   = sev_badge(f["severity"])
    cvss_el = (
        f'<span class="cvss-score">CVSS {f["cvss"]}</span>'
        if f["cvss"] else ""
    )
    fixed_el = (
        f'<span class="fixed-badge">Fix: {f["fixed"]}</span>'
        if f["fixed"] else
        '<span class="no-fix-badge">Sin fix disponible</span>'
    )
    refs = "".join(
        f'<a href="{r}" target="_blank" class="ref-link">{r[:60]}{"…" if len(r)>60 else ""}</a>'
        for r in f["references"]
    )
    url_el = (
        f'<a href="{f["primary_url"]}" target="_blank" class="ref-link">{f["primary_url"]}</a>'
        if f.get("primary_url") else ""
    )
    return f"""
<div class="finding-card sev-card-{f['severity'].lower()}"
     data-severity="{f['severity']}" data-type="vuln">
  <div class="finding-header">
    <div class="finding-meta">
      {badge}
      {cvss_el}
      <span class="rule-id">{f['id']}</span>
      {fixed_el}
    </div>
    <span class="finding-idx">#{idx}</span>
  </div>
  <h3 class="finding-title">{f['title'] or f['id']}</h3>
  <div class="pkg-info">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
    <strong>{f['pkg']}</strong>
    <span class="ver-badge">instalado: {f['installed']}</span>
  </div>
  {'<p class="finding-desc">' + f['description'] + ('…' if len(f['description'])==300 else '') + '</p>' if f['description'] else ''}
  <div class="refs-row">{url_el}{refs}</div>
</div>"""


def secret_card(idx: int, f: dict) -> str:
    badge = sev_badge(f["severity"])
    mod_el = (
        f'<span class="module-badge">{f["module"]}</span>'
        if f.get("module") else ""
    )
    match_el = ""
    if f.get("match"):
        masked = f["match"][:20] + "••••••••" + f["match"][-4:] if len(f["match"]) > 28 else "••••••••"
        match_el = f'<pre class="secret-match">Coincidencia: {masked}</pre>'
    return f"""
<div class="finding-card sev-card-{f['severity'].lower()}"
     data-severity="{f['severity']}" data-type="secret">
  <div class="finding-header">
    <div class="finding-meta">
      {badge}
      {mod_el}
      <span class="type-badge type-secret">Secreto</span>
      <span class="rule-id">{f['rule_id']}</span>
    </div>
    <span class="finding-idx">#{idx}</span>
  </div>
  <h3 class="finding-title">{f['title'] or f['category']}</h3>
  <div class="finding-loc">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
    {f['target']}{':' + f['line'] if f['line'] else ''}
  </div>
  {match_el}
</div>"""


def misconfig_card(idx: int, f: dict) -> str:
    badge = sev_badge(f["severity"])
    refs = "".join(
        f'<a href="{r}" target="_blank" class="ref-link">{r[:60]}{"…" if len(r)>60 else ""}</a>'
        for r in f.get("references", [])
    )
    resolution_el = (
        f'<p class="finding-help">💡 {f["resolution"]}</p>'
        if f.get("resolution") else ""
    )
    return f"""
<div class="finding-card sev-card-{f['severity'].lower()}"
     data-severity="{f['severity']}" data-type="misconfig">
  <div class="finding-header">
    <div class="finding-meta">
      {badge}
      <span class="type-badge type-misconfig">Misconfig</span>
      <span class="rule-id">{f['id']}</span>
    </div>
    <span class="finding-idx">#{idx}</span>
  </div>
  <h3 class="finding-title">{f['title']}</h3>
  <div class="finding-loc">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
    {f['target']}
  </div>
  {'<p class="finding-desc">' + f['description'] + '</p>' if f['description'] else ''}
  {resolution_el}
  <div class="refs-row">{refs}</div>
</div>"""


# ─────────────────────────────────────────────────────────────
# DONUT
# ─────────────────────────────────────────────────────────────

def donut_section(counts: dict, total: int) -> str:
    if total == 0:
        return ""
    colors = {
        "CRITICAL": ("#DC2626", "Crítico"),
        "HIGH":     ("#D97706", "Alto"),
        "MEDIUM":   ("#0284C7", "Medio"),
        "LOW":      ("#059669", "Bajo"),
    }
    r = 60; circumference = 2 * 3.14159 * r
    segments = []; offset = 0
    for key, (color, label) in colors.items():
        count = counts.get(key, 0)
        if count == 0:
            continue
        dash = circumference * count / total
        segments.append(
            f'<circle cx="80" cy="80" r="{r}" fill="none" stroke="{color}" '
            f'stroke-width="18" stroke-dasharray="{dash:.2f} {circumference:.2f}" '
            f'stroke-dashoffset="-{offset:.2f}" stroke-linecap="butt"/>'
        )
        offset += dash

    legend = ""
    for key, (color, label) in colors.items():
        count = counts.get(key, 0)
        pct   = round(count / total * 100) if total > 0 else 0
        legend += f"""
        <div class="legend-item">
          <span class="legend-dot" style="background:{color}"></span>
          <span class="legend-name">{label}</span>
          <div class="legend-bar"><div class="legend-fill" style="width:{pct}%;background:{color}"></div></div>
          <span class="legend-count">{count}</span>
        </div>"""

    return f"""
    <div class="chart-section">
      <div class="donut-wrap">
        <svg viewBox="0 0 160 160" style="transform:rotate(-90deg);width:100%;height:100%;">
          <circle cx="80" cy="80" r="{r}" fill="none" stroke="#E2E8F0" stroke-width="18"/>
          {chr(10).join(segments)}
        </svg>
        <div class="donut-center">
          <div class="donut-total">{total}</div>
          <div class="donut-label">issues</div>
        </div>
      </div>
      <div class="legend">{legend}</div>
    </div>"""


# ─────────────────────────────────────────────────────────────
# HTML GENERATOR
# ─────────────────────────────────────────────────────────────

CSS = """
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
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
      --shadow-sm:   0 1px 3px rgba(15,23,42,0.08);
      --shadow:      0 4px 16px rgba(15,23,42,0.10);
      --shadow-lg:   0 10px 40px rgba(15,23,42,0.12);
      --sidebar-w:   268px;
      --header-h:    60px;
    }

    html { scroll-behavior: smooth; }
    body { font-family: var(--font); background: var(--bg); color: var(--text);
           min-height: 100vh; -webkit-font-smoothing: antialiased; }

    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: var(--bg3); }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

    /* HEADER */
    .header {
      position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
      background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; z-index: 1000; box-shadow: var(--shadow-sm);
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo-mark {
      width: 34px; height: 34px; background: var(--purple);
      border-radius: 9px; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #fff;
      box-shadow: 0 2px 8px rgba(124,58,237,0.35); flex-shrink: 0;
    }
    .header-title { font-size: 14px; font-weight: 700; color: var(--slate);
                    white-space: nowrap; max-width: 380px; overflow: hidden; text-overflow: ellipsis; }
    .header-divider { width: 1px; height: 18px; background: var(--border); }
    .header-subtitle { font-size: 12px; color: var(--text3); }
    .header-right { display: flex; align-items: center; gap: 8px; }

    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600; font-family: var(--mono);
    }
    .badge-branch  { background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-border); }
    .badge-ok      { background: var(--green-bg);  color: var(--green);  border: 1px solid var(--green-border); }
    .badge-ok::before { content:''; width:6px; height:6px; background:var(--green);
                        border-radius:50%; animation: pulse 2s infinite; }
    .badge-fail    { background: var(--red-bg);    color: var(--red);    border: 1px solid var(--red-border); }
    .badge-tech    { background: var(--blue-bg);   color: var(--blue);   border: 1px solid var(--blue-border); font-size:10px; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }

    /* LAYOUT */
    .layout { display: flex; padding-top: var(--header-h); min-height: 100vh; }

    /* SIDEBAR */
    .sidebar {
      width: var(--sidebar-w); flex-shrink: 0; background: var(--bg2);
      border-right: 1px solid var(--border);
      position: fixed; top: var(--header-h); bottom: 0; left: 0;
      overflow-y: auto; padding: 16px 0;
    }
    .sidebar-label { padding: 0 16px 6px; font-size: 10px; font-weight: 700;
                     letter-spacing: .08em; text-transform: uppercase; color: var(--text3); }
    .sidebar-item {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 16px; cursor: pointer; font-size: 13px; font-weight: 500;
      color: var(--text2); border-left: 2px solid transparent;
      transition: all .14s; margin: 1px 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sidebar-item:hover { color: var(--accent); background: var(--accent-light); border-left-color: var(--accent-mid); }
    .sidebar-item.active { color: var(--accent); background: var(--accent-light); border-left-color: var(--accent); font-weight: 600; }
    .method-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .sidebar-divider { height: 1px; background: var(--border); margin: 8px 16px; }
    .sev-counter { margin-left: auto; font-size: 11px; font-weight: 700;
                   font-family: var(--mono); padding: 1px 7px; border-radius: 10px; flex-shrink: 0; }
    .sc-critical { background:var(--red-bg);   color:var(--red);   border:1px solid var(--red-border);   }
    .sc-high     { background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }
    .sc-medium   { background:var(--blue-bg);  color:var(--blue);  border:1px solid var(--blue-border);  }
    .sc-low      { background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }

    .search-wrap { padding: 12px 12px 8px; }
    .search-box { position: relative; }
    .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%);
                   color:var(--text3); pointer-events:none; }
    .search-input {
      width: 100%; background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 12px 8px 32px;
      font-size: 12px; color: var(--text); font-family: var(--font);
      outline: none; transition: border-color .15s, box-shadow .15s;
    }
    .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    .search-input::placeholder { color: var(--text3); }

    /* MAIN */
    .main { flex: 1; margin-left: var(--sidebar-w); }

    /* HERO */
    .hero {
      background: var(--bg2); border-bottom: 1px solid var(--border);
      padding: 40px 48px 36px; position: relative; overflow: hidden;
    }
    .hero::after {
      content:''; position:absolute; top:0; right:0; bottom:0; width:340px;
      background: linear-gradient(135deg, var(--purple-bg) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 20px;
      background: var(--surface2); border: 1px solid var(--border2);
      font-size: 10px; font-weight: 700; color: var(--text2);
      letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px;
    }
    .hero h1 { font-size: 28px; font-weight: 800; color: var(--slate);
               line-height: 1.15; margin-bottom: 10px; letter-spacing: -.5px; }
    .hero h1 em { font-style: normal; color: var(--purple); }
    .hero-sub { font-size: 14px; color: var(--text2); line-height: 1.65; max-width: 560px; margin-bottom: 24px; }
    .hero-pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .hero-pill {
      display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px;
      border-radius: 6px; font-size: 11px; font-weight: 500; color: var(--text2);
      background: var(--bg3); border: 1px solid var(--border);
    }

    /* STATUS BANNER */
    .status-banner {
      display: flex; align-items: center; gap: 14px;
      margin: 0 48px; padding: 14px 20px;
      border-radius: var(--radius); border: 1px solid var(--border);
      background: var(--bg2); transform: translateY(20px);
      box-shadow: var(--shadow-sm);
    }
    .status-icon { width:36px; height:36px; border-radius:50%;
                   display:flex; align-items:center; justify-content:center;
                   font-size:15px; font-weight:800; flex-shrink:0; }
    .si-ok   { background:var(--green-bg); color:var(--green); border:2px solid var(--green-border); }
    .si-fail { background:var(--red-bg);   color:var(--red);   border:2px solid var(--red-border);   }
    .si-warn { background:var(--amber-bg); color:var(--amber); border:2px solid var(--amber-border); }
    .status-text h2 { font-size:14px; font-weight:700; color:var(--slate); margin-bottom:1px; }
    .status-text p  { font-size:12px; color:var(--text3); }
    .status-meta { margin-left:auto; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

    /* STATS */
    .stats { display:grid; grid-template-columns:repeat(7,1fr);
             border-bottom:1px solid var(--border); background:var(--bg2); margin-top:28px; }
    .stat-item { padding:18px 16px; display:flex; flex-direction:column; gap:3px;
                 border-right:1px solid var(--border); }
    .stat-item:last-child { border-right:none; }
    .stat-value { font-size:22px; font-weight:800; color:var(--slate);
                  font-family:var(--mono); line-height:1; letter-spacing:-1px; }
    .stat-value.c-accent { color:var(--accent); }
    .stat-value.c-red    { color:var(--red);    }
    .stat-value.c-amber  { color:var(--amber);  }
    .stat-value.c-blue   { color:var(--blue);   }
    .stat-value.c-green  { color:var(--green);  }
    .stat-value.c-purple { color:var(--purple); }
    .stat-label { font-size:10px; color:var(--text3); font-weight:600;
                  text-transform:uppercase; letter-spacing:.06em; }

    /* DONUT */
    .chart-section {
      display:grid; grid-template-columns:200px 1fr; gap:28px; align-items:center;
      background:var(--bg2); border-bottom:1px solid var(--border); padding:24px 48px;
    }
    .donut-wrap { position:relative; width:160px; height:160px; }
    .donut-center { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    text-align:center; }
    .donut-total { font-size:28px; font-weight:800; color:var(--slate);
                   font-family:var(--mono); line-height:1; }
    .donut-label { font-size:10px; color:var(--text3); font-weight:600;
                   text-transform:uppercase; letter-spacing:.06em; }
    .legend { display:flex; flex-direction:column; gap:10px; }
    .legend-item { display:flex; align-items:center; gap:10px; }
    .legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .legend-name { font-size:13px; color:var(--text2); flex:1; }
    .legend-count { font-size:13px; font-weight:700; font-family:var(--mono); color:var(--slate); }
    .legend-bar { flex:1; height:4px; border-radius:2px; background:var(--border); overflow:hidden; }
    .legend-fill { height:100%; border-radius:2px; }

    /* TABS */
    .tabs-bar {
      display:flex; gap:4px; padding:20px 48px 0;
      border-bottom:1px solid var(--border); background:var(--bg2);
    }
    .tab-btn {
      padding:10px 20px; border-radius:var(--radius-sm) var(--radius-sm) 0 0;
      font-size:13px; font-weight:600; cursor:pointer;
      border:1px solid transparent; background:transparent;
      color:var(--text3); font-family:var(--font);
      transition:all .14s; border-bottom:none; position:relative; bottom:-1px;
    }
    .tab-btn:hover { color:var(--text2); background:var(--bg3); }
    .tab-btn.active {
      color:var(--accent); background:var(--bg2);
      border-color:var(--border); border-bottom-color:var(--bg2);
    }
    .tab-badge {
      display:inline-flex; align-items:center; justify-content:center;
      width:18px; height:18px; border-radius:50%; font-size:10px; font-weight:700;
      margin-left:6px; font-family:var(--mono);
    }
    .tb-red    { background:var(--red-bg);    color:var(--red);    }
    .tb-amber  { background:var(--amber-bg);  color:var(--amber);  }
    .tb-purple { background:var(--purple-bg); color:var(--purple); }
    .tb-green  { background:var(--green-bg);  color:var(--green);  }

    /* CONTENT */
    .content { padding:32px 48px 64px; }
    .tab-panel { display:none; }
    .tab-panel.active { display:block; }

    .toolbar { display:flex; align-items:center; gap:10px; margin-bottom:20px; flex-wrap:wrap; }
    .toolbar-label { font-size:13px; font-weight:600; color:var(--text2); margin-right:4px; }
    .filter-btn {
      padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600;
      cursor:pointer; border:1px solid var(--border); background:var(--bg2);
      color:var(--text2); transition:all .14s; font-family:var(--font);
    }
    .filter-btn:hover { border-color:var(--border2); background:var(--bg3); }
    .filter-btn.active { border-color:var(--accent); background:var(--accent-light); color:var(--accent); }
    .filter-btn.fb-critical.active { border-color:var(--red);   background:var(--red-bg);   color:var(--red);   }
    .filter-btn.fb-high.active     { border-color:var(--amber); background:var(--amber-bg); color:var(--amber); }
    .filter-btn.fb-medium.active   { border-color:var(--blue);  background:var(--blue-bg);  color:var(--blue);  }
    .filter-btn.fb-low.active      { border-color:var(--green); background:var(--green-bg); color:var(--green); }

    .findings-list { display:flex; flex-direction:column; gap:10px; }

    /* CARDS */
    .finding-card {
      background:var(--bg2); border:1px solid var(--border);
      border-radius:var(--radius); padding:18px 20px;
      box-shadow:var(--shadow-sm); border-left:4px solid var(--border2);
      transition:box-shadow .15s;
    }
    .finding-card:hover { box-shadow:var(--shadow); }
    .sev-card-critical { border-left-color:var(--red);   }
    .sev-card-high     { border-left-color:var(--amber); }
    .sev-card-medium   { border-left-color:var(--blue);  }
    .sev-card-low      { border-left-color:var(--green); }

    .finding-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .finding-meta   { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .finding-idx    { font-size:11px; color:var(--text4); font-family:var(--mono); }
    .finding-title  { font-size:15px; font-weight:700; color:var(--slate); margin-bottom:6px; line-height:1.3; }
    .finding-desc   { font-size:13px; color:var(--text2); line-height:1.6; margin-bottom:8px; }
    .finding-help   { font-size:12px; color:var(--text3); line-height:1.55; margin-top:6px; }
    .finding-loc {
      display:inline-flex; align-items:center; gap:5px;
      font-size:11px; font-family:var(--mono); color:var(--accent);
      background:var(--accent-light); border:1px solid var(--accent-mid);
      padding:2px 8px; border-radius:5px; margin-bottom:8px;
    }

    .sev-badge {
      display:inline-flex; align-items:center; padding:2px 9px; border-radius:12px;
      font-size:10px; font-weight:700; font-family:var(--mono); border:1px solid;
    }
    .rule-id {
      font-size:11px; font-family:var(--mono); color:var(--text3);
      background:var(--bg3); border:1px solid var(--border); padding:1px 7px; border-radius:5px;
    }
    .module-badge {
      font-size:10px; font-weight:700; padding:2px 8px; border-radius:5px;
      background:var(--purple-bg); color:var(--purple);
      border:1px solid var(--purple-border); font-family:var(--mono);
    }
    .type-badge {
      font-size:10px; font-weight:700; padding:2px 8px; border-radius:5px;
      font-family:var(--mono);
    }
    .type-secret  { background:var(--red-bg);  color:var(--red);  border:1px solid var(--red-border);  }
    .type-misconfig { background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }
    .cvss-score {
      font-size:10px; font-weight:700; font-family:var(--mono);
      padding:2px 7px; border-radius:5px;
      background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border);
    }
    .fixed-badge {
      font-size:10px; font-weight:700; font-family:var(--mono);
      padding:2px 7px; border-radius:5px;
      background:var(--green-bg); color:var(--green); border:1px solid var(--green-border);
    }
    .no-fix-badge {
      font-size:10px; font-weight:700; font-family:var(--mono);
      padding:2px 7px; border-radius:5px;
      background:var(--red-bg); color:var(--red); border:1px solid var(--red-border);
    }
    .ver-badge {
      font-size:11px; font-family:var(--mono); color:var(--text3);
      background:var(--bg3); border:1px solid var(--border);
      padding:1px 7px; border-radius:5px; margin-left:4px;
    }
    .pkg-info { display:flex; align-items:center; gap:6px; margin-bottom:8px;
                font-size:13px; font-family:var(--mono); color:var(--slate); }
    .secret-match {
      background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm);
      font-family:var(--mono); font-size:11px; color:var(--text3);
      padding:8px 12px; margin:8px 0;
    }
    .refs-row { display:flex; flex-direction:column; gap:3px; margin-top:8px; }
    .ref-link { font-size:11px; color:var(--accent); text-decoration:none; font-family:var(--mono); }
    .ref-link:hover { text-decoration:underline; }

    /* EMPTY STATE */
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:64px 24px; text-align:center; }
    .empty-state h3 { font-size:17px; font-weight:700; color:var(--slate); margin-bottom:8px; }
    .empty-state p  { font-size:14px; color:var(--text3); }

    /* FOOTER */
    .footer {
      background:var(--bg2); border-top:1px solid var(--border);
      padding:18px 48px; display:flex; align-items:center;
      justify-content:space-between; font-size:11px; color:var(--text3);
    }
    .footer a { color:var(--text3); text-decoration:none; }
    .footer a:hover { color:var(--accent); }

    @media (max-width: 900px) {
      :root { --sidebar-w: 0px; }
      .sidebar { display: none; }
      .hero, .content, .chart-section, .footer, .tabs-bar { padding-left: 20px; padding-right: 20px; }
      .status-banner { margin: 0 20px; }
      .stats { grid-template-columns: repeat(3, 1fr); }
      .chart-section { grid-template-columns: 1fr; }
    }
"""

JS = """
    let _activeSev = 'all';

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="' + tabId + '"]').classList.add('active');
      document.getElementById('panel-' + tabId).classList.add('active');
      _activeSev = 'all';
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sev === 'all');
      });
      applyFilter();
    }

    function filterBySev(btn, sev) {
      _activeSev = sev;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    }

    function filterSidebar(sev) {
      _activeSev = sev;
      document.querySelectorAll('.sidebar-item[data-sev]').forEach(el => {
        el.classList.toggle('active', el.dataset.sev === sev);
      });
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sev === sev);
      });
      applyFilter();
    }

    function applyFilter() {
      const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
      document.querySelectorAll('.finding-card').forEach(function(card) {
        const sev = card.dataset.severity;
        const txt = card.textContent.toLowerCase();
        const sevOk = _activeSev === 'all' || sev === _activeSev;
        const txtOk = !q || txt.includes(q);
        card.style.display = (sevOk && txtOk) ? '' : 'none';
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      const si = document.getElementById('searchInput');
      if (si) si.addEventListener('input', applyFilter);
    });
"""


def generate_html(
    vulns:      list[dict],
    secrets:    list[dict],
    misconfigs: list[dict],
    repo:       str,
    branch:     str,
    run_id:     str,
    severity:   str,
    build_date: str,
) -> str:
    total_vulns   = len(vulns)
    total_secrets = len(secrets)
    total_misc    = len(misconfigs)
    total         = total_vulns + total_secrets + total_misc
    passed        = total == 0

    # Conteos globales de severidad (solo vulnerabilidades para el donut)
    all_findings = vulns + secrets + misconfigs
    sev_counts   = count_by_severity(all_findings)

    # Cards
    vuln_cards    = "".join(vuln_card(i+1, f) for i, f in enumerate(vulns))
    secret_cards  = "".join(secret_card(i+1, f) for i, f in enumerate(secrets))
    misconf_cards = "".join(misconfig_card(i+1, f) for i, f in enumerate(misconfigs))

    empty_vuln = """<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           style="color:var(--green);margin-bottom:12px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/></svg>
      <h3>Sin vulnerabilidades CVE</h3><p>No se encontraron CVEs en las dependencias npm.</p></div>"""
    empty_secret = """<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           style="color:var(--green);margin-bottom:12px;"><rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h3>Sin secretos detectados</h3><p>No se encontraron credenciales o tokens hardcodeados.</p></div>"""
    empty_misc = """<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           style="color:var(--green);margin-bottom:12px;"><polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <h3>Sin misconfiguraciones</h3><p>No se encontraron problemas de configuración.</p></div>"""

    # Status
    status_icon_cls = "si-ok" if passed else ("si-fail" if sev_counts["CRITICAL"] > 0 else "si-warn")
    status_icon_chr = "✓" if passed else "!"
    status_h2 = "Análisis superado — sin hallazgos" if passed else f"{total} hallazgo{'s' if total != 1 else ''} encontrado{'s' if total != 1 else ''}"
    status_p  = "No se detectaron vulnerabilidades." if passed else "Revisa los hallazgos antes de fusionar a producción."

    run_link = (
        f'<div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">'
        f'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        f'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>'
        f'<line x1="12" y1="16" x2="12.01" y2="16"/></svg>Run #{run_id}</div>'
    ) if run_id else ""

    tb_vuln   = f'<span class="tab-badge tb-{"red" if total_vulns else "green"}">{total_vulns}</span>'
    tb_secret = f'<span class="tab-badge tb-{"red" if total_secrets else "green"}">{total_secrets}</span>'
    tb_misc   = f'<span class="tab-badge tb-{"amber" if total_misc else "green"}">{total_misc}</span>'

    # Toolbar para cada tab
    def toolbar(panel_counts: dict, total_panel: int) -> str:
        return f"""<div class="toolbar">
          <span class="toolbar-label">Filtrar:</span>
          <button class="filter-btn active" data-sev="all"      onclick="filterBySev(this,'all')">Todos ({total_panel})</button>
          <button class="filter-btn fb-critical" data-sev="CRITICAL" onclick="filterBySev(this,'CRITICAL')">Crítico ({panel_counts.get('CRITICAL',0)})</button>
          <button class="filter-btn fb-high"     data-sev="HIGH"     onclick="filterBySev(this,'HIGH')">Alto ({panel_counts.get('HIGH',0)})</button>
          <button class="filter-btn fb-medium"   data-sev="MEDIUM"   onclick="filterBySev(this,'MEDIUM')">Medio ({panel_counts.get('MEDIUM',0)})</button>
          <button class="filter-btn fb-low"      data-sev="LOW"      onclick="filterBySev(this,'LOW')">Bajo ({panel_counts.get('LOW',0)})</button>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Trivy Security Report — SGA Backend</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>{CSS}</style>
</head>
<body>

  <header class="header">
    <div class="header-left">
      <div class="logo-mark">SGA</div>
      <span class="header-title">{repo}</span>
      <div class="header-divider" style="width:1px;height:18px;background:var(--border);"></div>
      <span class="header-subtitle">Trivy Security Report</span>
    </div>
    <div class="header-right">
      <span class="badge badge-tech">npm · fs scan</span>
      <span class="badge badge-branch">⎇ {branch}</span>
      {'<span class="badge badge-ok">Passed</span>' if passed else '<span class="badge badge-fail">Failed</span>'}
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
      <div class="sidebar-item active" data-sev="all" onclick="filterSidebar('all')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Todos <span class="sev-counter" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);">{total}</span>
      </div>
      <div class="sidebar-item" data-sev="CRITICAL" onclick="filterSidebar('CRITICAL')">
        <span class="method-dot" style="background:var(--red)"></span>Crítico
        <span class="sev-counter sc-critical">{sev_counts['CRITICAL']}</span>
      </div>
      <div class="sidebar-item" data-sev="HIGH" onclick="filterSidebar('HIGH')">
        <span class="method-dot" style="background:var(--amber)"></span>Alto
        <span class="sev-counter sc-high">{sev_counts['HIGH']}</span>
      </div>
      <div class="sidebar-item" data-sev="MEDIUM" onclick="filterSidebar('MEDIUM')">
        <span class="method-dot" style="background:var(--blue)"></span>Medio
        <span class="sev-counter sc-medium">{sev_counts['MEDIUM']}</span>
      </div>
      <div class="sidebar-item" data-sev="LOW" onclick="filterSidebar('LOW')">
        <span class="method-dot" style="background:var(--green)"></span>Bajo
        <span class="sev-counter sc-low">{sev_counts['LOW']}</span>
      </div>

      <div class="sidebar-divider"></div>
      <div class="sidebar-label">Tipos</div>
      <div class="sidebar-item" onclick="switchTab('vulns')">
        <span class="method-dot" style="background:var(--red)"></span>CVE npm
        <span class="sev-counter sc-critical">{total_vulns}</span>
      </div>
      <div class="sidebar-item" onclick="switchTab('secrets')">
        <span class="method-dot" style="background:var(--amber)"></span>Secretos
        <span class="sev-counter sc-high">{total_secrets}</span>
      </div>
      <div class="sidebar-item" onclick="switchTab('misconfigs')">
        <span class="method-dot" style="background:var(--blue)"></span>Misconfigs
        <span class="sev-counter sc-medium">{total_misc}</span>
      </div>

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
          Trivy · SCA + Secrets + Misconfig
        </div>
        <h1>Security <em>Report</em></h1>
        <p class="hero-sub">
          Análisis de dependencias npm con CVEs, detección de secretos hardcodeados
          y misconfiguraciones en <strong>SGA-BACKEND</strong> — Azure Functions + TypeScript + Drizzle ORM.
          Severidades analizadas: <strong>{severity}</strong>.
        </p>
        <div class="hero-pills">
          <span class="hero-pill">📦 npm · CVE</span>
          <span class="hero-pill">🔑 Secretos</span>
          <span class="hero-pill">⚙️ Misconfig</span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {build_date}
          </span>
        </div>
      </section>

      <!-- STATUS BANNER -->
      <div class="status-banner">
        <div class="status-icon {status_icon_cls}">{status_icon_chr}</div>
        <div class="status-text">
          <h2>{status_h2}</h2>
          <p>{status_p}</p>
        </div>
        <div class="status-meta">
          {'<span class="badge badge-ok">✓ Clean</span>' if passed else f'<span class="badge badge-fail">✗ {total} issue{"s" if total != 1 else ""}</span>'}
          {'<a href="https://github.com/' + repo + '/security" target="_blank" class="filter-btn" style="text-decoration:none;">Ver en GitHub →</a>' if '/' in repo else ''}
        </div>
      </div>

      <!-- STATS -->
      <div class="stats">
        <div class="stat-item"><span class="stat-value c-accent">{total}</span><span class="stat-label">Total</span></div>
        <div class="stat-item"><span class="stat-value c-red">{sev_counts['CRITICAL']}</span><span class="stat-label">Crítico</span></div>
        <div class="stat-item"><span class="stat-value c-amber">{sev_counts['HIGH']}</span><span class="stat-label">Alto</span></div>
        <div class="stat-item"><span class="stat-value c-blue">{sev_counts['MEDIUM']}</span><span class="stat-label">Medio</span></div>
        <div class="stat-item"><span class="stat-value c-green">{sev_counts['LOW']}</span><span class="stat-label">Bajo</span></div>
        <div class="stat-item"><span class="stat-value c-red">{total_vulns}</span><span class="stat-label">CVE npm</span></div>
        <div class="stat-item"><span class="stat-value c-amber">{total_secrets}</span><span class="stat-label">Secretos</span></div>
      </div>

      <!-- DONUT -->
      {donut_section(sev_counts, total) if total > 0 else ''}

      <!-- TABS -->
      <div class="tabs-bar">
        <button class="tab-btn active" data-tab="vulns"     onclick="switchTab('vulns')">🔴 CVE / npm {tb_vuln}</button>
        <button class="tab-btn"        data-tab="secrets"   onclick="switchTab('secrets')">🔑 Secretos {tb_secret}</button>
        <button class="tab-btn"        data-tab="misconfigs" onclick="switchTab('misconfigs')">⚙️ Misconfig {tb_misc}</button>
      </div>

      <!-- CONTENT -->
      <div class="content">

        <!-- TAB: CVE -->
        <div id="panel-vulns" class="tab-panel active">
          {toolbar(count_by_severity(vulns), total_vulns)}
          <div class="findings-list">{vuln_cards or empty_vuln}</div>
        </div>

        <!-- TAB: SECRETS -->
        <div id="panel-secrets" class="tab-panel">
          {toolbar(count_by_severity(secrets), total_secrets)}
          <div class="findings-list">{secret_cards or empty_secret}</div>
        </div>

        <!-- TAB: MISCONFIGS -->
        <div id="panel-misconfigs" class="tab-panel">
          {toolbar(count_by_severity(misconfigs), total_misc)}
          <div class="findings-list">{misconf_cards or empty_misc}</div>
        </div>

      </div>

      <footer class="footer">
        <span>{repo} · {build_date}</span>
        <span>Powered by <a href="https://trivy.dev" target="_blank">Aqua Trivy</a></span>
      </footer>
    </main>
  </div>

  <script>{JS}</script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Genera página HTML de reporte Trivy — SGA Backend")
    parser.add_argument("results_dir", help="Directorio con npm-vulns.json, secrets.json, misconfig.json")
    parser.add_argument("output_dir",  help="Directorio de salida para index.html")
    parser.add_argument("--repo",     default="TALLER-PROYECTOS-2026-I/SGA_BACKEND")
    parser.add_argument("--branch",   default="dev")
    parser.add_argument("--run-id",   default="")
    parser.add_argument("--severity", default="CRITICAL,HIGH,MEDIUM,LOW")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    output_dir  = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    vulns     = parse_vulns(results_dir / "npm-vulns.json")
    secrets   = parse_secrets(results_dir / "secrets.json")
    misconfigs = parse_misconfigs(results_dir / "misconfig.json")

    total = len(vulns) + len(secrets) + len(misconfigs)
    print(f"🔍 CVEs: {len(vulns)}  Secretos: {len(secrets)}  Misconfigs: {len(misconfigs)}  Total: {total}")

    build_date = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")

    html = generate_html(
        vulns      = vulns,
        secrets    = secrets,
        misconfigs = misconfigs,
        repo       = args.repo,
        branch     = args.branch,
        run_id     = args.run_id,
        severity   = args.severity,
        build_date = build_date,
    )

    out = output_dir / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"✅ Reporte guardado: {out}")


if __name__ == "__main__":
    main()
