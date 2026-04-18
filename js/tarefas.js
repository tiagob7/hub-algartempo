const db = firebase.firestore();
const storage = firebase.storage();

function toggleFormTarefas() {
  const panel = document.getElementById('formTarefas');
  if (panel) panel.classList.toggle('open');
}
let col;
let tasks = [], selPrioVal = 'normal', sortMode = 'prio', filterMode = 'activos', filterPessoa = '';
let pendingFiles = [];
window._files = {};
const expandedIds = new Set();
const PRIO_ORDER = { urgente:0, normal:1, baixa:2 };
const ESTADO_ORDER = { progresso:0, aguardar:1, pendente:2, cancelado:3, concluido:4 };
const ESTADO_LABEL = { aguardar:'A aguardar', progresso:'Em progresso', concluido:'Concluído', cancelado:'Cancelado', pendente:'Pendente' };
const PRIO_LABEL = { urgente:'Urgente', normal:'Normal', baixa:'Baixa' };

let filterEscritorio = '';

window.bootProtectedPage({
  activePage: 'tarefas',
  moduleId: 'tarefas',
}, ({ profile, isAdmin, escritorio }) => {

  // mostrar/esconder form de criar tarefa (colapsado por defeito quando visível)
  const canCreate = window.temPermissao('modules.tarefas.create');
  const formPanel = document.getElementById('formTarefas');
  if (formPanel) formPanel.style.display = canCreate ? '' : 'none';

  // botão VOZ — visível apenas para admins
  const btnVozTar = document.querySelector('.novo-pedido-panel .mic-trigger-btn');
  if (btnVozTar && !isAdmin) btnVozTar.style.display = 'none';

  // preencher info do utilizador no form
  if (profile) {
    const nome = profile.nomeCompleto || profile.nome || profile.email || '?';
    const userNameEl   = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    if (userNameEl)   userNameEl.textContent   = nome;
    if (userAvatarEl) userAvatarEl.textContent = nome.charAt(0).toUpperCase();
  }

  // carregar escritórios dinamicamente (do Firestore via config-escritorios.js)
  window.loadEscritorios().then(lista => {
    const selEsc = document.getElementById('fEscritorio');
    const selFil = document.getElementById('filterEscritorio');

    // popular select do formulário
    if (selEsc) {
      selEsc.innerHTML = lista.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
      if (profile && profile.escritorio && lista.find(e => e.id === profile.escritorio)) {
        selEsc.value = profile.escritorio;
      }
    }

    // popular select do filtro (mantém a opção "Todos os escritórios")
    if (selFil) {
      selFil.innerHTML = '<option value="">Todos os escritórios</option>' +
        lista.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
      if (filterEscritorio) selFil.value = filterEscritorio;
    }
  });

  // subtitle
  const nomeAtivo = filterEscritorio
    ? (window.nomeEscritorio ? window.nomeEscritorio(filterEscritorio) : filterEscritorio)
    : 'Todos os escritórios';
  document.getElementById('pageSubtitle').textContent = nomeAtivo;

  // filtro escritório: por defeito = escritório do utilizador (para todos)
  // admin vê "todos" por defeito, colaborador vê o seu escritório
  const fe = document.getElementById('filterEscritorio');
  if (isAdmin) {
    filterEscritorio = (escritorio && escritorio !== 'todos') ? escritorio : '';
  } else {
    filterEscritorio = profile ? (profile.escritorio || '') : '';
  }
  if (filterEscritorio && fe) fe.value = filterEscritorio;

  // Carregar tarefas com onSnapshot (tempo real — colaboração ativa).
  // Otimização: se houver um escritório selecionado, filtra no servidor (.where)
  // para não transferir documentos de outros escritórios desnecessariamente.
  // Limite reduzido para 100 (suficiente para uma lista de gestão diária).
  col = window.TasksService.proxy();

  setStatus('A ligar…', '#f59e0b');

  // Construir query com filtro no servidor quando possível
  function buildTarefasQuery() {
    let q = col;
    if (filterEscritorio) {
      // Filtro no servidor: só carrega tarefas deste escritório
      q = q.where('escritorio', '==', filterEscritorio);
    }
    return q.orderBy('ordemChegada', 'asc').limit(100);
  }

  function subscribeTarefas() {
    if (window._tarefasUnsub) window._tarefasUnsub();
    const q = buildTarefasQuery();
    const unsub = q.onSnapshot(snap => {
      tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
      setStatus('✓ Sincronizado', '#16a34a');
      setTimeout(() => setStatus(''), 3000);
    }, err => {
      console.error('tarefas (orderBy):', err);
      // Fallback sem orderBy — evita página em branco se o índice falhar
      let qFallback = col;
      if (filterEscritorio) qFallback = qFallback.where('escritorio', '==', filterEscritorio);
      const unsubFallback = qFallback.limit(100).onSnapshot(snap => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
        setStatus('✓ Sincronizado', '#16a34a');
        setTimeout(() => setStatus(''), 3000);
      }, err2 => { console.error('tarefas fallback:', err2); setStatus('Erro de ligação', '#dc2626'); });
      window._tarefasUnsub = unsubFallback;
    });
    window._tarefasUnsub = unsub;
  }

  subscribeTarefas();
  // Expor para re-subscrever quando o filtro de escritório mudar
  window._tarefasResubscribe = subscribeTarefas;
  window.addEventListener('beforeunload', () => { if (window._tarefasUnsub) window._tarefasUnsub(); });
});


