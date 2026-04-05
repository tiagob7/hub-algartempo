(function() {
  const DEFAULT_OFFICES = [
    { id: 'quarteira', nome: 'Quarteira', cor: '#2563eb', default: true, ativo: true, ordem: 10 },
    { id: 'albufeira', nome: 'Albufeira', cor: '#7c3aed', default: false, ativo: true, ordem: 20 },
    { id: 'lisboa', nome: 'Lisboa', cor: '#db2777', default: false, ativo: true, ordem: 30 },
    { id: 'porto', nome: 'Porto', cor: '#16a34a', default: false, ativo: true, ordem: 40 },
  ];

  let cache = null;
  let loadPromise = null;

  function cloneList(list) {
    return list.map(item => ({ ...item }));
  }

  function capitalizeId(id) {
    if (!id) return '';
    if (id.indexOf('-') !== -1 || id.indexOf('_') !== -1) {
      return id
        .split(/[-_]/g)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function normalizeOffice(item, index) {
    return {
      id: String(item && item.id || '').trim().toLowerCase(),
      nome: item && item.nome ? item.nome : (item && item.id ? item.id : ''),
      cor: item && item.cor ? item.cor : '#2563eb',
      default: !!(item && item.default),
      ativo: !item || item.ativo !== false,
      ordem: Number.isFinite(item && item.ordem) ? item.ordem : (index + 1) * 10,
    };
  }

  function normalizeList(list) {
    if (!Array.isArray(list) || !list.length) return cloneList(DEFAULT_OFFICES);

    const normalized = list
      .map(normalizeOffice)
      .filter(item => item.id)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-PT'));

    if (!normalized.some(item => item.default)) {
      if (normalized[0]) normalized[0].default = true;
    } else {
      let defaultSeen = false;
      normalized.forEach(item => {
        if (item.default && !defaultSeen) {
          defaultSeen = true;
          return;
        }
        if (item.default && defaultSeen) item.default = false;
      });
    }

    return normalized;
  }

  function getDb() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    return firebase.firestore();
  }

  function filterList(list, options) {
    const cfg = options || {};
    if (cfg.includeInactive) return cloneList(list);
    return cloneList(list.filter(item => item.ativo !== false));
  }

  async function load(options) {
    const cfg = options || {};

    if (cache) return filterList(cache, cfg);
    if (loadPromise) return loadPromise.then(() => filterList(cache || DEFAULT_OFFICES, cfg));

    const db = getDb();
    if (!db) {
      cache = cloneList(DEFAULT_OFFICES);
      return filterList(cache, cfg);
    }

    loadPromise = db.collection('config').doc('escritorios').get()
      .then(snap => {
        if (snap.exists && snap.data() && Array.isArray(snap.data().lista)) {
          cache = normalizeList(snap.data().lista);
        } else {
          cache = cloneList(DEFAULT_OFFICES);
        }
        return filterList(cache, cfg);
      })
      .catch(() => {
        cache = cloneList(DEFAULT_OFFICES);
        return filterList(cache, cfg);
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  function getSync(options) {
    const base = cache || DEFAULT_OFFICES;
    return filterList(base, options);
  }

  async function saveList(list) {
    const db = getDb();
    const normalized = normalizeList(list);
    cache = normalized;

    if (!db) return cloneList(normalized);

    await db.collection('config').doc('escritorios').set({ lista: normalized });
    return cloneList(normalized);
  }

  async function upsert(office) {
    const current = await load({ includeInactive: true });
    const normalized = normalizeOffice(office, current.length);
    if (!normalized.id) throw new Error('ID de escritorio invalido.');

    const existingIndex = current.findIndex(item => item.id === normalized.id);
    let next;
    if (existingIndex === -1) {
      next = current.concat({
        ...normalized,
        default: normalized.default === true ? true : current.length === 0,
      });
    } else {
      next = current.slice();
      next[existingIndex] = { ...next[existingIndex], ...normalized };
    }

    if (normalized.default === true) {
      next = next.map(item => ({ ...item, default: item.id === normalized.id }));
    }

    return saveList(next);
  }

  async function remove(id) {
    if (!id) throw new Error('ID de escritorio em falta.');

    const current = await load({ includeInactive: true });
    const target = current.find(item => item.id === id);
    if (!target) throw new Error('Escritorio nao encontrado.');
    if (target.default) throw new Error('Nao podes apagar o escritorio base.');

    const next = current.filter(item => item.id !== id);
    await saveList(next);

    if (window.UsersService && typeof window.UsersService.clearOffice === 'function') {
      await window.UsersService.clearOffice(id);
    }

    return cloneList(next);
  }

  window.OfficesService = {
    DEFAULT_OFFICES: cloneList(DEFAULT_OFFICES),
    normalizeOffice,
    normalizeList,
    load,
    getSync,
    saveList,
    upsert,
    remove,
    getDefault(options) {
      const list = getSync(options);
      return list.find(item => item.default) || list[0] || null;
    },
    exists(id, options) {
      if (!id) return false;
      return getSync(options).some(item => item.id === id);
    },
    getName(id) {
      if (!id) return '';
      const found = (cache || DEFAULT_OFFICES).find(item => item.id === id);
      return found && found.nome ? found.nome : capitalizeId(id);
    },
    getAvailableForUser(profile, options) {
      const user = profile || window.userProfile || null;
      const list = getSync(options);

      if (!user) return [];
      if (user.role === 'admin') return list;
      if (user.escritorio && list.some(item => item.id === user.escritorio)) {
        return list.filter(item => item.id === user.escritorio);
      }

      const fallback = this.getDefault(options);
      return fallback ? [fallback] : [];
    },
    resetCache() {
      cache = null;
      loadPromise = null;
    },
  };
})();
