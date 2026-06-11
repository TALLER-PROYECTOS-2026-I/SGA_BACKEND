#!/usr/bin/env python3
"""
generate_lint_page.py — SGA Backend Edition
Genera una página HTML profesional para reportes de ESLint.
Paleta: blanco / índigo / slate (consistente con el resto del proyecto)

Uso:
  python3 generate_lint_page.py <eslint-results.json> <output_dir>
    [--repo REPO] [--branch BRANCH] [--run-id RUN_ID]
"""

import sys
import json
import datetime
import argparse
from pathlib import Path
from collections import defaultdict


# ─────────────────────────────────────────────────────────────
# ESLINT RULE CATEGORIES
# ─────────────────────────────────────────────────────────────

# Categorías de reglas ESLint relevantes para Azure Functions + TypeScript
RULE_CATEGORIES = {
    # Seguridad
    "no-eval":                    ("security", "Seguridad"),
    "no-implied-eval":            ("security", "Seguridad"),
    "no-new-func":                ("security", "Seguridad"),
    "no-script-url":              ("security", "Seguridad"),
    "@typescript-eslint/no-explicit-any": ("typescript", "TypeScript"),
    "@typescript-eslint/no-unsafe-assignment": ("typescript", "TypeScript"),
    "@typescript-eslint/no-unsafe-call":       ("typescript", "TypeScript"),
    "@typescript-eslint/no-unsafe-member-access": ("typescript", "TypeScript"),
    "@typescript-eslint/no-unsafe-return":     ("typescript", "TypeScript"),
    "@typescript-eslint/ban-ts-comment":       ("typescript", "TypeScript"),
    # Calidad
    "no-unused-vars":             ("quality", "Calidad"),
    "@typescript-eslint/no-unused-vars": ("quality", "Calidad"),
    "no-console":                 ("quality", "Calidad"),
    "no-debugger":                ("quality", "Calidad"),
    "no-duplicate-imports":       ("quality", "Calidad"),
    "prefer-const":               ("quality", "Calidad"),
    "no-var":                     ("quality", "Calidad"),
    # Estilo
    "semi":                       ("style", "Estilo"),
    "quotes":                     ("style", "Estilo"),
    "indent":                     ("style", "Estilo"),
    "eqeqeq":                     ("style", "Estilo"),
}

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

SEVERITY_ESLINT = {1: "warning", 2: "error"}
SEV_LABEL = {
    "error":   ("Error",   "var(--red)",   "var(--red-bg)",   "var(--red-border)"),
    "warning": ("Warning", "var(--amber)", "var(--amber-bg)", "var(--amber-border)"),
    "info":    ("Info",    "var(--blue)",  "var(--blue-bg)",  "var(--blue-border)"),
}


def detect_module(file_path: str) -> str:
    parts = file_path.replace("\\", "/").lower().split("/")
    for part in parts:
        if part in SGA_MODULES:
            return SGA_MODULES[part]
    return "Otros"


def get_rule_category(rule_id: str) -> tuple[str, str]:
    if not rule_id:
        return ("other", "Otro")
    if rule_id in RULE_CATEGORIES:
        return RULE_CATEGORIES[rule_id]
    if "@typescript-eslint" in rule_id:
        return ("typescript", "TypeScript")
    if "security" in rule_id.lower():
        return ("security", "Seguridad")
    return ("other", "Otro")


def shorten_path(full_path: str) -> str:
    """Acorta rutas largas manteniendo src/... o la parte relevante."""
    p = full_path.replace("\\", "/")
    if "/src/" in p:
        return "src/" + p.split("/src/")[-1]
    if "/node_modules/" in p:
        return "node_modules/..."
    parts = p.split("/")
    return "/".join(parts[-3:]) if len(parts) > 3 else p


# ─────────────────────────────────────────────────────────────
# PARSER
# ─────────────────────────────────────────────────────────────

