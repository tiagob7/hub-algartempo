const db = firebase.firestore();

function renderDashboardModuleNav() {
  if (typeof window.getAppModules !== 'function') return;

  let host = document.getElementById('dashboardModulesNav');
  if (!host) {
    const nav = document.querySelector('.nav-links');
    const searchWrap = document.getElementById('globalSearchWrap');
    if (!nav) return;

    host = document.createElement('div');
    host.id = 'dashboardModulesNav';
    host.style.display = 'flex';
    host.style.gap = '8px';
    host.style.flexWrap = 'wrap';

    [...nav.querySelectorAll('.nav-link')].forEach(link => link.remove());
    if (searchWrap) nav.insertBefore(host, searchWrap);
    else nav.prepend(host);
  }

  const modules = window.getAppModules({
    group: 'main',
    forDashboardNav: true,
    profile: window.userProfile,
  });

  host.innerHTML = modules.map(m => `
    <a class="nav-link" href="${m.href}">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${m.icon}</svg>
      ${m.label}
    </a>
  `).join('');
}

// ── Dark mode ──
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  document.querySelectorAll('.dark-toggle-icon').forEach(el => {
    el.textContent = isDark ? '☀️' : '🌙';
  });
}
// Inicializar ícone do botão com base no estado actual
(function() {
  const isDark = document.documentElement.classList.contains('dark');
  document.querySelectorAll('.dark-toggle-icon').forEach(el => {
    el.textContent = isDark ? '☀️' : '🌙';
  });
})();

// ══════════════════════════════════════════════
// LAYOUT — drag & drop + toggle largura
// ══════════════════════════════════════════════

const LAYOUT_DEFAULT = [
  { id: 'comunicados', width: 'full' },
  { id: 'tarefas',     width: 'half' },
  { id: 'admissoes',   width: 'half' },
  { id: 'reclamacoes', width: 'full' },
  { id: 'calendario',  width: 'full' },
  { id: 'eventos',     width: 'half' },
  { id: 'actividade',  width: 'half' },
];

let dashboardLayout = null; // carregado do Firestore ou default
let _layoutSaveTimer = null;

// Aplica um array de layout ao DOM
function applyLayout(layout) {
  const grid = document.getElementById('mainGrid');
  if (!grid) return;

  // Reordenar painéis no DOM segundo o layout
  layout.forEach(item => {
    const panel = grid.querySelector(`[data-panel-id="${item.id}"]`);
    if (!panel) return;
    grid.appendChild(panel); // move para o fim na ordem correcta
    // Largura
    if (item.width === 'full') {
      panel.classList.add('full');
    } else {
      panel.classList.remove('full');
    }
    // Actualizar botão de toggle
    const btn = panel.querySelector('.panel-width-btn');
    if (btn) btn.classList.toggle('is-full', item.width === 'full');
  });
}

// Lê o layout actual do DOM e devolve array
function readLayoutFromDOM() {
  const grid = document.getElementById('mainGrid');
  if (!grid) return LAYOUT_DEFAULT.slice();
  return [...grid.querySelectorAll('[data-panel-id]')].map(panel => ({
    id: panel.dataset.panelId,
    width: panel.classList.contains('full') ? 'full' : 'half',
  }));
}

// Compara layout com o default
function isDefaultLayout(layout) {
  if (!layout || layout.length !== LAYOUT_DEFAULT.length) return false;
  return layout.every((item, i) =>
    item.id === LAYOUT_DEFAULT[i].id && item.width === LAYOUT_DEFAULT[i].width
  );
}

// Guarda no Firestore com debounce
function saveLayout() {
  clearTimeout(_layoutSaveTimer);
  _layoutSaveTimer = setTimeout(() => {
    const layout = readLayoutFromDOM();
    dashboardLayout = layout;
    const resetBtn = document.getElementById('layoutResetBtn');
    if (resetBtn) resetBtn.classList.toggle('visible', !isDefaultLayout(layout));
    if (window.currentUser) {
      firebase.firestore()
        .collection('utilizadores').doc(window.currentUser.uid)
        .update({ dashboardLayout: layout })
        .catch(e => console.warn('[layout] Erro ao guardar:', e));
    }
  }, 600);
}

// Toggle full/half de um painel
function toggleWidth(btn) {
  const panel = btn.closest('[data-panel-id]');
  if (!panel) return;
  const isFull = panel.classList.toggle('full');
  btn.classList.toggle('is-full', isFull);
  saveLayout();
}

// Repor layout original
function resetLayout() {
  applyLayout(LAYOUT_DEFAULT);
  dashboardLayout = LAYOUT_DEFAULT.slice();
  const resetBtn = document.getElementById('layoutResetBtn');
  if (resetBtn) resetBtn.classList.remove('visible');
  if (window.currentUser) {
    firebase.firestore()
      .collection('utilizadores').doc(window.currentUser.uid)
      .update({ dashboardLayout: firebase.firestore.FieldValue.delete() })
      .catch(() => {});
  }
}

// Inicializa SortableJS no grid
function initSortable() {
  const grid = document.getElementById('mainGrid');
  if (!grid || typeof Sortable === 'undefined') return;
  Sortable.create(grid, {
    handle: '.drag-handle',
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd() {
      saveLayout();
    },
  });
}

// ── STATE ──
let tasks       = [];
let comunicados = [];
let admissoes   = [];
let reclamacoes = [];
let calData     = null;
let loadedFlags = { tasks: false, com: false, cal: false, adm: false, rec: false };
let unsubFns    = []; // para cancelar listeners ao mudar filtro
let _switchEscTimer = null;
let errorFlags  = {}; // regista listeners que falharam

