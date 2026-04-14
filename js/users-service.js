(function() {
  function getDb() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    return firebase.firestore();
  }

  function usersCollection() {
    const db = getDb();
    if (!db) throw new Error('Firestore indisponivel.');
    return db.collection('utilizadores');
  }

  function getDefaultPermissions() {
    if (typeof window.createDefaultPermissions === 'function') {
      return window.createDefaultPermissions();
    }
    return { modules: {} };
  }

  function normalizePermissions(value) {
    if (typeof window.normalizePermissions === 'function') {
      return window.normalizePermissions(value);
    }
    return value || getDefaultPermissions();
  }

  function getLegacyKeys(permission) {
    const defs = typeof window.getPermissionDefinitions === 'function'
      ? window.getPermissionDefinitions()
      : [];
    const canonical = typeof window.resolvePermissionKey === 'function'
      ? window.resolvePermissionKey(permission)
      : permission;
    const found = defs.find(def => def.key === canonical);
    return found && Array.isArray(found.legacyKeys) ? found.legacyKeys.slice() : [];
  }

  function buildProfile(data) {
    const nome = String(data.nome || '').trim();
    const apelido = String(data.apelido || '').trim();
    const nomeCompleto = (data.nomeCompleto || (nome + ' ' + apelido)).trim();

    return {
      uid: data.uid,
      email: String(data.email || '').trim(),
      nome,
      apelido,
      nomeCompleto,
      escritorio: data.escritorio || '',
      funcao: data.funcao || '',
      role: data.role || 'colaborador',
      ativo: data.ativo !== false,
      criadoEm: data.criadoEm || Date.now(),
      ultimoAcesso: data.ultimoAcesso || Date.now(),
      permissoes: normalizePermissions(data.permissoes || getDefaultPermissions()),
    };
  }

  async function listAll() {
    const snap = await usersCollection().get();
    return snap.docs.map(doc => {
      const data = doc.data();
      return { uid: doc.id, ...data, permissoes: normalizePermissions(data.permissoes) };
    });
  }

  function listenAll(options) {
    const cfg = options || {};
    let query = usersCollection();
    if (cfg.limit) query = query.limit(cfg.limit);

    return query.onSnapshot(snap => {
      const users = snap.docs.map(doc => {
        const data = doc.data();
        return { uid: doc.id, ...data, permissoes: normalizePermissions(data.permissoes) };
      });
      if (typeof cfg.onData === 'function') cfg.onData(users, snap);
    }, err => {
      if (typeof cfg.onError === 'function') cfg.onError(err);
    });
  }

  async function update(uid, patch) {
    if (!uid) throw new Error('UID em falta.');
    await usersCollection().doc(uid).update(patch);
  }

  async function setPermission(uid, permission, value, options) {
    if (!permission) throw new Error('Permissao em falta.');

    const canonical = typeof window.resolvePermissionKey === 'function'
      ? window.resolvePermissionKey(permission)
      : permission;

    const patch = {};
    patch['permissoes.' + canonical] = !!value;

    getLegacyKeys(permission).forEach(legacyKey => {
      patch['permissoes.' + legacyKey] = !!value;
    });

    if (options && options.clearProfile) {
      patch.perfil = null;
    }

    await update(uid, patch);
  }

  async function clearOffice(officeId) {
    if (!officeId) return;

    const snap = await usersCollection().where('escritorio', '==', officeId).get();
    if (snap.empty) return;

    const db = getDb();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { escritorio: '' });
    });
    await batch.commit();
  }

  async function create(data) {
    const email = String(data.email || '').trim();
    const password = String(data.password || '');
    const nome = String(data.nome || '').trim();

    if (!nome || !email || !password) {
      throw new Error('Nome, email e password sao obrigatorios.');
    }

    const appName = 'adminCreate_' + Date.now();
    let secondaryApp = null;

    try {
      secondaryApp = firebase.initializeApp(firebase.app().options, appName);
      const secondaryAuth = secondaryApp.auth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      await secondaryAuth.signOut();

      const profile = buildProfile({
        ...data,
        uid,
        email,
      });

      await usersCollection().doc(uid).set(profile);
      return profile;
    } finally {
      if (secondaryApp) {
        secondaryApp.delete().catch(() => {});
      }
    }
  }

  window.UsersService = {
    DEFAULT_PERMISSIONS: getDefaultPermissions(),
    buildProfile,
    listAll,
    listenAll,
    update,
    setPermission,
    clearOffice,
    create,
  };
})();
