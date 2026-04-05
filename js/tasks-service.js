(function() {
  function getDb() {
    return firebase.firestore();
  }

  function getStorage() {
    return firebase.storage();
  }

  function collection() {
    return getDb().collection('tarefas_todo');
  }

  function listenAll(options) {
    const cfg = options || {};
    const limit = cfg.limit || 200;
    const onData = cfg.onData || function() {};
    const onError = cfg.onError || function() {};

    const primary = collection().orderBy('ordemChegada', 'asc').limit(limit).onSnapshot(snap => {
      onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => {
      console.error('[TasksService] orderBy fallback:', err);
      const fallback = collection().limit(limit).onSnapshot(snap => {
        onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, onError);
      if (typeof cfg.onFallback === 'function') cfg.onFallback(fallback);
    });

    return primary;
  }

  async function create(data) {
    return collection().add(data);
  }

  async function getById(id) {
    return collection().doc(id).get();
  }

  async function update(id, patch) {
    return collection().doc(id).update(patch);
  }

  async function remove(id) {
    return collection().doc(id).delete();
  }

  async function uploadFiles(taskId, files) {
    const storage = getStorage();
    const uploaded = [];

    for (const file of files || []) {
      const path = `tarefas/${taskId}/${Date.now()}_${file.name}`;
      const ref = storage.ref(path);
      const snap = await ref.put(file);
      const url = await snap.ref.getDownloadURL();
      uploaded.push({ nome: file.name, url, tamanho: file.size, criadoEm: Date.now(), path });
    }

    return uploaded;
  }

  async function removeFile(docId, fileData) {
    if (fileData && fileData.path) {
      await getStorage().ref(fileData.path).delete().catch(() => {});
    }
    await update(docId, {
      ficheiros: firebase.firestore.FieldValue.arrayRemove(fileData),
    });
  }

  function proxy() {
    return {
      add: create,
      doc(id) {
        return {
          get() {
            return getById(id);
          },
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
      limit(limitValue) {
        return {
          onSnapshot(onData, onError) {
            return collection().limit(limitValue).onSnapshot(onData, onError);
          },
        };
      },
    };
  }

  window.TasksService = {
    listenAll,
    create,
    getById,
    update,
    remove,
    uploadFiles,
    removeFile,
    proxy,
  };
})();