def parse_eslint(json_path: Path) -> dict:
    """Parsea el JSON de ESLint y retorna estructura normalizada."""
    if not json_path.exists():
        return {"files": [], "messages": [], "stats": {}}

    try:
        raw = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return {"files": [], "messages": [], "stats": {}}

    if not isinstance(raw, list):
        return {"files": [], "messages": [], "stats": {}}

    files = []
    all_messages = []
    total_errors   = 0
    total_warnings = 0
    rule_counts: dict[str, int] = defaultdict(int)
    module_counts: dict[str, int] = defaultdict(int)

    for file_result in raw:
        file_path    = file_result.get("filePath", "")
        short_path   = shorten_path(file_path)
        module_name  = detect_module(file_path)
        err_count    = file_result.get("errorCount", 0)
        warn_count   = file_result.get("warningCount", 0)
        messages     = file_result.get("messages", [])

        if not messages:
            continue

        file_messages = []
        for msg in messages:
            sev_int = msg.get("severity", 1)
            sev_str = SEVERITY_ESLINT.get(sev_int, "warning")
            rule_id = msg.get("ruleId") or ""
            cat_key, cat_label = get_rule_category(rule_id)

            m = {
                "severity":  sev_str,
                "rule_id":   rule_id,
                "message":   msg.get("message", ""),
                "line":      msg.get("line", ""),
                "column":    msg.get("column", ""),
                "category":  cat_key,
                "cat_label": cat_label,
                "file":      short_path,
                "module":    module_name,
                "fix":       bool(msg.get("fix")),
            }
            file_messages.append(m)
            all_messages.append(m)
            rule_counts[rule_id or "unknown"] += 1

        if module_name:
            module_counts[module_name] += len(file_messages)

        total_errors   += err_count
        total_warnings += warn_count

        files.append({
            "path":     short_path,
            "module":   module_name,
            "errors":   err_count,
            "warnings": warn_count,
            "messages": file_messages,
        })

    # Top reglas
    top_rules = sorted(rule_counts.items(), key=lambda x: -x[1])[:15]
    # Módulos afectados
    top_modules = dict(sorted(module_counts.items(), key=lambda x: -x[1]))

    return {
        "files":         files,
        "messages":      all_messages,
        "total_errors":  total_errors,
        "total_warnings": total_warnings,
        "total":         total_errors + total_warnings,
        "top_rules":     top_rules,
        "top_modules":   top_modules,
        "fixable":       sum(1 for m in all_messages if m["fix"]),
    }


# ─────────────────────────────────────────────────────────────
# HTML COMPONENTS
# ─────────────────────────────────────────────────────────────

def sev_badge(sev: str) -> str:
    label, c, bg, bd = SEV_LABEL.get(sev, SEV_LABEL["info"])
    return (
        f'<span class="sev-badge" style="color:{c};background:{bg};border-color:{bd};">'
        f'{label}</span>'
    )


def message_card(idx: int, msg: dict) -> str:
    badge = sev_badge(msg["severity"])
    mod_el = (
        f'<span class="module-badge">{msg["module"]}</span>'
        if msg["module"] and msg["module"] != "Otros" else ""
    )
    fix_el = (
        '<span class="fix-badge">⚡ Autofix</span>'
        if msg["fix"] else ""
    )
    cat_el = (
        f'<span class="cat-badge cat-{msg["category"]}">{msg["cat_label"]}</span>'
    )
    loc = f'{msg["file"]}:{msg["line"]}:{msg["column"]}'
    return f"""
<div class="finding-card sev-card-{msg['severity']}"
     data-severity="{msg['severity']}"
     data-category="{msg['category']}"
     data-module="{msg['module']}">
  <div class="finding-header">
    <div class="finding-meta">
      {badge}
      {cat_el}
      {mod_el}
      {fix_el}
      {'<span class="rule-id">' + msg['rule_id'] + '</span>' if msg['rule_id'] else ''}
    </div>
    <span class="finding-idx">#{idx}</span>
  </div>
  <p class="finding-title">{msg['message']}</p>
  <div class="finding-loc">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
    {loc}
  </div>
</div>"""


def rules_table(top_rules: list[tuple]) -> str:
    if not top_rules:
        return ""
    rows = ""
    for rule, count in top_rules:
        cat_key, cat_label = get_rule_category(rule)
        rows += f"""<tr>
          <td style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--slate);">{rule or "unknown"}</td>
          <td><span class="cat-badge cat-{cat_key}">{cat_label}</span></td>
          <td style="font-family:var(--mono);font-weight:700;color:var(--accent);">{count}</td>
        </tr>"""
    return f"""
    <div class="rules-table-wrap">
      <h3 class="section-title">📊 Top reglas más frecuentes</h3>
      <div class="table-container">
        <table class="rules-table">
          <thead><tr><th>Regla</th><th>Categoría</th><th>Ocurrencias</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>"""


