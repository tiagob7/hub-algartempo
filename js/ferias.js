(function() {
  let allPedidos = [];
  let filtroEstado = 'todos';
  let filtroEscritorio = '';
  let isAdmin = false;
  let currentUid = '';
  let unsub = null;

  window.bootProtectedPage({
    activePage: 'ferias',
    moduleId: 'ferias',
  }, ({ profile, escritorio }) => {
    isAdmin = profile.role === 'admin';
    currentUid = profile.uid;

    document.getElementById('pageSubtitle').textContent =
      isAdmin ? 'Gestão de pedidos de ausência' : 'Os teus pedidos de ausência';

    if (isAdmin) {
      document.getElementById('adminFilters').style.display = 'flex';
      document.getElementById('fEscritorioWrap').style.display = '';
      popularEscritorios();
    }

    setDataDefaults();
    startSync();
  });

  function setDataDefaults() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('fInicio').value = hoje;
    document.getElementById('fFim').value = hoje;
  }

  function popularEscritorios() {
    window.loadEscritorios && window.loadEscritorios().then(lista => {
      const selForm = document.getElementById('fEscritorio');
      const selFiltro = document.getElementById('filterEscritorio');
      selForm.innerHTML = lista.map(e => `<option value="${window.escHtml(e.id)}">${window.escHtml(e.nome)}</option>`).join('');
      selFiltro.innerHTML = '<option value="">Todos</option>' +
        lista.map(e => `<option value="${window.escHtml(e.id)}">${window.escHtml(e.nome)}</option>`).join('');
    });
  }

  function startSync() {
    if (unsub) unsub();
    window.setStatus('A sincronizar…');
    unsub = window.FeriasService.listenAll({
      onData(docs) {
        allPedidos = docs;
        render();
        window.setStatus('✓ Sincronizado');
      },
      onError(err) {
        console.error('[ferias]', err);
        window.setStatus('Erro ao carregar', 'var(--red)');
      },
    });
  }

  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    const ano = new Date().getFullYear();
    const proprios = isAdmin ? allPedidos : allPedidos.filter(p => p.uid === currentUid);
    document.getElementById('statTotal').textContent = proprios.length;
    document.getElementById('statPendente').textContent = proprios.filter(p => p.estado === 'pendente').length;
    document.getElementById('statAprovado').textContent = proprios.filter(p => p.estado === 'aprovado').length;

    const dias = proprios
      .filter(p => p.estado === 'aprovado' && p.tipo === 'ferias' && new Date(p.dataInicio).getFullYear() === ano)
      .reduce((acc, p) => {
        const d = Math.round((new Date(p.dataFim) - new Date(p.dataInicio)) / 86400000) + 1;
        return acc + (d > 0 ? d : 0);
      }, 0);
    document.getElementById('statDias').textContent = dias;
  }

  function filtrados() {
    return allPedidos.filter(p => {
      if (!isAdmin && p.uid !== currentUid) return false;
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (filtroEscritorio && p.escritorio !== filtroEscritorio) return false;
      return true;
    });
  }

  function renderList() {
    const lista = filtrados();
    const el = document.getElementById('feriasList');
    document.getElementById('countBadge').textContent = lista.length + ' registo(s)';

    if (!lista.length) {
      el.innerHTML = '<div class="empty-msg">Nenhum pedido encontrado.</div>';
      return;
    }

    el.innerHTML = lista.map(p => cardHtml(p)).join('');
  }

  function cardHtml(p) {
    const meu = p.uid === currentUid;
    const inicio = p.dataInicio ? new Date(p.dataInicio).toLocaleDateString('pt-PT') : '—';
    const fim    = p.dataFim   ? new Date(p.dataFim).toLocaleDateString('pt-PT')   : '—';
    const dias = p.dataInicio && p.dataFim
      ? Math.round((new Date(p.dataFim) - new Date(p.dataInicio)) / 86400000) + 1
      : '?';
    const tipoLabel = { ferias: 'Férias', folga: 'Folga', licenca: 'Licença', outro: 'Outro' }[p.tipo] || p.tipo;

    const acoes = [];
    if (isAdmin && p.estado === 'pendente') {
      acoes.push(`
        <input class="obs-input" id="obs_${p.id}" placeholder="Observação (opcional)">
        <button class="btn btn-secondary btn-sm" onclick="aprovar('${p.id}')">✓ Aprovar</button>
        <button class="btn btn-red btn-sm" onclick="rejeitar('${p.id}')">✕ Rejeitar</button>
      `);
    }
    if (meu && p.estado === 'pendente') {
      acoes.push(`<button class="btn btn-secondary btn-sm" onclick="cancelar('${p.id}')">Cancelar pedido</button>`);
    }

    return `
      <div class="ferias-card estado-${window.escHtml(p.estado)}" id="card_${p.id}">
        <div class="card-header" onclick="toggleCard('${p.id}')">
          <div>
            <div class="card-nome">${window.escHtml(p.nomeCompleto || p.email || '—')}</div>
            <div class="card-sub">${window.escHtml(tipoLabel)} · ${inicio} → ${fim} (${dias} dia${dias !== 1 ? 's' : ''})</div>
          </div>
          <span class="tipo-tag">${window.escHtml(tipoLabel)}</span>
          <span class="estado-pill ${window.escHtml(p.estado)}">${window.escHtml(p.estado)}</span>
        </div>
        <div class="card-body" id="body_${p.id}">
          <div class="card-detail-row">
            <span class="detail-item">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>
              ${inicio} → ${fim}
            </span>
            ${p.escritorio ? `<span class="detail-item">${window.escHtml(p.escritorio)}</span>` : ''}
            <span class="detail-item">${window.escHtml(window.fmtShort ? window.fmtShort(p.criadoEm) : '')}</span>
          </div>
          ${p.motivo ? `<div class="card-motivo">${window.escHtml(p.motivo)}</div>` : ''}
          ${p.observacao ? `<div class="card-obs">Obs: ${window.escHtml(p.observacao)}</div>` : ''}
          ${acoes.length ? `<div class="card-actions">${acoes.join('')}</div>` : ''}
        </div>
      </div>`;
  }

  window.toggleCard = function(id) {
    document.getElementById('body_' + id).classList.toggle('open');
  };

  window.toggleForm = function() {
    document.getElementById('formPanel').classList.toggle('open');
  };

  window.setFiltro = function(f) {
    filtroEstado = f;
    document.querySelectorAll('.filter-btn[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === f));
    renderList();
  };

  window.setFiltroEscritorio = function(v) {
    filtroEscritorio = v;
    renderList();
  };

  window.submitPedido = async function() {
    const inicio = document.getElementById('fInicio').value;
    const fim    = document.getElementById('fFim').value;
    if (!inicio || !fim) { window.toast('Preenche as datas.'); return; }
    if (fim < inicio)    { window.toast('A data de fim não pode ser anterior ao início.'); return; }

    const profile = window.userProfile;
    const escritorio = isAdmin
      ? (document.getElementById('fEscritorio').value || window.escritorioAtivo())
      : window.escritorioAtivo();

    const data = {
      uid: profile.uid,
      nomeCompleto: profile.nomeCompleto || profile.nome || profile.email,
      email: profile.email,
      escritorio,
      tipo: document.getElementById('fTipo').value,
      dataInicio: inicio,
      dataFim: fim,
      motivo: document.getElementById('fMotivo').value.trim(),
      estado: 'pendente',
      criadoEm: Date.now(),
    };

    try {
      await window.FeriasService.create(data);
      window.toast('Pedido submetido com sucesso.');
      document.getElementById('fMotivo').value = '';
      setDataDefaults();
      document.getElementById('formPanel').classList.remove('open');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('ferias', 'create', data);
    } catch (e) {
      console.error(e);
      window.toast('Erro ao submeter pedido.');
    }
  };

  window.aprovar = async function(id) {
    const obs = (document.getElementById('obs_' + id) || {}).value || '';
    try {
      await window.FeriasService.update(id, { estado: 'aprovado', observacao: obs, resolvidoEm: Date.now(), resolvidoPor: window.userProfile.uid });
      window.toast('Pedido aprovado.');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('ferias', 'aprovar', { id, obs });
    } catch (e) { window.toast('Erro ao aprovar.'); }
  };

  window.rejeitar = async function(id) {
    const obs = (document.getElementById('obs_' + id) || {}).value || '';
    try {
      await window.FeriasService.update(id, { estado: 'rejeitado', observacao: obs, resolvidoEm: Date.now(), resolvidoPor: window.userProfile.uid });
      window.toast('Pedido rejeitado.');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('ferias', 'rejeitar', { id, obs });
    } catch (e) { window.toast('Erro ao rejeitar.'); }
  };

  window.cancelar = async function(id) {
    if (!confirm('Cancelar este pedido?')) return;
    try {
      await window.FeriasService.update(id, { estado: 'cancelado' });
      window.toast('Pedido cancelado.');
    } catch (e) { window.toast('Erro ao cancelar.'); }
  };
})();
