(function() {
  const PAGE_TITLES = {
    calendario: 'Calend&aacute;rio',
    tarefas: 'Tarefas',
    comunicados: 'Comunicados',
    admissoes: 'Admiss&otilde;es',
    reclamacoes: 'Reclama&ccedil;&otilde;es de Horas',
    escalas: 'Escalas',
    definicoes: 'Defini&ccedil;&otilde;es',
    utilizadores: 'Utilizadores',
    'gerir-calendarios': 'Gerir Calend&aacute;rios',
    auditoria: 'Auditoria',
  };

  function getModules(group) {
    if (typeof window.getAppModules !== 'function') return [];
    return window.getAppModules({ group, forNav: true, profile: window.userProfile });
  }

  window.escritorioAtivo = function() {
    if (window.isAdmin && window.isAdmin()) {
      const saved = sessionStorage.getItem('filtroEscritorio') || 'todos';
      if (saved === 'todos') return saved;
      if (window.escritorioExiste && window.escritorioExiste(saved)) return saved;
      return 'todos';
    }

    if (window.userProfile && window.userProfile.escritorio) return window.userProfile.escritorio;
    if (window.getEscritorioDefault) {
      const fallback = window.getEscritorioDefault();
      return fallback ? fallback.id : '';
    }
    return '';
  };

  window.bootProtectedPage = function(options, onReady) {
    const cfg = options || {};

    document.addEventListener('authReady', function handleProtectedPage(event) {
      const detail = event && event.detail ? event.detail : {};
      const profile = detail.profile || window.userProfile || null;
      const isAdmin = window.isAdmin ? window.isAdmin() : false;

      if (cfg.moduleId && typeof window.userCanAccessModule === 'function' && !window.userCanAccessModule(cfg.moduleId, profile)) {
        if (typeof cfg.onDenied === 'function') {
          cfg.onDenied({ user: detail.user || window.currentUser || null, profile, isAdmin, escritorio: '' });
        } else {
          window.location.href = cfg.redirectTo || 'dashboard.html';
        }
        return;
      }

      if (cfg.requireAdmin && !isAdmin) {
        if (typeof cfg.onDenied === 'function') {
          cfg.onDenied({ user: detail.user || window.currentUser || null, profile, isAdmin, escritorio: '' });
        } else {
          window.location.href = cfg.redirectTo || 'dashboard.html';
        }
        return;
      }

      if (cfg.renderNavbar !== false && cfg.activePage) {
        window.renderNavbar(cfg.activePage);
      }

      const context = {
        user: detail.user || window.currentUser || null,
        profile,
        isAdmin,
        escritorio: window.escritorioAtivo(),
        moduleId: cfg.moduleId || cfg.activePage || '',
      };

      if (typeof onReady === 'function') onReady(context);
    }, { once: true });
  };

  window.renderNavbar = function(activePage) {
    if (activePage === 'dashboard') return;

    const profile = window.userProfile;
    const isAdmin = window.isAdmin ? window.isAdmin() : false;
    const nome = profile ? (profile.nomeCompleto || profile.nome || profile.email || '') : '';
    const role = isAdmin ? 'Admin' : 'Colaborador';
    const roleClass = isAdmin ? 'admin' : 'colab';

    if (!document.getElementById('miniHeaderStyle')) {
      const style = document.createElement('style');
      style.id = 'miniHeaderStyle';
      style.textContent = `
        .mini-header { background:#fff; border-bottom:1px solid #e2e2e8; font-family:'DM Mono',monospace; height:46px; display:flex; align-items:stretch; position:sticky; top:0; z-index:500; transition:background .2s,border-color .2s; }
        html.dark .mini-header { background:#18181f; border-bottom-color:#2c2c3e; }
        .mini-header-inner { width:100%; margin:0 auto; padding:0 20px; display:flex; align-items:center; gap:8px; }
        .mini-header-back { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border:1px solid #e2e2e8; border-radius:8px; font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:#8888a0; text-decoration:none; font-family:'DM Mono',monospace; background:#f7f7f9; transition:all .15s; white-space:nowrap; }
        html.dark .mini-header-back { border-color:#2c2c3e; background:#222230; color:#6868a0; }
        .mini-header-back:hover { border-color:#2563eb; color:#2563eb; background:#eff6ff; }
        html.dark .mini-header-back:hover { background:#0c1a30; }
        .mini-header-back svg { width:11px; height:11px; }
        .mini-header-title { font-family:'Manrope',sans-serif; font-weight:800; font-size:13px; letter-spacing:-.02em; color:#1a1a22; flex:1; }
        html.dark .mini-header-title { color:#e4e4f0; }
        .mini-header-user { font-size:10px; color:#8888a0; white-space:nowrap; }
        html.dark .mini-header-user { color:#6868a0; }
        .mini-header-role { font-size:9px; text-transform:uppercase; letter-spacing:.07em; padding:2px 8px; border-radius:10px; font-weight:500; white-space:nowrap; }
        .mini-header-role.admin  { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
        .mini-header-role.colab  { background:#f4f4f6; color:#8888a0; border:1px solid #e2e2e8; }
        html.dark .mini-header-role.admin { background:#0c1a30; color:#4f8eff; border-color:#1a3060; }
        html.dark .mini-header-role.colab { background:#222230; color:#6868a0; border-color:#2c2c3e; }
        .mini-header-logout { display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border:1px solid #e2e2e8; background:none; font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:#8888a0; border-radius:8px; cursor:pointer; transition:all .15s; }
        html.dark .mini-header-logout { border-color:#2c2c3e; color:#6868a0; }
        .mini-header-logout:hover { border-color:#dc2626; color:#dc2626; }
        .mini-header-logout svg { width:11px; height:11px; }
        .mini-nav-wrap { position:relative; }
        .mini-nav-btn { display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border:1px solid #e2e2e8; border-radius:8px; font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:#8888a0; background:#f7f7f9; cursor:pointer; transition:all .15s; white-space:nowrap; }
        html.dark .mini-nav-btn { border-color:#2c2c3e; background:#222230; color:#6868a0; }
        .mini-nav-btn:hover,.mini-nav-btn.open { border-color:#2563eb; color:#2563eb; background:#eff6ff; }
        html.dark .mini-nav-btn:hover, html.dark .mini-nav-btn.open { border-color:#4f8eff; color:#4f8eff; background:#0c1a30; }
        .mini-nav-btn svg { width:10px; height:10px; transition:transform .15s; }
        .mini-nav-btn.open svg { transform:rotate(180deg); }
        .mini-nav-drop { display:none; position:absolute; top:calc(100% + 6px); left:0; background:#fff; border:1px solid #e2e2e8; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,.12); min-width:180px; padding:6px; z-index:600; }
        html.dark .mini-nav-drop { background:#18181f; border-color:#2c2c3e; box-shadow:0 8px 32px rgba(0,0,0,.5); }
        .mini-nav-drop.open { display:block; animation:navDropIn .15s ease; }
        @keyframes navDropIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .mini-nav-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#8888a0; text-decoration:none; transition:all .12s; cursor:pointer; }
        html.dark .mini-nav-item { color:#6868a0; }
        .mini-nav-item:hover { background:#f7f7f9; color:#1a1a22; }
        html.dark .mini-nav-item:hover { background:#222230; color:#e4e4f0; }
        .mini-nav-item.active { background:#eff6ff; color:#2563eb; }
        html.dark .mini-nav-item.active { background:#0c1a30; color:#4f8eff; }
        .mini-nav-item svg { width:11px; height:11px; flex-shrink:0; }
        .mini-nav-sep { height:1px; background:#e2e2e8; margin:4px 0; }
        html.dark .mini-nav-sep { background:#2c2c3e; }
        .mini-dark-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:1px solid #e2e2e8; border-radius:8px; background:#f7f7f9; cursor:pointer; font-size:13px; transition:all .15s; flex-shrink:0; }
        html.dark .mini-dark-btn { border-color:#2c2c3e; background:#222230; }
        .mini-dark-btn:hover { border-color:#2563eb; background:#eff6ff; }
        html.dark .mini-dark-btn:hover { border-color:#4f8eff; background:#0c1a30; }
        @media(max-width:640px) { .mini-header-user { display:none; } .mini-header-role { display:none; } .mini-header-title { font-size:12px; } }
        @media(max-width:480px) { .mini-nav-btn span { display:none; } .mini-nav-btn { padding:5px 8px; } }
      `;
      document.head.appendChild(style);
    }

    const titulo = PAGE_TITLES[activePage] || activePage;
    const navModules = getModules('main');
    const adminModules = isAdmin ? getModules('admin') : [];

    const navItemsHtml = navModules.map(m => `
      <a class="mini-nav-item${activePage === m.id ? ' active' : ''}" href="${m.href}">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${m.icon}</svg>
        ${m.label}
      </a>
    `).join('');

    const adminNavItemsHtml = isAdmin && adminModules.length ? `
      <div class="mini-nav-sep"></div>
      ${adminModules.map(m => `
        <a class="mini-nav-item${activePage === m.id ? ' active' : ''}" href="${m.href}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${m.icon}</svg>
          ${m.label}
        </a>
      `).join('')}
    ` : '';

    const isDark = document.documentElement.classList.contains('dark');
    const pageEl = document.querySelector('.page');
    const pgMaxWidth = pageEl ? window.getComputedStyle(pageEl).maxWidth : 'none';

    const existing = document.querySelector('.mini-header');
    if (existing) existing.remove();

    const header = document.createElement('div');
    header.className = 'mini-header';
    header.innerHTML = `
      <div class="mini-header-inner" style="max-width:${pgMaxWidth}">
        <a href="dashboard.html" class="mini-header-back">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 12L6 8l4-4"/></svg>
          Dashboard
        </a>
        <div class="mini-header-title">${titulo}</div>
        <div class="mini-nav-wrap">
          <button class="mini-nav-btn" id="miniNavBtn" onclick="window._toggleMiniNav(event)">
            <span>M&oacute;dulos</span>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6l4 4 4-4"/></svg>
          </button>
          <div class="mini-nav-drop" id="miniNavDrop">
            ${navItemsHtml}${adminNavItemsHtml}
          </div>
        </div>
        <button class="mini-dark-btn" onclick="window.toggleDarkMode()" title="Alternar modo escuro">
          <span class="dark-toggle-icon">${isDark ? '☀️' : '🌙'}</span>
        </button>
        <span class="mini-header-user">${window.escHtml ? window.escHtml(nome) : nome}</span>
        <span class="mini-header-role ${roleClass}">${role}</span>
        <button class="mini-header-logout" onclick="window.logout()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/></svg>
          Sair
        </button>
      </div>
    `;

    window._toggleMiniNav = function(e) {
      e.stopPropagation();
      const btn = document.getElementById('miniNavBtn');
      const drop = document.getElementById('miniNavDrop');
      if (btn) btn.classList.toggle('open');
      if (drop) drop.classList.toggle('open');
    };

    document.body.insertBefore(header, document.body.firstChild);
  };

  document.addEventListener('click', function() {
    const btn = document.getElementById('miniNavBtn');
    const drop = document.getElementById('miniNavDrop');
    if (btn) btn.classList.remove('open');
    if (drop) drop.classList.remove('open');
  }, { capture: true, passive: true });
})();
