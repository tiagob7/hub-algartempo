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

    let fallbackUnsub = null;

    const primaryUnsub = collection().orderBy('ordemChegada', 'asc').limit(limit).onSnapshot(snap => {
      onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => {
      console.error('[TasksService] orderBy fallback:', err);
      fallbackUnsub = collection().limit(limit).onSnapshot(snap => {
        onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, onError);
      if (typeof cfg.onFallback === 'function') cfg.onFallback(fallbackUnsub);
    });

    return function unsubscribe() {
      primaryUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
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

  const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
  const UPLOAD_ALLOWED_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ]);

  function validateFile(file) {
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new Error(`"${file.name}" excede o tamanho máximo de 50 MB.`);
    }
    if (!UPLOAD_ALLOWED_TYPES.has(file.type)) {
      throw new Error(`Tipo de ficheiro não permitido: "${file.name}". São aceites imagens, PDF e documentos Office.`);
    }
  }

  async function uploadFiles(taskId, files) {
    const storage = getStorage();
    const uploaded = [];

    for (const file of files || []) {
      validateFile(file);
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
