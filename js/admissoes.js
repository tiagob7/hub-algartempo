const GESTOR_PIN = '9005';
const db      = firebase.firestore();

function toggleFormAdm() {
  const panel = document.getElementById('formAdmissoes');
  if (panel) panel.classList.toggle('open');
}
const col     = window.AdmissoesService.proxy();
const storage = firebase.storage();
window._files = {};

// ── STATE ──
let processos      = [];
let isGestor       = false;
let selTipoVal     = 'admissao';
let selPagamentoVal= 'mes';
let filterTipo     = 'todos';
let filterEstado   = 'activos';
let filterPrio     = 'todos';
const expandedIds  = new Set();
let filtroEscritorio = '';
let pendingFilesAdm = [];

// ── FIREBASE ──

// ── PRIORIDADE ──
function calcPrioridade(dateStr) {
  if (!dateStr) return 'baixa';
  const hoje  = new Date(); hoje.setHours(0,0,0,0);
  const data  = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((data - hoje) / 86400000); // dias
  if (diff <= 1)  return 'alta';
  if (diff <= 3)  return 'media';
  return 'baixa';
}

function prioLabel(prio) {
  if (prio === 'alta')  return '🔴 Alta — data iminente';
  if (prio === 'media') return '🟡 Média — em breve';
  return '🟢 Baixa — sem urgência';
}

function updatePrioPreview() {
  const val     = document.getElementById('fDataEntrada').value;
  const preview = document.getElementById('prioPreview');
  if (!val) { preview.style.display = 'none'; return; }
  const prio = calcPrioridade(val);
  preview.className = 'prio-preview ' + prio;
  preview.querySelector('.prio-preview-text').textContent = prioLabel(prio);
  preview.style.display = 'flex';
}

function updatePrioPreviewCessacao() {
  const val     = document.getElementById('fDataSaida').value;
  const preview = document.getElementById('prioPreviewCessacao');
  if (!val) { preview.style.display = 'none'; return; }
  const prio = calcPrioridade(val);
  preview.className = 'prio-preview ' + prio;
  preview.querySelector('.prio-preview-text').textContent = prioLabel(prio);
  preview.style.display = 'flex';
}

// ── TIPO FORM ──
function selTipo(t) {
  selTipoVal = t;
  document.getElementById('cardAdmissao').className = 'tipo-card' + (t === 'admissao' ? ' sel-admissao' : '');
  document.getElementById('cardCessacao').className = 'tipo-card' + (t === 'cessacao' ? ' sel-cessacao' : '');
  document.getElementById('blocoCamposAdmissao').style.display = t === 'admissao' ? '' : 'none';
  document.getElementById('blocoCamposCessacao').style.display = t === 'cessacao' ? '' : 'none';
  // reset previews
  document.getElementById('prioPreview').style.display = 'none';
  document.getElementById('prioPreviewCessacao').style.display = 'none';
}

function selPagamento(p) {
  selPagamentoVal = p;
  document.querySelectorAll('.pag-pill').forEach(b => b.classList.toggle('sel', b.dataset.p === p));
}