let _submitTarefaLoading = false;

async function submitTarefa() {
  if (_submitTarefaLoading) return;
  const titulo    = document.getElementById('fTitulo').value.trim();
  const descricao = document.getElementById('fDescricao').value.trim();
  const destino   = document.getElementById('fEscritorio').value;
  if (!titulo) { toast('Introduz o título da tarefa!'); return; }

  _submitTarefaLoading = true;
  const btn = document.querySelector('#formTarefas .submit-btn, #formTarefas button[onclick*="submitTarefa"]');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  const profile     = window.userProfile;
  const solicitante = profile ? (profile.nomeCompleto || profile.nome || profile.email) : '—';
  const escritorioOrigem = profile && profile.escritorio ? profile.escritorio : '';

  const maxOrdem = tasks.length ? Math.max(...tasks.map(t => t.ordemChegada || 0)) : 0;
  try {
    const dadosTarefa = {
      titulo, descricao, solicitante,
      prioridade: selPrioVal, estado: 'aguardar', notas: '',
      criadaEm: Date.now(), ordemChegada: maxOrdem + 1,
      escritorio: destino,
      escritorioOrigem,
      criadoPor: window.currentUser ? window.currentUser.uid : ''
    };
    const docRef = await col.add(dadosTarefa);
    await registarAuditoria({
      modulo: 'tarefas', acao: 'criado',
      docId: docRef.id, titulo,
      depois: dadosTarefa,
    });

    // Upload pending files
    if (pendingFiles.length) {
      const statusEl = document.getElementById('formUploadStatus');
      if (statusEl) statusEl.textContent = 'A carregar anexos…';
      const ficheiros = [];
      for (const file of pendingFiles) {
        const path = `tarefas/${docRef.id}/${Date.now()}_${file.name}`;
        try {
          const ref  = storage.ref(path);
          const snap = await ref.put(file);
          const url  = await snap.ref.getDownloadURL();
          ficheiros.push({ nome: file.name, url, tamanho: file.size, criadoEm: Date.now(), path });
        } catch(e) { console.error(e); toast('Erro ao carregar: ' + file.name); }
      }
      if (ficheiros.length) await docRef.update({ ficheiros });
      if (statusEl) statusEl.textContent = '';
    }

    pendingFiles = [];
    renderPendingFilesList();
    document.getElementById('fTitulo').value    = '';
    document.getElementById('fDescricao').value = '';
    selPrio('normal');
    const fp = document.getElementById('formTarefas');
    if (fp) fp.classList.remove('open');
    toast('✓ Tarefa adicionada em ' + destino.charAt(0).toUpperCase() + destino.slice(1) + '!');
  } catch(e) { console.error(e); toast('Erro ao adicionar.'); }
  finally {
    _submitTarefaLoading = false;
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

async function updateEstado(id, val) {
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).update({ estado: val });
    await registarAuditoria({
      modulo: 'tarefas', acao: 'estado',
      docId: id, titulo: antes.titulo,
      antes: { estado: antes.estado },
      depois: { estado: val },
    });
  } catch(e) { toast('Erro.'); }
}
async function updateNotas(id, val) {
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).update({ notas: val });
    await registarAuditoria({
      modulo: 'tarefas', acao: 'atualizado',
      docId: id, titulo: antes.titulo,
      antes: { notas: antes.notas },
      depois: { notas: val },
    });
  } catch(e) {}
}
async function deleteTask(id) {
  if (!await confirmar({ titulo: 'Eliminar esta tarefa?', btnOk: 'Confirmar', perigo: true })) return;
  expandedIds.delete(id);
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).delete();
    await registarAuditoria({
      modulo: 'tarefas', acao: 'eliminado',
      docId: id, titulo: antes.titulo,
      antes,
    });
    toast('Eliminada.');
  } catch(e) { toast('Erro.'); }
}

