// Compat layer para escritorios.
// Mantem a API global existente, mas a implementacao passa por OfficesService.

(function() {
  function service() {
    return window.OfficesService || null;
  }

  window.loadEscritorios = function loadEscritorios(options) {
    const svc = service();
    if (!svc) return Promise.resolve([]);
    return svc.load(options);
  };

  window.getEscritoriosSync = function getEscritoriosSync(options) {
    const svc = service();
    if (!svc) return [];
    return svc.getSync(options);
  };

  window.nomeEscritorio = function nomeEscritorio(id) {
    const svc = service();
    if (!svc) return id || '';
    return svc.getName(id);
  };

  window.escritoriosValidos = function escritoriosValidos() {
    const svc = service();
    if (!svc) return [];
    return svc.getSync().map(item => item.id);
  };

  window.escritorioExiste = function escritorioExiste(id, options) {
    const svc = service();
    if (!svc) return false;
    return svc.exists(id, options);
  };

  window.getEscritorioDefault = function getEscritorioDefault(options) {
    const svc = service();
    if (!svc) return null;
    return svc.getDefault(options);
  };

  window.getEscritoriosAtivosSync = function getEscritoriosAtivosSync() {
    const svc = service();
    if (!svc) return [];
    return svc.getSync();
  };

  window.getEscritoriosDisponiveisParaUser = function getEscritoriosDisponiveisParaUser(profile, options) {
    const svc = service();
    if (!svc) return [];
    return svc.getAvailableForUser(profile, options);
  };
})();
