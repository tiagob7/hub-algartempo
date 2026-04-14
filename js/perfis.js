// perfis.js — UI de gestão de perfis de permissão

(function() {
  'use strict';

  // Todas as ações possíveis no eixo X da matriz
  const ALL_ACTIONS = [
    { key: 'view',    label: 'Ver' },
    { key: 'create',  label: 'Criar' },
    { key: 'gerir',   label: 'Gerir' }, // agrupa resolve/edit/manage
  ];

  // Mapeamento: action no modelo → coluna "gerir"
  const GERIR_KEYS = ['resolve', 'edit', 'manage'];

  function getModuleActions() {
    return window.PerfisService.getModuleActions();
  }

  // Resolve o valor de permissao num perfil editado (draft)
  function draftGet(draft, moduleId, actionKey) {
    return !!(draft[moduleId] && draft[moduleId][actionKey]);
  }

  // Devolve o action key real de "gerir" para um módulo específico
  function gerirKeyFor(mod) {
    return mod.actions.find(a => GERIR_KEYS.includes(a.key));
  }

  // ── Renderização de cards ─────────────────────────────────────────────────────

  function modTagsHtml(perfil) {
    const mods = (perfil.permissoes && perfil.permissoes.modules) || {};
    return getModuleActions()
      .filter(m => {
        const modPerms = mods[m.id] || {};
        return modPerms.view !== false;
      })
      .map(m => {
        const modPerms = mods[m.id] || {};
        const hasManage = m.actions
          .filter(a => a.key !== 'view')
          .some(a => !!modPerms[a.key]);
        return `<span class="mod-tag${hasManage ? ' has-manage' : ''}">${m.label}</span>`;
      })
      .join('');
  }

  function renderCards(perfis) {
    const grid = document.getElementById('perfisGrid');
    if (!grid) return;

    grid.innerHTML = '';

    perfis.forEach(perfil => {
      const card = document.createElement('div');
      card.className = 'perfil-card';
      card.innerHTML = `
        <div class="perfil-card-head">
          <span class="perfil-nome">${escHtml(perfil.nome)}</span>
        </div>
        <div class="perfil-modulos">${modTagsHtml(perfil)}</div>
        <div class="perfil-card-actions">
          <button class="btn-card" data-edit="${perfil.id}">Editar</button>
          <button class="btn-card danger" data-delete="${perfil.id}">Apagar</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Card "Novo perfil"
    const novoCard = document.createElement('div');
    novoCard.className = 'perfil-card card-novo';
    novoCard.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 2v12M2 8h12"/>
      </svg>
      Novo perfil
    `;
    novoCard.addEventListener('click', () => abrirModal(null));
    grid.appendChild(novoCard);

    // Delegação de eventos nos botões dos cards
    grid.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => abrirModal(btn.getAttribute('data-edit')));
    });
    grid.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => confirmarApagar(btn.getAttribute('data-delete')));
    });
  }

  // ── Modal de edição ───────────────────────────────────────────────────────────

  let _editingId = null;
  let _draft = {};   // { moduleId: { actionKey: bool } }

  function abrirModal(perfilId) {
    _editingId = perfilId;
    _draft = {};

    const modal = document.getElementById('modalPerfil');
    const titleEl = document.getElementById('modalTitle');
    const nomeEl = document.getElementById('perfilNome');

    if (perfilId) {
      titleEl.textContent = 'Editar Perfil';
      window.PerfisService.loadPerfis().then(lista => {
        const perfil = lista.find(p => p.id === perfilId);
        if (!perfil) return;
        nomeEl.value = perfil.nome;
        const mods = (perfil.permissoes && perfil.permissoes.modules) || {};
        getModuleActions().forEach(m => {
          _draft[m.id] = {};
          m.actions.forEach(a => {
            _draft[m.id][a.key] = !!(mods[m.id] && mods[m.id][a.key]);
          });
        });
        renderMatrix();
      });
    } else {
      titleEl.textContent = 'Novo Perfil';
      nomeEl.value = '';
      // defaults: view=true, resto=false
      getModuleActions().forEach(m => {
        _draft[m.id] = { view: true };
        m.actions.forEach(a => { if (a.key !== 'view') _draft[m.id][a.key] = false; });
      });
      renderMatrix();
    }

    modal.classList.add('open');
    nomeEl.focus();
  }

  function fecharModal() {
    document.getElementById('modalPerfil').classList.remove('open');
    _editingId = null;
    _draft = {};
  }

  function renderMatrix() {
    const container = document.getElementById('permMatrix');
    if (!container) return;

    const mods = getModuleActions();

    // Header
    let html = `
      <div class="matrix-row header">
        <div class="matrix-cell header-cell">Módulo</div>
        ${ALL_ACTIONS.map(a => `<div class="matrix-cell header-cell">${a.label}</div>`).join('')}
      </div>
    `;

    mods.forEach(mod => {
      const viewOn = draftGet(_draft, mod.id, 'view');
      const gerirAction = gerirKeyFor(mod);

      html += `<div class="matrix-row${viewOn ? '' : ' disabled-row'}" id="matrow_${mod.id}">`;
      html += `<div class="matrix-cell mod-name">${mod.label}</div>`;

      // Ver
      const hasView = mod.actions.some(a => a.key === 'view');
      html += `<div class="matrix-cell matrix-check">`;
      if (hasView) {
        html += `<input type="checkbox" data-mod="${mod.id}" data-action="view" ${viewOn ? 'checked' : ''}>`;
      } else {
        html += `<span class="empty">—</span>`;
      }
      html += `</div>`;

      // Criar
      const hasCreate = mod.actions.some(a => a.key === 'create');
      html += `<div class="matrix-cell matrix-check">`;
      if (hasCreate) {
        const checked = draftGet(_draft, mod.id, 'create');
        html += `<input type="checkbox" data-mod="${mod.id}" data-action="create" ${checked ? 'checked' : ''} ${!viewOn ? 'disabled' : ''}>`;
      } else {
        html += `<span class="empty">—</span>`;
      }
      html += `</div>`;

      // Gerir (resolve / edit / manage)
      html += `<div class="matrix-cell matrix-check">`;
      if (gerirAction) {
        const checked = draftGet(_draft, mod.id, gerirAction.key);
        html += `<input type="checkbox" data-mod="${mod.id}" data-action="${gerirAction.key}" ${checked ? 'checked' : ''} ${!viewOn ? 'disabled' : ''}>`;
      } else {
        html += `<span class="empty">—</span>`;
      }
      html += `</div>`;

      html += `</div>`;
    });

    container.innerHTML = html;

    // Listeners de checkboxes
    container.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const mod = cb.getAttribute('data-mod');
        const action = cb.getAttribute('data-action');
        _draft[mod] = _draft[mod] || {};
        _draft[mod][action] = cb.checked;

        // Se desligar "ver", desligar e desabilitar o resto
        if (action === 'view') {
          const row = document.getElementById('matrow_' + mod);
          if (row) row.classList.toggle('disabled-row', !cb.checked);
          container.querySelectorAll(`input[data-mod="${mod}"]:not([data-action="view"])`).forEach(other => {
            other.disabled = !cb.checked;
            if (!cb.checked) {
              other.checked = false;
              _draft[mod][other.getAttribute('data-action')] = false;
            }
          });
        }
      });
    });
  }

  async function guardarPerfil() {
    const nome = (document.getElementById('perfilNome').value || '').trim();
    if (!nome) {
      toast('Nome do perfil é obrigatório.');
      return;
    }

    const btn = document.getElementById('btnGuardarPerfil');
    btn.disabled = true;
    btn.textContent = 'A guardar…';

    // Construir permissoes a partir do draft
    const modules = {};
    getModuleActions().forEach(mod => {
      modules[mod.id] = {};
      mod.actions.forEach(a => {
        modules[mod.id][a.key] = !!(_draft[mod.id] && _draft[mod.id][a.key]);
      });
    });

    const id = _editingId || nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      await window.PerfisService.upsertPerfil({
        id,
        nome,
        permissoes: { modules },
      });
      fecharModal();
      toast('Perfil guardado.');
      await reloadCards();
    } catch (err) {
      console.error('[perfis] Erro ao guardar:', err);
      toast('Erro ao guardar perfil.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }

  // ── Apagar ────────────────────────────────────────────────────────────────────

  let _pendingDeleteId = null;

  function confirmarApagar(perfilId) {
    _pendingDeleteId = perfilId;
    window.PerfisService.loadPerfis().then(lista => {
      const perfil = lista.find(p => p.id === perfilId);
      const nome = perfil ? perfil.nome : perfilId;
      document.getElementById('confirmText').textContent =
        `Vais apagar o perfil "${nome}". Os utilizadores que têm este perfil atribuído perderão as suas permissões e voltarão aos defaults. Esta ação não pode ser desfeita.`;
      document.getElementById('confirmOverlay').classList.add('open');
    });
  }

  async function executarApagar() {
    if (!_pendingDeleteId) return;
    try {
      await window.PerfisService.deletePerfil(_pendingDeleteId);
      toast('Perfil apagado.');
      await reloadCards();
    } catch (err) {
      console.error('[perfis] Erro ao apagar:', err);
      toast('Erro ao apagar perfil.');
    } finally {
      _pendingDeleteId = null;
      document.getElementById('confirmOverlay').classList.remove('open');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async function reloadCards() {
    window.PerfisService.invalidateCache();
    const perfis = await window.PerfisService.loadPerfis();
    renderCards(perfis);
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  window.escHtml = escHtml;

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  window.bootProtectedPage({
    activePage: 'perfis',
    moduleId: 'perfis',
  }, ({ profile }) => {
    const me = profile ? (profile.nomeCompleto || profile.nome || profile.email || '') : '';
    const meInfo = document.getElementById('meInfo');
    if (meInfo) meInfo.textContent = 'Sessão iniciada como: ' + me;

    // Listeners do modal
    document.getElementById('btnCancelarModal').addEventListener('click', fecharModal);
    document.getElementById('btnGuardarPerfil').addEventListener('click', guardarPerfil);
    document.getElementById('btnConfirmCancel').addEventListener('click', () => {
      _pendingDeleteId = null;
      document.getElementById('confirmOverlay').classList.remove('open');
    });
    document.getElementById('btnConfirmOk').addEventListener('click', executarApagar);

    // Fechar modal ao clicar fora
    document.getElementById('modalPerfil').addEventListener('click', e => {
      if (e.target === e.currentTarget) fecharModal();
    });

    // Carregar perfis
    window.PerfisService.loadPerfis().then(perfis => {
      renderCards(perfis);
    }).catch(err => {
      console.error('[perfis] Erro ao carregar:', err);
      toast('Erro ao carregar perfis.');
    });
  });

})();