def files_summary(files: list[dict]) -> str:
    if not files:
        return ""
    rows = ""
    for f in sorted(files, key=lambda x: -(x["errors"] * 10 + x["warnings"]))[:20]:
        err_el  = f'<span style="color:var(--red);font-weight:700;">{f["errors"]}</span>' if f["errors"] else '<span style="color:var(--text4);">0</span>'
        warn_el = f'<span style="color:var(--amber);font-weight:700;">{f["warnings"]}</span>' if f["warnings"] else '<span style="color:var(--text4);">0</span>'
        mod_el  = f'<span class="module-badge" style="font-size:10px;">{f["module"]}</span>' if f["module"] and f["module"] != "Otros" else ""
        rows += f"""<tr>
          <td style="font-family:var(--mono);font-size:11px;">{f['path']} {mod_el}</td>
          <td style="text-align:center;">{err_el}</td>
          <td style="text-align:center;">{warn_el}</td>
          <td style="text-align:center;font-size:11px;color:var(--text3);">{f['errors']+f['warnings']}</td>
        </tr>"""
    return f"""
    <div class="rules-table-wrap" style="margin-top:24px;">
      <h3 class="section-title">📁 Archivos con más issues</h3>
      <div class="table-container">
        <table class="rules-table">
          <thead><tr><th>Archivo</th><th style="text-align:center;">Errores</th><th style="text-align:center;">Warnings</th><th style="text-align:center;">Total</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>"""


# ─────────────────────────────────────────────────────────────
# HTML GENERATOR
# ─────────────────────────────────────────────────────────────