// ── SUBMIT ──
async function submitProcesso() {
  const btn = document.getElementById('btnSubmeterProcesso');
  if (btn) btn.disabled = true;
  try {
    const profile     = window.userProfile;
    const submetidoPor = profile ? (profile.nomeCompleto || profile.nome || profile.email) : '—';
    const nome         = document.getElementById('fNome').value.trim();

    if (!nome) { toast('Preenche o nome do colaborador!'); return; }

    // empresa só é obrigatória na admissão
    let empresa = '';
    if (selTipoVal === 'admissao') {
      empresa = document.getElementById('fEmpresa') ? document.getElementById('fEmpresa').value.trim() : '';
      if (!empresa) { toast('Preenche a empresa utilizadora!'); return; }
    }

    let dataRef = '';
    let prioridade = 'baixa';

    if (selTipoVal === 'admissao') {
      dataRef = document.getElementById('fDataEntrada').value;
      if (!dataRef) { toast('Selecciona a data de entrada!'); return; }
      prioridade = calcPrioridade(dataRef);
    } else {
      dataRef = document.getElementById('fDataSaida').value;
      if (!dataRef) { toast('Selecciona a data de saída!'); return; }
      prioridade = calcPrioridade(dataRef);
    }

    const doc = {
      tipo:          selTipoVal,
      submetidoPor,
      numero:        document.getElementById('fNumero').value.trim(),
      nome,
      nif:           document.getElementById('fNif').value.trim(),
      empresa,
      categoria:     document.getElementById('fCategoria').value.trim(),
      prioridade,
      estado:        'aguardar',
      notas:         '',
      criadoEm:      Date.now(),
      escritorio:    (document.getElementById('fEscritorioAdm') ? document.getElementById('fEscritorioAdm').value : null)
                     || (window.userProfile ? window.userProfile.escritorio : null)
                     || '',
      escritorioOrigem: window.userProfile && window.userProfile.escritorio
                        ? window.userProfile.escritorio
                        : '',
      criadoPor:     window.currentUser ? window.currentUser.uid : ''
    };

    if (selTipoVal === 'admissao') {
      doc.tipoPagamento = selPagamentoVal;
      doc.valorBase  = document.getElementById('fValorBase').value || '';
      doc.valorHora  = document.getElementById('fValorHora').value || '';
      doc.valorMes   = document.getElementById('fValorMes').value  || '';
      doc.dataEntrada = dataRef;
    } else {
      doc.dataSaida = dataRef;
      doc.motivo    = document.getElementById('fMotivo').value;
    }

    const docRef = await col.add(doc);
    await registarAuditoria({
      modulo: 'admissoes', acao: 'criado',
      docId: docRef.id,
      titulo: doc.nome + (doc.tipo === 'admissao' ? ' — Admissão' : ' — Cessação'),
      depois: doc,
    });

    // Upload pending files
    if (pendingFilesAdm.length) {
      const statusEl = document.getElementById('formAdmUploadStatus');
      if (statusEl) statusEl.textContent = 'A carregar anexos…';
      const ficheiros = [];
      for (const file of pendingFilesAdm) {
        const path = `admissoes/${docRef.id}/${Date.now()}_${file.name}`;
        try {
          const uploaded = await window.AdmissoesService.uploadFiles(docRef.id, [file]);
          if (uploaded.length) ficheiros.push(uploaded[0]);
        } catch(e) { console.error(e); toast('Erro ao carregar: ' + file.name); }
      }
      if (ficheiros.length) await docRef.update({ ficheiros });
      if (statusEl) statusEl.textContent = '';
    }

    _invalidateAdmCache(); // novo processo → forçar re-leitura
    pendingFilesAdm = [];
    renderPendingFilesAdmList();
    resetForm();
    // Fechar o painel após submeter com sucesso
    const fp = document.getElementById('formAdmissoes');
    if (fp) fp.classList.remove('open');
    startSync(); // recarregar lista
    toast('✓ Processo submetido!');
  } catch(e) {
    console.error(e);
    toast('Erro ao submeter.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function resetForm() {
  ['fNumero','fNome','fNif','fEmpresa','fCategoria',
   'fValorBase','fValorHora','fValorMes','fDataEntrada','fDataSaida'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fMotivo').value = '';
  selTipo('admissao');
  selPagamento('mes');
  document.getElementById('prioPreview').style.display = 'none';
  document.getElementById('prioPreviewCessacao').style.display = 'none';
  // clear pending files
  pendingFilesAdm = [];
  renderPendingFilesAdmList();
}

// ── UPDATE (gestor) ──
async function updateEstado(id, val) {
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).update({ estado: val });
    _invalidateAdmCache(); // estado alterado → forçar re-leitura
    // atualizar localmente sem re-fetch para resposta imediata
    const proc = processos.find(p => p.id === id);
    if (proc) { proc.estado = val; render(); }
    await registarAuditoria({
      modulo: 'admissoes', acao: 'estado',
      docId: id,
      titulo: antes.nome + (antes.tipo === 'admissao' ? ' — Admissão' : ' — Cessação'),
      antes: { estado: antes.estado },
      depois: { estado: val },
    });
  }
  catch(e) { toast('Erro ao actualizar.'); }
}

async function updateNotas(id, val) {
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).update({ notas: val });
    await registarAuditoria({
      modulo: 'admissoes', acao: 'atualizado',
      docId: id,
      titulo: antes.nome + (antes.tipo === 'admissao' ? ' — Admissão' : ' — Cessação'),
      antes: { notas: antes.notas },
      depois: { notas: val },
    });
  }
  catch(e) {}
}