function getSorted(list) {
  const copy = [...list];
  if (sortMode === 'fifo') return copy.sort((a,b) => (a.ordemChegada||0)-(b.ordemChegada||0));
  if (sortMode === 'prio') return copy.sort((a,b) => {
    const aDone = (a.estado==='concluido'||a.estado==='cancelado')?1:0;
    const bDone = (b.estado==='concluido'||b.estado==='cancelado')?1:0;
    if (aDone!==bDone) return aDone-bDone;
    const pd = (PRIO_ORDER[a.prioridade]??1)-(PRIO_ORDER[b.prioridade]??1);
    return pd!==0?pd:(a.ordemChegada||0)-(b.ordemChegada||0);
  });
  return copy.sort((a,b) => {
    const ed=(ESTADO_ORDER[a.estado]??1)-(ESTADO_ORDER[b.estado]??1);
    return ed!==0?ed:(PRIO_ORDER[a.prioridade]??1)-(PRIO_ORDER[b.prioridade]??1);
  });
}

function getFiltered(list) {
  let out = list;
  if (filterMode==='activos')   out=out.filter(t=>t.estado!=='concluido'&&t.estado!=='cancelado');
  if (filterMode==='concluido') out=out.filter(t=>t.estado==='concluido'||t.estado==='cancelado');
  if (filterPessoa)             out=out.filter(t=>t.solicitante===filterPessoa);
  if (filterEscritorio)         out=out.filter(t=>t.escritorio===filterEscritorio);
  return out;
}

function setSort(mode) { sortMode=mode; document.querySelectorAll('.sort-btn').forEach(b=>b.classList.toggle('active',b.dataset.sort===mode)); renderList(); }
function setFilter(mode) { filterMode=mode; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===mode)); renderList(); }
function setFilterPessoa(val) { filterPessoa=val; renderList(); }
function setFilterEscritorio(val) {
  filterEscritorio = val;
  const nome = val
    ? (window.nomeEscritorio ? window.nomeEscritorio(val) : val)
    : 'Todos os escritórios';
  document.getElementById('pageSubtitle').textContent = nome;
  // Re-subscrever com novo filtro no servidor (evita carregar escritórios desnecessários)
  if (window._tarefasResubscribe) {
    window._tarefasResubscribe();
  } else {
    renderList();
  }
}

function render() {
  renderStats();
  updatePessoaSelect();
  renderList();
}

function renderStats() {
  const total=tasks.length, prog=tasks.filter(t=>t.estado==='progresso').length;
  const urg=tasks.filter(t=>t.prioridade==='urgente'&&t.estado!=='concluido'&&t.estado!=='cancelado').length;
  const conc=tasks.filter(t=>t.estado==='concluido').length;
  document.getElementById('statsBar').innerHTML = `
    <div class="stat-chip"><span class="stat-val">${total}</span><span class="stat-lbl">Total</span></div>
    <div class="stat-chip s-progresso"><span class="stat-val">${prog}</span><span class="stat-lbl">Em progresso</span></div>
    <div class="stat-chip s-urgente"><span class="stat-val">${urg}</span><span class="stat-lbl">Urgentes</span></div>
    <div class="stat-chip s-ok"><span class="stat-val">${conc}</span><span class="stat-lbl">Concluídas</span></div>`;
}