def generate_html(data: dict, repo: str, branch: str, run_id: str, build_date: str) -> str:
    total       = data["total"]
    errors      = data["total_errors"]
    warnings    = data["total_warnings"]
    fixable     = data["fixable"]
    passed      = total == 0
    messages    = data["messages"]
    top_modules = data.get("top_modules", {})

    status_cls = "si-ok" if passed else ("si-fail" if errors > 0 else "si-warn")
    status_chr = "✓" if passed else "!"

    # Cards por severidad
    error_cards   = [m for m in messages if m["severity"] == "error"]
    warning_cards = [m for m in messages if m["severity"] == "warning"]

    all_cards_html = "".join(message_card(i+1, m) for i, m in enumerate(messages))
    err_cards_html = "".join(message_card(i+1, m) for i, m in enumerate(error_cards))
    wrn_cards_html = "".join(message_card(i+1, m) for i, m in enumerate(warning_cards))

    empty = """<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           style="color:var(--green);margin-bottom:12px;"><polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <h3>Sin problemas en esta categoría</h3>
      <p>El análisis no encontró issues de este tipo.</p></div>"""

    # Sidebar módulos
    module_sidebar = ""
    if top_modules:
        module_sidebar = '<div class="sidebar-divider"></div><div class="sidebar-label">Módulos afectados</div>'
        colors = {
            "Autenticación": "#2563EB", "Asignaciones": "#D97706",
            "Malla Curricular": "#059669", "Sílabos": "#7C3AED",
            "Docentes": "#0284C7", "Librería": "#94A3B8",
        }
        for mod, cnt in top_modules.items():
            color = colors.get(mod, "#94A3B8")
            safe  = mod.replace("'", "\\'")
            module_sidebar += (
                f'<div class="sidebar-item" data-module="{mod}" onclick="filterModule(\'{safe}\')">'
                f'<span class="method-dot" style="background:{color}"></span>{mod}'
                f'<span class="sev-counter" style="background:var(--surface2);color:var(--text2);'
                f'border:1px solid var(--border);margin-left:auto;">{cnt}</span></div>'
            )

    run_link = (
        f'<div class="sidebar-item" style="cursor:default;font-size:11px;color:var(--text3);">'
        f'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        f'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>'
        f'<line x1="12" y1="16" x2="12.01" y2="16"/></svg>Run #{run_id}</div>'
    ) if run_id else ""

    tb_err  = f'<span class="tab-badge tb-{"red" if errors else "green"}">{errors}</span>'
    tb_warn = f'<span class="tab-badge tb-{"amber" if warnings else "green"}">{warnings}</span>'
    tb_all  = f'<span class="tab-badge tb-{"red" if total else "green"}">{total}</span>'

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ESLint Report — SGA Backend</title>
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

    .header {{
      position:fixed; top:0; left:0; right:0; height:var(--header-h);
      background:rgba(255,255,255,0.92); backdrop-filter:blur(12px);
      border-bottom:1px solid var(--border);
      display:flex; align-items:center; justify-content:space-between;
      padding:0 24px; z-index:1000; box-shadow:var(--shadow-sm);
    }}
    .header-left {{ display:flex; align-items:center; gap:12px; }}
    .logo-mark {{
      width:34px; height:34px; background:var(--green); border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:800; color:#fff;
      box-shadow:0 2px 8px rgba(5,150,105,.35); flex-shrink:0;
    }}
    .header-title {{ font-size:14px; font-weight:700; color:var(--slate);
                     white-space:nowrap; max-width:380px; overflow:hidden; text-overflow:ellipsis; }}
    .header-divider {{ width:1px; height:18px; background:var(--border); }}
    .header-subtitle {{ font-size:12px; color:var(--text3); }}
    .header-right {{ display:flex; align-items:center; gap:8px; }}
    .badge {{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px;
              font-size:11px; font-weight:600; font-family:var(--mono); }}
    .badge-branch {{ background:var(--purple-bg); color:var(--purple); border:1px solid var(--purple-border); }}
    .badge-ok   {{ background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }}
    .badge-ok::before {{ content:''; width:6px; height:6px; background:var(--green);
                         border-radius:50%; animation:pulse 2s infinite; }}
    .badge-fail {{ background:var(--red-bg); color:var(--red); border:1px solid var(--red-border); }}
    .badge-warn {{ background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }}
    .badge-tech {{ background:var(--blue-bg); color:var(--blue); border:1px solid var(--blue-border); font-size:10px; }}
    @keyframes pulse {{ 0%,100%{{opacity:1;transform:scale(1)}} 50%{{opacity:.5;transform:scale(.7)}} }}

    .layout {{ display:flex; padding-top:var(--header-h); min-height:100vh; }}
    .sidebar {{
      width:var(--sidebar-w); flex-shrink:0; background:var(--bg2);
      border-right:1px solid var(--border);
      position:fixed; top:var(--header-h); bottom:0; left:0;
      overflow-y:auto; padding:16px 0;
    }}
    .sidebar-label {{ padding:0 16px 6px; font-size:10px; font-weight:700;
                      letter-spacing:.08em; text-transform:uppercase; color:var(--text3); }}
    .sidebar-item {{
      display:flex; align-items:center; gap:9px; padding:7px 16px; cursor:pointer;
      font-size:13px; font-weight:500; color:var(--text2);
      border-left:2px solid transparent; transition:all .14s; margin:1px 0;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }}
    .sidebar-item:hover {{ color:var(--accent); background:var(--accent-light); border-left-color:var(--accent-mid); }}
    .sidebar-item.active {{ color:var(--accent); background:var(--accent-light); border-left-color:var(--accent); font-weight:600; }}
    .method-dot {{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }}
    .sidebar-divider {{ height:1px; background:var(--border); margin:8px 16px; }}
    .sev-counter {{ margin-left:auto; font-size:11px; font-weight:700; font-family:var(--mono);
                    padding:1px 7px; border-radius:10px; flex-shrink:0; }}
    .sc-err  {{ background:var(--red-bg);  color:var(--red);  border:1px solid var(--red-border);  }}
    .sc-warn {{ background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }}

    .search-wrap {{ padding:12px 12px 8px; }}
    .search-box {{ position:relative; }}
    .search-icon {{ position:absolute; left:10px; top:50%; transform:translateY(-50%);
                    color:var(--text3); pointer-events:none; }}
    .search-input {{
      width:100%; background:var(--bg3); border:1px solid var(--border);
      border-radius:var(--radius-sm); padding:8px 12px 8px 32px;
      font-size:12px; color:var(--text); font-family:var(--font);
      outline:none; transition:border-color .15s, box-shadow .15s;
    }}
    .search-input:focus {{ border-color:var(--accent); box-shadow:0 0 0 3px rgba(37,99,235,.12); }}
    .search-input::placeholder {{ color:var(--text3); }}

    .main {{ flex:1; margin-left:var(--sidebar-w); }}
    .hero {{
      background:var(--bg2); border-bottom:1px solid var(--border);
      padding:40px 48px 36px; position:relative; overflow:hidden;
    }}
    .hero::after {{
      content:''; position:absolute; top:0; right:0; bottom:0; width:340px;
      background:linear-gradient(135deg, var(--green-bg) 0%, transparent 70%);
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
    .hero h1 em {{ font-style:normal; color:var(--green); }}
    .hero-sub {{ font-size:14px; color:var(--text2); line-height:1.65; max-width:560px; margin-bottom:24px; }}
    .hero-pills {{ display:flex; flex-wrap:wrap; gap:8px; }}
    .hero-pill {{ display:inline-flex; align-items:center; gap:5px; padding:4px 12px;
                  border-radius:6px; font-size:11px; font-weight:500; color:var(--text2);
                  background:var(--bg3); border:1px solid var(--border); }}

    .status-banner {{
      display:flex; align-items:center; gap:14px; margin:0 48px;
      padding:14px 20px; border-radius:var(--radius); border:1px solid var(--border);
      background:var(--bg2); transform:translateY(20px); box-shadow:var(--shadow-sm);
    }}
    .status-icon {{ width:36px; height:36px; border-radius:50%; display:flex; align-items:center;
                    justify-content:center; font-size:15px; font-weight:800; flex-shrink:0; }}
    .si-ok   {{ background:var(--green-bg); color:var(--green); border:2px solid var(--green-border); }}
    .si-fail {{ background:var(--red-bg);   color:var(--red);   border:2px solid var(--red-border);   }}
    .si-warn {{ background:var(--amber-bg); color:var(--amber); border:2px solid var(--amber-border); }}
    .status-text h2 {{ font-size:14px; font-weight:700; color:var(--slate); margin-bottom:1px; }}
    .status-text p  {{ font-size:12px; color:var(--text3); }}
    .status-meta {{ margin-left:auto; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }}

    .stats {{ display:grid; grid-template-columns:repeat(5,1fr);
              border-bottom:1px solid var(--border); background:var(--bg2); margin-top:28px; }}
    .stat-item {{ padding:18px 20px; display:flex; flex-direction:column; gap:3px;
                  border-right:1px solid var(--border); }}
    .stat-item:last-child {{ border-right:none; }}
    .stat-value {{ font-size:24px; font-weight:800; font-family:var(--mono);
                   line-height:1; letter-spacing:-1px; color:var(--slate); }}
    .c-accent {{ color:var(--accent); }} .c-red {{ color:var(--red); }}
    .c-amber {{ color:var(--amber); }}  .c-green {{ color:var(--green); }}
    .c-blue {{ color:var(--blue); }}
    .stat-label {{ font-size:10px; color:var(--text3); font-weight:600;
                   text-transform:uppercase; letter-spacing:.06em; }}

    .tabs-bar {{
      display:flex; gap:4px; padding:20px 48px 0;
      border-bottom:1px solid var(--border); background:var(--bg2);
    }}
    .tab-btn {{
      padding:10px 20px; border-radius:var(--radius-sm) var(--radius-sm) 0 0;
      font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font);
      border:1px solid transparent; background:transparent; color:var(--text3);
      transition:all .14s; border-bottom:none; position:relative; bottom:-1px;
    }}
    .tab-btn:hover {{ color:var(--text2); background:var(--bg3); }}
    .tab-btn.active {{ color:var(--accent); background:var(--bg2);
                       border-color:var(--border); border-bottom-color:var(--bg2); }}
    .tab-badge {{
      display:inline-flex; align-items:center; justify-content:center;
      width:18px; height:18px; border-radius:50%; font-size:10px; font-weight:700;
      margin-left:6px; font-family:var(--mono);
    }}
    .tb-red   {{ background:var(--red-bg);   color:var(--red);   }}
    .tb-amber {{ background:var(--amber-bg); color:var(--amber); }}
    .tb-green {{ background:var(--green-bg); color:var(--green); }}

    .content {{ padding:32px 48px 64px; }}
    .tab-panel {{ display:none; }} .tab-panel.active {{ display:block; }}
    .toolbar {{ display:flex; align-items:center; gap:10px; margin-bottom:20px; flex-wrap:wrap; }}
    .toolbar-label {{ font-size:13px; font-weight:600; color:var(--text2); margin-right:4px; }}
    .filter-btn {{
      padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600;
      cursor:pointer; border:1px solid var(--border); background:var(--bg2);
      color:var(--text2); transition:all .14s; font-family:var(--font);
    }}
    .filter-btn:hover {{ border-color:var(--border2); background:var(--bg3); }}
    .filter-btn.active {{ border-color:var(--accent); background:var(--accent-light); color:var(--accent); }}
    .fb-error.active   {{ border-color:var(--red);   background:var(--red-bg);   color:var(--red);   }}
    .fb-warning.active {{ border-color:var(--amber); background:var(--amber-bg); color:var(--amber); }}

    .findings-list {{ display:flex; flex-direction:column; gap:8px; }}
    .finding-card {{
      background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius);
      padding:14px 18px; box-shadow:var(--shadow-sm);
      border-left:4px solid var(--border2); transition:box-shadow .15s;
    }}
    .finding-card:hover {{ box-shadow:var(--shadow); }}
    .sev-card-error   {{ border-left-color:var(--red);   }}
    .sev-card-warning {{ border-left-color:var(--amber); }}
    .finding-header {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }}
    .finding-meta   {{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; }}
    .finding-idx    {{ font-size:11px; color:var(--text4); font-family:var(--mono); }}
    .finding-title  {{ font-size:13px; color:var(--slate); line-height:1.5; }}
    .finding-loc {{
      display:inline-flex; align-items:center; gap:5px; margin-top:6px;
      font-size:11px; font-family:var(--mono); color:var(--accent);
      background:var(--accent-light); border:1px solid var(--accent-mid);
      padding:2px 8px; border-radius:5px;
    }}
    .sev-badge {{ display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px;
                  font-size:10px; font-weight:700; font-family:var(--mono); border:1px solid; }}
    .rule-id {{ font-size:10px; font-family:var(--mono); color:var(--text3);
                background:var(--bg3); border:1px solid var(--border); padding:1px 6px; border-radius:4px; }}
    .module-badge {{ font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
                     background:var(--purple-bg); color:var(--purple);
                     border:1px solid var(--purple-border); font-family:var(--mono); }}
    .fix-badge {{ font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
                  background:var(--green-bg); color:var(--green);
                  border:1px solid var(--green-border); font-family:var(--mono); }}
    .cat-badge {{ font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px; font-family:var(--mono); }}
    .cat-security {{ background:var(--red-bg); color:var(--red); border:1px solid var(--red-border); }}
    .cat-typescript {{ background:var(--blue-bg); color:var(--blue); border:1px solid var(--blue-border); }}
    .cat-quality {{ background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-border); }}
    .cat-style {{ background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }}
    .cat-other {{ background:var(--bg3); color:var(--text3); border:1px solid var(--border); }}

    .section-title {{ font-size:14px; font-weight:800; color:var(--slate);
                      margin:0 0 14px; text-transform:uppercase; letter-spacing:.5px; }}
    .rules-table-wrap {{ background:var(--bg2); border:1px solid var(--border);
                         border-radius:var(--radius); padding:20px; box-shadow:var(--shadow-sm); }}
    .table-container {{ overflow-x:auto; }}
    .rules-table {{ width:100%; border-collapse:collapse; }}
    .rules-table th {{ background:var(--bg3); color:var(--text3); font-size:10px; font-weight:700;
                       padding:8px 14px; border-bottom:1px solid var(--border);
                       text-transform:uppercase; letter-spacing:.04em; text-align:left; }}
    .rules-table td {{ padding:10px 14px; border-bottom:1px solid var(--bg3);
                       font-size:13px; color:var(--text); }}
    .rules-table tr:last-child td {{ border-bottom:none; }}
    .rules-table tr:hover td {{ background:var(--bg3); }}

    .empty-state {{ display:flex; flex-direction:column; align-items:center;
                    padding:64px 24px; text-align:center; }}
    .empty-state h3 {{ font-size:17px; font-weight:700; color:var(--slate); margin-bottom:8px; }}
    .empty-state p  {{ font-size:14px; color:var(--text3); }}

    .footer {{ background:var(--bg2); border-top:1px solid var(--border);
               padding:18px 48px; display:flex; align-items:center;
               justify-content:space-between; font-size:11px; color:var(--text3); }}
    .footer a {{ color:var(--text3); text-decoration:none; }}
    .footer a:hover {{ color:var(--accent); }}

    @media (max-width:900px) {{
      :root {{ --sidebar-w:0px; }} .sidebar {{ display:none; }}
      .hero,.content,.footer,.tabs-bar {{ padding-left:20px; padding-right:20px; }}
      .status-banner {{ margin:0 20px; }} .stats {{ grid-template-columns:repeat(3,1fr); }}
    }}
  </style>
