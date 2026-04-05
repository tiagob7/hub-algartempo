(function() {
  function collection() {
    return firebase.firestore().collection('comunicados');
  }

  function listenAll(options) {
    const cfg = options || {};
    const limit = cfg.limit || 200;
    return collection().orderBy('criadoEm', 'desc').limit(limit).onSnapshot(snap => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (typeof cfg.onData === 'function') cfg.onData(docs, snap);
    }, err => {
      if (typeof cfg.onError === 'function') cfg.onError(err);
    });
  }

  async function create(data) {
    return collection().add(data);
  }

  async function update(id, patch) {
    return collection().doc(id).update(patch);
  }

  async function remove(id) {
    return collection().doc(id).delete();
  }

  function proxy() {
    return {
      add: create,
      doc(id) {
        return {
          update(patch) {
            return update(id, patch);
          },
          delete() {
            return remove(id);
          },
        };
      },
      orderBy(field, direction) {
        return {
          limit(limitValue) {
            return {
              onSnapshot(onData, onError) {
                return collection().orderBy(field, direction).limit(limitValue).onSnapshot(onData, onError);
              },
            };
          },
        };
      },
    };
  }

  window.ComunicadosService = {
    listenAll,
    create,
    update,
    remove,
    proxy,
  };
})();
