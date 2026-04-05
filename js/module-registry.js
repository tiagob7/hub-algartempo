(function() {
  const registry = [];

  function upsert(def) {
    if (!def || !def.id || !def.href) return;

    const normalized = {
      id: String(def.id).trim(),
      label: def.label || def.id,
      href: def.href,
      icon: def.icon || '',
      group: def.group || 'main',
      order: Number.isFinite(def.order) ? def.order : 999,
      showInNav: def.showInNav !== false,
      showInDashboardNav: def.showInDashboardNav !== false,
      adminOnly: !!def.adminOnly,
      requiredPermissions: Array.isArray(def.requiredPermissions) ? def.requiredPermissions.slice() : [],
      usesEscritorio: def.usesEscritorio !== false,
    };

    const idx = registry.findIndex(item => item.id === normalized.id);
    if (idx === -1) registry.push(normalized);
    else registry[idx] = { ...registry[idx], ...normalized };
  }

  function seedDefaults() {
    if (registry.length) return;

    [
      {
        id: 'tarefas',
        label: 'Tarefas',
        href: 'tarefas.html',
        order: 10,
        requiredPermissions: ['modules.tarefas.view'],
        icon: '<rect x="3" y="4" width="10" height="10" rx="1.5"/><path d="M6 7l1.5 1.5L10 6"/>',
      },
      {
        id: 'comunicados',
        label: 'Comunicados',
        href: 'comunicados.html',
        order: 20,
        requiredPermissions: ['modules.comunicados.view'],
        icon: '<path d="M13 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3l2 2 2-2h3a1 1 0 001-1V3a1 1 0 00-1-1z"/>',
      },
      {
        id: 'calendario',
        label: 'Calend&aacute;rio',
        href: 'calendario.html',
        order: 30,
        requiredPermissions: ['modules.calendario.view'],
        icon: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/>',
      },
      {
        id: 'admissoes',
        label: 'Admiss&otilde;es',
        href: 'admissoes.html',
        order: 40,
        requiredPermissions: ['modules.admissoes.view'],
        icon: '<circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>',
      },
      {
        id: 'reclamacoes',
        label: 'Reclama&ccedil;&otilde;es',
        href: 'reclamacoes.html',
        order: 50,
        requiredPermissions: ['modules.reclamacoes.view'],
        icon: '<circle cx="8" cy="8" r="6.5"/><path d="M8 5v4"/><circle cx="8" cy="11.5" r=".6" fill="currentColor"/>',
      },
      {
        id: 'escalas',
        label: 'Escalas',
        href: 'escalas.html',
        order: 60,
        requiredPermissions: ['modules.escalas.view'],
        icon: '<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5h6M5 11h4"/>',
      },
      {
        id: 'definicoes',
        label: 'Defini&ccedil;&otilde;es',
        href: 'definicoes.html',
        group: 'admin',
        order: 100,
        adminOnly: true,
        requiredPermissions: ['modules.definicoes.manage'],
        icon: '<circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/>',
      },
      {
        id: 'utilizadores',
        label: 'Utilizadores',
        href: 'utilizadores.html',
        group: 'admin',
        order: 110,
        adminOnly: true,
        requiredPermissions: ['modules.utilizadores.manage'],
        icon: '<circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>',
      },
      {
        id: 'gerir-calendarios',
        label: 'Gerir Calend&aacute;rios',
        href: 'gerir-calendarios.html',
        group: 'admin',
        order: 120,
        adminOnly: true,
        requiredPermissions: ['modules.gerir-calendarios.manage'],
        icon: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12M5 10h6"/>',
      },
      {
        id: 'auditoria',
        label: 'Auditoria',
        href: 'auditoria.html',
        group: 'admin',
        order: 130,
        adminOnly: true,
        requiredPermissions: ['modules.auditoria.view'],
        icon: '<path d="M3 4h10M3 8h8M3 12h6"/><circle cx="13" cy="12" r="2.5"/><path d="M15 14l1.5 1.5"/>',
      },
    ].forEach(upsert);
  }

  function canAccess(def, profile) {
    if (!def || !profile) return false;
    if (profile.role === 'admin') return true;
    if (def.adminOnly) return false;
    if (!def.requiredPermissions.length) return true;
    if (typeof window.temPermissao !== 'function') return false;
    return def.requiredPermissions.some(perm => window.temPermissao(perm));
  }

  function listModules(options) {
    seedDefaults();

    const cfg = options || {};
    const profile = cfg.profile || window.userProfile || null;

    return registry
      .filter(item => !cfg.group || item.group === cfg.group)
      .filter(item => cfg.forNav ? item.showInNav : true)
      .filter(item => cfg.forDashboardNav ? item.showInDashboardNav : true)
      .filter(item => cfg.includeHidden ? true : canAccess(item, profile))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-PT'))
      .map(item => ({ ...item }));
  }

  seedDefaults();

  window.registerAppModule = upsert;
  window.getAppModules = function(options) {
    return listModules(options);
  };
  window.getAppModuleById = function(id) {
    seedDefaults();
    const found = registry.find(item => item.id === id);
    return found ? { ...found } : null;
  };
  window.userCanAccessModule = function(id, profile) {
    seedDefaults();
    return canAccess(registry.find(item => item.id === id), profile || window.userProfile || null);
  };
})();
