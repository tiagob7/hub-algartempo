(function() {
  const state = {
    clientes: [],
    filtered: [],
    selectedId: '',
    canImport: false,
    preview: null,
    importBusy: false,
  };

  const dom = {};

  function cacheDom() {
    dom.statsBar = document.getElementById('statsBar');
    dom.clientesList = document.getElementById('clientesList');
    dom.clienteDetail = document.getElementById('clienteDetail');
    dom.clientsCountLabel = document.getElementById('clientsCountLabel');
    dom.filterSearch = document.getElementById('filterSearch');
    dom.filterOffice = document.getElementById('filterOffice');
    dom.filterStatus = document.getElementById('filterStatus');
    dom.importPanel = document.getElementById('importPanel');
    dom.importDropzone = document.getElementById('importDropzone');
    dom.importFile = document.getElementById('clientesImportFile');
    dom.importBusyState = document.getElementById('importBusyState');
    dom.importPreviewWrap = document.getElementById('importPreviewWrap');
    dom.importPermissionHint = document.getElementById('importPermissionHint');
  }

  function formatMoney(value) {
    if (value == null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: value % 1 ? 2 : 0,
      maximumFractionDigits: 4,
    }).format(value);
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function getCurrentRevision(cliente) {
    const revisoes = Array.isArray(cliente && cliente.revisoes) ? cliente.revisoes : [];
    return revisoes.length ? revisoes[revisoes.length - 1] : null;
  }

  function hasPrices(cliente) {
    return !!(cliente && cliente.precosAtuais && Object.keys(cliente.precosAtuais).length);
  }

  function bindFilters() {
    dom.filterSearch.addEventListener('input', render);
    dom.filterOffice.addEventListener('change', render);
    dom.filterStatus.addEventListener('change', render);

    dom.importFile.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      await handleImportFile(file);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dom.importDropzone.addEventListener(eventName, event => {
        event.preventDefault();
        if (!state.canImport) return;
        dom.importDropzone.classList.add('drag');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dom.importDropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dom.importDropzone.classList.remove('drag');
      });
    });

    dom.importDropzone.addEventListener('drop', async event => {
      if (!state.canImport) return;
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      await handleImportFile(file);
    });
  }

  function toggleImportPanel() {
    if (!dom.importPanel) return;
    dom.importPanel.classList.toggle('open');
  }

  function setImportBusy(isBusy) {
    state.importBusy = !!isBusy;
    dom.importBusyState.hidden = !isBusy;
  }

  function updateImportPermissionState() {
    state.canImport = typeof window.temPermissao === 'function' && window.temPermissao('modules.clientes.import');
    dom.importPermissionHint.textContent = state.canImport ? 'Importação disponível' : 'Sem permissão de importação';

    if (!state.canImport) {
      dom.importDropzone.style.opacity = '.65';
      dom.importDropzone.style.pointerEvents = 'none';
      dom.importPreviewWrap.innerHTML = '<div class="clientes-preview-note">Tens acesso de leitura ao módulo, mas a importação Excel está reservada a utilizadores com <code>modules.clientes.import</code>.</div>';
    }
  }

  async function handleImportFile(file) {
    if (!state.canImport) return;

    try {
      setImportBusy(true);
      state.preview = await window.ClientesService.previewImport(file);
      renderImportPreview();
      dom.importPanel.classList.add('open');
      window.toast('Preview de importação pronto.');
    } catch (error) {
      console.error(error);
      state.preview = null;
      dom.importPreviewWrap.innerHTML = '';
      window.toast(error.message || 'Erro ao analisar o ficheiro.');
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!state.preview || !state.canImport) return;

    try {
      setImportBusy(true);
      const result = await window.ClientesService.applyImport(state.preview);

      if (typeof window.registarAuditoria === 'function') {
        await window.registarAuditoria({
          modulo: 'clientes',
          acao: 'importado',
          docId: 'import-' + result.importedAt,
          titulo: result.sourceFile,
          depois: {
            numeroClientes: result.totalClientes,
            sourceFile: result.sourceFile,
          },
          nota: 'Importacao Excel de clientes concluida.',
        });
      }

      state.preview = null;
      dom.importFile.value = '';
      dom.importPreviewWrap.innerHTML = '';
      window.toast('Importação concluída com sucesso.');
    } catch (error) {
      console.error(error);
      window.toast(error.message || 'Erro ao aplicar a importação.');
    } finally {
      setImportBusy(false);
    }
  }

  function cancelImportPreview() {
    state.preview = null;
    dom.importFile.value = '';
    dom.importPreviewWrap.innerHTML = '';
  }

  function renderImportPreview() {
    if (!state.preview) {
      dom.importPreviewWrap.innerHTML = '';
      return;
    }

    const summary = state.preview.summary;
    const itemsHtml = state.preview.clients.slice(0, 10).map(item => `
      <div class="clientes-preview-row">
        <div class="clientes-preview-copy">
          <div class="clientes-preview-title">${window.escHtml(item.nome)}</div>
          <div class="clientes-preview-sub">
            ${item.numeroCliente ? 'Nº ' + window.escHtml(item.numeroCliente) + ' · ' : ''}
            ${window.escHtml(item.grupo || 'Sem grupo')}
            ${item.escritorioOrigem ? ' · ' + window.escHtml(item.escritorioOrigem) : ''}
            · ${item.summary.totalCategorias} categoria${item.summary.totalCategorias !== 1 ? 's' : ''}
          </div>
        </div>
        <span class="clientes-preview-badge ${item.isAmbiguous ? 'warning' : item.isExisting ? 'update' : 'new'}">
          ${item.isBlocked ? 'Bloqueado' : item.isExisting ? 'Atualizar' : 'Novo'}
        </span>
      </div>
    `).join('');

    const notes = []
      .concat(state.preview.ignoredRows.slice(0, 6).map(item => 'Linha ' + item.rowNumber + ': ' + item.reason))
      .concat(state.preview.clients.flatMap(item => item.warnings).slice(0, 6));

    dom.importPreviewWrap.innerHTML = `
      <div class="clientes-import-preview">
        <div class="clientes-import-grid">
          <div class="clientes-preview-block">
            <div class="clientes-preview-head">
              <div>
                <h3>${window.escHtml(state.preview.fileName)}</h3>
                <p>Folha <strong>${window.escHtml(state.preview.sourceSheet)}</strong> · ${summary.totalCategorias} linhas de preço agrupadas em ${summary.totalClientes} clientes.</p>
              </div>
              <span class="clientes-soft-badge">Preview</span>
            </div>

            <div class="clientes-preview-list">
              ${itemsHtml || '<div class="clientes-preview-note">Sem clientes válidos para importar.</div>'}
            </div>
            ${state.preview.clients.length > 10 ? `<p class="clientes-empty-note" style="margin-top:10px;">Mais ${state.preview.clients.length - 10} cliente(s) incluído(s) no preview final.</p>` : ''}
          </div>

          <div class="clientes-preview-block">
            <div class="clientes-preview-head">
              <div>
                <h3>Resumo</h3>
                <p>Antes de gravar no Firestore, confirma o impacto desta importação.</p>
              </div>
            </div>

            <div class="clientes-history-tags" style="margin-top:0;">
              <span class="clientes-status-badge new">${summary.novos} novos</span>
              <span class="clientes-status-badge update">${summary.existentes} atualizações</span>
              <span class="clientes-status-badge warning">${summary.ambiguos} ambíguos</span>
              <span class="clientes-soft-badge">${summary.bloqueados} bloqueados</span>
              <span class="clientes-soft-badge">${summary.linhasIgnoradas} linhas ignoradas</span>
            </div>

            <div class="clientes-preview-notes" style="margin-top:12px;">
              ${(notes.length ? notes : ['Sem avisos relevantes no preview.']).map(note => `<div class="clientes-preview-note">${window.escHtml(note)}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="clientes-import-actions">
          <button class="btn btn-secondary" type="button" onclick="window.ClientesPage.cancelImportPreview()">Limpar preview</button>
          <button class="btn btn-primary" type="button" onclick="window.ClientesPage.confirmImport()" ${state.preview.clients.some(item => !item.isBlocked) ? '' : 'disabled'}>
            Confirmar importação
          </button>
        </div>
      </div>
    `;
  }

  function getFilteredClientes() {
    const search = normalizeText(dom.filterSearch.value);
    const office = dom.filterOffice.value;
    const status = dom.filterStatus.value;

    return state.clientes.filter(cliente => {
      if (office && (cliente.escritorioOrigem || '') !== office) return false;
      if (status === 'com-precos' && !hasPrices(cliente)) return false;
      if (status === 'sem-precos' && hasPrices(cliente)) return false;

      if (!search) return true;

      const haystack = [
        cliente.nome,
        cliente.numeroCliente,
        cliente.grupo,
        cliente.escritorioOrigem,
      ].map(normalizeText).join(' ');

      return haystack.includes(search);
    });
  }

  function ensureSelection() {
    if (state.filtered.some(cliente => cliente.id === state.selectedId)) return;
    state.selectedId = state.filtered.length ? state.filtered[0].id : '';
  }

  function renderStats() {
    const total = state.clientes.length;
    const withPrices = state.clientes.filter(hasPrices).length;
    const offices = new Set(state.clientes.map(item => item.escritorioOrigem).filter(Boolean)).size;
    const revised = state.clientes.filter(item => !!getCurrentRevision(item)).length;

    dom.statsBar.innerHTML = `
      <div class="stat-chip">
        <span class="stat-val">${total}</span>
        <span class="stat-lbl">Clientes</span>
      </div>
      <div class="stat-chip">
        <span class="stat-val" style="color:var(--blue);">${withPrices}</span>
        <span class="stat-lbl">Com preços</span>
      </div>
      <div class="stat-chip">
        <span class="stat-val" style="color:var(--amber);">${Math.max(total - withPrices, 0)}</span>
        <span class="stat-lbl">Sem preços</span>
      </div>
      <div class="stat-chip">
        <span class="stat-val" style="color:var(--teal);">${offices}</span>
        <span class="stat-lbl">Escritórios</span>
      </div>
      <div class="stat-chip">
        <span class="stat-val" style="color:var(--green);">${revised}</span>
        <span class="stat-lbl">Com revisões</span>
      </div>
    `;
  }

  function renderOfficeOptions() {
    const currentValue = dom.filterOffice.value;
    const offices = Array.from(new Set(state.clientes.map(item => item.escritorioOrigem).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-PT'));

    dom.filterOffice.innerHTML = '<option value="">Todos</option>' + offices.map(office => (
      `<option value="${window.escHtml(office)}">${window.escHtml(office)}</option>`
    )).join('');

    if (offices.includes(currentValue)) dom.filterOffice.value = currentValue;
  }

  function renderList() {
    dom.clientsCountLabel.textContent = `${state.filtered.length} cliente${state.filtered.length !== 1 ? 's' : ''} visível${state.filtered.length !== 1 ? 'is' : ''}`;

    if (!state.filtered.length) {
      dom.clientesList.innerHTML = `
        <div class="empty-state clientes-list-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 7h16M4 12h16M4 17h10"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>
          <div class="empty-title">Nenhum cliente encontrado</div>
          <div class="empty-sub">Ajusta os filtros ou importa um ficheiro Excel para começar.</div>
        </div>
      `;
      return;
    }

    dom.clientesList.innerHTML = state.filtered.map(cliente => {
      const currentRevision = getCurrentRevision(cliente);
      const totalCategorias = cliente.precosAtuais ? Object.keys(cliente.precosAtuais).length : 0;
      const latestDate = currentRevision ? window.fmtDataHora(currentRevision.importedAt) : 'Sem revisões';

      return `
        <article class="cliente-list-card ${cliente.id === state.selectedId ? 'active' : ''}" data-id="${cliente.id}">
          <div class="cliente-list-card-head">
            <div>
              <div class="cliente-list-title">${window.escHtml(cliente.nome || 'Sem nome')}</div>
              <div class="cliente-list-sub">
                ${cliente.numeroCliente ? 'Nº ' + window.escHtml(cliente.numeroCliente) + ' · ' : ''}
                ${window.escHtml(cliente.grupo || 'Sem grupo')}
              </div>
            </div>
            <span class="clientes-status-badge ${hasPrices(cliente) ? 'update' : 'warning'}">
              ${hasPrices(cliente) ? 'Com preços' : 'Sem preços'}
            </span>
          </div>

          <div class="cliente-list-metas">
            ${cliente.escritorioOrigem ? `<span class="clientes-soft-badge">${window.escHtml(cliente.escritorioOrigem)}</span>` : ''}
            <span class="clientes-soft-badge">${window.escHtml(latestDate)}</span>
          </div>

          <div class="cliente-list-prices">
            <div class="cliente-mini-stat">
              <strong>${totalCategorias}</strong>
              <span>Categorias</span>
            </div>
            <div class="cliente-mini-stat">
              <strong>${Array.isArray(cliente.revisoes) ? cliente.revisoes.length : 0}</strong>
              <span>Revisões</span>
            </div>
            <div class="cliente-mini-stat">
              <strong>${currentRevision ? window.escHtml(currentRevision.sourceFile || 'Manual') : '—'}</strong>
              <span>Origem</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    dom.clientesList.querySelectorAll('[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        state.selectedId = card.getAttribute('data-id');
        render();
      });
    });
  }

  function renderDetail() {
    const cliente = state.filtered.find(item => item.id === state.selectedId) || state.clientes.find(item => item.id === state.selectedId);
    if (!cliente) {
      dom.clienteDetail.innerHTML = `
        <div class="empty-state clientes-detail-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 11h1v5h1"/></svg>
          <div class="empty-title">Seleciona um cliente</div>
          <div class="empty-sub">O detalhe mostra preços atuais e o histórico das importações aplicadas.</div>
        </div>
      `;
      return;
    }

    const currentRevision = getCurrentRevision(cliente);
    const priceEntries = Object.values(cliente.precosAtuais || {}).sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || ''), 'pt-PT'));
    const revisions = (cliente.revisoes || []).slice().reverse();

    dom.clienteDetail.innerHTML = `
      <div class="clientes-detail-wrap">
        <div class="clientes-detail-main">
          <div class="clientes-detail-heading">
            <div class="clientes-detail-titleblock">
              <div class="clientes-detail-subcopy">Cliente global</div>
              <h2>${window.escHtml(cliente.nome || 'Sem nome')}</h2>
            </div>
            <div class="clientes-detail-meta">
              ${cliente.numeroCliente ? `<span class="clientes-soft-badge">Nº ${window.escHtml(cliente.numeroCliente)}</span>` : ''}
              ${cliente.grupo ? `<span class="clientes-soft-badge">${window.escHtml(cliente.grupo)}</span>` : ''}
              ${cliente.escritorioOrigem ? `<span class="clientes-soft-badge">${window.escHtml(cliente.escritorioOrigem)}</span>` : ''}
            </div>
          </div>

          <div class="clientes-detail-grid">
            <div class="clientes-detail-card">
              <div class="clientes-detail-card-label">Categorias ativas</div>
              <div class="clientes-detail-card-value">${priceEntries.length || '—'}</div>
            </div>
            <div class="clientes-detail-card">
              <div class="clientes-detail-card-label">Revisões</div>
              <div class="clientes-detail-card-value">${Array.isArray(cliente.revisoes) ? cliente.revisoes.length : 0}</div>
            </div>
            <div class="clientes-detail-card">
              <div class="clientes-detail-card-label">Última importação</div>
              <div class="clientes-detail-card-value">${currentRevision ? window.fmtDataHora(currentRevision.importedAt) : 'Sem revisão'}</div>
            </div>
            <div class="clientes-detail-card">
              <div class="clientes-detail-card-label">Data proposta / contrato</div>
              <div class="clientes-detail-card-value">${window.escHtml(cliente.ultimaPropostaData || (currentRevision && currentRevision.propostaDataRaw) || '—')}</div>
            </div>
          </div>

          ${cliente.obs ? `
            <div class="clientes-preview-note">
              <strong style="display:block;margin-bottom:4px;color:var(--text);">Observações</strong>
              ${window.escHtml(cliente.obs)}
            </div>
          ` : ''}
        </div>

        <section class="clientes-section">
          <div class="clientes-section-head">
            <h3>Preços atuais</h3>
            <span class="clientes-soft-badge">${priceEntries.length} categoria${priceEntries.length !== 1 ? 's' : ''}</span>
          </div>

          ${priceEntries.length ? `
            <div class="clientes-prices-wrap">
              <table class="clientes-prices-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Preço 22 dias</th>
                    <th>Valor dia</th>
                    <th>Preço hora</th>
                  </tr>
                </thead>
                <tbody>
                  ${priceEntries.map(item => `
                    <tr>
                      <td>
                        <span class="clientes-price-main">${window.escHtml(item.categoria || '—')}</span>
                        ${item.obsLinha ? `<span class="clientes-price-sub">${window.escHtml(item.obsLinha)}</span>` : ''}
                      </td>
                      <td>${formatMoney(item.preco22Dias)}</td>
                      <td>${formatMoney(item.valorDia)}</td>
                      <td>${formatMoney(item.precoHora)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="clientes-empty-note">Ainda não existem preços importados para este cliente.</div>'}
        </section>

        <section class="clientes-section">
          <div class="clientes-section-head">
            <h3>Histórico de revisões</h3>
            <span class="clientes-soft-badge">${revisions.length} entrada${revisions.length !== 1 ? 's' : ''}</span>
          </div>

          ${revisions.length ? `
            <div class="clientes-history-list">
              ${revisions.map(revision => `
                <article class="clientes-history-item">
                  <div class="clientes-history-item-head">
                    <div>
                      <h4>${window.fmtDataHora(revision.importedAt)}</h4>
                      <p>${window.escHtml(revision.importedByName || 'Utilizador desconhecido')} · ${window.escHtml(revision.sourceFile || 'Importação manual')} · ${window.escHtml(revision.sourceSheet || 'Folha principal')}</p>
                    </div>
                    <span class="clientes-soft-badge">${Array.isArray(revision.linhas) ? revision.linhas.length : 0} categorias</span>
                  </div>
                  <div class="clientes-history-tags">
                    ${revision.propostaDataRaw ? `<span class="clientes-soft-badge">Proposta: ${window.escHtml(revision.propostaDataRaw)}</span>` : ''}
                    <span class="clientes-soft-badge">${Array.isArray(revision.linhas) ? revision.linhas.filter(line => line.precoHora != null).length : 0} com preço hora</span>
                    <span class="clientes-soft-badge">${Array.isArray(revision.linhas) ? revision.linhas.filter(line => line.valorDia != null).length : 0} com valor dia</span>
                  </div>
                </article>
              `).join('')}
            </div>
          ` : '<div class="clientes-empty-note">Sem histórico de revisões registado.</div>'}
        </section>
      </div>
    `;
  }

  function render() {
    state.filtered = getFilteredClientes();
    ensureSelection();
    renderStats();
    renderOfficeOptions();
    renderList();
    renderDetail();
  }

  function renderLoading() {
    dom.clientesList.innerHTML = [
      '<div class="skeleton-card"><div class="skeleton skeleton-line w-3/4"></div><div class="skeleton skeleton-line w-1/2"></div></div>',
      '<div class="skeleton-card"><div class="skeleton skeleton-line w-full"></div><div class="skeleton skeleton-line w-1/2"></div></div>',
      '<div class="skeleton-card"><div class="skeleton skeleton-line w-3/4"></div><div class="skeleton skeleton-line w-1/4"></div></div>',
    ].join('');

    dom.clienteDetail.innerHTML = `
      <div class="clientes-detail-wrap">
        <div class="skeleton skeleton-line w-1/2" style="height:24px;"></div>
        <div class="skeleton skeleton-line w-3/4"></div>
        <div class="skeleton skeleton-line w-full"></div>
      </div>
    `;
  }

  function subscribeClientes() {
    renderLoading();
    window.setStatus('A ligar…', '#d97706');

    const unsubscribe = window.ClientesService.listenAll({
      onData(clientes) {
        state.clientes = clientes;
        render();
        window.setStatus('✓ Sincronizado', '#16a34a');
        setTimeout(() => window.setStatus(''), 2800);
      },
      onError(error) {
        console.error(error);
        window.setStatus('Erro de ligação', '#dc2626');
        window.toast('Erro ao carregar clientes.');
      },
    });

    window.addEventListener('beforeunload', () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
  }

  window.ClientesPage = {
    toggleImportPanel,
    confirmImport,
    cancelImportPreview,
  };

  window.bootProtectedPage({
    activePage: 'clientes',
    moduleId: 'clientes',
  }, function() {
    cacheDom();
    bindFilters();
    updateImportPermissionState();
    subscribeClientes();
  });
})();
