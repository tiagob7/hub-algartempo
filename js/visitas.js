(function() {
  let allVisitas = [];
  let filtroEstado = 'todos';
  let filtroEscritorio = '';
  let isAdmin = false;
  let currentUid = '';
  let unsub = null;

  window.bootProtectedPage({
    activePage: 'visitas',
    moduleId: 'visitas',
  }, ({ profile, escritorio }) => {
    isAdmin = profile.role === 'admin';
    currentUid = profile.uid;

    document.getElementById('pageSubtitle').textContent =
      isAdmin ? 'Gestão de visitas a clientes e parceiros' : 'As tuas visitas registadas';

    if (isAdmin) {
      document.getElementById('adminFilters').style.display = 'flex';
    }

    popularEscritorios(escritorio);
    setDataDefault();
    startSync();
  });

  function setDataDefault() {
    document.getElementById('fData').value = new Date().toISOString().split('T')[0];
  }

  function popularEscritorios(atual) {
    window.loadEscritorios && window.loadEscritorios().then(lista => {
      const selForm = document.getElementById('fEscritorio');
      selForm.innerHTML = lista.map(e =>
        `<option value="${window.escHtml(e.id)}" ${e.id === atual ? 'selected' : ''}>${window.escHtml(e.nome)}</option>`
      ).join('');

      if (isAdmin) {
        const selFiltro = document.getElementById('filterEscritorio');
        selFiltro.innerHTML = '<option value="">Todos</option>' +
          lista.map(e => `<option value="${window.escHtml(e.id)}">${window.escHtml(e.nome)}</option>`).join('');
      }
    });
  }

  function startSync() {
    if (unsub) unsub();
    window.setStatus('A sincronizar…');
    unsub = window.VisitasService.listenAll({
      onData(docs) {
        allVisitas = docs;
        render();
        window.setStatus('✓ Sincronizado');
      },
      onError(err) {
        console.error('[visitas]', err);
        window.setStatus('Erro ao carregar', 'var(--red)');
      },
    });
  }

  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    const proprias = isAdmin ? allVisitas : allVisitas.filter(v => v.uid === currentUid);
    document.getElementById('statTotal').textContent = proprias.length;
    document.getElementById('statAgendada').textContent = proprias.filter(v => v.estado === 'agendada').length;
    document.getElementById('statRealizada').textContent = proprias.filter(v => v.estado === 'realizada').length;
  }

  function filtrados() {
    return allVisitas.filter(v => {
      if (!isAdmin && v.uid !== currentUid) return false;
      if (filtroEstado !== 'todos' && v.estado !== filtroEstado) return false;
      if (filtroEscritorio && v.escritorio !== filtroEscritorio) return false;
      return true;
    });
  }

  function renderList() {
    const lista = filtrados();
    const el = document.getElementById('visitasList');
    document.getElementById('countBadge').textContent = lista.length + ' registo(s)';

    if (!lista.length) {
      el.innerHTML = '<div class="empty-msg">Nenhuma visita encontrada.</div>';
      return;
    }

    el.innerHTML = lista.map(v => cardHtml(v)).join('');
  }

  const tipoLabels = { reuniao: 'Reunião', demonstracao: 'Demonstração', auditoria: 'Auditoria', formacao: 'Formação', outro: 'Outro' };

  function cardHtml(v) {
    const meu = v.uid === currentUid;
    const data = v.dataVisita ? new Date(v.dataVisita).toLocaleDateString('pt-PT') : '—';
    const tipoLabel = tipoLabels[v.tipo] || v.tipo || '—';

    const acoes = [];
    if ((meu || isAdmin) && v.estado === 'agendada') {
      acoes.push(`
        <input class="resultado-input" id="res_${v.id}" placeholder="Resultado / notas da visita">
        <button class="btn btn-secondary btn-sm" onclick="marcarRealizada('${v.id}')">✓ Marcar realizada</button>
        <button class="btn btn-red btn-sm" onclick="cancelarVisita('${v.id}')">Cancelar</button>
      `);
    }
    if (meu && v.estado === 'agendada') {
      acoes.push(`<button class="btn btn-secondary btn-sm" onclick="editarVisita('${v.id}')">Editar</button>`);
    }

    return `
      <div class="visita-card estado-${window.escHtml(v.estado)}" id="card_${v.id}">
        <div class="card-header" onclick="toggleCard('${v.id}')">
          <div>
            <div class="card-nome">${window.escHtml(v.cliente || '—')}</div>
            <div class="card-sub">${window.escHtml(data)} · ${window.escHtml(v.local || '—')} · ${window.escHtml(v.nomeCompleto || v.email || '—')}</div>
          </div>
          <span class="tipo-tag">${window.escHtml(tipoLabel)}</span>
          <span class="estado-pill ${window.escHtml(v.estado)}">${window.escHtml(v.estado)}</span>
        </div>
        <div class="card-body" id="body_${v.id}">
          <div class="card-detail-row">
            <span class="detail-item">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5l2 1.5"/></svg>
              ${window.escHtml(data)}
            </span>
            ${v.local ? `<span class="detail-item">📍 ${window.escHtml(v.local)}</span>` : ''}
            ${v.responsavel ? `<span class="detail-item">👤 ${window.escHtml(v.responsavel)}</span>` : ''}
            ${v.escritorio ? `<span class="detail-item">${window.escHtml(v.escritorio)}</span>` : ''}
          </div>
          ${v.descricao ? `<div class="card-desc">${window.escHtml(v.descricao)}</div>` : ''}
          ${v.resultado ? `<div class="card-resultado"><div class="card-resultado-label">Resultado</div>${window.escHtml(v.resultado)}</div>` : ''}
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

  window.submitVisita = async function() {
    const cliente = document.getElementById('fCliente').value.trim();
    const data    = document.getElementById('fData').value;
    if (!cliente) { window.toast('Preenche o nome do cliente.'); return; }
    if (!data)    { window.toast('Preenche a data da visita.'); return; }

    const profile = window.userProfile;
    const doc = {
      uid: profile.uid,
      nomeCompleto: profile.nomeCompleto || profile.nome || profile.email,
      email: profile.email,
      escritorio: document.getElementById('fEscritorio').value || window.escritorioAtivo(),
      cliente,
      local: document.getElementById('fLocal').value.trim(),
      dataVisita: data,
      tipo: document.getElementById('fTipo').value,
      responsavel: document.getElementById('fResponsavel').value.trim(),
      descricao: document.getElementById('fDescricao').value.trim(),
      estado: 'agendada',
      criadoEm: Date.now(),
    };

    try {
      await window.VisitasService.create(doc);
      window.toast('Visita registada com sucesso.');
      ['fCliente','fLocal','fResponsavel','fDescricao'].forEach(id => document.getElementById(id).value = '');
      setDataDefault();
      document.getElementById('formPanel').classList.remove('open');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('visitas', 'create', doc);
    } catch (e) {
      console.error(e);
      window.toast('Erro ao registar visita.');
    }
  };

  window.marcarRealizada = async function(id) {
    const resultado = (document.getElementById('res_' + id) || {}).value || '';
    try {
      await window.VisitasService.update(id, { estado: 'realizada', resultado, realizadaEm: Date.now() });
      window.toast('Visita marcada como realizada.');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('visitas', 'realizada', { id });
    } catch (e) { window.toast('Erro ao actualizar visita.'); }
  };

  window.cancelarVisita = async function(id) {
    if (!confirm('Cancelar esta visita?')) return;
    try {
      await window.VisitasService.update(id, { estado: 'cancelada' });
      window.toast('Visita cancelada.');
    } catch (e) { window.toast('Erro ao cancelar.'); }
  };

  window.editarVisita = function(id) {
    window.toast('Para editar, cancela e regista uma nova visita.');
  };
})();