// ── AGUARDAR AUTH ──
document.addEventListener('authReady', ({ detail }) => {
  const profile = detail.profile;

  // mini-header não é injetado no dashboard — renderNavbar('dashboard') é no-op
  window.renderNavbar('dashboard');
  renderDashboardModuleNav();

  // user info + logout no canto superior direito
  const isAdmin = window.isAdmin();
  const nome = profile ? (profile.nomeCompleto || profile.nome || '') : '';
  const dashUser = document.getElementById('dashUserInfo');
  if (dashUser) {
    dashUser.innerHTML = `
      <span style="font-size:10px;color:var(--muted);">${nome}</span>
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;padding:2px 8px;border-radius:10px;font-weight:500;${isAdmin ? 'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;' : 'background:#f4f4f6;color:#8888a0;border:1px solid #e2e2e8;'}">${isAdmin ? 'Admin' : 'Colaborador'}</span>
      <button onclick="window.logout()" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid var(--border);background:none;font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);border-radius:8px;cursor:pointer;" onmouseover="this.style.borderColor='#dc2626';this.style.color='#dc2626'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/></svg>
        Sair
      </button>
    `;
  }

  // mostrar botão de gestão de utilizadores apenas para admin
  const userAdminBtn = document.getElementById('userAdminBtn');
  if (userAdminBtn) {
    userAdminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  // filtro de escritório para admin — pills sem reload
  const escritorio = window.escritorioAtivo();

  if (isAdmin) {
    const pillsWrap = document.getElementById('adminEscritorioPills');
    if (pillsWrap) {
      pillsWrap.style.display = 'flex';
      // Carregar escritórios dinâmicos a partir da configuração partilhada
      loadEscritorios().then(lista => {
        pillsWrap.innerHTML = '';
        const opcoes = [
          { val: 'todos', label: 'Todos' },
          ...lista.map(e => ({ val: e.id, label: e.nome }))
        ];
        opcoes.forEach(({ val, label }) => {
          const btn = document.createElement('button');
          btn.dataset.e = val;
          btn.textContent = label;
          const ativo = (val === escritorio) || (val === 'todos' && (!escritorio || escritorio === 'todos'));
          btn.className = 'dash-esc-pill' + (ativo ? ' ativo' : '');
          btn.onclick = () => switchEscritorioDash(val);
          pillsWrap.appendChild(btn);
        });
      }).catch(() => {
        // fallback simples: mostrar apenas "Todos"
        pillsWrap.innerHTML = '';
        const btn = document.createElement('button');
        btn.dataset.e = 'todos';
        btn.textContent = 'Todos';
        btn.className = 'dash-esc-pill ativo';
        btn.onclick = () => switchEscritorioDash('todos');
        pillsWrap.appendChild(btn);
      });
    }
  }

  updateSubtitle(escritorio);

  // ── Carregar layout guardado ──
  const savedLayout = window.userProfile && window.userProfile.dashboardLayout;
  if (savedLayout && Array.isArray(savedLayout) && savedLayout.length) {
    // Garantir que todos os painéis estão representados (retrocompatibilidade)
    const merged = LAYOUT_DEFAULT.map(def => {
      const saved = savedLayout.find(s => s.id === def.id);
      return saved || def;
    });
    // Acrescentar painéis novos não presentes no layout guardado
    savedLayout.filter(s => !LAYOUT_DEFAULT.find(d => d.id === s.id)).forEach(s => merged.push(s));
    dashboardLayout = merged;
  } else {
    dashboardLayout = LAYOUT_DEFAULT.slice();
  }
  applyLayout(dashboardLayout);
  const resetBtn = document.getElementById('layoutResetBtn');
  if (resetBtn) resetBtn.classList.toggle('visible', !isDefaultLayout(dashboardLayout));

  // Inicializar drag & drop
  initSortable();

  startSync(escritorio);
});

// ── TROCAR ESCRITÓRIO (admin, sem reload) ──
function switchEscritorioDash(val) {
  // Atualizar pills imediatamente para feedback visual
  document.querySelectorAll('.dash-esc-pill').forEach(b => {
    b.classList.toggle('ativo', b.dataset.e === val);
  });
  updateSubtitle(val);

  // Debounce: evitar múltiplos re-subscribes em cliques rápidos
  clearTimeout(_switchEscTimer);
  _switchEscTimer = setTimeout(() => {
    sessionStorage.setItem('filtroEscritorio', val);
    startSync(val);
  }, 200);
}

function updateSubtitle(escritorio) {
  let label;
  if (!escritorio || escritorio === 'todos') {
    label = 'Todos os escritórios';
  } else if (window.nomeEscritorio) {
    label = window.nomeEscritorio(escritorio);
  } else {
    label = escritorio.charAt(0).toUpperCase() + escritorio.slice(1);
  }

  const badge = document.getElementById('escritorioBadge');
  if (!badge) return;
  badge.innerHTML = `
    <span class="escritorio-badge">
      <span class="escritorio-dot"></span>
      ${label}
    </span>
  `;
}

// ── ESCRITÓRIO ATIVO (atualizado sem reload) ──
let escritorioAtivoDash = '';

// ── LISTENERS — carregam tudo, filtro feito no cliente ──
function startSync(escritorio) {
  // ── Helper: ID do documento de calendário do mês atual ──
  function dashCalDocId(esc) {
    const n = new Date();
    return 'calendario_' + esc + '_' + n.getFullYear() + '_' + String(n.getMonth()+1).padStart(2,'0');
  }

  escritorioAtivoDash = escritorio || '';

  // Se já temos listeners ativos, re-renderizar (filtro no cliente)
  // Mas o calendário é especial — tem um doc por escritório, precisa de re-subscrever
  if (unsubFns.length > 0) {
    // Re-subscrever calendário se mudou de escritório
    const calEscNovo = (escritorioAtivoDash && escritorioAtivoDash !== 'todos') ? escritorioAtivoDash : (window.getEscritoriosSync ? (window.getEscritoriosSync()[0]||{}).id : '') || 'quarteira';
    if (window._dashCalEsc !== calEscNovo) {
      // Remover unsub antigo do array antes de cancelar
      const calIdx = unsubFns.indexOf(window._dashCalUnsub);
      if (calIdx > -1) unsubFns.splice(calIdx, 1);
      if (window._dashCalUnsub) window._dashCalUnsub();
      window._dashCalEsc = calEscNovo;
      const newDocId = dashCalDocId(calEscNovo);
      window._dashCalUnsub = db.collection('calendarios').doc(newDocId).onSnapshot(snap => {
        calData = snap.exists ? snap.data() : null;
        renderCalMini();
        renderEvents();
      }, err => { console.error('cal:', err); });
      unsubFns.push(window._dashCalUnsub);
    }
    renderAll();
    return;
  }

  // Primeira vez: criar listeners sem .where no servidor (evita índices compostos)
  loadedFlags = { tasks: false, com: false, cal: false, adm: false, rec: false };
  errorFlags  = {};
  setStatus('A ligar…', '#f59e0b');

  // ── Tarefas ──
  const unsubTarefas = db.collection('tarefas_todo')
    .orderBy('ordemChegada', 'asc')
    .limit(50)
    .onSnapshot(snap => {
      tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedFlags.tasks = true;
      checkAllLoaded();
    }, err => {
      console.error('tasks:', err);
      // Fallback sem orderBy (evita bloqueio se o índice falhar)
      db.collection('tarefas_todo').get().then(snap => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loadedFlags.tasks = true;
        checkAllLoaded();
      }).catch(() => { loadedFlags.tasks = true; checkAllLoaded(); });
    });
  unsubFns.push(unsubTarefas);

  // ── Comunicados ──
  const unsubCom = db.collection('comunicados')
    .orderBy('criadoEm', 'desc')
    .limit(20)
    .onSnapshot(snap => {
      comunicados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedFlags.com = true;
      checkAllLoaded();
    }, err => { console.error('com:', err); errorFlags.com = true; loadedFlags.com = true; checkAllLoaded(); });
  unsubFns.push(unsubCom);

  // ── Admissões ──
  const unsubAdm = db.collection('admissoes')
    .orderBy('criadoEm', 'desc')
    .limit(20)
    .onSnapshot(snap => {
      admissoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedFlags.adm = true;
      checkAllLoaded();
    }, err => { console.error('adm:', err); errorFlags.adm = true; loadedFlags.adm = true; checkAllLoaded(); });
  unsubFns.push(unsubAdm);

  // ── Calendário — carrega o doc do escritório ativo ──
  // Re-subscreve quando o escritório muda
  const calEsc = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? escritorioAtivoDash : (window.getEscritoriosSync ? (window.getEscritoriosSync()[0]||{}).id : '') || 'quarteira';
  const calDocId = dashCalDocId(calEsc);

  window._dashCalEsc = calEsc;
  window._dashCalUnsub = db.collection('calendarios').doc(calDocId).onSnapshot(snap => {
    calData = snap.exists ? snap.data() : null;
    loadedFlags.cal = true;
    checkAllLoaded();
  }, err => { console.error('cal:', err); errorFlags.cal = true; loadedFlags.cal = true; checkAllLoaded(); });
  unsubFns.push(window._dashCalUnsub);

  // ── Reclamações ──
  const unsubRec = db.collection('reclamacoes_horas')
    .orderBy('criadoEm', 'desc')
    .limit(20)
    .onSnapshot(snap => {
      reclamacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedFlags.rec = true;
      checkAllLoaded();
      renderReclamacoes(); // atualizar painel mesmo após carregamento inicial
    }, err => { console.error('rec:', err); errorFlags.rec = true; loadedFlags.rec = true; checkAllLoaded(); });
  unsubFns.push(unsubRec);
}

