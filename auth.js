// auth.js - autenticacao, sessao e permissoes
// Navbar e bootstrap visual vivem em js/app-platform.js.

window.currentUser = null;
window.userProfile = null;

(function() {
  if (localStorage.getItem('darkMode') === '1') {
    document.documentElement.classList.add('dark');
  }
  const _accent = localStorage.getItem('customAccent');
  if (_accent && /^#[0-9a-fA-F]{6}$/.test(_accent)) {
    const r = parseInt(_accent.slice(1,3),16), g = parseInt(_accent.slice(3,5),16), b = parseInt(_accent.slice(5,7),16);
    document.documentElement.style.setProperty('--accent', _accent);
    document.documentElement.style.setProperty('--blue', _accent);
    document.documentElement.style.setProperty('--blue-bg', `rgba(${r},${g},${b},.10)`);
    document.documentElement.style.setProperty('--blue-border', `rgba(${r},${g},${b},.28)`);
    document.documentElement.style.setProperty('--sidebar-active-color', _accent);
    document.documentElement.style.setProperty('--sidebar-active-bg', `rgba(${r},${g},${b},.18)`);
    document.documentElement.style.setProperty('--sidebar-active-icon-bg', `rgba(${r},${g},${b},.22)`);
  }
  const _bg = localStorage.getItem('customBg');
  if (_bg && /^#[0-9a-fA-F]{6}$/.test(_bg)) {
    document.documentElement.style.setProperty('--bg', _bg);
  }
})();

const PERMISSION_DEFINITIONS = [
  { key: 'modules.tarefas.view', label: 'Ver Tarefas' },
  { key: 'modules.tarefas.create', label: 'Criar Tarefas', legacyKeys: ['criarTarefas'] },
  { key: 'modules.tarefas.resolve', label: 'Resolver Tarefas', legacyKeys: ['resolverTarefas'] },
  { key: 'modules.comunicados.view', label: 'Ver Comunicados' },
  { key: 'modules.comunicados.manage', label: 'Gerir Comunicados', legacyKeys: ['gerirComunicados'] },
  { key: 'modules.calendario.view', label: 'Ver Calendario' },
  { key: 'modules.calendario.edit', label: 'Editar Calendario', legacyKeys: ['editarCalendario'] },
  { key: 'modules.admissoes.view', label: 'Ver Admissoes' },
  { key: 'modules.admissoes.create', label: 'Criar Admissoes', legacyKeys: ['criarAdmissoes'] },
  { key: 'modules.admissoes.resolve', label: 'Resolver Admissoes', legacyKeys: ['resolverAdmissoes'] },
  { key: 'modules.reclamacoes.view', label: 'Ver Reclamacoes' },
  { key: 'modules.reclamacoes.manage', label: 'Gerir Reclamacoes', legacyKeys: ['criarReclamacoes'] },
  { key: 'modules.escalas.view', label: 'Ver Escalas' },
  { key: 'modules.escalas.manage', label: 'Gerir Escalas' },
  { key: 'modules.clientes.view', label: 'Ver Clientes' },
  { key: 'modules.clientes.import', label: 'Importar Clientes' },
  { key: 'modules.clientes.edit', label: 'Editar Clientes' },
  { key: 'modules.utilizadores.manage', label: 'Gerir Utilizadores' },
  { key: 'modules.definicoes.manage', label: 'Gerir Definicoes' },
  { key: 'modules.gerir-calendarios.manage', label: 'Gerir Calendarios' },
  { key: 'modules.auditoria.view', label: 'Ver Auditoria' },
  { key: 'modules.perfis.manage', label: 'Gerir Perfis' },
];

const LEGACY_PERMISSION_MAP = PERMISSION_DEFINITIONS.reduce((acc, def) => {
  (def.legacyKeys || []).forEach(legacyKey => {
    acc[legacyKey] = def.key;
  });
  return acc;
}, {});

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getByPath(obj, path) {
  return String(path || '')
    .split('.')
    .reduce((acc, part) => (acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined), obj);
}

