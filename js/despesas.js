(function() {
  let allDespesas = [];
  let filtroEstado = 'todos';
  let filtroEscritorio = '';
  let isAdmin = false;
  let currentUid = '';
  let pendingRecibo = null;
  let unsub = null;

  window.bootProtectedPage({
    activePage: 'despesas',
    moduleId: 'despesas',
  }, ({ profile, escritorio }) => {
    isAdmin = profile.role === 'admin';
    currentUid = profile.uid;

    document.getElementById('pageSubtitle').textContent =
      isAdmin ? 'Gestão de notas de despesa' : 'As tuas notas de despesa';

    if (isAdmin) {
      document.getElementById('adminFilters').style.display = 'flex';
    }

    popularEscritorios(escritorio);
    document.getElementById('fData').value = new Date().toISOString().split('T')[0];
    startSync();
  });

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
    unsub = window.DespesasService.listenAll({
      onData(docs) {
        allDespesas = docs;
        render();
        window.setStatus('✓ Sincronizado');
      },
      onError(err) {
        console.error('[despesas]', err);
        window.setStatus('Erro ao carregar', 'var(--red)');
      },
    });
  }

  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    const proprias = isAdmin ? allDespesas : allDespesas.filter(d => d.uid === currentUid);
    const pendentes = proprias.filter(d => d.estado === 'pendente');
    document.getElementById('statPendente').textContent = pendentes.length;
    document.getElementById('statAprovado').textContent = proprias.filter(d => d.estado === 'aprovado').length;
    const totalPendente = pendentes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
    document.getElementById('statValor').textContent = totalPendente.toFixed(2) + ' €';
  }

  function filtrados() {
    return allDespesas.filter(d => {
      if (!isAdmin && d.uid !== currentUid) return false;
      if (filtroEstado !== 'todos' && d.estado !== filtroEstado) return false;
      if (filtroEscritorio && d.escritorio !== filtroEscritorio) return false;
      return true;
    });
  }

  function renderList() {
    const lista = filtrados();
    const el = document.getElementById('despesasList');
    document.getElementById('countBadge').textContent = lista.length + ' registo(s)';

    if (!lista.length) {
      el.innerHTML = '<div class="empty-msg">Nenhuma despesa encontrada.</div>';
      return;
    }

    el.innerHTML = lista.map(d => cardHtml(d)).join('');
  }

  const catLabels = {
    alimentacao: 'Alimentação', transporte: 'Transporte', alojamento: 'Alojamento',
    material: 'Material', comunicacoes: 'Comunicações', outro: 'Outro',
  };

  function cardHtml(d) {
    const meu = d.uid === currentUid;
    const data = d.data ? new Date(d.data).toLocaleDateString('pt-PT') : '—';
    const catLabel = catLabels[d.categoria] || d.categoria || '—';
    const valor = parseFloat(d.valor || 0).toFixed(2);

    const acoes = [];
    if (isAdmin && d.estado === 'pendente') {
      acoes.push(`
        <input class="obs-input" id="obs_${d.id}" placeholder="Observação (opcional)">
        <button class="btn btn-secondary btn-sm" onclick="aprovar('${d.id}')">✓ Aprovar</button>
        <button class="btn btn-red btn-sm" onclick="rejeitar('${d.id}')">✕ Rejeitar</button>
      `);
    }
    if (meu && d.estado === 'pendente') {
      acoes.push(`<button class="btn btn-secondary btn-sm" onclick="eliminar('${d.id}')">Eliminar</button>`);
    }

    const reciboHtml = d.recibo
      ? `<a class="recibo-link" href="${window.escHtml(d.recibo.url)}" target="_blank" rel="noopener">
           <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/></svg>
           ${window.escHtml(d.recibo.nome)}
         </a>`
      : '';

    return `
      <div class="despesa-card estado-${window.escHtml(d.estado)}" id="card_${d.id}">
        <div class="card-header" onclick="toggleCard('${d.id}')">
          <div>
            <div class="card-nome">${window.escHtml(d.descricao || '—')}</div>
            <div class="card-sub">${window.escHtml(d.nomeCompleto || d.email || '—')} · ${window.escHtml(data)}</div>
          </div>
          <span class="cat-tag">${window.escHtml(catLabel)}</span>
          <span class="card-valor">${window.escHtml(valor)} €</span>
          <span class="estado-pill ${window.escHtml(d.estado)}">${window.escHtml(d.estado)}</span>
        </div>
        <div class="card-body" id="body_${d.id}">
          <div class="card-detail-row">
            <span class="detail-item">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>
              ${window.escHtml(data)}
            </span>
            ${d.escritorio ? `<span class="detail-item">${window.escHtml(d.escritorio)}</span>` : ''}
            <span class="detail-item">${window.escHtml(window.fmtShort ? window.fmtShort(d.criadoEm) : '')}</span>
          </div>
          ${reciboHtml}
          ${d.observacao ? `<div class="card-obs">Obs: ${window.escHtml(d.observacao)}</div>` : ''}
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

  window.onReciboChange = function(input) {
    pendingRecibo = input.files[0] || null;
    document.getElementById('uploadStatus').textContent = pendingRecibo ? pendingRecibo.name : '';
  };

  window.submitDespesa = async function() {
    const descricao = document.getElementById('fDescricao').value.trim();
    const valor     = parseFloat(document.getElementById('fValor').value);
    const data      = document.getElementById('fData').value;

    if (!descricao)          { window.toast('Preenche a descrição.'); return; }
    if (!valor || valor <= 0){ window.toast('Valor inválido.'); return; }
    if (!data)               { window.toast('Preenche a data.'); return; }

    const profile = window.userProfile;
    const doc = {
      uid: profile.uid,
      nomeCompleto: profile.nomeCompleto || profile.nome || profile.email,
      email: profile.email,
      escritorio: document.getElementById('fEscritorio').value || window.escritorioAtivo(),
      categoria: document.getElementById('fCategoria').value,
      valor,
      data,
      descricao,
      estado: 'pendente',
      criadoEm: Date.now(),
    };

    try {
      document.getElementById('uploadStatus').textContent = 'A guardar…';
      const ref = await window.DespesasService.create(doc);
      if (pendingRecibo) {
        const recibo = await window.DespesasService.uploadRecibo(ref.id, pendingRecibo);
        await window.DespesasService.update(ref.id, { recibo });
      }
      window.toast('Despesa submetida com sucesso.');
      document.getElementById('fDescricao').value = '';
      document.getElementById('fValor').value = '';
      document.getElementById('fRecibo').value = '';
      document.getElementById('uploadStatus').textContent = '';
      pendingRecibo = null;
      document.getElementById('formPanel').classList.remove('open');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('despesas', 'create', doc);
    } catch (e) {
      console.error(e);
      window.toast('Erro ao submeter despesa.');
      document.getElementById('uploadStatus').textContent = '';
    }
  };

  window.aprovar = async function(id) {
    const obs = (document.getElementById('obs_' + id) || {}).value || '';
    try {
      await window.DespesasService.update(id, { estado: 'aprovado', observacao: obs, resolvidoEm: Date.now(), resolvidoPor: window.userProfile.uid });
      window.toast('Despesa aprovada.');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('despesas', 'aprovar', { id });
    } catch (e) { window.toast('Erro ao aprovar.'); }
  };

  window.rejeitar = async function(id) {
    const obs = (document.getElementById('obs_' + id) || {}).value || '';
    try {
      await window.DespesasService.update(id, { estado: 'rejeitado', observacao: obs, resolvidoEm: Date.now(), resolvidoPor: window.userProfile.uid });
      window.toast('Despesa rejeitada.');
      if (typeof window.logAuditoria === 'function') window.logAuditoria('despesas', 'rejeitar', { id });
    } catch (e) { window.toast('Erro ao rejeitar.'); }
  };

  window.eliminar = async function(id) {
    if (!confirm('Eliminar esta despesa?')) return;
    try {
      await window.DespesasService.remove(id);
      window.toast('Despesa eliminada.');
    } catch (e) { window.toast('Erro ao eliminar.'); }
  };
})();
