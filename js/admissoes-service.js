(function() {
  function collection() {
    return firebase.firestore().collection('admissoes');
  }

  function create(data) {
    return collection().add(data);
  }

  function update(id, patch) {
    return collection().doc(id).update(patch);
  }

  function remove(id) {
    return collection().doc(id).delete();
  }

  function getById(id) {
    return collection().doc(id).get();
  }

  async function uploadFiles(docId, files) {
    const storage = firebase.storage();
    const uploaded = [];

    for (const file of files || []) {
      const path = `admissoes/${docId}/${Date.now()}_${file.name}`;
      const ref = storage.ref(path);
      const snap = await ref.put(file);
      const url = await snap.ref.getDownloadURL();
      uploaded.push({ nome: file.name, url, tamanho: file.size, criadoEm: Date.now(), path });
    }

    return uploaded;
  }

  async function removeFile(docId, fileData) {
    if (fileData && fileData.path) {
      await firebase.storage().ref(fileData.path).delete().catch(() => {});
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
              get() {
                return collection().orderBy(field, direction).limit(limitValue).get();
              },
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

  window.AdmissoesService = {
    create,
    update,
    remove,
    getById,
    uploadFiles,
    removeFile,
    proxy,
  };
})();