function updatePessoaSelect() {
  const names=[...new Set(tasks.map(t=>t.solicitante).filter(Boolean))].sort();
  const sel=document.getElementById('filterPessoa'), cur=filterPessoa;
  sel.innerHTML='<option value="">Todos os nomes</option>';
  names.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; if(n===cur) o.selected=true; sel.appendChild(o); });
}

function renderList() {
  const container=document.getElementById('tasksList');
  const filtered=getFiltered(getSorted(tasks));
  document.getElementById('countBadge').textContent=filtered.length+' tarefa'+(filtered.length!==1?'s':'');
  if (!filtered.length) { container.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 18h8"/></svg><p>Nenhuma tarefa encontrada.</p></div>'; return; }
  container.innerHTML='';
  const canResolve = window.temPermissao && window.temPermissao('modules.tarefas.resolve');
  filtered.forEach((task,idx)=>{
    const isOpen=expandedIds.has(task.id), isDone=task.estado==='concluido'||task.estado==='cancelado';
    const estadoKey=task.estado||'aguardar';
    const card=document.createElement('div');
    card.className=`task-card estado-${estadoKey}`;
    card.innerHTML=`
      <div class="card-header" onclick="toggleCard('${task.id}')">
        <div class="card-num ${task.prioridade}">#${task.ordemChegada||(idx+1)}</div>
        <div class="card-title${isDone?' done':''}">${escHtml(task.titulo)}</div>
        <div class="card-person">${escHtml(task.solicitante)}</div>
        <div class="card-prio-col"><span class="prio-tag ${task.prioridade}">${PRIO_LABEL[task.prioridade]||task.prioridade}</span></div>
        <div class="card-estado-col"><span class="estado-pill ${estadoKey}">${ESTADO_LABEL[estadoKey]||estadoKey}</span></div>
        <svg class="chevron ${isOpen?'open':''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6l4 4 4-4"/></svg>
      </div>
      <div class="card-body ${isOpen?'open':''}">
        ${task.descricao?`<div class="card-desc">${escHtml(task.descricao)}</div>`:''}
        <div class="card-detail-row">
          <span class="detail-item"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="2.5"/><path d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/></svg>${escHtml(task.solicitante)}</span>
          <span class="detail-item"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>${fmtDateFull(task.criadaEm)}</span>
          ${task.escritorio?`<span class="escritorio-tag">${escHtml(task.escritorio)}</span>`:''}
        </div>
        ${task.notas?`<div class="card-notas"><div class="card-notas-label">Nota do gestor</div>${escHtml(task.notas)}</div>`:''}
        <div class="card-gestor ${canResolve?'show':''}">
          <div class="card-gestor-row">
            <select class="estado-select" onchange="updateEstado('${task.id}',this.value)">
              <option value="aguardar" ${estadoKey==='aguardar'?'selected':''}>⬜ A aguardar</option>
              <option value="progresso" ${estadoKey==='progresso'?'selected':''}>🔵 Em progresso</option>
              <option value="concluido" ${estadoKey==='concluido'?'selected':''}>✅ Concluído</option>
              <option value="cancelado" ${estadoKey==='cancelado'?'selected':''}>🔴 Cancelado</option>
              <option value="pendente" ${estadoKey==='pendente'?'selected':''}>🟠 Pendente</option>
            </select>
            <textarea class="notas-input" rows="1" placeholder="Nota interna…" onchange="updateNotas('${task.id}',this.value)">${escHtml(task.notas||'')}</textarea>
            <button class="icon-btn del" onclick="event.stopPropagation();deleteTask('${task.id}')">🗑</button>
          </div>
        </div>
        ${(task.ficheiros && task.ficheiros.length) ? `<div class="card-files">
          <div class="files-header">
            <span class="files-lbl">📎 Anexos</span>
          </div>
          ${renderFicheiros(task.id, task.ficheiros, canResolve)}
        </div>` : ''}
      </div>`;
    container.appendChild(card);
  });
}

function toggleCard(id) { if(expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id); renderList(); }
function selPrio(p) { selPrioVal=p; document.querySelectorAll('.prio-pill').forEach(b=>b.classList.toggle('sel',b.dataset.p===p)); }

// ── PENDING FILES (form) ──
function onPendingFilesChange(input) {
  Array.from(input.files).forEach(f => {
    if (f.size > 15 * 1024 * 1024) { toast('Ficheiro demasiado grande (máx 15 MB): ' + f.name); return; }
    pendingFiles.push(f);
  });
  input.value = '';
  renderPendingFilesList();
}

function renderPendingFilesList() {
  const container = document.getElementById('pendingFilesList');
  if (!container) return;
  if (!pendingFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-item">
      <span>📄</span>
      <span class="file-item-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
      <span class="file-item-size">${fmtBytes(f.size)}</span>
      <button class="file-item-del" onclick="removePendingFile(${i})" title="Remover">✕</button>
    </div>`).join('');
}

function removePendingFile(i) {
  pendingFiles.splice(i, 1);
  renderPendingFilesList();
}

// ── FILE UPLOADS ──
function renderFicheiros(docId, ficheiros, canDel) {
  window._files[docId] = ficheiros;
  if (!ficheiros.length) return '<div class="files-empty">Sem anexos</div>';
  return ficheiros.map((f, i) => `
    <div class="file-item">
      <span>📄</span>
      <span class="file-item-name" title="${escHtml(f.nome)}">${escHtml(f.nome)}</span>
      <span class="file-item-size">${fmtBytes(f.tamanho)}</span>
      <a class="file-item-dl" href="${escHtml(f.url)}" target="_blank" rel="noopener">⬇ Download</a>
      ${canDel ? `<button class="file-item-del" onclick="event.stopPropagation();deleteFicheiro('${escHtml(docId)}',${i})" title="Remover">✕</button>` : ''}
    </div>`).join('');
}


async function deleteFicheiro(docId, index) {
  const f = (window._files[docId] || [])[index];
  if (!f || !await confirmar({ titulo: 'Remover este anexo?', btnOk: 'Remover', perigo: true })) return;
  try {
    if (f.path) await storage.ref(f.path).delete().catch(()=>{});
    await col.doc(docId).update({ ficheiros: firebase.firestore.FieldValue.arrayRemove(f) });
    toast('Ficheiro removido.');
  } catch(e) { toast('Erro ao remover.'); }
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ── VOZ AI ──
const VOZ_CLAUDE_API_KEY = ''; // coloca a tua API key aqui

// ── Helper: normalizar escritório (ignora maiúsculas, acentos, palavras extra)
function _vozNormalizarEsc(valor) {
  if (!valor) return '';
  const lista = window.getEscritoriosSync ? window.getEscritoriosSync() : [];
  const limpar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,' ').trim();
  const v = limpar(valor);
  return (lista.find(e => v.includes(limpar(e.id)) || limpar(e.id).includes(v) || v.includes(limpar(e.nome)) || limpar(e.nome).includes(v)) || {}).id || '';
}

const VOZ_PROMPTS = {
  tarefa: `Analisa este texto em português e extrai os dados para uma tarefa interna.
Responde APENAS com um objecto JSON válido, sem texto adicional, sem marcadores de código.
Usa exactamente estas chaves (deixa em branco "" se não mencionado):
{"titulo":"título curto da tarefa (máx 80 chars)","descricao":"descrição detalhada ou vazio","prioridade":"urgente ou normal ou baixa","escritorio":"quarteira ou albufeira ou lisboa ou porto","departamento":"nome do departamento ou vazio"}`,
  admissao: `Analisa este texto em português e extrai os dados para uma admissão ou cessação.
Responde APENAS com um objecto JSON válido, sem texto adicional, sem marcadores de código.
Usa exactamente estas chaves (deixa em branco "" se não mencionado):
{"tipo":"admissao ou cessacao","nome":"nome completo","numero":"número de colaborador (só dígitos)","nif":"NIF (9 dígitos)","empresa":"nome da empresa utilizadora","categoria":"categoria ou função profissional","escritorio":"quarteira ou albufeira ou lisboa ou porto","dataEntrada":"YYYY-MM-DD ou vazio","valorBase":"valor numérico sem símbolo ex: 1200.00","tipoPagamento":"mes ou hora"}`
};

const VOZ_LABELS = {
  tarefa:   {titulo:'Título',descricao:'Descrição',prioridade:'Prioridade',escritorio:'Escritório',departamento:'Departamento'},
  admissao: {tipo:'Tipo',nome:'Nome',numero:'Nº Colaborador',nif:'NIF',empresa:'Empresa',categoria:'Categoria',escritorio:'Escritório',dataEntrada:'Data entrada',valorBase:'Valor base (€)',tipoPagamento:'Tipo pagamento'}
};

let _vozTipo = 'tarefa';
let _vozRec = null;
let _vozGravando = false;
let _vozTranscricao = '';
let _vozDados = null;

function vozAbrir(tipo) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    toast('A Web Speech API só funciona no Chrome ou Edge.');
    return;
  }
  _vozTipo = tipo;
  _vozDados = null;
  _vozTranscricao = '';
  const overlay = document.getElementById('vozModal');
  overlay.classList.add('open');
  document.getElementById('vozModalTitulo').textContent = tipo === 'tarefa' ? 'Nova tarefa por voz' : 'Novo processo por voz';
  document.getElementById('vozTranscript').classList.remove('visible');
  document.getElementById('vozFields').classList.remove('visible');
  document.getElementById('vozFields').innerHTML = '';
  document.getElementById('vozLoading').classList.remove('visible');
  document.getElementById('vozTranscriptFinal').textContent = '';
  document.getElementById('vozTranscriptInterim').textContent = '';
  document.getElementById('vozStatus').textContent = 'Clica para falar';
  document.getElementById('vozStatus').className = 'voz-status';
  document.getElementById('vozMicBtn').classList.remove('recording');
  document.getElementById('vozActions').innerHTML = '<button class="voz-btn voz-btn-cancel" onclick="vozFechar()">Cancelar</button>';
  overlay.classList.remove('recording');
}

function vozFechar() {
  if (_vozGravando) vozParar();
  document.getElementById('vozModal').classList.remove('open');
}

function vozToggle() {
  if (_vozGravando) vozParar();
  else vozIniciar();
}

function vozIniciar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _vozRec = new SR();
  _vozRec.lang = 'pt-PT';
  _vozRec.continuous = true;
  _vozRec.interimResults = true;
  _vozTranscricao = '';
  document.getElementById('vozTranscript').classList.add('visible');
  document.getElementById('vozTranscriptFinal').textContent = '';
  document.getElementById('vozTranscriptInterim').textContent = '';

  _vozRec.onstart = () => {
    _vozGravando = true;
    document.getElementById('vozMicBtn').classList.add('recording');
    document.getElementById('vozModal').classList.add('recording');
    document.getElementById('vozStatus').textContent = 'A ouvir… (clica para parar)';
    document.getElementById('vozStatus').className = 'voz-status rec';
    document.getElementById('vozMicIcon').innerHTML = '<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none"/>';
  };
  _vozRec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) _vozTranscricao += t + ' ';
      else interim = t;
    }
    document.getElementById('vozTranscriptFinal').textContent = _vozTranscricao;
    document.getElementById('vozTranscriptInterim').textContent = interim;
  };
  _vozRec.onerror = () => vozParar();
  _vozRec.onend = () => { if (_vozGravando) _vozRec.start(); };
  _vozRec.start();
}

function vozParar() {
  _vozGravando = false;
  if (_vozRec) { _vozRec.onend = null; _vozRec.stop(); }
  document.getElementById('vozMicBtn').classList.remove('recording');
  document.getElementById('vozModal').classList.remove('recording');
  document.getElementById('vozStatus').textContent = 'Clica para falar';
  document.getElementById('vozStatus').className = 'voz-status';
  document.getElementById('vozMicIcon').innerHTML = '<rect x="5" y="1" width="6" height="9" rx="3"/><path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6"/><path d="M8 14v2"/>';
  const texto = _vozTranscricao.trim();
  if (texto) vozProcessar(texto);
}

async function vozProcessar(texto) {
  document.getElementById('vozLoading').classList.add('visible');
  document.getElementById('vozFields').classList.remove('visible');
  document.getElementById('vozActions').innerHTML = '';

  try {
    let dados;
    if (!VOZ_CLAUDE_API_KEY) {
      await new Promise(r => setTimeout(r, 1400));
      dados = vozSimular(texto, _vozTipo);
    } else {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': VOZ_CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [{ role: 'user', content: VOZ_PROMPTS[_vozTipo] + '\n\nTexto: "' + texto + '"' }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.[0]?.text || '{}';
      dados = JSON.parse(raw.replace(/```json|```/g,'').trim());
    }
    _vozDados = dados;
    vozMostrarCampos(dados);
  } catch(e) {
    document.getElementById('vozLoading').classList.remove('visible');
    document.getElementById('vozStatus').textContent = 'Erro: ' + e.message;
    document.getElementById('vozActions').innerHTML = '<button class="voz-btn voz-btn-retry" onclick="vozProcessar(_vozTranscricao.trim())">Tentar novamente</button><button class="voz-btn voz-btn-cancel" onclick="vozFechar()">Cancelar</button>';
  }
}

function vozMostrarCampos(dados) {
  document.getElementById('vozLoading').classList.remove('visible');
  const labels = VOZ_LABELS[_vozTipo];
  const fields = document.getElementById('vozFields');
  const fullFields = _vozTipo === 'tarefa' ? ['descricao'] : ['empresa'];
  fields.innerHTML = Object.entries(dados).map(([k,v]) => {
    if (!(k in labels)) return '';
    const empty = !v || v === '' || v === 'vazio';
    const full = fullFields.includes(k);
    return '<div class="voz-field' + (full?' full':'') + '"><div class="voz-field-key">' + labels[k] + '</div><div class="voz-field-val' + (empty?' empty':'') + '">' + (empty ? '—' : String(v)) + '</div></div>';
  }).join('');
  fields.classList.add('visible');
  document.getElementById('vozActions').innerHTML = `
    <button class="voz-btn voz-btn-confirm" onclick="vozConfirmar()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l3.5 3.5L13 4"/></svg>
      Preencher formulário
    </button>
    <button class="voz-btn voz-btn-retry" onclick="vozToggle()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8A6 6 0 1114 8"/><path d="M2 8V4H6"/></svg>
      Regravar
    </button>`;
}

function vozConfirmar() {
  if (!_vozDados) return;
  if (_vozTipo === 'tarefa') vozPreencherTarefa(_vozDados);
  else vozPreencherAdmissao(_vozDados);
  vozFechar();
  document.querySelector('.novo-pedido-panel, .form-panel')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function vozPreencherTarefa(d) {
  if (d.titulo)    document.getElementById('fTitulo').value    = d.titulo.trim();
  if (d.descricao) document.getElementById('fDescricao').value = d.descricao.trim();
  // Escritório — normalização robusta
  const escId = _vozNormalizarEsc(d.escritorio);
  if (escId) {
    const sel = document.getElementById('fEscritorio');
    if (sel) [...sel.options].forEach(o => { if (o.value === escId) sel.value = o.value; });
  }
  // Prioridade — chama selPrio() para actualizar variável E pills
  if (d.prioridade && typeof selPrio === 'function') {
    const p = String(d.prioridade).toLowerCase().trim();
    selPrio(['urgente','normal','baixa'].includes(p) ? p : 'normal');
  }
  toast('Formulário preenchido por voz ✓');
}

function vozPreencherAdmissao(d) {
  // Tipo — chama selTipo() para actualizar cards e variável interna
  if (d.tipo && typeof selTipo === 'function') selTipo(d.tipo === 'cessacao' ? 'cessacao' : 'admissao');
  if (d.nome)     document.getElementById('fNome').value    = d.nome.trim();
  if (d.numero)   document.getElementById('fNumero').value  = String(d.numero).trim();
  if (d.nif)      document.getElementById('fNif').value     = String(d.nif).trim();
  if (d.empresa)  { const el = document.getElementById('fEmpresa');   if (el) el.value = d.empresa.trim(); }
  if (d.categoria){ const el = document.getElementById('fCategoria'); if (el) el.value = d.categoria.trim(); }
  if (d.valorBase){ const el = document.getElementById('fValorBase'); if (el) el.value = String(d.valorBase).replace(/[^0-9.]/g,''); }
  if (d.dataEntrada) {
    const el = document.getElementById('fDataEntrada');
    if (el) { el.value = d.dataEntrada; if (typeof updatePrioPreview === 'function') updatePrioPreview(); }
  }
  // Escritório — normalização robusta
  const escId = _vozNormalizarEsc(d.escritorio);
  if (escId) {
    const sel = document.getElementById('fEscritorioAdm');
    if (sel) [...sel.options].forEach(o => { if (o.value === escId) sel.value = o.value; });
  }
  // Tipo de pagamento — chama selPagamento()
  if (d.tipoPagamento && typeof selPagamento === 'function') {
    selPagamento(String(d.tipoPagamento).toLowerCase() === 'hora' ? 'hora' : 'mes');
  }
  toast('Formulário preenchido por voz ✓');
}

// Simulação offline
function vozSimular(texto, tipo) {
  const t = texto.toLowerCase();
  const nome = (texto.match(/\b([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç]+)+)\b/) || [])[1] || '';
  const esc  = _vozNormalizarEsc((window.getEscritoriosSync ? window.getEscritoriosSync() : []).map(e => e.id).find(e => t.includes(e)) || '');
  const data = (texto.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) || [])[1] || '';
  const numero = (texto.match(/(?:n[uúº°]mero|n[oº]\.?)\s*(\d+)/i) || [])[1] || '';
  const empM = texto.match(/(?:empresa|para\s+(?:a\s+)?empresa)\s+([A-Za-zÀ-ÿ0-9 &,\.]+?)(?:\s+(?:base|categoria|nif|n[uú]mero|escritório|€|\d))/i);
  const catM = texto.match(/categoria\s+([A-Za-zÀ-ÿ ]+?)(?:\s+(?:base|empresa|nif|escritório|€|\d|$))/i);
  const valM = texto.match(/(?:base\s+|salário\s+)?(\d[\d\s]*(?:[.,]\d{1,2})?)\s*€/i) || texto.match(/base\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i);
  const nif  = (texto.match(/\b(\d{9})\b/) || [])[1] || '';
  if (tipo === 'tarefa') {
    return {
      titulo: texto.split(' ').slice(0,7).join(' ').replace(/^\w/, c => c.toUpperCase()),
      descricao: texto.length > 50 ? texto : '',
      prioridade: t.includes('urgente') ? 'urgente' : t.includes('baixa') ? 'baixa' : 'normal',
      escritorio: esc,
      departamento: t.includes('contabil') ? 'Contabilidade' : t.includes('payroll')||t.includes('rh') ? 'Payroll' : '',
    };
  }
  return {
    tipo:          t.includes('cessa') || t.includes('saída') || t.includes('saida') ? 'cessacao' : 'admissao',
    nome,
    numero,
    nif,
    empresa:       empM ? empM[1].trim() : '',
    categoria:     catM ? catM[1].trim() : '',
    escritorio:    esc,
    dataEntrada:   data,
    valorBase:     valM ? valM[1].replace(/\s/g,'').replace(',','.') : '',
    tipoPagamento: t.includes(' hora') || t.includes('horário') ? 'hora' : 'mes',
  };
}

// Fechar ao clicar fora
document.getElementById('vozModal').addEventListener('click', function(e) {
  if (e.target === this) vozFechar();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') vozFechar(); });
