"""Server-rendered pages for the web UI (Dashboard)"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.analytics_service import AnalyticsService

router = APIRouter(tags=["pages"])

# Templates directory inside backend
templates = Jinja2Templates(directory="backend/templates")


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request, db: Session = Depends(get_db)):
    """
    Render the dashboard page with:
    - Top statistics (total creds, total domains, admin count, recent scans)
    - Top domains table with admin count, first/last seen, total occurrences
    """
    stats = AnalyticsService.get_dashboard_stats(db)
    top_domains = AnalyticsService.get_top_domains(db, limit=10)
    recent_scans = AnalyticsService.get_recent_scans(db, limit=10)

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "stats": stats,
            "top_domains": top_domains,
            "recent_scans": recent_scans
        }
    )

@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    """
    Render the settings page to configure:
    - IntelX API key
    - Notification provider (none/teams/slack/telegram)
    - Teams webhook URL
    - Slack webhook URL
    - Telegram bot token and chat id
    Secrets are not displayed; users can set/overwrite them.
    """
    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request
        }
    )

@router.get("/scan-intelx", response_class=HTMLResponse)
def scan_intelx_page(request: Request):
    """Render IntelX scan form page"""
    return templates.TemplateResponse(
        "scan_intelx.html",
        {
            "request": request
        }
    )


@router.get("/scan-file", response_class=HTMLResponse)
def scan_file_page(request: Request):
    """Render File scan form page"""
    return templates.TemplateResponse(
        "scan_file.html",
        {
            "request": request
        }
    )

@router.get("/scan", response_class=HTMLResponse)
def scan_page(request: Request):
    """Render unified New Scan page with name, query, advanced options, and live status"""
    return templates.TemplateResponse(
        "scan.html",
        {
            "request": request
        }
    )

@router.get("/results", response_class=HTMLResponse)
def results_page(request: Request):
    """
    Render a Results explorer page with filters:
    - job_id (optional): view credentials for a specific job
    - domain (optional)
    - admin_only (toggle)
    - search (URL/username contains)
    - date range: from_date (first_seen >=), to_date (last_seen <=)
    - pagination controls
    """
    html = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Results • IntelX Scanner</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { --bg:#0f172a; --panel:#111827; --card:#1f2937; --text:#e5e7eb; --muted:#9ca3af; --brand:#3b82f6; --accent:#22c55e; --warning:#f59e0b; --danger:#ef4444; --border:#374151; --input:#0b1220; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Arial; background: linear-gradient(180deg,#0b1220 0%,#0f172a 100%); color: var(--text); }
    header { background: linear-gradient(90deg,#0ea5e9,#3b82f6); padding: 18px 24px; color: white; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    header h1 { margin: 0; font-size: 20px; letter-spacing: 0.3px; }
    header .meta { font-size: 12px; opacity: .9; margin-top: 6px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .nav { margin-bottom: 16px; }
    .nav a { color: #93c5fd; text-decoration: none; margin-right: 10px; }
    .nav a:hover { text-decoration: underline; }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .section-title { margin: 0 0 12px 0; font-size: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .row { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; align-items: center; margin-bottom: 12px; }
    label { color: var(--muted); font-size: 13px; }
    input, select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--input); color: var(--text); font-size: 14px; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn { padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 14px; }
    .btn.primary { background: var(--brand); border-color: #1e40af; }
    .msg { margin-top: 10px; font-size: 13px; display: none; }
    .msg.ok { color: var(--accent); }
    .msg.err { color: var(--danger); }
    .table-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { text-align: left; color: var(--muted); font-weight: 600; }
    tr:hover td { background: rgba(255,255,255,0.03); }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid var(--border); font-size:12px; }
    .badge.ok { border-color: rgba(34,197,94,.35); color: var(--accent); }
    .badge.admin { border-color: rgba(239,68,68,.35); color: var(--danger); }
    .pagination { display:flex; gap:8px; align-items:center; margin-top: 12px; }
    .pill { padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: 12px; color: var(--muted); }
    .small { font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>
  <header>
    <h1>Results Explorer</h1>
    <div class="meta">Filter by job, domain, user, password, and date; view all credentials</div>
  </header>

  <div class="container">
    <div class="nav">
      <a href="/dashboard">&#8592; Back to Dashboard</a>
      <a href="/scan">New Scan</a>
      <a href="/settings">Settings</a>
    </div>

    <div class="panel">
      <h2 class="section-title">Filters</h2>
      <div class="grid">
        <div>
          <div class="row"><label>Job ID</label><div><input id="job_id" type="text" placeholder="optional job id (UUID)" /></div></div>
          <div class="row"><label>Domain</label><div><input id="domain" type="text" placeholder="e.g., acmecorp.com" /></div></div>
          <div class="row"><label>Search (URL/User)</label><div><input id="search" type="text" placeholder="substring in URL or username" /></div></div>
        </div>
        <div>
          <div class="row"><label>Admin Only</label><div><select id="admin_only"><option value="false">No</option><option value="true">Yes</option></select></div></div>
          <div class="row"><label>From Date</label><div><input id="from_date" type="datetime-local" /></div></div>
          <div class="row"><label>To Date</label><div><input id="to_date" type="datetime-local" /></div></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" id="apply_btn">Apply Filters</button>
        <button class="btn" id="reset_btn">Reset</button>
        <span class="pill" id="count_pill">0 items</span>
      </div>
      <div class="msg" id="msg_box"></div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Username</th>
              <th>Password</th>
              <th>Domain</th>
              <th>Admin</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Seen Count</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn" id="prev_btn">&#8592; Prev</button>
        <span class="pill" id="page_pill">Page 1</span>
        <button class="btn" id="next_btn">Next &#8594;</button>
        <span class="small" id="total_pill"></span>
      </div>
    </div>
  </div>

  <script>
    const msg = document.getElementById('msg_box');
    const tbody = document.getElementById('tbody');
    const pagePill = document.getElementById('page_pill');
    const totalPill = document.getElementById('total_pill');
    const countPill = document.getElementById('count_pill');

    let page = 1;
    let page_size = 50;

    function showMsg(text, ok=true) {
      msg.textContent = text;
      msg.className = 'msg ' + (ok ? 'ok' : 'err');
      msg.style.display = 'block';
    }

    function clearMsg() { msg.style.display = 'none'; }

    function formatDate(s) {
      if (!s) return '—';
      try { return new Date(s).toLocaleString(); } catch { return s; }
    }

    function getParams() {
      const params = new URLSearchParams(window.location.search);
      return {
        job_id: params.get('job_id') || '',
        domain: params.get('domain') || '',
        search: params.get('search') || '',
        admin_only: params.get('admin_only') === 'true',
        from_date: params.get('from_date') || '',
        to_date: params.get('to_date') || ''
      };
    }

    function setFiltersFromURL() {
      const p = getParams();
      document.getElementById('job_id').value = p.job_id;
      document.getElementById('domain').value = p.domain;
      document.getElementById('search').value = p.search;
      document.getElementById('admin_only').value = p.admin_only ? 'true' : 'false';
      if (p.from_date) document.getElementById('from_date').value = p.from_date.replace(' ', 'T');
      if (p.to_date) document.getElementById('to_date').value = p.to_date.replace(' ', 'T');
    }

    function buildAPI() {
      const job_id = document.getElementById('job_id').value.trim();
      const domain = document.getElementById('domain').value.trim();
      const search = document.getElementById('search').value.trim();
      const admin_only = document.getElementById('admin_only').value === 'true';
      const from_date = document.getElementById('from_date').value;
      const to_date = document.getElementById('to_date').value;

      const base = job_id ? ('/api/results/job/' + job_id) : '/api/results';
      const qs = new URLSearchParams();
      if (domain) qs.append('domain', domain);
      if (search) qs.append('search', search);
      if (admin_only) qs.append('admin_only', 'true');
      if (from_date) qs.append('from_date', from_date);
      if (to_date) qs.append('to_date', to_date);
      qs.append('page', page);
      qs.append('page_size', page_size);

      return base + '?' + qs.toString();
    }

    async function loadResults() {
      clearMsg();
      tbody.innerHTML = '';
      try {
        const url = buildAPI();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        const items = data.items || data.items;
        countPill.textContent = (items ? items.length : 0) + ' items';
        pagePill.textContent = 'Page ' + (data.page || page);
        totalPill.textContent = 'Total: ' + (data.total || 0) + ' • Pages: ' + (data.total_pages || 1);

        (items || []).forEach((c) => {
          const tr = document.createElement('tr');
          const admin = c.is_admin ? '<span class="badge admin">Admin</span>' : '<span class="badge ok">OK</span>';
          tr.innerHTML = `
            <td title="${c.url}"><a href="${c.url}" target="_blank">${c.url}</a></td>
            <td>${c.username}</td>
            <td>${c.password}</td>
            <td>${c.domain}</td>
            <td>${admin}</td>
            <td>${formatDate(c.first_seen)}</td>
            <td>${formatDate(c.last_seen)}</td>
            <td>${c.seen_count || 0}</td>
          `;
          tbody.appendChild(tr);
        });

      } catch (e) {
        showMsg('Error loading results: ' + e.message, false);
      }
    }

    document.getElementById('apply_btn').addEventListener('click', (e) => { e.preventDefault(); page = 1; loadResults(); });
    document.getElementById('reset_btn').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('job_id').value = '';
      document.getElementById('domain').value = '';
      document.getElementById('search').value = '';
      document.getElementById('admin_only').value = 'false';
      document.getElementById('from_date').value = '';
      document.getElementById('to_date').value = '';
      page = 1;
      loadResults();
    });
    document.getElementById('prev_btn').addEventListener('click', (e) => { e.preventDefault(); if (page > 1) { page--; loadResults(); } });
    document.getElementById('next_btn').addEventListener('click', (e) => { e.preventDefault(); page++; loadResults(); });

    setFiltersFromURL();
    loadResults();
  </script>
</body>
</html>
    """
    return HTMLResponse(content=html, status_code=200)