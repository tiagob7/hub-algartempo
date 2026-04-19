(function() {
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    calendario: 'Calend&aacute;rio',
    tarefas: 'Tarefas',
    comunicados: 'Comunicados',
    admissoes: 'Admiss&otilde;es',
    reclamacoes: 'Reclama&ccedil;&otilde;es de Horas',
    escalas: 'Escalas',
    clientes: 'Clientes',
    definicoes: 'Defini&ccedil;&otilde;es',
    utilizadores: 'Utilizadores',
    'gerir-calendarios': 'Gerir Calend&aacute;rios',
    auditoria: 'Auditoria',
  };

  const DASHBOARD_LINK = {
    id: 'dashboard',
    label: 'Dashboard',
    href: 'dashboard.html',
    icon: '<rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/>',
  };

  function getModules(group) {
    if (typeof window.getAppModules !== 'function') return [];
    return window.getAppModules({ group, forNav: true, profile: window.userProfile });
  }

  function ensureShellStyles() {
    if (document.getElementById('appShellStyle')) return;

    const style = document.createElement('style');
    style.id = 'appShellStyle';
    style.textContent = `
      body.app-shell-active {
        min-height: 100vh;
      }

      .app-shell-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 300;
        width: 240px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #0f172a;
        color: rgba(255,255,255,.58);
        border-right: 1px solid rgba(255,255,255,.08);
        transition: width .28s ease;
      }

      .app-shell-sidebar.collapsed {
        width: 68px;
      }

      .app-shell-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 62px;
        padding: 18px 16px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        overflow: hidden;
      }

      .app-shell-logo-icon {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0ea5e9, #0369a1);
        color: #fff;
        font-size: 15px;
        flex-shrink: 0;
        box-shadow: 0 4px 10px rgba(14,165,233,.35);
      }

      .app-shell-logo-name {
        font-family: 'Manrope', sans-serif;
        font-size: 14px;
        font-weight: 800;
        color: #fff;
        line-height: 1.1;
        white-space: nowrap;
      }

      .app-shell-logo-sub {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .08em;
        white-space: nowrap;
      }

      .app-shell-sidebar.collapsed .app-shell-logo-copy,
      .app-shell-sidebar.collapsed .app-shell-group-label,
      .app-shell-sidebar.collapsed .app-shell-link-label,
      .app-shell-sidebar.collapsed .app-shell-user-copy,
      .app-shell-sidebar.collapsed .app-shell-link-badge {
        opacity: 0;
        width: 0;
        overflow: hidden;
      }

      .app-shell-nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .app-shell-nav::-webkit-scrollbar {
        width: 4px;
      }

      .app-shell-nav::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.12);
        border-radius: 99px;
      }

      .app-shell-group-label {
        padding: 10px 8px 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .1em;
        color: rgba(255,255,255,.22);
        white-space: nowrap;
      }

      .app-shell-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        color: rgba(255,255,255,.58);
        text-decoration: none;
        transition: all .18s ease;
        white-space: nowrap;
      }

      .app-shell-link:hover {
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.92);
      }

      :root {
        --sidebar-active-bg: rgba(14,165,233,.18);
        --sidebar-active-color: #38bdf8;
        --sidebar-active-icon-bg: rgba(14,165,233,.2);
      }
      html[data-theme="forest"] {
        --sidebar-active-bg: rgba(45,212,191,.18);
        --sidebar-active-color: #2dd4bf;
        --sidebar-active-icon-bg: rgba(45,212,191,.2);
      }
      html[data-theme="sunset"] {
        --sidebar-active-bg: rgba(251,146,60,.18);
        --sidebar-active-color: #fb923c;
        --sidebar-active-icon-bg: rgba(251,146,60,.2);
      }
      html[data-theme="violet"] {
        --sidebar-active-bg: rgba(167,139,250,.18);
        --sidebar-active-color: #a78bfa;
        --sidebar-active-icon-bg: rgba(167,139,250,.2);
      }

      .app-shell-link.active {
        background: var(--sidebar-active-bg);
        color: var(--sidebar-active-color);
      }

      .app-shell-link-icon {
        width: 32px;
        height: 32px;
        border-radius: 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .app-shell-link.active .app-shell-link-icon {
        background: var(--sidebar-active-icon-bg);
      }

      .app-shell-link-icon svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
      }

      .app-shell-link-label {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
      }

      .app-shell-link-badge {
        min-width: 18px;
        padding: 1px 6px;
        border-radius: 99px;
        background: #dc2626;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
      }

      .app-shell-sidebar.collapsed .app-shell-link {
        justify-content: center;
      }

      .app-shell-sep {
        margin: 6px 0;
        border: 0;
        border-top: 1px solid rgba(255,255,255,.08);
      }

      .app-shell-footer {
        padding: 10px 8px;
        border-top: 1px solid rgba(255,255,255,.08);
      }

      .app-shell-user {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        overflow: hidden;
        transition: all .18s ease;
      }

      .app-shell-user:hover {
        background: rgba(255,255,255,.08);
      }

      .app-shell-avatar {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0ea5e9, #7c3aed);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .app-shell-user-name {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,.82);
        white-space: nowrap;
      }

      .app-shell-user-role {
        font-size: 10px;
        white-space: nowrap;
      }

      .app-shell-toggle {
        position: fixed;
        top: 18px;
        left: 227px;
        z-index: 350;
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border, #e2e2e8);
        border-radius: 999px;
        background: var(--surface, #fff);
        color: var(--muted, #8888a0);
        box-shadow: 0 4px 10px rgba(15,23,42,.12);
        cursor: pointer;
        transition: left .28s ease, transform .18s ease, border-color .18s ease, color .18s ease, background .18s ease;
      }

      .app-shell-toggle:hover {
        border-color: var(--accent, #2563eb);
        color: var(--accent, #2563eb);
      }

      .app-shell-toggle svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.4;
        transition: transform .28s ease;
      }

      .app-shell-sidebar.collapsed + .app-shell-toggle {
        left: 55px;
      }

      .app-shell-sidebar.collapsed + .app-shell-toggle svg {
        transform: rotate(180deg);
      }

      .app-shell-main {
        min-width: 0;
        margin-left: 240px;
        transition: margin-left .28s ease;
      }

      .app-shell-sidebar.collapsed + .app-shell-toggle + .app-shell-main {
        margin-left: 68px;
      }

      .app-shell-topbar {
        position: sticky;
        top: 0;
        z-index: 200;
        min-height: 58px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 28px;
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e2e2e8);
        box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }

      .app-shell-topbar-title {
        margin: 0;
        font-family: 'Poppins', sans-serif;
        font-size: 17px;
        font-weight: 800;
        letter-spacing: -.02em;
        color: var(--text, #1a1a22);
      }

      .app-shell-spacer {
        flex: 1;
      }

      .app-shell-dark,
      .app-shell-logout {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 8px;
        border: 1px solid var(--border, #e2e2e8);
        background: var(--surface2, #f7f7f9);
        color: var(--muted, #8888a0);
        transition: all .18s ease;
      }

      .app-shell-dark {
        width: 32px;
        height: 32px;
        font-size: 14px;
        cursor: pointer;
      }

      .app-shell-logout {
        padding: 7px 10px;
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .07em;
        cursor: pointer;
      }

      .app-shell-dark:hover,
      .app-shell-logout:hover {
        border-color: var(--accent, #2563eb);
        color: var(--accent, #2563eb);
      }

      .app-shell-topbar-user {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .app-shell-topbar-name {
        font-size: 10px;
        color: var(--muted, #8888a0);
        white-space: nowrap;
      }

      .app-shell-topbar-role {
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: .07em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .app-shell-topbar-role.admin {
        background: var(--blue-bg, #eff6ff);
        border: 1px solid var(--blue-border, #bfdbfe);
        color: var(--blue, #2563eb);
      }

      .app-shell-topbar-role.colab {
        background: var(--surface2, #f7f7f9);
        border: 1px solid var(--border, #e2e2e8);
        color: var(--muted, #8888a0);
      }

      .app-shell-main > .page {
        min-width: 0;
      }

      .app-shell-modules-btn {
        display: none;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid var(--border, #e2e2e8);
        background: var(--surface2, #f7f7f9);
        color: var(--muted, #8888a0);
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .07em;
        cursor: pointer;
        transition: all .18s ease;
      }

      .app-shell-modules-btn:hover {
        border-color: var(--accent, #2563eb);
        color: var(--accent, #2563eb);
      }

      .app-shell-modules-btn svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
      }

      .app-shell-modules-wrap {
        position: relative;
        display: none;
      }

      .app-shell-modules-menu {
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        width: min(320px, calc(100vw - 28px));
        max-height: min(70vh, 520px);
        overflow-y: auto;
        padding: 10px;
        border: 1px solid var(--border, #e2e2e8);
        border-radius: 18px;
        background: var(--surface, #fff);
        box-shadow: 0 18px 40px rgba(15,23,42,.16);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-6px);
        transition: opacity .18s ease, transform .18s ease;
      }

      .app-shell-modules-wrap.open .app-shell-modules-menu {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .app-shell-modules-group {
        padding: 8px 10px 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--muted, #8888a0);
      }

      .app-shell-modules-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        color: var(--text, #1a1a22);
        text-decoration: none;
        transition: all .18s ease;
      }

      .app-shell-modules-item:hover {
        background: var(--surface2, #f7f7f9);
      }

      .app-shell-modules-item.active {
        background: var(--blue-bg, #eff6ff);
        color: var(--blue, #2563eb);
      }

      .app-shell-modules-icon {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: var(--surface2, #f7f7f9);
        color: inherit;
        flex-shrink: 0;
      }

      .app-shell-modules-icon svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
      }

      .app-shell-modules-copy {
        min-width: 0;
        flex: 1;
      }

      .app-shell-modules-label {
        display: block;
        font-size: 13px;
        font-weight: 700;
      }

      .app-shell-modules-sub {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--muted, #8888a0);
      }

      .app-shell-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15,23,42,.4);
        opacity: 0;
        pointer-events: none;
        transition: opacity .22s ease;
        z-index: 280;
      }

      .app-shell-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      html[data-theme="forest"] .app-shell-sidebar { background: #12312b; }
      html[data-theme="sunset"] .app-shell-sidebar { background: #3c1f12; }
      html[data-theme="violet"] .app-shell-sidebar { background: #21163d; }

      @media (max-width: 900px) {
        .app-shell-sidebar {
          width: 68px;
        }

        .app-shell-sidebar .app-shell-logo-copy,
        .app-shell-sidebar .app-shell-group-label,
        .app-shell-sidebar .app-shell-link-label,
        .app-shell-sidebar .app-shell-user-copy,
        .app-shell-sidebar .app-shell-link-badge {
          opacity: 0;
          width: 0;
          overflow: hidden;
        }

        .app-shell-sidebar .app-shell-link {
          justify-content: center;
        }

        .app-shell-toggle {
          left: 55px;
        }

        .app-shell-main {
          margin-left: 68px;
        }

        .app-shell-topbar {
          padding-left: 18px;
          padding-right: 18px;
        }
      }

      @media (max-width: 640px) {
        .app-shell-topbar {
          gap: 8px;
          padding-left: 14px;
          padding-right: 14px;
        }

        .app-shell-modules-wrap {
          display: inline-block;
        }

        .app-shell-modules-btn {
          display: inline-flex;
        }

        .app-shell-topbar-name,
        .app-shell-topbar-role {
          display: none;
        }

        .app-shell-sidebar,
        .app-shell-toggle,
        .app-shell-backdrop {
          display: none !important;
        }

        .app-shell-toggle {
          display: none;
        }

        .app-shell-main,
        .app-shell-sidebar.collapsed + .app-shell-toggle + .app-shell-main {
          margin-left: 0;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialsFromName(nome) {
    return String(nome || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || '?';
  }

  function navLinkHtml(item, activePage, extraAttrs) {
    const badgeId = item.id === 'tarefas'
      ? 'sidebarBadgeTarefas'
      : item.id === 'comunicados'
        ? 'sidebarBadgeCom'
        : '';

    return `
      <a class="app-shell-link${activePage === item.id ? ' active' : ''}" href="${item.href}"${extraAttrs || ''}>
        <span class="app-shell-link-icon">
          <svg viewBox="0 0 16 16">${item.icon || ''}</svg>
        </span>
        <span class="app-shell-link-label">${item.label}</span>
        ${badgeId ? `<span class="app-shell-link-badge" id="${badgeId}" style="display:none"></span>` : ''}
      </a>
    `;
  }

  function buildSidebarHtml(activePage) {
    const mainModules = [DASHBOARD_LINK].concat(getModules('main'));
    const adminModules = getModules('admin');

    const adminSection = adminModules.length ? `
      <hr class="app-shell-sep">
      <div class="app-shell-group-label">Gest&atilde;o</div>
      ${adminModules.map(item => navLinkHtml(item, activePage)).join('')}
    ` : '';

    return `
      <aside class="app-shell-sidebar" id="appShellSidebar">
        <div class="app-shell-logo">
          <div class="app-shell-logo-icon">🏢</div>
          <div class="app-shell-logo-copy">
            <div class="app-shell-logo-name">Algartempo</div>
            <div class="app-shell-logo-sub">Hub Interno</div>
          </div>
        </div>
        <nav class="app-shell-nav">
          <div class="app-shell-group-label">Principal</div>
          ${mainModules.map(item => navLinkHtml(item, activePage)).join('')}
          ${adminSection}
        </nav>
        <div class="app-shell-footer">
          <div class="app-shell-user" id="appShellUser">
            <div class="app-shell-avatar" id="appShellAvatar">?</div>
            <div class="app-shell-user-copy">
              <div class="app-shell-user-name" id="appShellUserName">-</div>
              <div class="app-shell-user-role" id="appShellUserRole">-</div>
            </div>
          </div>
        </div>
      </aside>
      <div class="app-shell-backdrop" id="appShellBackdrop" onclick="window.closeSidebarMenu()"></div>
      <button class="app-shell-toggle" id="appShellToggle" type="button" title="Recolher menu" onclick="window.toggleSidebar()">
        <svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
      </button>
    `;
  }

  function buildTopbarHtml(activePage) {
    const title = PAGE_TITLES[activePage] || activePage;
    const isDark = document.documentElement.classList.contains('dark');
    const mainModules = [DASHBOARD_LINK].concat(getModules('main'));
    const adminModules = getModules('admin');
    const menuSections = [
      { label: 'Principal', items: mainModules },
      ...(adminModules.length ? [{ label: 'Gestao', items: adminModules }] : []),
    ];

    return `
      <header class="app-shell-topbar" id="appShellTopbar">
        <button class="app-shell-modules-btn" type="button" onclick="window.toggleSidebar()">
          <svg viewBox="0 0 16 16"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>
          Módulos
        </button>
        <h1 class="app-shell-topbar-title">${title}</h1>
        <span class="app-shell-spacer"></span>
        <button class="app-shell-dark" type="button" onclick="window.toggleDarkMode()" title="Alternar modo escuro">
          <span class="dark-toggle-icon">${isDark ? '☀️' : '🌙'}</span>
        </button>
        <div class="app-shell-topbar-user">
          <span class="app-shell-topbar-name" id="appShellTopbarName">-</span>
          <span class="app-shell-topbar-role" id="appShellTopbarRole">-</span>
        </div>
        <button class="app-shell-logout" type="button" onclick="window.logout()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px;">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
          </svg>
          Sair
        </button>
      </header>
    `;
  }

  function updateShellUser(profile) {
    const isAdmin = window.isAdmin ? window.isAdmin() : false;
    const nome = profile ? (profile.nomeCompleto || profile.nome || profile.email || '') : '';
    const iniciais = initialsFromName(nome);
    const roleText = isAdmin ? 'Administrador' : 'Colaborador';

    const avatar = document.getElementById('appShellAvatar');
    const name = document.getElementById('appShellUserName');
    const role = document.getElementById('appShellUserRole');
    const topName = document.getElementById('appShellTopbarName');
    const topRole = document.getElementById('appShellTopbarRole');

    if (avatar) avatar.textContent = iniciais;
    if (name) name.textContent = nome || '-';
    if (role) role.textContent = roleText;
    if (topName) topName.textContent = nome || '-';
    if (topRole) {
      topRole.textContent = isAdmin ? 'Admin' : 'Colab';
      topRole.className = `app-shell-topbar-role ${isAdmin ? 'admin' : 'colab'}`;
    }
  }

  function ensureMobileModulesMenu(activePage) {
    const topbar = document.getElementById('appShellTopbar');
    const button = topbar ? topbar.querySelector('.app-shell-modules-btn') : null;
    if (!topbar || !button) return;

    let wrap = document.getElementById('appShellModulesWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'appShellModulesWrap';
      wrap.className = 'app-shell-modules-wrap';
      button.parentNode.insertBefore(wrap, button);
      wrap.appendChild(button);
    }

    const mainModules = [DASHBOARD_LINK].concat(getModules('main'));
    const adminModules = getModules('admin');
    const sections = [
      { label: 'Principal', items: mainModules },
      ...(adminModules.length ? [{ label: 'Gestao', items: adminModules }] : []),
    ];

    let menu = document.getElementById('appShellModulesMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'appShellModulesMenu';
      menu.className = 'app-shell-modules-menu';
      wrap.appendChild(menu);
    }

    button.setAttribute('type', 'button');
    button.onclick = function(event) {
      window.toggleMobileModulesMenu(event);
    };

    menu.innerHTML = sections.map(section => `
      <div class="app-shell-modules-group">${section.label}</div>
      ${section.items.map(item => `
        <a class="app-shell-modules-item${activePage === item.id ? ' active' : ''}" href="${item.href}">
          <span class="app-shell-modules-icon">
            <svg viewBox="0 0 16 16">${item.icon || ''}</svg>
          </span>
          <span class="app-shell-modules-copy">
            <span class="app-shell-modules-label">${item.label}</span>
            <span class="app-shell-modules-sub">${activePage === item.id ? 'Pagina atual' : 'Abrir modulo'}</span>
          </span>
        </a>
      `).join('')}
    `).join('');
  }

  function applySidebarState() {
    const sidebar = document.getElementById('appShellSidebar');
    const backdrop = document.getElementById('appShellBackdrop');
    if (!sidebar) return;

    if (window.innerWidth <= 640) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('open');
      window.closeMobileModulesMenu();
      return;
    }

    const shouldCollapse = window.innerWidth <= 900 || localStorage.getItem('sidebarCollapsed') === '1';
    sidebar.classList.toggle('collapsed', shouldCollapse);
    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('open');
  }

  window.closeSidebarMenu = function() {
    const sidebar = document.getElementById('appShellSidebar') || document.getElementById('sidebar');
    const backdrop = document.getElementById('appShellBackdrop') || document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('open');
  };

  window.closeMobileModulesMenu = function() {
    const wrap = document.getElementById('appShellModulesWrap') || document.getElementById('dashModulesWrap');
    if (wrap) wrap.classList.remove('open');
  };

  window.toggleMobileModulesMenu = function(event) {
    if (event) event.stopPropagation();

    if (window.innerWidth > 640) {
      window.closeMobileModulesMenu();
      return;
    }

    const wrap = document.getElementById('appShellModulesWrap') || document.getElementById('dashModulesWrap');
    if (!wrap) return;
    wrap.classList.toggle('open');
  };

  window.toggleSidebar = function() {
    const sidebar = document.getElementById('appShellSidebar') || document.getElementById('sidebar');
    const backdrop = document.getElementById('appShellBackdrop') || document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    if (window.innerWidth <= 640) {
      window.toggleMobileModulesMenu();
      return;
    }

    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
  };

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
    const pageEl = document.querySelector('.page');
    if (!pageEl) return;

    const isDashboard = activePage === 'dashboard';

    ensureShellStyles();
    document.body.classList.add('app-shell-active');

    let sidebar = document.getElementById('appShellSidebar');
    let toggle = document.getElementById('appShellToggle');
    let main = document.getElementById('appShellMain');
    let topbar = document.getElementById('appShellTopbar');

    if (!sidebar || !toggle || !main || (!topbar && !isDashboard)) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildSidebarHtml(activePage) +
        `<div class="app-shell-main" id="appShellMain">${isDashboard ? '' : buildTopbarHtml(activePage)}</div>`;

      sidebar = wrapper.querySelector('#appShellSidebar');
      toggle = wrapper.querySelector('#appShellToggle');
      main = wrapper.querySelector('#appShellMain');
      topbar = wrapper.querySelector('#appShellTopbar');

      document.body.insertBefore(sidebar, document.body.firstChild);
      document.body.insertBefore(toggle, sidebar.nextSibling);
      document.body.insertBefore(main, toggle.nextSibling);

      if (isDashboard) {
        // Dashboard tem topbar própria — movê-la para app-shell-main antes do .page
        const dashTopbar = document.querySelector('.dash-topbar');
        if (dashTopbar) main.appendChild(dashTopbar);
      }
      main.appendChild(pageEl);
    } else {
      sidebar.outerHTML = buildSidebarHtml(activePage).trim();
      toggle.outerHTML = `<button class="app-shell-toggle" id="appShellToggle" type="button" title="Recolher menu" onclick="window.toggleSidebar()"><svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg></button>`;
      if (!isDashboard && topbar) {
        topbar.outerHTML = buildTopbarHtml(activePage).trim();
      }

      sidebar = document.getElementById('appShellSidebar');
      toggle = document.getElementById('appShellToggle');
      main = document.getElementById('appShellMain');
      topbar = document.getElementById('appShellTopbar');

      if (pageEl.parentElement !== main) {
        main.appendChild(pageEl);
      }
    }

    ensureMobileModulesMenu(activePage);
    applySidebarState();
    updateShellUser(window.userProfile);
  };

  window.addEventListener('resize', applySidebarState);
  document.addEventListener('click', event => {
    const wrap = document.getElementById('appShellModulesWrap') || document.getElementById('dashModulesWrap');
    if (wrap && !wrap.contains(event.target)) {
      window.closeMobileModulesMenu();
    }
  });

  document.addEventListener('authReady', event => {
    const detail = event && event.detail ? event.detail : {};
    const profile = detail.profile || window.userProfile || null;
    updateShellUser(profile);

    // Aplicar tema guardado nas preferências do utilizador
    const prefs = profile && profile.preferencias && profile.preferencias.dashboard
      ? profile.preferencias.dashboard
      : {};
    const theme = prefs.themePreset || null;
    if (theme && theme !== 'default') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // Aplicar cor de destaque personalizada
    const customAccent = prefs.customAccent || null;
    const accentVars = ['--accent','--blue','--blue-bg','--blue-border',
      '--sidebar-active-color','--sidebar-active-bg','--sidebar-active-icon-bg'];
    if (customAccent && /^#[0-9a-fA-F]{6}$/.test(customAccent)) {
      const r = parseInt(customAccent.slice(1,3),16);
      const g = parseInt(customAccent.slice(3,5),16);
      const b = parseInt(customAccent.slice(5,7),16);
      document.documentElement.style.setProperty('--accent', customAccent);
      document.documentElement.style.setProperty('--blue', customAccent);
      document.documentElement.style.setProperty('--blue-bg', `rgba(${r},${g},${b},.10)`);
      document.documentElement.style.setProperty('--blue-border', `rgba(${r},${g},${b},.28)`);
      document.documentElement.style.setProperty('--sidebar-active-color', customAccent);
      document.documentElement.style.setProperty('--sidebar-active-bg', `rgba(${r},${g},${b},.18)`);
      document.documentElement.style.setProperty('--sidebar-active-icon-bg', `rgba(${r},${g},${b},.22)`);
    } else {
      accentVars.forEach(v => document.documentElement.style.removeProperty(v));
    }
    // Aplicar fundo personalizado
    const customBg = prefs.customBg || null;
    if (customBg) {
      document.documentElement.style.setProperty('--bg', customBg);
    } else {
      document.documentElement.style.removeProperty('--bg');
    }
  });
})();