function setByPath(obj, path, value) {
  const parts = String(path || '').split('.');
  let ref = obj;
  while (parts.length > 1) {
    const part = parts.shift();
    if (!ref[part] || typeof ref[part] !== 'object') ref[part] = {};
    ref = ref[part];
  }
  ref[parts[0]] = value;
}

function createDefaultPermissions() {
  const perms = {
    modules: {
      tarefas: { view: true, create: false, resolve: false },
      comunicados: { view: true, manage: false },
      calendario: { view: true, edit: false },
      admissoes: { view: true, create: false, resolve: false },
      reclamacoes: { view: true, manage: false },
      escalas: { view: true, manage: false },
      clientes: { view: false, import: false, edit: false },
      utilizadores: { manage: false },
      definicoes: { manage: false },
      'gerir-calendarios': { manage: false },
      auditoria: { view: false },
      perfis: { manage: false },
    },
  };

  PERMISSION_DEFINITIONS.forEach(def => {
    const canonicalValue = getByPath(perms, def.key);
    (def.legacyKeys || []).forEach(legacyKey => {
      perms[legacyKey] = canonicalValue === true;
    });
  });

  return perms;
}

function normalizePermissions(input) {
  const normalized = createDefaultPermissions();
  const source = input && typeof input === 'object' ? input : {};

  if (source.modules && typeof source.modules === 'object') {
    Object.keys(source.modules).forEach(moduleKey => {
      const moduleValue = source.modules[moduleKey];
      if (!moduleValue || typeof moduleValue !== 'object') return;
      Object.keys(moduleValue).forEach(actionKey => {
        if (typeof moduleValue[actionKey] === 'boolean') {
          setByPath(normalized, ['modules', moduleKey, actionKey].join('.'), moduleValue[actionKey]);
        }
      });
    });
  }

  PERMISSION_DEFINITIONS.forEach(def => {
    const canonicalFromSource = getByPath(source, def.key);
    if (typeof canonicalFromSource === 'boolean') {
      setByPath(normalized, def.key, canonicalFromSource);
    }

    (def.legacyKeys || []).forEach(legacyKey => {
      if (typeof source[legacyKey] === 'boolean') {
        setByPath(normalized, def.key, source[legacyKey]);
      }
    });

    const finalValue = getByPath(normalized, def.key) === true;
    (def.legacyKeys || []).forEach(legacyKey => {
      normalized[legacyKey] = finalValue;
    });
  });

  return normalized;
}

window.getPermissionDefinitions = function() {
  return clone(PERMISSION_DEFINITIONS);
};

window.resolvePermissionKey = function(permissionKey) {
  return LEGACY_PERMISSION_MAP[permissionKey] || permissionKey;
};

window.createDefaultPermissions = createDefaultPermissions;
window.normalizePermissions = normalizePermissions;

window.temPermissaoNoPerfil = function(profile, permissionKey) {
  if (!profile) return false;
  if (profile.role === 'admin') return true;

  const canonicalKey = window.resolvePermissionKey(permissionKey);
  const permissions = normalizePermissions(profile.permissoes);
  const value = getByPath(permissions, canonicalKey);

  if (typeof value === 'boolean') return value;

  if (typeof permissions[permissionKey] === 'boolean') {
    return permissions[permissionKey];
  }

  return false;
};

const overlay = document.createElement('div');
overlay.id = 'authOverlay';
const _darkBg = document.documentElement.classList.contains('dark');
overlay.style.cssText = `position:fixed;inset:0;background:${_darkBg ? '#0f0f14' : '#f4f4f6'};display:flex;align-items:center;justify-content:center;z-index:9999;font-family:'DM Mono',monospace;`;
overlay.innerHTML = `<div style="font-size:12px;color:${_darkBg ? '#6868a0' : '#8888a0'};letter-spacing:.05em;">A verificar sessao...</div>`;
document.body.prepend(overlay);