// ── CHECK LOADED ──
function checkAllLoaded() {
  if (!loadedFlags.tasks || !loadedFlags.com || !loadedFlags.cal || !loadedFlags.adm || !loadedFlags.rec) return;
  renderAll();
  if (Object.keys(errorFlags).length > 0) {
    setStatus('⚠ Ligação parcial', '#d97706');
  } else {
    setStatus('✓ Sincronizado', '#16a34a');
    setTimeout(() => setStatus(''), 3000);
  }
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    'Actualizado às ' + now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}


// ── RENDER ALL ──
function renderAll() {
  renderUrgenteBanner();
  renderKPIs();
  renderTasks();
  renderComunicados();
  renderCalMini();
  renderEvents();
  renderAdmissoes();
  renderActivity();
  renderReclamacoes();
}

// ── URGENTE BANNER ──
function renderUrgenteBanner() {
  const banner   = document.getElementById('urgenteBanner');
  const urgentes = comunicados.filter(c =>
    c.tipo === 'urgente' &&
    !c.arquivado &&
    matchComunicadoEscritorioDash(c, escritorioAtivoDash)
  );
  if (!urgentes.length) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  banner.innerHTML = urgentes.slice(0, 2).map(u => `
    <div class="urgente-banner">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L1.5 13h13L8 2z"/><path d="M8 7v3M8 11.5v.5"/></svg>
      <div><strong>${escHtml(u.titulo)}</strong> — ${escHtml(u.autor || '')} · ${fmtShort(u.criadoEm)}</div>
    </div>
  `).join('');
}

// ── Helpers de filtro por escritório ──
function matchEscritorioDoc(doc, escritorio) {
  if (!escritorio || escritorio === 'todos') return true;
  const dest = doc.escritorio || '';
  const orig = doc.escritorioOrigem || '';
  return dest === escritorio || orig === escritorio;
}

