// perfis-service.js — gestão de perfis de permissões

(function() {
  'use strict';

  // Módulos configuráveis em perfis (exclui módulos admin-only)
  const MODULE_ACTIONS = [
    { id: 'tarefas',      label: 'Tarefas',       actions: [
      { key: 'view',    label: 'Ver' },
      { key: 'create',  label: 'Criar' },
      { key: 'resolve', label: 'Gerir' },
    ]},
    { id: 'comunicados',  label: 'Comunicados',   actions: [
      { key: 'view',   label: 'Ver' },
      { key: 'manage', label: 'Gerir' },
    ]},
    { id: 'calendario',   label: 'Calendário',    actions: [
      { key: 'view', label: 'Ver' },
      { key: 'edit', label: 'Editar' },
    ]},
    { id: 'admissoes',    label: 'Admissões',     actions: [
      { key: 'view',    label: 'Ver' },
      { key: 'create',  label: 'Criar' },
      { key: 'resolve', label: 'Gerir' },
    ]},
    { id: 'reclamacoes',  label: 'Reclamações',   actions: [
      { key: 'view',   label: 'Ver' },
      { key: 'manage', label: 'Gerir' },
    ]},
    { id: 'escalas',      label: 'Escalas',       actions: [
      { key: 'view',   label: 'Ver' },
      { key: 'manage', label: 'Gerir' },
    ]},
    { id: 'clientes',     label: 'Clientes',      actions: [
      { key: 'view',   label: 'Ver' },
      { key: 'import', label: 'Importar' },
      { key: 'edit',   label: 'Editar' },
    ]},
  ];

  const DEFAULT_PROFILES = [
    {
      id: 'rececionista',
      nome: 'Rececionista',
      permissoes: {
        modules: {
          tarefas:     { view: true,  create: false, resolve: false },
          comunicados: { view: true,  manage: false },
          calendario:  { view: true,  edit: false },
          admissoes:   { view: true,  create: true,  resolve: false },
          reclamacoes: { view: true,  manage: false },
          escalas:     { view: true,  manage: false },
          clientes:    { view: false, import: false, edit: false },
        },
      },
    },
    {
      id: 'tecnico',
      nome: 'Técnico',
      permissoes: {
        modules: {
          tarefas:     { view: true,  create: true,  resolve: true  },
          comunicados: { view: true,  manage: false },
          calendario:  { view: true,  edit: false },
          admissoes:   { view: true,  create: true,  resolve: true  },
          reclamacoes: { view: true,  manage: true  },
          escalas:     { view: true,  manage: false },
          clientes:    { view: true,  import: false, edit: false },
        },
      },
    },
    {
      id: 'gestor-rh',
      nome: 'Gestor RH',
      permissoes: {
        modules: {
          tarefas:     { view: true,  create: true,  resolve: true  },
          comunicados: { view: true,  manage: true  },
          calendario:  { view: true,  edit: true   },
          admissoes:   { view: true,  create: true,  resolve: true  },
          reclamacoes: { view: true,  manage: true  },
          escalas:     { view: true,  manage: true  },
          clientes:    { view: true,  import: true,  edit: true  },
        },
      },
    },
    {
      id: 'gestor-operacional',
      nome: 'Gestor Operacional',
      permissoes: {
        modules: {
          tarefas:     { view: true,  create: true,  resolve: true  },
          comunicados: { view: true,  manage: true  },
          calendario:  { view: true,  edit: true   },
          admissoes:   { view: false, create: false, resolve: false },
          reclamacoes: { view: true,  manage: true  },
          escalas:     { view: true,  manage: true  },
          clientes:    { view: true,  import: true,  edit: false },
        },
      },
    },
  ];

  const CONFIG_DOC = 'config/perfis';

  function db() { return firebase.firestore(); }

  let _cache = null;   // array de perfis em memória
  let _loading = null; // promise em curso (evita fetch duplo)

  function buildLegacyFields(modules) {
    const legacyMap = {
      tarefas_create:     'criarTarefas',
      tarefas_resolve:    'resolverTarefas',
      comunicados_manage: 'gerirComunicados',
      calendario_edit:    'editarCalendario',
      admissoes_create:   'criarAdmissoes',
      admissoes_resolve:  'resolverAdmissoes',
      reclamacoes_manage: 'criarReclamacoes',
    };
    const legacy = {};
    Object.entries(legacyMap).forEach(([composed, legacyKey]) => {
      const [mod, action] = composed.split('_');
      legacy[legacyKey] = !!(modules[mod] && modules[mod][action]);
    });
    return legacy;
  }

  // Converte permissoes de perfil em permissoes completas para o utilizador
  function buildUserPermissions(perfilPermissoes) {
    const mods = (perfilPermissoes && perfilPermissoes.modules) || {};

    // Começar dos defaults do auth.js (se disponíveis)
    const base = window.createDefaultPermissions
      ? window.createDefaultPermissions()
      : { modules: {} };

    // Sobrescrever com os valores do perfil
    MODULE_ACTIONS.forEach(({ id }) => {
      if (mods[id]) {
        base.modules[id] = { ...base.modules[id], ...mods[id] };
      }
    });

    // Escrever campos legacy para compatibilidade com regras Firestore
    const legacy = buildLegacyFields(base.modules);
    return { ...base, ...legacy };
  }

  // ── Persistência ─────────────────────────────────────────────────────────────

  async function loadPerfis() {
    if (_cache) return _cache.slice();
    if (_loading) return _loading;

    _loading = db().doc(CONFIG_DOC).get().then(snap => {
      const data = snap.exists ? snap.data() : null;
      if (data && Array.isArray(data.lista) && data.lista.length > 0) {
        _cache = data.lista;
      } else {
        _cache = DEFAULT_PROFILES.map(p => ({ ...p }));
        // Guardar defaults no Firestore silenciosamente
        db().doc(CONFIG_DOC).set({ lista: _cache }).catch(err =>
          console.warn('[perfis] Falha ao guardar defaults:', err)
        );
      }
      _loading = null;
      return _cache.slice();
    }).catch(err => {
      _loading = null;
      console.error('[perfis] Erro ao carregar perfis:', err);
      return DEFAULT_PROFILES.map(p => ({ ...p }));
    });

    return _loading;
  }

  async function savePerfis(lista) {
    _cache = lista.slice();
    await db().doc(CONFIG_DOC).set({ lista: _cache });
  }

  // ── CRUD de perfis ────────────────────────────────────────────────────────────

  async function upsertPerfil(def) {
    if (!def || !def.id || !def.nome) throw new Error('Perfil inválido: id e nome obrigatórios');

    const lista = await loadPerfis();
    const idx = lista.findIndex(p => p.id === def.id);
    const perfil = {
      id: String(def.id).trim(),
      nome: String(def.nome).trim(),
      permissoes: def.permissoes || { modules: {} },
    };

    if (idx === -1) {
      lista.push(perfil);
    } else {
      lista[idx] = { ...lista[idx], ...perfil };
    }

    await savePerfis(lista);

    // Propagar alterações a todos os utilizadores com este perfil
    await propagatePerfil(perfil.id);

    _invalidateCache();
    return perfil;
  }

  async function deletePerfil(perfilId) {
    const lista = await loadPerfis();
    const filtrado = lista.filter(p => p.id !== perfilId);
    if (filtrado.length === lista.length) return; // não existia

    await savePerfis(filtrado);

    // Degradar utilizadores com este perfil (limpar perfil e repor defaults)
    await degradarUtilizadoresComPerfil(perfilId);

    _invalidateCache();
  }

  // ── Aplicar perfil a utilizador ───────────────────────────────────────────────

  async function applyPerfilToUser(uid, perfilId) {
    if (!uid) throw new Error('UID obrigatório');

    const lista = await loadPerfis();
    const perfil = lista.find(p => p.id === perfilId);

    if (!perfil) throw new Error('Perfil não encontrado: ' + perfilId);

    const permissoes = buildUserPermissions(perfil.permissoes);

    await db().collection('utilizadores').doc(uid).update({
      perfil: perfilId,
      permissoes,
    });
  }

  async function removePerfilFromUser(uid) {
    if (!uid) throw new Error('UID obrigatório');

    const permissoes = window.createDefaultPermissions
      ? window.createDefaultPermissions()
      : { modules: {} };

    await db().collection('utilizadores').doc(uid).update({
      perfil: null,
      permissoes,
    });
  }

  // ── Propagação ────────────────────────────────────────────────────────────────

  async function propagatePerfil(perfilId) {
    const lista = await loadPerfis();
    const perfil = lista.find(p => p.id === perfilId);
    if (!perfil) return;

    const snap = await db().collection('utilizadores')
      .where('perfil', '==', perfilId)
      .get();

    if (snap.empty) return;

    const permissoes = buildUserPermissions(perfil.permissoes);
    const batch = db().batch();

    snap.docs.forEach(doc => {
      batch.update(doc.ref, { permissoes });
    });

    await batch.commit();
  }

  async function degradarUtilizadoresComPerfil(perfilId) {
    const snap = await db().collection('utilizadores')
      .where('perfil', '==', perfilId)
      .get();

    if (snap.empty) return;

    const permissoes = window.createDefaultPermissions
      ? window.createDefaultPermissions()
      : { modules: {} };

    const batch = db().batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { perfil: null, permissoes });
    });

    await batch.commit();
  }

  // ── Cache helpers ─────────────────────────────────────────────────────────────

  function _invalidateCache() {
    _cache = null;
  }

  function getModuleActions() {
    return MODULE_ACTIONS.map(m => ({
      ...m,
      actions: m.actions.map(a => ({ ...a })),
    }));
  }

  // ── API pública ───────────────────────────────────────────────────────────────

  window.PerfisService = {
    loadPerfis,
    upsertPerfil,
    deletePerfil,
    applyPerfilToUser,
    removePerfilFromUser,
    propagatePerfil,
    getModuleActions,
    buildUserPermissions,
    invalidateCache: _invalidateCache,
  };

})();
