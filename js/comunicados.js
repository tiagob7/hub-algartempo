const db = firebase.firestore();
let col;
let comunicados = [], selTipoVal = 'geral', filterMode = 'activos';
const expandedIds = new Set();
let filtroEscritorio = '';
let escDestinosSel = ['todos'];
const TIPO_LABEL = { geral:'Geral', urgente:'Urgente', info:'Info', aviso:'Aviso' };
const TIPO_EMOJI = { geral:'📢', urgente:'🚨', info:'ℹ️', aviso:'⚠️' };

// ── Cache de comunicados ──────────────────────────────────────────────────────
// TTL de 5 min: comunicados mudam com pouca frequência.
// Ao criar/arquivar/eliminar, o cache é invalidado para forçar nova leitura.
const _comCache = { data: null, ts: 0, escritorio: '__uninit__' };
const COM_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function _comCacheValid(escritorio) {
  return (
    _comCache.data !== null &&
    _comCache.escritorio === (escritorio || '') &&
    (Date.now() - _comCache.ts) < COM_CACHE_TTL
  );
}

function _invalidateComCache() {
  _comCache.ts = 0;
  _comCache.data = null;
}

window.bootProtectedPage({
  activePage: 'comunicados',
  moduleId: 'comunicados',
}, ({ profile, isAdmin, escritorio }) => {

  // botão novo comunicado para quem tem permissão; preencher autor
  if (window.temPermissao('modules.comunicados.manage')) {
    document.getElementById('btnNovoCom').classList.add('show');
    if (profile) document.getElementById('fAutor').value = profile.nomeCompleto || profile.nome || '';
  }

  // filtro por defeito = escritório do utilizador
  filtroEscritorio = isAdmin
    ? ((escritorio && escritorio !== 'todos') ? escritorio : '')
    : (profile ? (profile.escritorio || '') : '');

  // mostrar filtro de escritório para todos e preencher dinamicamente
  const feEl = document.getElementById('filterEscritorioCom');
  if (feEl) {
    feEl.style.display = '';
    loadEscritorios().then(lista => {
      feEl.innerHTML = '<option value=\"\">Todos os escritórios</option>' +
        lista.map(e => `<option value=\"${e.id}\">${e.nome}</option>`).join('');
      if (filtroEscritorio) feEl.value = filtroEscritorio;

      // preencher pills de destinos no formulário
      const row = document.getElementById('escDestRow');
      if (row) {
        row.innerHTML = '';
        const btnTodos = document.createElement('button');
        btnTodos.type = 'button';
        btnTodos.className = 'esc-pill esc-pill-todos sel';
        btnTodos.dataset.e = 'todos';
        btnTodos.textContent = 'Todos';
        btnTodos.onclick = function() { toggleEscDestino('todos', this); };
        row.appendChild(btnTodos);
        lista.forEach(e => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'esc-pill';
          b.dataset.e = e.id;
          b.textContent = e.nome;
          b.onclick = function() { toggleEscDestino(e.id, this); };
          row.appendChild(b);
        });
      }
    }).catch(() => {
      if (filtroEscritorio) feEl.value = filtroEscritorio;
    });
  }

  document.getElementById('pageSubtitle').textContent =
    filtroEscritorio ? (window.nomeEscritorio ? window.nomeEscritorio(filtroEscritorio) : filtroEscritorio) : 'Todos os escritórios';

  col = window.ComunicadosService.proxy();

  // Carregar comunicados com cache (substitui o onSnapshot permanente).
  // — Se o cache estiver fresco para este escritório, serve direto.
  // — Caso contrário, faz .get() ao Firestore e guarda no cache.
  // — Filtros adicionais (arquivado, tipo) continuam a ser feitos no cliente
  //   para não exigir índices compostos.
  function carregarComunicados() {
    if (_comCacheValid(filtroEscritorio)) {
      comunicados = _comCache.data;
      render();
      return;
    }
    setStatus('A carregar…', '#f59e0b');
    col.orderBy('criadoEm', 'desc').limit(200).get()
      .then(snap => {
        comunicados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _comCache.data = comunicados;
        _comCache.ts = Date.now();
        _comCache.escritorio = filtroEscritorio || '';
        render();
        setStatus('✓ Carregado', '#16a34a');
        setTimeout(() => setStatus(''), 3000);
      })
      .catch(err => { console.error(err); setStatus('Erro', '#dc2626'); });
  }

  carregarComunicados();
});


function toggleForm() {
  document.getElementById('formPanel').classList.toggle('open');
}