function matchComunicadoEscritorioDash(c, esc) {
  if (!esc || esc === 'todos') return true;
  const dests = c.destinosEscritorio || null;
  if (dests && Array.isArray(dests) && dests.length) {
    if (dests.includes('todos')) return true;
    return dests.includes(esc);
  }
  return c.escritorio === esc;
}

// ── KPIs ──
function renderKPIs() {
  const filtT = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? tasks.filter(t => matchEscritorioDoc(t, escritorioAtivoDash))
    : tasks;
  const filtC = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? comunicados.filter(c => matchComunicadoEscritorioDash(c, escritorioAtivoDash))
    : comunicados;
  const filtA = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? admissoes.filter(a => matchEscritorioDoc(a, escritorioAtivoDash))
    : admissoes;
  const activas    = filtT.filter(t => t.estado !== 'concluido' && t.estado !== 'cancelado');
  const urgentes   = activas.filter(t => t.prioridade === 'urgente');
  const progresso  = activas.filter(t => t.estado === 'progresso');
  const concluidas = filtT.filter(t => t.estado === 'concluido');
  const pendentes  = activas.filter(t => t.estado === 'pendente');
  const comAtivos     = filtC.filter(c => !c.arquivado);
  const admPendentes  = filtA.filter(a => a.estado !== 'concluido' && a.estado !== 'cancelado');

  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi-card k-total">
      <div class="kpi-val">${activas.length}</div>
      <div class="kpi-lbl">Tarefas activas</div>
      <div class="kpi-sub">${tasks.length} no total</div>
    </div>
    <div class="kpi-card k-urgente">
      <div class="kpi-val">${urgentes.length}</div>
      <div class="kpi-lbl">Urgentes</div>
      <div class="kpi-sub">requerem atenção</div>
    </div>
    <div class="kpi-card k-progresso">
      <div class="kpi-val">${progresso.length}</div>
      <div class="kpi-lbl">Em progresso</div>
      <div class="kpi-sub">a ser trabalhadas</div>
    </div>
    <div class="kpi-card k-pendente">
      <div class="kpi-val">${pendentes.length}</div>
      <div class="kpi-lbl">Pendentes</div>
      <div class="kpi-sub">aguardam resposta</div>
    </div>
    <div class="kpi-card k-concluido">
      <div class="kpi-val">${concluidas.length}</div>
      <div class="kpi-lbl">Concluídas</div>
      <div class="kpi-sub">total histórico</div>
    </div>
    <div class="kpi-card k-com">
      <div class="kpi-val">${comAtivos.length}</div>
      <div class="kpi-lbl">Comunicados</div>
      <div class="kpi-sub">activos</div>
    </div>
    <div class="kpi-card k-adm">
      <div class="kpi-val">${admPendentes.length}</div>
      <div class="kpi-lbl">Admissões</div>
      <div class="kpi-sub">em processamento</div>
    </div>
  `;
}

// ── TASKS ──
const ESTADO_LABEL = { aguardar: 'A aguardar', progresso: 'Em progresso', concluido: 'Concluído', cancelado: 'Cancelado', pendente: 'Pendente' };
const PRIO_ORDER   = { urgente: 0, normal: 1, baixa: 2 };

function renderTasks() {
  const container = document.getElementById('tasksList');
  const isAdmin = window.isAdmin();
  const mostrarEscritorio = isAdmin && (!escritorioAtivoDash || escritorioAtivoDash === 'todos');
  const filtradas = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? tasks.filter(t => matchEscritorioDoc(t, escritorioAtivoDash))
    : tasks;

  const activas = filtradas
    .filter(t => t.estado !== 'concluido' && t.estado !== 'cancelado')
    .sort((a, b) => {
      const pd = (PRIO_ORDER[a.prioridade] ?? 1) - (PRIO_ORDER[b.prioridade] ?? 1);
      if (pd !== 0) return pd;
      return (a.ordemChegada || 0) - (b.ordemChegada || 0);
    })
    .slice(0, 8);

  if (!activas.length) {
    container.innerHTML = '<div class="empty-mini">Sem tarefas activas 🎉</div>';
    document.getElementById('progressWrap').style.display = 'none';
    return;
  }

  container.innerHTML = activas.map(t => `
    <div class="task-row"
      data-titulo="${escHtml(t.titulo)}"
      data-desc="${escHtml(t.descricao||'')}"
      data-pessoa="${escHtml(t.solicitante||'—')}"
      data-escritorio="${escHtml(t.escritorio||'—')}"
      data-prio="${escHtml(t.prioridade||'normal')}"
      data-estado="${escHtml(ESTADO_LABEL[t.estado]||t.estado)}">
      <div class="task-prio-dot ${t.prioridade}"></div>
      <div class="task-name">${escHtml(t.titulo)}</div>
      <div class="task-person">${escHtml(t.solicitante)}</div>
      <span class="estado-pill ${t.estado || 'aguardar'}">${ESTADO_LABEL[t.estado] || t.estado}</span>
    </div>
  `).join('');

  bindTaskTooltips();

  // progress bar
  const total      = filtradas.filter(t => t.estado !== 'cancelado').length;
  const concluidas = filtradas.filter(t => t.estado === 'concluido').length;
  if (total > 0) {
    const pct = Math.round(concluidas / total * 100);
    document.getElementById('progressWrap').style.display = 'block';
    document.getElementById('progressPct').textContent = pct + '%';
    document.getElementById('progressBar').style.width  = pct + '%';
  }
}


// ── ADMISSÕES ──
function renderAdmissoes() {
  const container = document.getElementById('admList');
  const mostrarEscritorio = window.isAdmin() && (!escritorioAtivoDash || escritorioAtivoDash === 'todos');
  const filtradas = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? admissoes.filter(a => matchEscritorioDoc(a, escritorioAtivoDash))
    : admissoes;
  const recentes = filtradas
    .filter(a => a.estado !== 'concluido' && a.estado !== 'cancelado')
    .slice(0, 8);

  if (!recentes.length) {
    container.innerHTML = '<div class="empty-mini">Sem processos em curso.</div>';
    return;
  }

  container.innerHTML = recentes.map(a => {
    const dataVal = a.tipo === 'cessacao' ? (a.dataSaida || '') : (a.dataEntrada || '');
    return `
    <div class="adm-row"
      data-num="${escHtml(a.numero||'—')}"
      data-nif="${escHtml(a.nif||'—')}"
      data-nome="${escHtml(a.nome||'—')}"
      data-empresa="${escHtml(a.empresa||'—')}"
      data-cat="${escHtml(a.categoria||'—')}"
      data-data="${escHtml(dataVal)}"
      data-tipo="${escHtml(a.tipo||'admissao')}">
      <div class="adm-tipo-dot ${a.tipo || 'admissao'}"></div>
      <div class="adm-name">${escHtml(a.nome || '—')}</div>
      <div class="adm-meta">${escHtml(a.submetidoPor || a.empresa || '')}</div>
      ${mostrarEscritorio && a.escritorio ? `<span class="escritorio-tag">${escHtml(a.escritorio)}</span>` : ''}
      <span class="adm-tipo-tag ${a.tipo || 'admissao'}">${a.tipo === 'cessacao' ? 'Cessação' : 'Admissão'}</span>
    </div>
  `}).join('');

  bindAdmTooltips();
}

// ── TOOLTIP ADMISSÕES ──
function bindAdmTooltips() {
  const tip = document.getElementById('admTooltip');
  if (!tip) return;

  document.querySelectorAll('#admList .adm-row').forEach(row => {
    row.addEventListener('mouseenter', e => {
      const tipo = row.dataset.tipo === 'cessacao' ? 'Cessação' : 'Admissão';
      const dataLabel = row.dataset.tipo === 'cessacao' ? 'Data Saída' : 'Data Entrada';
      const dataFmt = fmtDateStr(row.dataset.data);
      tip.innerHTML = `
        <div class="tt-row"><span class="tt-lbl">Nº Func.</span><span class="tt-val">${row.dataset.num}</span></div>
        <div class="tt-row"><span class="tt-lbl">NIF</span><span class="tt-val">${row.dataset.nif}</span></div>
        <div class="tt-row"><span class="tt-lbl">Nome</span><span class="tt-val">${row.dataset.nome}</span></div>
        <div class="tt-row"><span class="tt-lbl">Empresa</span><span class="tt-val">${row.dataset.empresa}</span></div>
        <div class="tt-row"><span class="tt-lbl">Categoria</span><span class="tt-val">${row.dataset.cat}</span></div>
        <div class="tt-row"><span class="tt-lbl">${dataLabel}</span><span class="tt-val">${dataFmt}</span></div>
      `;
      positionTip(tip, e);
      tip.classList.add('show');
    });
    row.addEventListener('mousemove', e => positionTip(tip, e));
    row.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}

// ── TOOLTIP TAREFAS ──
const PRIO_LABEL_DASH = { urgente:'🔴 Urgente', normal:'🟡 Normal', baixa:'🟢 Baixa' };

function bindTaskTooltips() {
  const tip = document.getElementById('taskTooltip');
  if (!tip) return;

  document.querySelectorAll('#tasksList .task-row').forEach(row => {
    row.addEventListener('mouseenter', e => {
      const desc = row.dataset.desc;
      tip.innerHTML = `
        <div class="tt-row"><span class="tt-lbl">Tarefa</span><span class="tt-val" style="font-weight:600">${row.dataset.titulo}</span></div>
        ${desc ? `<hr class="tt-divider"><div class="tt-val tt-desc">${desc}</div>` : ''}
        <hr class="tt-divider">
        <div class="tt-row"><span class="tt-lbl">Criado por</span><span class="tt-val">${row.dataset.pessoa}</span></div>
        <div class="tt-row"><span class="tt-lbl">Prioridade</span><span class="tt-val">${PRIO_LABEL_DASH[row.dataset.prio]||row.dataset.prio}</span></div>
        <div class="tt-row"><span class="tt-lbl">Estado</span><span class="tt-val">${row.dataset.estado}</span></div>
        <div class="tt-row"><span class="tt-lbl">Escritório</span><span class="tt-val">${row.dataset.escritorio}</span></div>
      `;
      positionTip(tip, e);
      tip.classList.add('show');
    });
    row.addEventListener('mousemove', e => positionTip(tip, e));
    row.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}

// ── TOOLTIP RECLAMAÇÕES ──
const CANAL_LABEL_DASH = { email:'📧 Email', telefone:'📞 Telefone', mensagem:'💬 Mensagem', presencial:'🧑 Presencial' };

function bindRecTooltips() {
  const tip = document.getElementById('recTooltip');
  if (!tip) return;

  document.querySelectorAll('#recList .rec-dash-row').forEach(row => {
    row.style.cursor = 'default';
    row.addEventListener('mouseenter', e => {
      const periodos = row.dataset.periodos;
      const turnos   = row.dataset.turnos;
      const notas    = row.dataset.notas;
      const dataFmt  = row.dataset.data ? fmtShort(Number(row.dataset.data)) : '—';
      tip.innerHTML = `
        <div class="tt-row"><span class="tt-lbl">Nome</span><span class="tt-val" style="font-weight:600">${row.dataset.nome}</span></div>
        <div class="tt-row"><span class="tt-lbl">NIF</span><span class="tt-val">${row.dataset.nif}</span></div>
        <div class="tt-row"><span class="tt-lbl">Nº Func.</span><span class="tt-val">${row.dataset.numfunc}</span></div>
        <div class="tt-row"><span class="tt-lbl">Categoria</span><span class="tt-val">${row.dataset.categoria}</span></div>
        <hr class="tt-divider">
        <div class="tt-row"><span class="tt-lbl">Empresa</span><span class="tt-val">${row.dataset.empresa}</span></div>
        <div class="tt-row"><span class="tt-lbl">Escritório</span><span class="tt-val">${row.dataset.escritorio}</span></div>
        <div class="tt-row"><span class="tt-lbl">Canal</span><span class="tt-val">${CANAL_LABEL_DASH[row.dataset.canal] || row.dataset.canal}</span></div>
        <hr class="tt-divider">
        <div class="tt-row"><span class="tt-lbl">Períodos</span><span class="tt-val">${row.dataset.resumo}</span></div>
        ${periodos ? `<div class="tt-row"><span class="tt-lbl">Detalhe</span><span class="tt-val tt-desc">${periodos}</span></div>` : ''}
        ${turnos   ? `<div class="tt-row"><span class="tt-lbl">Turnos</span><span class="tt-val tt-desc">${turnos}</span></div>` : ''}
        ${notas    ? `<hr class="tt-divider"><div class="tt-val tt-desc">📝 ${notas}</div>` : ''}
        <hr class="tt-divider">
        <div class="tt-row"><span class="tt-lbl">Estado</span><span class="tt-val">${row.dataset.estado}</span></div>
        <div class="tt-row"><span class="tt-lbl">Registado</span><span class="tt-val">${row.dataset.criado} · ${dataFmt}</span></div>
      `;
      positionTip(tip, e);
      tip.classList.add('show');
    });
    row.addEventListener('mousemove', e => positionTip(tip, e));
    row.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}

function positionTip(tip, e) {
  const margin = 14;
  const tipW = 300;
  const tipH = tip.offsetHeight || 220;
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  if (x + tipW > window.innerWidth)  x = e.clientX - tipW - margin;
  if (y + tipH > window.innerHeight) y = e.clientY - tipH - margin;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function fmtDateStr(str) {
  if (!str || str === '—') return '—';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// ── COMUNICADOS ──
const TIPO_LABEL = { geral: 'Geral', urgente: 'Urgente', info: 'Info', aviso: 'Aviso' };

function renderComunicados() {
  const container = document.getElementById('comList');
  const mostrarEscritorio = window.isAdmin() && (!escritorioAtivoDash || escritorioAtivoDash === 'todos');
  const filtradas = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? comunicados.filter(c => matchComunicadoEscritorioDash(c, escritorioAtivoDash))
    : comunicados;
  const recentes = filtradas.filter(c => !c.arquivado).slice(0, 6);

  if (!recentes.length) {
    container.innerHTML = '<div class="empty-mini">Sem comunicados activos.</div>';
    return;
  }

  container.innerHTML = recentes.map(c => `
    <div class="com-row">
      <div class="tipo-dot ${c.tipo}"></div>
      <div class="com-content">
        <div class="com-titulo-row">${escHtml(c.titulo)}</div>
        <div class="com-meta-row">
          ${escHtml(c.autor || '—')} · ${fmtShort(c.criadoEm)}
          ${mostrarEscritorio && c.escritorio ? ` · <span style="text-transform:capitalize">${escHtml(c.escritorio)}</span>` : ''}
        </div>
      </div>
      <span class="tipo-tag-sm ${c.tipo}">${TIPO_LABEL[c.tipo] || c.tipo}</span>
    </div>
  `).join('');
}

// ── CALENDAR MINI ──
function renderCalMini() {
  const container = document.getElementById('calMini');
  if (!calData || !calData.departments || !calData.departments.length) {
    container.innerHTML = '<div class="empty-mini">Sem dados de calendário.</div>';
    return;
  }

  // Descobrir o mês/ano do documento de calendário (id: "calendario_ESC_YYYY_MM")
  // Usar calData.mes/ano se existir, caso contrário inferir do mês atual
  const now = new Date();
  const ano  = calData.ano  || now.getFullYear();
  const mes  = calData.mes  != null ? calData.mes : now.getMonth(); // 0-based
  const diasNoMes = new Date(ano, mes + 1, 0).getDate(); // 28/29/30/31

  const DIAS_SEMANA_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // Linha de números de dia + dia da semana
  let numHtml  = '<div class="cal-day-nums">';
  let dowHtml  = '<div class="cal-dow-row">';
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mes, d).getDay(); // 0=Dom … 6=Sáb
    const isWeekend = dow === 0 || dow === 6;
    const style = isWeekend ? 'color:#dc2626;opacity:.7;' : '';
    numHtml += `<div class="cal-day-num" style="${style}">${d}</div>`;
    dowHtml += `<div class="cal-dow" style="${style}">${DIAS_SEMANA_PT[dow].charAt(0)}</div>`;
  }
  numHtml += '</div>';
  dowHtml += '</div>';

  const { departments } = calData;
  let html = dowHtml + numHtml;

  departments.forEach(dept => {
    html += `<div class="cal-dept-label">${escHtml(dept.name)}</div>`;
    html += '<div class="cal-grid">';
    for (let d = 0; d < diasNoMes; d++) {
      const val   = dept.data ? (dept.data[d] ?? 0) : 0;
      const color = dept.colors ? dept.colors[Math.min(5, Math.max(0, val))] : '#ddd';
      const dow   = new Date(ano, mes, d + 1).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const opacity = isWeekend && val === 0 ? 'opacity:.35;' : '';
      html += `<div class="cal-seg" style="background:${color};${opacity}" title="${DIAS_SEMANA_PT[dow]} ${d + 1}: ${val}"></div>`;
    }
    html += '</div>';
  });

  container.innerHTML = html;
}

// ── EVENTS ──
function renderEvents() {
  const container = document.getElementById('evList');
  if (!calData || !calData.events || !calData.events.length) {
    container.innerHTML = '<div class="empty-mini">Sem eventos no calendário.</div>';
    return;
  }

  const events  = [...calData.events].sort((a, b) => a.dayFrom - b.dayFrom).slice(0, 10);
  const depts   = calData.departments || [];
  const getDept = id => depts.find(d => d.id === id);

  container.innerHTML = events.map(ev => {
    const dept   = getDept(ev.deptId);
    const color  = dept ? dept.colors[4] : '#888';
    const dayLbl = ev.dayFrom === ev.dayTo ? `Dia ${ev.dayFrom}` : `Dia ${ev.dayFrom}–${ev.dayTo}`;
    return `
      <div class="ev-row">
        <div class="ev-dot" style="background:${color}"></div>
        <span class="ev-day-badge">${escHtml(dayLbl)}</span>
        <div class="ev-label">${escHtml(ev.label)}</div>
        <div class="ev-dept">${dept ? escHtml(dept.name) : ''}</div>
      </div>
    `;
  }).join('');
}

// ── ACTIVITY ──
function renderActivity() {
  const container = document.getElementById('activityList');
  const mostrarEscritorio = window.isAdmin() && (!escritorioAtivoDash || escritorioAtivoDash === 'todos');
  const filtT = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? tasks.filter(t => matchEscritorioDoc(t, escritorioAtivoDash))
    : tasks;
  const filtC = (escritorioAtivoDash && escritorioAtivoDash !== 'todos')
    ? comunicados.filter(c => matchComunicadoEscritorioDash(c, escritorioAtivoDash))
    : comunicados;

  const items = [
    ...filtT.map(t => ({ type: 'task', ts: t.criadaEm || 0, label: t.titulo, sub: t.solicitante, estado: t.estado, escritorio: t.escritorio })),
    ...filtC.map(c => ({ type: 'com', ts: c.criadoEm || 0, label: c.titulo, sub: c.autor, tipo: c.tipo, escritorio: c.escritorio }))
  ].sort((a, b) => b.ts - a.ts).slice(0, 8);

  if (!items.length) {
    container.innerHTML = '<div class="empty-mini">Sem actividade recente.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const icon = item.type === 'task' ? '📋' : '📢';
    const cls  = item.type === 'task' ? 'task' : 'com';
    const sub  = item.type === 'task'
      ? `${escHtml(item.sub || '')} · ${ESTADO_LABEL[item.estado] || item.estado}`
      : `Comunicado · ${escHtml(item.sub || '')}`;
    return `
      <div class="activity-row">
        <div class="activity-icon ${cls}">${icon}</div>
        <div class="activity-content">
          <div class="activity-text">${escHtml(item.label)}</div>
          <div class="activity-sub">
            ${sub}
            ${mostrarEscritorio && item.escritorio ? ` · <span style="text-transform:capitalize">${escHtml(item.escritorio)}</span>` : ''}
          </div>
        </div>
        <div class="activity-time">${fmtShort(item.ts)}</div>
      </div>
    `;
  }).join('');
}

// ── UTILS ──

// ── RECLAMAÇÕES ──
const ESTADOS_ATIVOS_REC = ['nova','verificacao','enviada','confirmada','aguarda-proc'];
const REC_ESTADO_LABEL = {
  nova:'Nova', verificacao:'Em Verificação', enviada:'Enviada à Empresa',
  confirmada:'Confirmada', 'aguarda-proc':'Aguarda Processamento',
  paga:'Paga', 'sem-fundamento':'Sem Fundamento', negada:'Negada'
};

function renderReclamacoes() {
  const esc = escritorioAtivoDash;
  const filtradas = reclamacoes.filter(r => {
    if (esc && esc !== 'todos' && r.escritorio !== esc) return false;
    return ESTADOS_ATIVOS_REC.includes(r.estado);
  });

  // KPI chips
  const kpis = document.getElementById('recKpis');
  if (kpis) {
    const counts = {};
    ESTADOS_ATIVOS_REC.forEach(e => { counts[e] = 0; });
    filtradas.forEach(r => { if (counts[r.estado] !== undefined) counts[r.estado]++; });
    const chips = ESTADOS_ATIVOS_REC.filter(e => counts[e] > 0).map(e =>
      `<span class="rec-kpi-chip ${e}">${counts[e]} ${REC_ESTADO_LABEL[e]}</span>`
    ).join('');
    kpis.innerHTML = chips || '';
  }

  // Ocultar painel se sem permissão ou sem dados
  const wrap = document.getElementById('reclamacoesPanelWrap');
  const canSee = window.isAdmin() || window.temPermissao('modules.reclamacoes.view');
  if (wrap) wrap.style.display = canSee ? '' : 'none';

  const container = document.getElementById('recList');
  if (!container) return;

  if (!canSee) { container.innerHTML = ''; return; }

  if (!filtradas.length) {
    container.innerHTML = '<div class="empty-mini">✓ Sem reclamações em aberto.</div>';
    return;
  }

  const mostrar = filtradas.slice(0, 10);
  container.innerHTML = mostrar.map(r => {
    const estadoCls = (r.estado || 'nova').replace(/-/g,'');
    const dotCls = r.estado === 'aguarda-proc' ? 'aguarda-proc' : estadoCls;
    // Construir resumo de períodos e turnos para o tooltip
    const periodos = (r.periodos || []);
    const periodoStr = periodos.map(p =>
      `${p.mesNome || ''} ${p.ano}: dias ${(p.dias||[]).join(',')} — ${p.totalHoras||''}${p.totalNoturnas?' 🌙'+p.totalNoturnas:''}${p.totalFeriado?' 📅'+p.totalFeriado:''}`
    ).join(' | ');
    const turnosStr = periodos.flatMap(p =>
      (p.turnos||[]).map(t => `${t.entrada||''}→${t.saida||''}${t.total?' ('+t.total+')':''}`)
    ).join(' · ');
    return `<div class="rec-dash-row"
      data-nome="${escHtml(r.nome||'—')}"
      data-nif="${escHtml(r.nif||'—')}"
      data-numfunc="${escHtml(r.numFunc||'—')}"
      data-categoria="${escHtml(r.categoria||'—')}"
      data-empresa="${escHtml(r.empresa||'—')}"
      data-escritorio="${escHtml(window.nomeEscritorio?window.nomeEscritorio(r.escritorio):(r.escritorio||'—'))}"
      data-canal="${escHtml(r.canal||'—')}"
      data-estado="${escHtml(REC_ESTADO_LABEL[r.estado]||r.estado||'—')}"
      data-resumo="${escHtml(r.resumoPeriodo||'—')}"
      data-periodos="${escHtml(periodoStr)}"
      data-turnos="${escHtml(turnosStr)}"
      data-notas="${escHtml(r.notas||'')}"
      data-criado="${escHtml(r.criadoPor||'—')}"
      data-data="${r.criadoEm||''}">
      <div class="rec-dash-dot ${dotCls}"></div>
      <div class="rec-dash-name">${escHtml(r.nome || '—')} <span style="color:var(--muted);font-size:10px;">· ${escHtml(r.empresa || '—')}${r.categoria ? ' · ' + escHtml(r.categoria) : ''}</span></div>
      <div class="rec-dash-meta">${escHtml(r.resumoPeriodo || '—')}</div>
      <span class="rec-kpi-chip ${r.estado === 'aguarda-proc' ? 'aguarda-proc' : estadoCls}">${REC_ESTADO_LABEL[r.estado] || r.estado}</span>
    </div>`;
  }).join('');

  if (filtradas.length > 10) {
    container.innerHTML += `<div style="padding:8px 0;font-size:10px;color:var(--muted);text-align:center;">
      + ${filtradas.length - 10} mais · <a href="reclamacoes.html" style="color:var(--accent);text-decoration:none;">Ver todas</a>
    </div>`;
  }

  bindRecTooltips();
}

// ── PESQUISA GLOBAL ──
let _gsearchTimeout = null;

function toggleGlobalSearch() {
  const panel = document.getElementById('globalSearchPanel');
  const input = document.getElementById('globalSearchInput');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) {
    input.focus();
    input.select();
  }
}

// Fechar ao clicar fora
document.addEventListener('click', e => {
  const wrap = document.getElementById('globalSearchWrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('globalSearchPanel');
    if (panel) panel.style.display = 'none';
  }
});

function doGlobalSearch(q) {
  clearTimeout(_gsearchTimeout);
  _gsearchTimeout = setTimeout(() => _execGlobalSearch(q), 180);
}

function _execGlobalSearch(q) {
  const results = document.getElementById('globalSearchResults');
  if (!results) return;
  q = (q || '').toLowerCase().trim();
  if (!q || q.length < 2) {
    results.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:8px 9px;">Escreve pelo menos 2 letras…</div>';
    return;
  }

  const hits = [];

  // Tarefas
  tasks.filter(t => `${t.titulo} ${t.solicitante} ${t.descricao}`.toLowerCase().includes(q)).slice(0, 4).forEach(t => {
    hits.push({ type: 'task', icon: '📋', label: t.titulo || '—', sub: t.solicitante || '', href: 'tarefas.html' });
  });

  // Comunicados
  comunicados.filter(c => `${c.titulo} ${c.autor} ${c.conteudo}`.toLowerCase().includes(q)).slice(0, 4).forEach(c => {
    hits.push({ type: 'com', icon: '📢', label: c.titulo || '—', sub: c.autor || '', href: 'comunicados.html' });
  });

  // Reclamações
  reclamacoes.filter(r => `${r.nome} ${r.nif} ${r.numFunc} ${r.empresa}`.toLowerCase().includes(q)).slice(0, 4).forEach(r => {
    hits.push({ type: 'rec', icon: '⚠️', label: r.nome || '—', sub: `${r.empresa || ''} · ${r.resumoPeriodo || ''}`, href: 'reclamacoes.html' });
  });

  // Admissões
  admissoes.filter(a => `${a.nome} ${a.nif} ${a.empresa} ${a.funcao}`.toLowerCase().includes(q)).slice(0, 3).forEach(a => {
    hits.push({ type: 'adm', icon: '👤', label: a.nome || '—', sub: `${a.empresa || ''} · ${a.tipo || ''}`, href: 'admissoes.html' });
  });

  if (!hits.length) {
    results.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:8px 9px;">Sem resultados.</div>';
    return;
  }

  const sections = { task: 'Tarefas', com: 'Comunicados', rec: 'Reclamações', adm: 'Admissões' };
  let lastType = null;
  results.innerHTML = hits.map(h => {
    let html = '';
    if (h.type !== lastType) {
      html += `<div class="gsearch-section">${sections[h.type]}</div>`;
      lastType = h.type;
    }
    html += `<a class="gsearch-item" href="${h.href}">
      <div class="gsearch-item-icon ${h.type}">${h.icon}</div>
      <div class="gsearch-item-label">${escHtml(h.label)}</div>
      <div class="gsearch-item-sub">${escHtml(h.sub)}</div>
    </a>`;
    return html;
  }).join('');
}