</head>
<body>

  <header class="header">
    <div class="header-left">
      <div class="logo-mark">SGA</div>
      <span class="header-title">{repo}</span>
      <div class="header-divider" style="width:1px;height:18px;background:var(--border);"></div>
      <span class="header-subtitle">ESLint Report</span>
    </div>
    <div class="header-right">
      <span class="badge badge-tech">TypeScript · ESLint</span>
      <span class="badge badge-branch">⎇ {branch}</span>
      {'<span class="badge badge-ok">Passed</span>' if passed else ('<span class="badge badge-fail">Failed</span>' if errors > 0 else '<span class="badge badge-warn">Warnings</span>')}
    </div>
  </header>

  <div class="layout">

    <aside class="sidebar">
      <div class="search-wrap">
        <div class="search-box">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" type="text" id="searchInput" placeholder="Buscar issues..."/>
        </div>
      </div>
      <div class="sidebar-label" style="margin-top:8px;">Tipo</div>
      <div class="sidebar-item active" data-sev="all" onclick="filterSidebar('all')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Todos <span class="sev-counter" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);">{total}</span>
      </div>
      <div class="sidebar-item" data-sev="error" onclick="filterSidebar('error')">
        <span class="method-dot" style="background:var(--red)"></span>Errores
        <span class="sev-counter sc-err">{errors}</span>
      </div>
      <div class="sidebar-item" data-sev="warning" onclick="filterSidebar('warning')">
        <span class="method-dot" style="background:var(--amber)"></span>Warnings
        <span class="sev-counter sc-warn">{warnings}</span>
      </div>
      {module_sidebar}
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

    <main class="main">
      <section class="hero">
        <div class="hero-eyebrow">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          ESLint · Linting & Code Quality
        </div>
        <h1>Lint <em>Report</em></h1>
        <p class="hero-sub">
          Análisis estático de calidad de código sobre <strong>SGA-BACKEND</strong> —
          Azure Functions + TypeScript + Drizzle ORM.
          Detecta errores, warnings, problemas de tipo y malas prácticas.
          {f'<strong>{fixable}</strong> issues tienen autofix disponible.' if fixable > 0 else ''}
        </p>
        <div class="hero-pills">
          <span class="hero-pill">⚡ ESLint</span>
          <span class="hero-pill">TypeScript</span>
          <span class="hero-pill">Azure Functions</span>
          <span class="hero-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {build_date}
          </span>
        </div>
      </section>

      <div class="status-banner">
        <div class="status-icon {status_cls}">{status_chr}</div>
        <div class="status-text">
          <h2>{'Sin problemas detectados' if passed else f'{errors} error{"es" if errors != 1 else ""} · {warnings} warning{"s" if warnings != 1 else ""}'}</h2>
          <p>{'El código cumple con todas las reglas ESLint configuradas.' if passed else f'{fixable} issues tienen autofix disponible con npx eslint --fix'}</p>
        </div>
        <div class="status-meta">
          {'<span class="badge badge-ok">✓ Clean</span>' if passed else ('<span class="badge badge-fail">✗ Errors</span>' if errors > 0 else '<span class="badge badge-warn">⚠ Warnings</span>')}
        </div>
      </div>

      <div class="stats">
        <div class="stat-item"><span class="stat-value c-accent">{total}</span><span class="stat-label">Total</span></div>
        <div class="stat-item"><span class="stat-value c-red">{errors}</span><span class="stat-label">Errores</span></div>
        <div class="stat-item"><span class="stat-value c-amber">{warnings}</span><span class="stat-label">Warnings</span></div>
        <div class="stat-item"><span class="stat-value c-green">{fixable}</span><span class="stat-label">Autofix</span></div>
        <div class="stat-item"><span class="stat-value c-blue">{len(data['files'])}</span><span class="stat-label">Archivos</span></div>
      </div>

      <div class="tabs-bar">
        <button class="tab-btn active" data-tab="all"      onclick="switchTab('all')">🔍 Todos {tb_all}</button>
        <button class="tab-btn"        data-tab="errors"   onclick="switchTab('errors')">🔴 Errores {tb_err}</button>
        <button class="tab-btn"        data-tab="warnings" onclick="switchTab('warnings')">🟠 Warnings {tb_warn}</button>
        <button class="tab-btn"        data-tab="summary"  onclick="switchTab('summary')">📊 Resumen</button>
      </div>

      <div class="content">

        <div id="panel-all" class="tab-panel active">
          <div class="toolbar">
            <span class="toolbar-label">Filtrar:</span>
            <button class="filter-btn active" data-sev="all"     onclick="filterBySev(this,'all')">Todos ({total})</button>
            <button class="filter-btn fb-error"   data-sev="error"   onclick="filterBySev(this,'error')">Errores ({errors})</button>
            <button class="filter-btn fb-warning" data-sev="warning" onclick="filterBySev(this,'warning')">Warnings ({warnings})</button>
          </div>
          <div class="findings-list">{all_cards_html or empty}</div>
        </div>

        <div id="panel-errors" class="tab-panel">
          <div class="findings-list">{err_cards_html or empty}</div>
        </div>

        <div id="panel-warnings" class="tab-panel">
          <div class="findings-list">{wrn_cards_html or empty}</div>
        </div>

        <div id="panel-summary" class="tab-panel">
          {rules_table(data['top_rules'])}
          {files_summary(data['files'])}
        </div>

      </div>

      <footer class="footer">
        <span>{repo} · {build_date}</span>
        <span>Powered by <a href="https://eslint.org" target="_blank">ESLint</a></span>
      </footer>
    </main>
  </div>

  <script>
    let _activeSev = 'all';

    function switchTab(tabId) {{
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="' + tabId + '"]').classList.add('active');
      document.getElementById('panel-' + tabId).classList.add('active');
    }}

    function filterBySev(btn, sev) {{
      _activeSev = sev;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    }}

    function filterSidebar(sev) {{
      _activeSev = sev;
      document.querySelectorAll('.sidebar-item[data-sev]').forEach(el => {{
        el.classList.toggle('active', el.dataset.sev === sev);
      }});
      document.querySelectorAll('.filter-btn').forEach(b => {{
        b.classList.toggle('active', b.dataset.sev === sev);
      }});
      applyFilter();
    }}

    function filterModule(mod) {{
      document.querySelectorAll('.sidebar-item[data-sev]').forEach(el => el.classList.remove('active'));
      const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
      document.querySelectorAll('.finding-card').forEach(function(card) {{
        const cardMod = card.dataset.module;
        const txt = card.textContent.toLowerCase();
        const modOk = cardMod === mod;
        const txtOk = !q || txt.includes(q);
        card.style.display = (modOk && txtOk) ? '' : 'none';
      }});
    }}

    function applyFilter() {{
      const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
      document.querySelectorAll('.finding-card').forEach(function(card) {{
        const sev = card.dataset.severity;
        const txt = card.textContent.toLowerCase();
        const sevOk = _activeSev === 'all' || sev === _activeSev;
        const txtOk = !q || txt.includes(q);
        card.style.display = (sevOk && txtOk) ? '' : 'none';
      }});
    }}

    document.addEventListener('DOMContentLoaded', function() {{
      const si = document.getElementById('searchInput');
      if (si) si.addEventListener('input', applyFilter);
    }});
  </script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Genera página HTML de reporte ESLint — SGA Backend")
    parser.add_argument("eslint_json", help="Archivo eslint-results.json")
    parser.add_argument("output_dir",  help="Directorio de salida para index.html")
    parser.add_argument("--repo",     default="TALLER-PROYECTOS-2026-I/SGA_BACKEND")
    parser.add_argument("--branch",   default="dev")
    parser.add_argument("--run-id",   default="")
    args = parser.parse_args()

    json_path  = Path(args.eslint_json)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    data = parse_eslint(json_path)
    print(f"✨ Errores: {data['total_errors']}  Warnings: {data['total_warnings']}  "
          f"Archivos: {len(data['files'])}  Autofix: {data['fixable']}")

    build_date = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")

    html = generate_html(
        data       = data,
        repo       = args.repo,
        branch     = args.branch,
        run_id     = args.run_id,
        build_date = build_date,
    )

    out = output_dir / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"✅ Reporte guardado: {out}")


if __name__ == "__main__":
    main()