window.isAdmin = function() {
  return window.userProfile && window.userProfile.role === 'admin';
};

window.temPermissao = function(permissionKey) {
  return window.temPermissaoNoPerfil(window.userProfile, permissionKey);
};

window.setFiltroEscritorio = function(escritorioId) {
  sessionStorage.setItem('filtroEscritorio', escritorioId);
  location.reload();
};

window.logout = function() {
  firebase.auth().signOut().then(() => {
    window.location.href = 'login.html';
  });
};

window.toggleDarkMode = function() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  document.querySelectorAll('.dark-toggle-icon').forEach(el => {
    el.textContent = isDark ? '☀️' : '🌙';
  });
};

function getBasicProfile(user) {
  const fallbackName = user.displayName || user.email.split('@')[0];
  return {
    uid: user.uid,
    email: user.email,
    nome: fallbackName,
    apelido: '',
    nomeCompleto: fallbackName,
    escritorio: '',
    funcao: '',
    role: 'colaborador',
    ativo: true,
    criadoEm: Date.now(),
    ultimoAcesso: Date.now(),
    permissoes: createDefaultPermissions(),
  };
}

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  window.currentUser = user;

  let snap;
  try {
    snap = await firebase.firestore().collection('utilizadores').doc(user.uid).get();
  } catch (readErr) {
    console.error('[auth] Falha ao ler perfil do Firestore:', readErr.code, readErr.message);
    const ov = document.getElementById('authOverlay');
    if (ov) {
      ov.innerHTML = '<div style="font-size:12px;color:#dc2626;letter-spacing:.05em;text-align:center;padding:20px;">Erro ao carregar perfil.<br>Tenta recarregar a pagina.</div>';
    }
    return;
  }

  if (snap && snap.exists) {
    const rawProfile = snap.data();
    window.userProfile = {
      ...rawProfile,
      permissoes: normalizePermissions(rawProfile.permissoes),
    };

    if (window.userProfile.ativo === false && window.userProfile.role !== 'admin') {
      await firebase.auth().signOut();
      window.location.href = 'login.html?conta=desativada';
      return;
    }

    if (!window.userProfile.uid) {
      firebase.firestore().collection('utilizadores').doc(user.uid)
        .update({ uid: user.uid })
        .catch(() => {});
    }
  } else {
    const basicProfile = getBasicProfile(user);
    try {
      await firebase.firestore().collection('utilizadores').doc(user.uid).set(basicProfile);
      window.userProfile = basicProfile;
    } catch (writeErr) {
      console.error('[auth] Falha ao criar perfil no Firestore:', writeErr.code, writeErr.message);
      window.userProfile = basicProfile;
    }
  }

  firebase.firestore().collection('utilizadores').doc(user.uid)
    .update({ ultimoAcesso: Date.now() })
    .catch(() => {});

  const ov = document.getElementById('authOverlay');
  if (ov) ov.remove();

  document.dispatchEvent(new CustomEvent('authReady', {
    detail: { user: window.currentUser, profile: window.userProfile },
  }));

  let fsOffline = false;
  firebase.firestore()
    .collection('utilizadores').doc(user.uid)
    .onSnapshot({ includeMetadataChanges: true }, snapShot => {
      const fromCache = snapShot.metadata.fromCache;
      if (fromCache && !fsOffline) {
        fsOffline = true;
        setTimeout(() => {
          if (fsOffline) window.dispatchEvent(new Event('offline'));
        }, 5000);
      } else if (!fromCache && fsOffline) {
        fsOffline = false;
        if (!navigator.onLine) return;
        window.dispatchEvent(new Event('online'));
      }
    }, () => {
      fsOffline = true;
      window.dispatchEvent(new Event('offline'));
    });
});
