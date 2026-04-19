(function() {
  function collection() {
    return firebase.firestore().collection('ferias');
  }

  function listenAll(options) {
    const cfg = options || {};
    const limit = cfg.limit || 300;
    return collection().orderBy('criadoEm', 'desc').limit(limit).onSnapshot(
      snap => { if (typeof cfg.onData === 'function') cfg.onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      err  => { if (typeof cfg.onError === 'function') cfg.onError(err); }
    );
  }

  function create(data)       { return collection().add(data); }
  function update(id, patch)  { return collection().doc(id).update(patch); }
  function remove(id)         { return collection().doc(id).delete(); }
  function getById(id)        { return collection().doc(id).get(); }

  window.FeriasService = { listenAll, create, update, remove, getById };
})();