async function deleteProcesso(id) {
  if (!await confirmar({ titulo: 'Eliminar este processo permanentemente?', btnOk: 'Confirmar', perigo: true })) return;
  expandedIds.delete(id);
  try {
    const snap = await col.doc(id).get();
    const antes = snap.data();
    await col.doc(id).delete();
    await registarAuditoria({
      modulo: 'admissoes', acao: 'eliminado',
      docId: id,
      titulo: antes.nome + (antes.tipo === 'admissao' ? ' — Admissão' : ' — Cessação'),
      antes,
    });
    toast('Processo eliminado.');
  }
  catch(e) { toast('Erro ao eliminar.'); }
}

// ── FILTERS ──
function getFiltered() {
  let out = processos;
  if (filtroEscritorio)         out = out.filter(p => p.escritorio === filtroEscritorio);
  if (filterTipo !== 'todos')   out = out.filter(p => p.tipo === filterTipo);
  if (filterPrio !== 'todos')   out = out.filter(p => p.prioridade === filterPrio);
  if (filterEstado === 'activos') out = out.filter(p => p.estado !== 'concluido' && p.estado !== 'cancelado');
  else if (filterEstado !== 'todos') out = out.filter(p => p.estado === filterEstado);
  return out;
}

function setFilterTipo(v)   { filterTipo   = v; document.querySelectorAll('[data-ft]').forEach(b => b.classList.toggle('active', b.dataset.ft === v)); renderList(); }
function setFilterEstado(v) { filterEstado = v; document.querySelectorAll('[data-fe]').forEach(b => b.classList.toggle('active', b.dataset.fe === v)); renderList(); }
function setFilterPrio(v)   { filterPrio   = v; document.querySelectorAll('[data-fp]').forEach(b => b.classList.toggle('active', b.dataset.fp === v)); renderList(); }

// ── RENDER ──
function render() {
  renderStats();
  renderList();
}

function renderStats() {
  // usar apenas os processos do escritório ativo (respeita o filtro)
  const base    = filtroEscritorio ? processos.filter(p => p.escritorio === filtroEscritorio) : processos;
  const activos = base.filter(p => p.estado !== 'concluido' && p.estado !== 'cancelado');
  document.getElementById('statAdm').textContent  = base.filter(p => p.tipo === 'admissao' && p.estado !== 'concluido' && p.estado !== 'cancelado').length;
  document.getElementById('statCes').textContent  = base.filter(p => p.tipo === 'cessacao' && p.estado !== 'concluido' && p.estado !== 'cancelado').length;
  document.getElementById('statAlta').textContent = activos.filter(p => p.prioridade === 'alta').length;
  document.getElementById('statPend').textContent = activos.filter(p => p.estado === 'pendente').length;
  document.getElementById('statConc').textContent = base.filter(p => p.estado === 'concluido').length;
}

const ESTADO_LABEL = { aguardar:'A aguardar', pendente:'Pendente', concluido:'Concluído', cancelado:'Cancelado' };
const TIPO_LABEL   = { admissao:'Admissão', cessacao:'Cessação' };
const PRIO_ORDER   = { alta:0, media:1, baixa:2 };

