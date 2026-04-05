(function() {
  function collection() {
    return firebase.firestore().collection('calendarios');
  }

  function doc(id) {
    return collection().doc(id);
  }

  function proxy(id) {
    const ref = doc(id);
    return {
      set(data) {
        return ref.set(data);
      },
      onSnapshot(onData, onError) {
        return ref.onSnapshot(onData, onError);
      },
      get() {
        return ref.get();
      },
    };
  }

  window.CalendarioService = {
    doc,
    proxy,
  };
})();