async function submitComunicado() {
  const titulo = document.getElementById('fTitulo').value.trim();
  const texto  = document.getElementById('fTexto').value.trim();
  const autor  = document.getElementById('fAutor').value.trim() || 'Administração';
  const dept   = document.getElementById('fDept').value;
  if (!titulo) { toast('Preenche o título!'); return; }
  if (!texto)  { toast('Escreve a mensagem!'); return; }
  // destinos: se ficou na opção "Todos", guardamos ['todos']; se removeram todos, cai para escritório de origem apenas
  let destinos = escDestinosSel && escDestinosSel.length ? [...escDestinosSel] : [];
  const escrOrigem = window.userProfile ? (window.userProfile.escritorio || '') : '';
  if (!destinos.length && escrOrigem) destinos = [escrOrigem];
  try {
    const dados = {
      titulo, texto, autor, dept,
      tipo: selTipoVal,
      arquivado: false,
      criadoEm: Date.now(),
      escritorio: escrOrigem,
      destinosEscritorio: destinos,
      criadoPor: window.currentUser ? window.currentUser.uid : ''
    };
    const docRef = await col.add(dados);
    _invalidateComCache(); // novo documento → forçar re-leitura
    await registarAuditoria({
      modulo: 'comunicados',
      acao:   'criado',
      docId:  docRef.id,
      titulo: dados.titulo,
      depois: dados,
    });
    document.getElementById('fTitulo').value = '';
    document.getElementById('fTexto').value = '';
    selTipo('geral');
    toggleForm();
    toast('✓ Comunicado publicado!');
  } catch(e) { toast('Erro ao publicar.'); }
}

async function toggleArquivado(id, current) {
  try {
    await col.doc(id).update({ arquivado: !current });
    _invalidateComCache(); // estado alterado → forçar re-leitura
    const com = comunicados.find(c => c.id === id);
    await registarAuditoria({
      modulo: 'comunicados',
      acao:   'estado',
      docId:  id,
      titulo: com ? com.titulo : id,
      antes:  { arquivado: current },
      depois: { arquivado: !current },
    });
  } catch(e) { toast('Erro.'); }
}
async function deleteComunicado(id) {
  if (!await confirmar({ titulo: 'Eliminar este comunicado?', btnOk: 'Confirmar', perigo: true })) return;
  expandedIds.delete(id);
  try {
    const com = comunicados.find(c => c.id === id);
    await col.doc(id).delete();
    _invalidateComCache(); // documento eliminado → forçar re-leitura
    await registarAuditoria({
      modulo: 'comunicados',
      acao:   'eliminado',
      docId:  id,
      titulo: com ? com.titulo : id,
      antes:  com || {},
    });
    toast('Eliminado.');
  } catch(e) { toast('Erro.'); }
}

function getFiltered() {
  let out = comunicados;
  if (filtroEscritorio)           out = out.filter(c => matchComunicadoEscritorio(c, filtroEscritorio));
  if (filterMode === 'activos')   out = out.filter(c => !c.arquivado);
  if (filterMode === 'urgente')   out = out.filter(c => c.tipo === 'urgente' && !c.arquivado);
  if (filterMode === 'arquivado') out = out.filter(c => c.arquivado);
  return out;
}
function setFilter(mode) { filterMode=mode; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===mode)); renderList(); }

function render() { renderStats(); renderUrgenteBanner(); renderList(); }

function renderStats() {
  // usar apenas os comunicados do escritório ativo (respeita o filtro)
  const base   = filtroEscritorio ? comunicados.filter(c => matchComunicadoEscritorio(c, filtroEscritorio)) : comunicados;
  const total  = base.filter(c=>!c.arquivado).length;
  const gerais = base.filter(c=>c.tipo==='geral'&&!c.arquivado).length;
  const urg    = base.filter(c=>c.tipo==='urgente'&&!c.arquivado).length;
  const infos  = base.filter(c=>(c.tipo==='info'||c.tipo==='aviso')&&!c.arquivado).length;
  const btnNovo = document.getElementById('btnNovoCom');
  document.getElementById('statsBar').innerHTML = `
    <div class="stat-chip s-total"><span class="stat-val">${total}</span><span class="stat-lbl">Activos</span></div>
    <div class="stat-chip s-geral"><span class="stat-val">${gerais}</span><span class="stat-lbl">Gerais</span></div>
    <div class="stat-chip s-urgente"><span class="stat-val">${urg}</span><span class="stat-lbl">Urgentes</span></div>
    <div class="stat-chip s-info"><span class="stat-val">${infos}</span><span class="stat-lbl">Info/Aviso</span></div>`;
  document.getElementById('statsBar').appendChild(btnNovo);
}