function renderList() {
  const container = document.getElementById('cardsList');
  const filtered  = getFiltered().sort((a,b) => {
    const done_a = (a.estado==='concluido'||a.estado==='cancelado') ? 1 : 0;
    const done_b = (b.estado==='concluido'||b.estado==='cancelado') ? 1 : 0;
    if (done_a !== done_b) return done_a - done_b;
    const pd = (PRIO_ORDER[a.prioridade]??2) - (PRIO_ORDER[b.prioridade]??2);
    if (pd !== 0) return pd;
    return (b.criadoEm||0) - (a.criadoEm||0);
  });

  document.getElementById('countBadge').textContent = filtered.length + ' processo' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        <p>Nenhum processo encontrado.</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((proc, idx) => {
    const isOpen  = expandedIds.has(proc.id);
    const isDone  = proc.estado === 'concluido' || proc.estado === 'cancelado';
    const dataKey = proc.tipo === 'admissao' ? proc.dataEntrada : proc.dataSaida;
    const dataLabel = proc.tipo === 'admissao' ? 'Entrada' : 'Saída';

    // detail items
    let detailHtml = `
      <div class="detail-item"><div class="detail-item-label">Nº Colaborador</div><div class="detail-item-val">${escHtml(proc.numero||'—')}</div></div>
      <div class="detail-item"><div class="detail-item-label">NIF</div><div class="detail-item-val">${escHtml(proc.nif||'—')}</div></div>
      <div class="detail-item"><div class="detail-item-label">Categoria</div><div class="detail-item-val">${escHtml(proc.categoria||'—')}</div></div>
      <div class="detail-item"><div class="detail-item-label">Data ${escHtml(dataLabel)}</div><div class="detail-item-val ${proc.tipo==='cessacao'?'val-cessacao':''}">${fmtDate(dataKey)}</div></div>
    `;

    if (proc.tipo === 'admissao') {
      detailHtml += `
        <div class="detail-item"><div class="detail-item-label">Tipo pagamento</div><div class="detail-item-val">${proc.tipoPagamento === 'hora' ? '⏱ À hora' : '📅 Mensal'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Valor Base</div><div class="detail-item-val val-money">${proc.valorBase ? fmtMoney(proc.valorBase) : '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Valor Hora</div><div class="detail-item-val val-money">${proc.valorHora ? fmtMoney(proc.valorHora) : '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Valor Mês</div><div class="detail-item-val val-money">${proc.valorMes ? fmtMoney(proc.valorMes) : '—'}</div></div>
      `;
    } else {
      detailHtml += `
        <div class="detail-item"><div class="detail-item-label">Motivo saída</div><div class="detail-item-val val-cessacao">${escHtml(proc.motivo||'—')}</div></div>
      `;
    }

    const card = document.createElement('div');
    card.className = `proc-card tipo-${proc.tipo} estado-${proc.estado||'aguardar'}`;
    card.innerHTML = `
      <div class="card-header" onclick="toggleCard('${proc.id}')">
        <div class="card-num ${proc.prioridade}">#${idx+1}</div>
        <div class="card-info">
          <div class="card-nome${isDone?' done':''}">${escHtml(proc.nome)}</div>
          <div class="card-empresa">${escHtml(proc.empresa||'—')}${proc.categoria ? ' <span style="color:var(--border);margin:0 2px">·</span> <span style="color:var(--muted)">' + escHtml(proc.categoria) + '</span>' : ''}</div>
        </div>
        <div class="card-date">${fmtDate(dataKey)}</div>
        <span class="tipo-badge ${proc.tipo}">${TIPO_LABEL[proc.tipo]||proc.tipo}</span>
        <span class="prio-tag ${proc.prioridade}">${proc.prioridade==='alta'?'🔴':proc.prioridade==='media'?'🟡':'🟢'} ${proc.prioridade==='media'?'Média':proc.prioridade.charAt(0).toUpperCase()+proc.prioridade.slice(1)}</span>
        <span class="estado-pill ${proc.estado||'aguardar'}">${ESTADO_LABEL[proc.estado]||proc.estado}</span>
        <svg class="chevron ${isOpen?'open':''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6l4 4 4-4"/></svg>
      </div>
      <div class="card-body ${isOpen?'open':''}">
        <div class="detail-grid">${detailHtml}</div>
        <div class="card-footer-row">
          <span class="detail-meta">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="2.5"/><path d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/></svg>
            Submetido por ${escHtml(proc.submetidoPor||'—')}
          </span>
          <span class="detail-meta">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>
            ${fmtDateFull(proc.criadoEm)}
          </span>
        </div>
        ${proc.notas ? `<div class="card-notas"><div class="card-notas-label">Nota RH</div>${escHtml(proc.notas)}</div>` : ''}
        <div class="card-gestor ${isGestor?'show':''}">
          <div class="card-gestor-row">
            <select class="estado-select" onchange="updateEstado('${proc.id}', this.value)">
              <option value="aguardar"  ${proc.estado==='aguardar' ?'selected':''}>⬜ A aguardar</option>
              <option value="pendente"  ${proc.estado==='pendente' ?'selected':''}>🔵 Pendente (aguarda docs)</option>
              <option value="concluido" ${proc.estado==='concluido'?'selected':''}>✅ Concluído</option>
              <option value="cancelado" ${proc.estado==='cancelado'?'selected':''}>🔴 Cancelado</option>
            </select>
            <textarea class="notas-input" rows="1" placeholder="Nota interna RH (opcional)…" autocomplete="off" onchange="updateNotas('${proc.id}', this.value)">${escHtml(proc.notas||'')}</textarea>
            <button class="icon-btn del" title="Eliminar" onclick="event.stopPropagation();deleteProcesso('${proc.id}')">🗑</button>
          </div>
        </div>
        ${(proc.ficheiros && proc.ficheiros.length) ? `<div class="card-files">
          <div class="files-header">
            <span class="files-lbl">📎 Anexos</span>
          </div>
          ${renderFicheiros(proc.id, proc.ficheiros, isGestor)}
        </div>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// ── CARD TOGGLE ──
function toggleCard(id) {
  if (expandedIds.has(id)) expandedIds.delete(id);
  else expandedIds.add(id);
  renderList();
}

// ── PIN / GESTOR ──
function openPinModal() {
  if (isGestor) {
    isGestor = false;
    document.getElementById('btnGestor').classList.remove('active');
    document.querySelectorAll('.card-gestor').forEach(el => el.classList.remove('show'));
    toast('Modo gestor desactivado.');
    return;
  }
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
  document.getElementById('pinModal').classList.add('open');
  setTimeout(() => document.getElementById('pinInput').focus(), 100);
}

function closePinModal() { document.getElementById('pinModal').classList.remove('open'); }
function onPinInput()    { if (document.getElementById('pinInput').value.length === 4) checkPin(); }

function checkPin() {
  const val = document.getElementById('pinInput').value;
  if (val === GESTOR_PIN) {
    isGestor = true;
    document.getElementById('btnGestor').classList.add('active');
    closePinModal();
    document.querySelectorAll('.card-gestor').forEach(el => el.classList.add('show'));
    toast('✓ Modo gestor (RH) activado.');
  } else {
    document.getElementById('pinError').textContent = 'PIN incorreto. Tenta novamente.';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

document.getElementById('pinModal').addEventListener('click', function(e){ if(e.target===this) closePinModal(); });
document.getElementById('pinInput').addEventListener('keydown', e => { if(e.key==='Enter') checkPin(); });

// ── UTILS ──

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}


function fmtMoney(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
}

function setFiltroEscritorioAdm(val) {
  filtroEscritorio = val;
  renderList();
}

// ── PENDING FILES (form) ──
function onPendingFilesAdmChange(input) {
  Array.from(input.files).forEach(f => {
    if (f.size > 15 * 1024 * 1024) { toast('Ficheiro demasiado grande (máx 15 MB): ' + f.name); return; }
    pendingFilesAdm.push(f);
  });
  input.value = '';
  renderPendingFilesAdmList();
}

function renderPendingFilesAdmList() {
  const container = document.getElementById('pendingFilesAdmList');
  if (!container) return;
  if (!pendingFilesAdm.length) { container.innerHTML = ''; return; }
  container.innerHTML = pendingFilesAdm.map((f, i) => `
    <div class="file-item">
      <span>📄</span>
      <span class="file-item-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
      <span class="file-item-size">${fmtBytes(f.size)}</span>
      <button class="file-item-del" onclick="removePendingFileAdm(${i})" title="Remover">✕</button>
    </div>`).join('');
}

function removePendingFileAdm(i) {
  pendingFilesAdm.splice(i, 1);
  renderPendingFilesAdmList();
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
    await window.AdmissoesService.removeFile(docId, f);
    toast('Ficheiro removido.');
  } catch(e) { toast('Erro ao remover.'); }
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}


// ── INIT — aguarda autenticação ──
document.addEventListener('authReady', ({ detail }) => {
  window.renderNavbar('admissoes');
  const isAdmin    = window.isAdmin();
  const escritorio = window.escritorioAtivo();
  const profile    = detail.profile;

  // preencher info do utilizador no form (automático)
  if (profile) {
    const nome = profile.nomeCompleto || profile.nome || profile.email || '?';
    const avatarEl = document.getElementById('userAvatar');
    const nameEl   = document.getElementById('userName');
    if (avatarEl) avatarEl.textContent = nome.charAt(0).toUpperCase();
    if (nameEl)   nameEl.textContent   = nome;
  }

  // mostrar/esconder form de criar processo
  const canCriarAdm = window.temPermissao('modules.admissoes.create');
  const formPanelEl = document.querySelector('.form-panel');
  if (formPanelEl) formPanelEl.style.display = canCriarAdm ? '' : 'none';

  // mostrar/esconder botão "Modo Gestor"
  const canResolverAdm = window.temPermissao('modules.admissoes.resolve');
  const btnGestor = document.getElementById('btnGestor');
  if (btnGestor && !canResolverAdm) btnGestor.style.display = 'none';

  // botão VOZ — visível apenas para admins
  const btnVozAdm = document.querySelector('.form-panel .mic-trigger-btn');
  if (btnVozAdm && !isAdmin) btnVozAdm.style.display = 'none';

  // Modo gestor automático para quem tem permissão de resolver + admin
  if (isAdmin || window.temPermissao('modules.admissoes.resolve')) {
    isGestor = true;
    const btn = document.getElementById('btnGestor');
    if (btn) {
      btn.classList.add('active');
      btn.onclick = function() {
        isGestor = !isGestor;
        btn.classList.toggle('active', isGestor);
        document.querySelectorAll('.card-gestor').forEach(el => el.classList.toggle('show', isGestor));
        toast(isGestor ? '✓ Modo gestor activado.' : 'Modo gestor desactivado.');
      };
    }
    document.querySelectorAll('.card-gestor').forEach(el => el.classList.add('show'));

    // Mostrar seletor de escritório para admin
    const rowEsc = document.getElementById('rowFiltroEscritorio');
    if (rowEsc) rowEsc.style.display = '';
  }

  // filtro por defeito = escritório do utilizador (com fallback seguro)
  filtroEscritorio = isAdmin
    ? ((escritorio && escritorio !== 'todos') ? escritorio : '')
    : (profile ? (profile.escritorio || '') : '');

  const feEl = document.getElementById('filterEscritorioAdm');

  // preencher selects de escritório dinamicamente
  if (window.loadEscritorios) {
    loadEscritorios().then(lista => {
      if (feEl) {
        feEl.innerHTML = '<option value=\"\">Todos os escritórios</option>' +
          lista.map(e => `<option value=\"${e.id}\">${e.nome}</option>`).join('');
        if (filtroEscritorio) feEl.value = filtroEscritorio;
      }
      const fEsc = document.getElementById('fEscritorioAdm');
      if (fEsc) {
        fEsc.innerHTML = lista.map(e => `<option value=\"${e.id}\">${e.nome}</option>`).join('');
        if (profile && profile.escritorio && lista.some(e => e.id === profile.escritorio)) {
          fEsc.value = profile.escritorio;
        }
      }
    }).catch(() => {
      if (feEl && filtroEscritorio) feEl.value = filtroEscritorio;
    });
  } else if (feEl && filtroEscritorio) {
    feEl.value = filtroEscritorio;
  }

  startSync();
});

// ── Cache de admissões ────────────────────────────────────────────────────────
// TTL de 3 min: processos mudam com moderada frequência.
// Cache é invalidado ao criar/atualizar um processo.
const _admCache = { ts: 0 };
const ADM_CACHE_TTL = 3 * 60 * 1000; // 3 minutos

function _admCacheValid() {
  return processos.length > 0 && (Date.now() - _admCache.ts) < ADM_CACHE_TTL;
}

function _invalidateAdmCache() { _admCache.ts = 0; }

function startSync() {
  // Se cache válido → apenas re-renderizar
  if (_admCacheValid()) {
    render();
    setStatus('✓ Carregado', '#16a34a');
    setTimeout(() => setStatus(''), 2000);
    return;
  }
  setStatus('A carregar…', '#f59e0b');
  col.orderBy('criadoEm', 'desc').limit(100).get()
    .then(snap => {
      processos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _admCache.ts = Date.now();
      render();
      setStatus('✓ Carregado', '#16a34a');
      setTimeout(() => setStatus(''), 3000);
    })
    .catch(err => {
      console.error(err);
      setStatus('Erro de ligação', '#dc2626');
    });
}

// ── VOZ AI — helpers e registo do tipo 'admissao' ──
function _vozNormalizarEsc(valor) {
  if (!valor) return '';
  const lista = window.getEscritoriosSync ? window.getEscritoriosSync() : [];
  const limpar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,' ').trim();
  const v = limpar(valor);
  return (lista.find(e => v.includes(limpar(e.id)) || limpar(e.id).includes(v) || v.includes(limpar(e.nome)) || limpar(e.nome).includes(v)) || {}).id || '';
}

function _vozPreencherAdmissao(d) {
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
  const escId = _vozNormalizarEsc(d.escritorio);
  if (escId) {
    const sel = document.getElementById('fEscritorioAdm');
    if (sel) [...sel.options].forEach(o => { if (o.value === escId) sel.value = o.value; });
  }
  if (d.tipoPagamento && typeof selPagamento === 'function') {
    selPagamento(String(d.tipoPagamento).toLowerCase() === 'hora' ? 'hora' : 'mes');
  }
}

document.addEventListener('authReady', () => {
  if (!window.VozAI) return;
  VozAI.registarTipo('admissao', {
    titulo: 'Novo processo por voz',
    prompt: `Analisa este texto em português e extrai os dados para uma admissão ou cessação.
Responde APENAS com um objecto JSON válido, sem texto adicional, sem marcadores de código.
Usa exactamente estas chaves (deixa em branco "" se não mencionado):
{"tipo":"admissao ou cessacao","nome":"nome completo","numero":"número de colaborador (só dígitos)","nif":"NIF (9 dígitos)","empresa":"nome da empresa utilizadora","categoria":"categoria ou função profissional","escritorio":"quarteira ou albufeira ou lisboa ou porto","dataEntrada":"YYYY-MM-DD ou vazio","valorBase":"valor numérico sem símbolo ex: 1200.00","tipoPagamento":"mes ou hora"}`,
    labels: {tipo:'Tipo',nome:'Nome',numero:'Nº Colaborador',nif:'NIF',empresa:'Empresa',categoria:'Categoria',escritorio:'Escritório',dataEntrada:'Data entrada',valorBase:'Valor base (€)',tipoPagamento:'Tipo pagamento'},
    fullFields: ['empresa'],
    preencher: _vozPreencherAdmissao,
    simular(texto) {
      const t = texto.toLowerCase();
      const nome = (texto.match(/\b([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç]+)+)\b/) || [])[1] || '';
      const esc  = _vozNormalizarEsc((window.getEscritoriosSync ? window.getEscritoriosSync() : []).map(e => e.id).find(e => t.includes(e)) || '');
      const data = (texto.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) || [])[1] || '';
      const numero = (texto.match(/(?:n[uúº°]mero|n[oº]\.?)\s*(\d+)/i) || [])[1] || '';
      const empM = texto.match(/(?:empresa|para\s+(?:a\s+)?empresa)\s+([A-Za-zÀ-ÿ0-9 &,\.]+?)(?:\s+(?:base|categoria|nif|n[uú]mero|escritório|€|\d))/i);
      const catM = texto.match(/categoria\s+([A-Za-zÀ-ÿ ]+?)(?:\s+(?:base|empresa|nif|escritório|€|\d|$))/i);
      const valM = texto.match(/(?:base\s+|salário\s+)?(\d[\d\s]*(?:[.,]\d{1,2})?)\s*€/i) || texto.match(/base\s+(\d[\d\s]*(?:[.,]\d{1,2})?)/i);
      const nif  = (texto.match(/\b(\d{9})\b/) || [])[1] || '';
      return {
        tipo:          t.includes('cessa') || t.includes('saída') || t.includes('saida') ? 'cessacao' : 'admissao',
        nome, numero, nif,
        empresa:       empM ? empM[1].trim() : '',
        categoria:     catM ? catM[1].trim() : '',
        escritorio:    esc,
        dataEntrada:   data,
        valorBase:     valM ? valM[1].replace(/\s/g,'').replace(',','.') : '',
        tipoPagamento: t.includes(' hora') || t.includes('horário') ? 'hora' : 'mes',
      };
    },
  });
}, { once: true });