function renderUrgenteBanner() {
  const banner = document.getElementById('urgenteBanner');
  const base   = filtroEscritorio ? comunicados.filter(c => matchComunicadoEscritorio(c, filtroEscritorio)) : comunicados;
  const urgentes = base.filter(c=>c.tipo==='urgente'&&!c.arquivado);
  if (!urgentes.length) { banner.style.display='none'; return; }
  banner.style.display='flex'; banner.style.flexDirection='column'; banner.style.gap='8px';
  banner.innerHTML=urgentes.map(u=>`
    <div class="urgente-banner">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L1.5 13h13L8 2z"/><path d="M8 7v3M8 11.5v.5"/></svg>
      <div><strong>${escHtml(u.titulo)}</strong> — ${escHtml(u.autor||'')} · ${fmtShort(u.criadoEm)}</div>
    </div>`).join('');
}

function renderList() {
  const container = document.getElementById('comunicadosList');
  const filtered = getFiltered();
  const canGerir = window.temPermissao && window.temPermissao('modules.comunicados.manage');
  document.getElementById('countBadge').textContent=filtered.length+' comunicado'+(filtered.length!==1?'s':'');
  if (!filtered.length) { container.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>Nenhum comunicado encontrado.</p></div>'; return; }
  container.innerHTML='';
  filtered.forEach(com=>{
    const isOpen=expandedIds.has(com.id), isArq=com.arquivado;
    const card=document.createElement('div');
    card.className=`com-card tipo-${com.tipo}${isArq?' arquivado':''}`;
    card.innerHTML=`
      <div class="com-header" onclick="toggleCard('${com.id}')">
        <span class="tipo-tag ${com.tipo}">${TIPO_EMOJI[com.tipo]||''} ${TIPO_LABEL[com.tipo]||com.tipo}</span>
        <div class="com-titulo${isArq?' arquivado':''}">${escHtml(com.titulo)}</div>
        ${com.dept?`<span class="com-dept-tag">${escHtml(com.dept)}</span>`:''}
        <div class="com-meta">${fmtShort(com.criadoEm)}</div>
        <svg class="chevron ${isOpen?'open':''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6l4 4 4-4"/></svg>
      </div>
      <div class="com-body ${isOpen?'open':''}">
        <div class="com-text">${escHtml(com.texto)}</div>
        <div class="com-footer-row">
          <span class="com-author"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="2.5"/><path d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/></svg>${escHtml(com.autor||'—')}</span>
          <span style="opacity:.7;">${fmtDateFull(com.criadoEm)}</span>
        </div>
        <div class="com-gestor ${canGerir?'show':''}">
          <button class="arquivo-btn ${isArq?'active':''}" onclick="event.stopPropagation();toggleArquivado('${com.id}',${isArq})">${isArq?'↩ Restaurar':'📁 Arquivar'}</button>
          <button class="icon-btn del" onclick="event.stopPropagation();deleteComunicado('${com.id}')">🗑</button>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function setFiltroEscritorioCom(val) {
  filtroEscritorio = val;
  document.getElementById('pageSubtitle').textContent = val
    ? (window.nomeEscritorio ? window.nomeEscritorio(val) : val)
    : 'Todos os escritórios';
  renderList();
}
function toggleCard(id) { if(expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id); renderList(); }
function selTipo(t) { selTipoVal=t; document.querySelectorAll('.tipo-pill').forEach(b=>b.classList.toggle('sel',b.dataset.t===t)); }

// Escritorios destino — multi-select
function toggleEscDestino(code, btn) {
  const todosBtn = document.querySelector('.esc-pill-todos');
  if (code === 'todos') {
    escDestinosSel = ['todos'];
    document.querySelectorAll('.esc-pill').forEach(b => b.classList.remove('sel'));
    if (todosBtn) todosBtn.classList.add('sel');
    return;
  }
  // remover "todos" se estava activo
  escDestinosSel = escDestinosSel.filter(e => e !== 'todos');
  if (todosBtn) todosBtn.classList.remove('sel');

  if (escDestinosSel.includes(code)) {
    escDestinosSel = escDestinosSel.filter(e => e !== code);
    btn.classList.remove('sel');
  } else {
    escDestinosSel.push(code);
    btn.classList.add('sel');
  }

  // se voltar a ficar vazio, deixa tudo para a origem (tratado no submit)
}

// helper de correspondência para filtros
function matchComunicadoEscritorio(c, esc) {
  if (!esc) return true;
  const orig = c.escritorio || '';
  const dests = c.destinosEscritorio || null;
  if (dests && Array.isArray(dests) && dests.length) {
    if (dests.includes('todos')) return true;
    return dests.includes(esc);
  }
  return orig === esc;
}
