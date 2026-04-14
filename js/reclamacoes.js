const db  = firebase.firestore();
const col = window.ReclamacoesService.proxy();
const storage = firebase.storage();
window._files = {};

function toggleFormRec() {
  const panel = document.getElementById('formPanel');
  if (panel) panel.classList.toggle('open');
}

let recs=[], filtroEstado='ativos', filtroEscritorio='', selCanalVal='email';
const expandedIds = new Set();

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
             'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA=['D','S','T','Q','Q','S','S'];

const ESTADO_LABEL={
  nova:'Nova',verificacao:'Em Verificação',enviada:'Enviada à Empresa',
  confirmada:'Confirmada','aguarda-proc':'Aguarda Processamento',
  paga:'Paga','sem-fundamento':'Sem Fundamento',negada:'Negada pela Empresa'};
const CANAL_LABEL={email:'📧 Email',telefone:'📞 Telefone',mensagem:'💬 Mensagem',presencial:'🧑 Presencial'};
const ESTADOS_ATIVOS=['nova','verificacao','enviada','confirmada','aguarda-proc'];

// ── PERÍODO BLOCKS ──
let periodoCount=0;
const PS={}; // periodoState: id → {mes,ano,diasSel,calOpen,calViewMes,calViewAno,rangeStart}

function adicionarPeriodo(d) {
  const id='p'+(++periodoCount);
  const now=new Date();
  PS[id]={
    mes:  d?d.mes:now.getMonth(),
    ano:  d?d.ano:now.getFullYear(),
    diasSel: new Set(d?d.dias:[]),
    calOpen:false,
    calViewMes: d?d.mes:now.getMonth(),
    calViewAno: d?d.ano:now.getFullYear(),
    rangeStart:null
  };
  const wrap=document.getElementById('periodosWrap');
  const div=document.createElement('div');
  div.className='periodo-block'; div.id='block-'+id;
  div.innerHTML=buildBlockHTML(id,d);
  wrap.appendChild(div);
  if(d) updateTrigger(id);
  // add initial turno(s)
  if(d && d.turnos && d.turnos.length) d.turnos.forEach(t=>adicionarTurno(id,t));
  else adicionarTurno(id);
  syncRemoveBtns();
}

function buildBlockHTML(id,d) {
  const s=PS[id];
  const mesOpts=MESES.map((m,i)=>`<option value="${i}" ${i===s.mes?'selected':''}>${m}</option>`).join('');
  const hE=d?(d.horaEntrada||''):'';
  const hS=d?(d.horaSaida||''):'';
  const tot=d?(d.totalHoras||''):'';
  return `
    <div class="periodo-block-header">
      <span class="periodo-block-title">Período</span>
      <button class="btn-remove-periodo" onclick="removerPeriodo('${id}')" title="Remover">×</button>
    </div>
    <div class="periodo-grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div>
        <label class="field-label">Dias<span class="req">*</span></label>
        <div class="cal-wrap" id="cw-${id}">
          <button type="button" class="cal-trigger" id="ct-${id}" onclick="toggleCal('${id}')">Selecionar dias…</button>
          <div class="cal-popup" id="cp-${id}">
            <div class="cal-nav">
              <button class="cal-nav-btn" onclick="calNav('${id}',-1)"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 12L6 8l4-4"/></svg></button>
              <span class="cal-month-label" id="cm-${id}"></span>
              <button class="cal-nav-btn" onclick="calNav('${id}',1)"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12l4-4-4-4"/></svg></button>
            </div>
            <div class="cal-grid" id="cg-${id}"></div>
            <div class="cal-footer">
              <span class="cal-hint">Clique · Shift+clique para intervalo</span>
              <button class="cal-clear" onclick="calClear('${id}')">Limpar</button>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label class="field-label">Mês</label>
        <select class="form-select" id="mes-${id}" onchange="onMesAno('${id}')">${mesOpts}</select>
      </div>
      <div>
        <label class="field-label">Ano</label>
        <input type="number" class="form-input" id="ano-${id}" value="${s.ano}" min="2020" max="2035" onchange="onMesAno('${id}')">
      </div>
    </div>
    <div style="margin-top:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <label class="field-label" style="margin:0">Turnos</label>
        <button class="btn-add-turno" onclick="adicionarTurno('${id}')">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
          Adicionar turno
        </button>
      </div>
      <div class="turnos-wrap" id="turnos-${id}"></div>
    </div>
    <div class="periodo-totais">
      <div class="total-chip horas"><span class="total-chip-label">Total</span><input type="text" class="turno-input-sm" id="th-${id}" value="${tot}" placeholder="—" style="width:70px;font-weight:600;" autocomplete="off" title="Total horas (editável)"></div>
      <div class="total-chip noturnas"><span class="total-chip-label">🌙 Noturnas</span><input type="text" class="turno-input-sm" id="thn-${id}" placeholder="—" style="width:64px;" autocomplete="off" readonly></div>
      <div class="total-chip feriado"><span class="total-chip-label">📅 Feriado</span><input type="text" class="turno-input-sm" id="thf-${id}" placeholder="—" style="width:64px;" autocomplete="off" readonly></div>
    </div>`
}

function removerPeriodo(id) {
  if(document.querySelectorAll('.periodo-block').length<=1){toast('Tem de existir pelo menos um período.');return;}
  document.getElementById('block-'+id).remove();
  delete PS[id];
  syncRemoveBtns();
}
function syncRemoveBtns() {
  const bl=document.querySelectorAll('.periodo-block');
  bl.forEach(b=>{const btn=b.querySelector('.btn-remove-periodo');if(btn)btn.style.display=bl.length>1?'':'none';});
}
function onMesAno(id) {
  const s=PS[id];
  s.mes=parseInt(document.getElementById('mes-'+id).value);
  s.ano=parseInt(document.getElementById('ano-'+id).value)||new Date().getFullYear();
  s.calViewMes=s.mes; s.calViewAno=s.ano;
  s.diasSel.clear(); s.rangeStart=null;
  updateTrigger(id);
  if(s.calOpen) renderCal(id);
}

// ── CALENDÁRIO ──
function toggleCal(id) {
  Object.keys(PS).forEach(k=>{if(k!==id&&PS[k].calOpen)closeCal(k);});
  const s=PS[id]; s.calOpen=!s.calOpen;
  document.getElementById('cp-'+id).classList.toggle('open',s.calOpen);
  document.getElementById('ct-'+id).classList.toggle('open',s.calOpen);
  if(s.calOpen) renderCal(id);
}
function closeCal(id) {
  if(!PS[id])return;
  PS[id].calOpen=false;
  document.getElementById('cp-'+id)?.classList.remove('open');
  document.getElementById('ct-'+id)?.classList.remove('open');
}
function calNav(id,dir) {
  const s=PS[id]; s.calViewMes+=dir;
  if(s.calViewMes<0){s.calViewMes=11;s.calViewAno--;}
  if(s.calViewMes>11){s.calViewMes=0;s.calViewAno++;}
  renderCal(id);
}
function renderCal(id) {
  const s=PS[id];
  document.getElementById('cm-'+id).textContent=MESES[s.calViewMes]+' '+s.calViewAno;
  const first=new Date(s.calViewAno,s.calViewMes,1).getDay();
  const dim=new Date(s.calViewAno,s.calViewMes+1,0).getDate();
  const td=new Date();
  let html=DIAS_SEMANA.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<first;i++) html+=`<div class="cal-day other-month empty"></div>`;
  for(let d=1;d<=dim;d++){
    const sel=s.diasSel.has(d);
    const today=d===td.getDate()&&s.calViewMes===td.getMonth()&&s.calViewAno===td.getFullYear();
    html+=`<div class="cal-day${sel?' sel':''}${today?' today':''}" onclick="dayClick('${id}',${d},event)">${d}</div>`;
  }
  document.getElementById('cg-'+id).innerHTML=html;
}
function dayClick(id,day,evt) {
  const s=PS[id];
  if(evt.shiftKey&&s.rangeStart!==null){
    const from=Math.min(s.rangeStart,day),to=Math.max(s.rangeStart,day);
    const dim=new Date(s.calViewAno,s.calViewMes+1,0).getDate();
    for(let d=from;d<=Math.min(to,dim);d++) s.diasSel.add(d);
    s.rangeStart=null;
  } else {
    if(s.diasSel.has(day)){s.diasSel.delete(day);s.rangeStart=null;}
    else{s.diasSel.add(day);s.rangeStart=day;}
  }
  // sync selects to calView
  document.getElementById('mes-'+id).value=s.calViewMes;
  document.getElementById('ano-'+id).value=s.calViewAno;
  s.mes=s.calViewMes; s.ano=s.calViewAno;
  updateTrigger(id); renderCal(id);
}
function calClear(id){PS[id].diasSel.clear();PS[id].rangeStart=null;updateTrigger(id);renderCal(id);}
function updateTrigger(id){
  const s=PS[id],btn=document.getElementById('ct-'+id);if(!btn)return;
  const dias=[...s.diasSel].sort((a,b)=>a-b);
  if(!dias.length){btn.textContent='Selecionar dias…';btn.classList.remove('has-days');}
  else{btn.textContent=dias.length===1?`Dia ${dias[0]}`:`${dias.length} dias: ${dias.slice(0,5).join(', ')}${dias.length>5?' …':''}`;btn.classList.add('has-days');}
}
document.addEventListener('click',e=>{
  Object.keys(PS).forEach(id=>{
    if(!PS[id].calOpen)return;
    const w=document.getElementById('cw-'+id);
    if(w&&!w.contains(e.target))closeCal(id);
  });
});

// ── TURNOS ──
let turnoCount=0;
function adicionarTurno(pid, d){
  const tid='t'+(++turnoCount);
  const wrap=document.getElementById('turnos-'+pid);
  if(!wrap)return;
  const row=document.createElement('div');
  row.className='turno-row'; row.id='tr-'+tid;
  const n=wrap.children.length+1;
  row.innerHTML=`
    <span class="turno-num">Turno ${n}</span>
    <div class="turno-fields">
      <label class="field-label" style="margin:0;white-space:nowrap">Entrada</label>
      <input type="time" class="turno-input" id="te-${tid}" value="${d?d.entrada:''}" oninput="calcTurno('${pid}','${tid}')">
      <span class="turno-sep">→</span>
      <label class="field-label" style="margin:0;white-space:nowrap">Saída</label>
      <input type="time" class="turno-input" id="ts-${tid}" value="${d?d.saida:''}" oninput="calcTurno('${pid}','${tid}')">
      <span class="turno-sep" style="color:var(--muted);font-size:10px">=</span>
      <input type="text" class="turno-input" id="tt-${tid}" value="${d?d.total:''}" placeholder="—" style="max-width:64px;color:var(--blue);" autocomplete="off" title="Total (editável)">
      <span class="turno-sep" style="width:1px;height:16px;background:var(--border);margin:0 4px;"></span>
      <div class="turno-extra"><span class="turno-extra-label">🌙 Noturnas</span><input type="text" class="turno-input-sm" id="tn-${tid}" value="${d?d.noturnas:''}" placeholder="—" oninput="calcTotaisPeriodo('${pid}')" autocomplete="off"></div>
      <div class="turno-extra"><span class="turno-extra-label">📅 Feriado</span><input type="text" class="turno-input-sm" id="tf-${tid}" value="${d?d.feriado:''}" placeholder="—" oninput="calcTotaisPeriodo('${pid}')" autocomplete="off"></div>
    </div>
    <button class="btn-rm-turno" onclick="removerTurno('${pid}','${tid}')" title="Remover">×</button>`;
  wrap.appendChild(row);
  renumTurnos(pid);
}
function removerTurno(pid,tid){
  document.getElementById('tr-'+tid)?.remove();
  renumTurnos(pid);
}
function renumTurnos(pid){
  const rows=document.querySelectorAll(`#turnos-${pid} .turno-row`);
  rows.forEach((r,i)=>{const n=r.querySelector('.turno-num');if(n)n.textContent=rows.length===1?'Turno':'Turno '+(i+1);});
}
function calcTotaisPeriodo(pid){
  const rows=[...document.querySelectorAll(`#turnos-${pid} .turno-row`)];
  let totMin=0,notMin=0,ferMin=0;
  rows.forEach(r=>{
    const tid=r.id.replace('tr-','');
    const parseFn=v=>{if(!v)return 0;const m=v.match(/(\d+)h(\d+)?/i);if(m)return parseInt(m[1])*60+(parseInt(m[2]||0));const n=parseFloat(v.replace(',','.'));return isNaN(n)?0:Math.round(n*60);};
    totMin+=parseFn(document.getElementById('tt-'+tid)?.value);
    notMin+=parseFn(document.getElementById('tn-'+tid)?.value);
    ferMin+=parseFn(document.getElementById('tf-'+tid)?.value);
  });
  const fmt=m=>{if(!m)return'';const h=Math.floor(m/60),mn=m%60;return mn?`${h}h${String(mn).padStart(2,'0')}`:`${h}h`;};
  const ht=document.getElementById('th-'+pid);
  const tnt=document.getElementById('thn-'+pid);
  const tft=document.getElementById('thf-'+pid);
  if(ht&&!ht.dataset.manual) ht.value=fmt(totMin);
  if(tnt) tnt.value=fmt(notMin);
  if(tft) tft.value=fmt(ferMin);
}

function calcTurno(pid,tid){
  const e=document.getElementById('te-'+tid)?.value;
  const s=document.getElementById('ts-'+tid)?.value;
  if(!e||!s)return;
  const[eh,em]=e.split(':').map(Number),[sh,sm]=s.split(':').map(Number);
  let mins=(sh*60+sm)-(eh*60+em); if(mins<=0)return;
  const h=Math.floor(mins/60),m=mins%60;
  const tot=document.getElementById('tt-'+tid);
  if(tot) tot.value=m?`${h}h${String(m).padStart(2,'0')}`:`${h}h`;
  calcTotaisPeriodo(pid);
}
function getTurnos(pid){
  return [...document.querySelectorAll(`#turnos-${pid} .turno-row`)].map(r=>{
    const tid=r.id.replace('tr-','');
    return{entrada:document.getElementById('te-'+tid)?.value||'',
           saida:document.getElementById('ts-'+tid)?.value||'',
           total:document.getElementById('tt-'+tid)?.value||'',
           noturnas:document.getElementById('tn-'+tid)?.value||'',
           feriado:document.getElementById('tf-'+tid)?.value||''};
  }).filter(t=>t.entrada||t.saida);
}

function getPeriodos(){
  return [...document.querySelectorAll('.periodo-block')].map(bl=>{
    const id=bl.id.replace('block-',''),s=PS[id];if(!s)return null;
    return{dias:[...s.diasSel].sort((a,b)=>a-b),mes:s.mes,mesNome:MESES[s.mes],ano:s.ano,
      turnos:getTurnos(id),
      totalHoras:document.getElementById('th-'+id).value,
      totalNoturnas:document.getElementById('thn-'+id)?.value||'',
      totalFeriado:document.getElementById('thf-'+id)?.value||''};
  }).filter(Boolean);
}

// ── FILE ATTACHMENTS ──
let pendingFiles = [];

function onPendingFilesChange(input) {
  Array.from(input.files).forEach(f => {
    if (f.size > 15 * 1024 * 1024) { toast('Ficheiro demasiado grande (máx 15 MB): ' + f.name); return; }
    pendingFiles.push(f);
  });
  input.value = '';
  renderPendingFilesList();
}
function renderPendingFilesList() {
  const el = document.getElementById('pendingFilesList');
  if (!el) return;
  if (!pendingFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-item">
      <span>📄</span>
      <span class="file-item-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
      <span class="file-item-size">${fmtBytes(f.size)}</span>
      <button class="file-item-del" onclick="removePendingFile(${i})" title="Remover">✕</button>
    </div>`).join('');
}
function removePendingFile(i) { pendingFiles.splice(i, 1); renderPendingFilesList(); }
function renderFicheiros(docId, ficheiros, canDel) {
  window._files[docId] = ficheiros;
  if (!ficheiros || !ficheiros.length) return '<div class="files-empty">Sem anexos</div>';
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
    await window.ReclamacoesService.removeFile(docId, f);
    toast('Ficheiro removido.');
  } catch(e) { toast('Erro ao remover.'); }
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ── AUTH ──
document.addEventListener('authReady',({detail})=>{
  window.renderNavbar('reclamacoes');
  const profile=detail.profile,isAdmin=window.isAdmin(),canCreate=window.temPermissao('modules.reclamacoes.manage');
  if(profile) document.getElementById('userName').textContent=profile.nomeCompleto||profile.nome||profile.email||'?';
  if(canCreate){
    // Mostrar o painel colapsado por defeito (utilizador expande quando quiser)
    document.getElementById('formPanel').style.display='';
    adicionarPeriodo();
  }
  filtroEscritorio=isAdmin?'':(profile?(profile.escritorio||''):'');
  window.loadEscritorios().then(lista=>{
    const fEsc=document.getElementById('fEscritorio');
    fEsc.innerHTML='<option value="">— Selecionar —</option>'+lista.map(e=>`<option value="${e.id}">${e.nome}</option>`).join('');
    if(profile&&profile.escritorio)fEsc.value=profile.escritorio;
    const feEl=document.getElementById('filterEscritorio');
    feEl.innerHTML='<option value="">Todos os escritórios</option>'+lista.map(e=>`<option value="${e.id}">${e.nome}</option>`).join('');
    if(filtroEscritorio)feEl.value=filtroEscritorio;
  });
  document.getElementById('pageSubtitle').textContent=isAdmin?'Todos os escritórios':
    (profile&&profile.escritorio?(window.nomeEscritorio?window.nomeEscritorio(profile.escritorio):profile.escritorio):'');
  setStatus('A ligar…','#f59e0b');
  // Carrega tudo e filtra no cliente (igual às tarefas) — evita necessidade de índices compostos
  const _recUnsub = col.orderBy('criadoEm','desc').limit(200).onSnapshot(snap=>{
    recs=snap.docs.map(d=>({id:d.id,...d.data()}));
    render(); setStatus('✓ Sincronizado','#16a34a'); setTimeout(()=>setStatus(''),3000);
  }, err=>{
    console.error('reclamacoes (orderBy):', err);
    // Fallback sem ordenação se o índice simples também falhar
    col.limit(200).onSnapshot(snap=>{
      recs=snap.docs.map(d=>({id:d.id,...d.data()}));
      render(); setStatus('✓ Sincronizado','#16a34a'); setTimeout(()=>setStatus(''),3000);
    }, err2=>{ console.error('reclamacoes fallback:', err2); setStatus('Erro de ligação','#dc2626'); });
  });
  window._reclamacoesUnsub = _recUnsub;
  window.addEventListener('beforeunload', () => { if (window._reclamacoesUnsub) window._reclamacoesUnsub(); }, { once: true });
});

// ── SUBMIT ──
async function submitReclamacao(){
  const btn=document.getElementById('btnRegistarReclamacao');
  if(btn) btn.disabled=true;
  try{
    const nif=document.getElementById('fNif').value.trim();
    const nome=document.getElementById('fNome').value.trim();
    const empresa=document.getElementById('fEmpresa').value.trim();
    if(!nif){toast('NIF obrigatório');return;}
    if(!nome){toast('Nome obrigatório');return;}
    if(!empresa){toast('Empresa utilizadora obrigatória');return;}
    const periodos=getPeriodos();
    if(!periodos.length||periodos.every(p=>p.dias.length===0)){toast('Seleciona pelo menos um dia');return;}
    const profile=window.userProfile;
    const criadoPor=profile?(profile.nomeCompleto||profile.nome||profile.email):'—';
    const resumoPeriodo=periodos.map(p=>`${p.dias.length} dia(s) — ${p.mesNome} ${p.ano}`).join(' | ');
    const dadosRec = {
      numFunc:document.getElementById('fNumFunc').value.trim(),
      nif,nome,empresa,
      categoria:document.getElementById('fCategoria').value.trim(),
      escritorio:document.getElementById('fEscritorio').value,
      canal:selCanalVal,
      notas:document.getElementById('fNotas').value.trim(),
      periodos,resumoPeriodo,
      estado:'nova',criadoPor,
      criadoPorUid:window.currentUser?window.currentUser.uid:'',
      criadoEm:Date.now(),
      historico:[{estado:'nova',nota:'Reclamação registada',por:criadoPor,em:Date.now()}]
    };
    const docRef = await col.add(dadosRec);
    await registarAuditoria({
      modulo: 'reclamacoes', acao: 'criado',
      docId: docRef.id,
      titulo: nome + ' — ' + empresa,
      depois: dadosRec,
    });
    if (pendingFiles.length) {
      const statusEl = document.getElementById('formUploadStatus');
      if (statusEl) statusEl.textContent = 'A carregar anexos…';
      const ficheiros = [];
      for (const file of pendingFiles) {
        const path = `reclamacoes/${docRef.id}/${Date.now()}_${file.name}`;
        try {
          const uploaded = await window.ReclamacoesService.uploadFiles(docRef.id, [file]);
          if (uploaded.length) ficheiros.push(uploaded[0]);
        } catch(e) { console.error(e); toast('Erro ao carregar: ' + file.name); }
      }
      if (ficheiros.length) await docRef.update({ ficheiros });
      if (statusEl) statusEl.textContent = '';
    }
    pendingFiles = [];
    renderPendingFilesList();
    limparForm();
    // Fechar o painel após submeter com sucesso
    const fp = document.getElementById('formPanel');
    if (fp) fp.classList.remove('open');
    toast('✓ Reclamação registada com sucesso!');
  }catch(e){console.error(e);toast('Erro ao registar.');}
  finally{if(btn) btn.disabled=false;}
}

// ── UPDATE ESTADO ──
async function updateEstado(id,novoEstado,nota){
  const profile=window.userProfile;
  const por=profile?(profile.nomeCompleto||profile.nome||profile.email):'—';
  try{
    const snap=await col.doc(id).get();
    const dados=snap.data();
    const hist=dados.historico||[];
    const estadoAntigo=dados.estado;
    await col.doc(id).update({estado:novoEstado,historico:[...hist,{estado:novoEstado,nota:nota||'',por,em:Date.now()}]});
    await registarAuditoria({
      modulo: 'reclamacoes', acao: 'estado',
      docId: id,
      titulo: dados.nome + ' — ' + dados.empresa,
      antes:  { estado: estadoAntigo },
      depois: { estado: novoEstado },
      nota: nota || '',
    });
    toast('✓ Estado atualizado');
  }catch(e){toast('Erro ao atualizar.');}
}
async function deleteRec(id){
  if (!await confirmar({ titulo: 'Eliminar esta reclamação?', btnOk: 'Confirmar', perigo: true })) return;
  expandedIds.delete(id);
  try{
    const snap=await col.doc(id).get();
    const antes=snap.data();
    await col.doc(id).delete();
    await registarAuditoria({
      modulo: 'reclamacoes', acao: 'eliminado',
      docId: id,
      titulo: antes.nome + ' — ' + antes.empresa,
      antes,
    });
    toast('Eliminada.');
  }catch(e){toast('Erro.');}
}

// ── HELPERS ──
function selCanal(c){selCanalVal=c;document.querySelectorAll('.canal-pill').forEach(b=>b.classList.toggle('sel',b.dataset.c===c));}
function setFiltro(f){filtroEstado=f;document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===f));render();}
function limparForm(){
  ['fNumFunc','fNif','fNome','fCategoria','fEmpresa','fNotas'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  selCanal('email');
  pendingFiles=[]; renderPendingFilesList();
  document.getElementById('periodosWrap').innerHTML='';
  Object.keys(PS).forEach(k=>delete PS[k]); periodoCount=0;
  adicionarPeriodo();
}
function estadoClass(e){return(e||'nova').replace(/-/g,'');}
function estadoPillClass(e){const c=estadoClass(e);return c==='aguardaproc'?'aguarda-proc':c==='semfundamento'?'sem-fundamento':c;}

// ── RENDER ──
function render(){
  const q=(document.getElementById('searchInput').value||'').toLowerCase().trim();
  const feEsc=document.getElementById('filterEscritorio').value;
  const feEmp=document.getElementById('filterEmpresa').value;
  const isAdmin=window.isAdmin();
  const empresas=[...new Set(recs.map(r=>r.empresa).filter(Boolean))].sort();
  const feEmpEl=document.getElementById('filterEmpresa');
  const curEmp=feEmpEl.value;
  feEmpEl.innerHTML='<option value="">Todas as empresas</option>'+empresas.map(e=>`<option value="${e}" ${e===curEmp?'selected':''}>${e}</option>`).join('');
  let lista=recs.filter(r=>{
    if(feEsc&&r.escritorio!==feEsc)return false;
    if(feEmp&&r.empresa!==feEmp)return false;
    if(filtroEstado==='ativos'&&!ESTADOS_ATIVOS.includes(r.estado))return false;
    if(filtroEstado!=='ativos'&&filtroEstado!=='todos'&&r.estado!==filtroEstado)return false;
    if(q&&!`${r.nome} ${r.nif} ${r.numFunc} ${r.empresa}`.toLowerCase().includes(q))return false;
    return true;
  });
  renderStats(recs,feEsc);
  document.getElementById('countBadge').textContent=`${lista.length} registo${lista.length!==1?'s':''}`;
  const container=document.getElementById('cardsList');
  if(!lista.length){container.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg><p>Nenhuma reclamação encontrada.</p></div>`;return;}
  container.innerHTML=lista.map((r,i)=>{
    const exp=expandedIds.has(r.id);
    const eKey=r.estado||'nova';
    const eLabel=ESTADO_LABEL[eKey]||eKey;
    const ePill=estadoPillClass(eKey);
    const eCard=estadoClass(eKey);
    const hist=r.historico||[];
    const periodos=r.periodos||[];
    const podeGerir=isAdmin||window.temPermissao('modules.reclamacoes.manage');
    const periodosHTML=periodos.length?`
      <table class="periodos-table">
        <thead><tr><th>Mês/Ano</th><th>Dias</th><th>Turnos</th><th>Total</th><th>🌙 Noc.</th><th>📅 Fer.</th></tr></thead>
        <tbody>${periodos.map(p=>{
          const turnos=(p.turnos||[]);
          const turnosHTML=turnos.length
            ?turnos.map((t,i)=>`<span style="white-space:nowrap;margin-right:8px">${turnos.length>1?'T'+(i+1)+': ':''}${t.entrada||'—'} → ${t.saida||'—'}${t.total?' ('+t.total+')':''}</span>`).join('')
            :'—';
          return`<tr>
            <td>${p.mesNome||MESES[p.mes]||''} ${p.ano}</td>
            <td><div class="dias-chips">${(p.dias||[]).map(d=>`<span class="dia-chip">${d}</span>`).join('')}</div></td>
            <td style="font-size:10px">${turnosHTML}</td>
            <td>${p.totalHoras||'—'}</td>
            <td>${p.totalNoturnas||'—'}</td>
            <td>${p.totalFeriado||'—'}</td>
          </tr>`;}).join('')}</tbody>
      </table>`:'' ;
    return `<div class="rec-card estado-${eCard}" id="card-${r.id}">
      <div class="card-header" onclick="toggleCard('${r.id}')">
        <span class="card-num">#${String(i+1).padStart(2,'0')}</span>
        <div class="card-info">
          <div class="card-nome">${r.nome||'—'}${r.codigoPortal?` <span style="font-size:9px;background:var(--blue-bg);border:1px solid var(--blue-border);color:var(--blue);border-radius:4px;padding:1px 6px;font-weight:500;letter-spacing:.03em;vertical-align:middle;">🔗 Portal</span>`:''}</div>
          <div class="card-sub">${r.empresa||'—'} · ${r.resumoPeriodo||'—'}</div>
        </div>
        <span class="card-date">${fmtData(r.criadoEm)}</span>
        <span class="estado-pill ${ePill}">${eLabel}</span>
        <svg class="chevron ${exp?'open':''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6l4 4 4-4"/></svg>
      </div>
      <div class="card-body ${exp?'open':''}" id="body-${r.id}">
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-item-label">Nº Func.</div><div class="detail-item-val">${r.numFunc||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">NIF</div><div class="detail-item-val">${r.nif||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Categoria</div><div class="detail-item-val">${r.categoria||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Empresa</div><div class="detail-item-val">${r.empresa||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Canal</div><div class="detail-item-val">${CANAL_LABEL[r.canal]||r.canal||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Escritório</div><div class="detail-item-val">${window.nomeEscritorio?window.nomeEscritorio(r.escritorio):(r.escritorio||'—')}</div></div>
          ${r.codigoPortal?`<div class="detail-item"><div class="detail-item-label">Código Portal</div><div class="detail-item-val" style="display:flex;align-items:center;gap:6px;">${escHtml(r.codigoPortal)}<button onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtml(r.codigoPortal)}').then(()=>toast('Código copiado!'))" style="background:none;border:1px solid var(--border);border-radius:4px;font-size:9px;cursor:pointer;padding:2px 7px;color:var(--muted);font-family:'DM Mono',monospace;transition:all .15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">📋</button></div></div>`:''}
          ${periodos.length?`<div class="detail-item span-full"><div class="detail-item-label">Períodos reclamados</div>${periodosHTML}</div>`:''}
        </div>
        ${r.notas?`<div class="card-notas"><div class="card-notas-label">Notas</div>${r.notas}</div>`:''}
        ${(r.ficheiros&&r.ficheiros.length)?`<div class="card-files">
          <div class="files-header"><span class="files-lbl">📎 Anexos (${r.ficheiros.length})</span></div>
          ${renderFicheiros(r.id,r.ficheiros,podeGerir)}
        </div>`:''}
        <div class="card-footer-row">
          <span class="detail-meta"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>${r.criadoPor||'—'}</span>
          <span class="detail-meta"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="14" height="11" rx="1.5"/><path d="M1 7h14M5 1v4M11 1v4"/></svg>${fmtData(r.criadoEm)}</span>
        </div>
        ${hist.length?`<div class="card-historico"><div class="historico-label">Histórico</div><div class="historico-list">
          ${hist.map(h=>{const hc=estadoPillClass(h.estado||'nova');return`<div class="historico-item">
            <div class="historico-dot ${hc}"></div>
            <div class="historico-content">
              <div class="historico-estado">${ESTADO_LABEL[h.estado]||h.estado}</div>
              ${h.nota?`<div class="historico-nota">${h.nota}</div>`:''}
              <div class="historico-meta">${h.por||''} · ${fmtDataHora(h.em)}</div>
            </div></div>`;}).join('')}
        </div></div>`:''}
        ${podeGerir?`<div class="card-gestor"><div class="card-gestor-row">
          <select class="estado-select" id="sel-${r.id}">
            <option value="nova" ${r.estado==='nova'?'selected':''}>Nova</option>
            <option value="verificacao" ${r.estado==='verificacao'?'selected':''}>Em Verificação</option>
            <option value="enviada" ${r.estado==='enviada'?'selected':''}>Enviada à Empresa</option>
            <option value="confirmada" ${r.estado==='confirmada'?'selected':''}>Confirmada</option>
            <option value="aguarda-proc" ${r.estado==='aguarda-proc'?'selected':''}>Aguarda Processamento</option>
            <option value="paga" ${r.estado==='paga'?'selected':''}>Paga</option>
            <option value="sem-fundamento" ${r.estado==='sem-fundamento'?'selected':''}>Sem Fundamento</option>
            <option value="negada" ${r.estado==='negada'?'selected':''}>Negada pela Empresa</option>
          </select>
          <textarea class="notas-input" id="nota-${r.id}" rows="1" placeholder="Nota sobre esta alteração…"></textarea>
          <button class="btn btn-sm btn-primary" onclick="saveEstado('${r.id}')">Guardar</button>
          ${isAdmin?`<button class="icon-btn del" title="Eliminar" onclick="deleteRec('${r.id}')">🗑</button>`:''}
        </div></div>`:''}
      </div></div>`;
  }).join('');
}

function toggleCard(id){if(expandedIds.has(id))expandedIds.delete(id);else expandedIds.add(id);render();}
function saveEstado(id){updateEstado(id,document.getElementById('sel-'+id).value,document.getElementById('nota-'+id).value.trim());}
// ── EXPORTAÇÃO ──
function getListaFiltrada() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const feEsc = document.getElementById('filterEscritorio').value;
  const feEmp = document.getElementById('filterEmpresa').value;
  return recs.filter(r => {
    const ef = feEsc || filtroEscritorio;
    if (ef && r.escritorio !== ef) return false;
    if (feEmp && r.empresa !== feEmp) return false;
    if (filtroEstado === 'ativos' && !ESTADOS_ATIVOS.includes(r.estado)) return false;
    if (filtroEstado !== 'ativos' && filtroEstado !== 'todos' && r.estado !== filtroEstado) return false;
    if (q && !`${r.nome} ${r.nif} ${r.numFunc} ${r.empresa}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function recToRow(r) {
  const periodos = (r.periodos || []).map(p =>
    `${p.mesNome} ${p.ano}: dias ${(p.dias || []).join(',')} | ${p.totalHoras || ''}${p.totalNoturnas ? ' noc:' + p.totalNoturnas : ''}${p.totalFeriado ? ' fer:' + p.totalFeriado : ''}`
  ).join('\n');
  const turnos = (r.periodos || []).flatMap(p =>
    (p.turnos || []).map(t => `${t.entrada || ''}→${t.saida || ''}${t.total ? ' (' + t.total + ')' : ''}`)
  ).join(' | ');
  return {
    'Estado': ESTADO_LABEL[r.estado] || r.estado || '—',
    'Nome': r.nome || '—',
    'NIF': r.nif || '—',
    'Nº Func.': r.numFunc || '—',
    'Categoria': r.categoria || '—',
    'Empresa': r.empresa || '—',
    'Escritório': window.nomeEscritorio ? window.nomeEscritorio(r.escritorio) : (r.escritorio || '—'),
    'Canal': CANAL_LABEL[r.canal]?.replace(/[^\w ]/g, '').trim() || r.canal || '—',
    'Períodos': periodos,
    'Turnos': turnos,
    'Resumo': r.resumoPeriodo || '—',
    'Registado por': r.criadoPor || '—',
    'Data registo': fmtData(r.criadoEm),
    'Notas': r.notas || '',
  };
}

function exportarExcel() {
  const lista = getListaFiltrada();
  if (!lista.length) { toast('Nenhum registo para exportar.'); return; }
  const rows = lista.map(recToRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  // Larguras de coluna automáticas
  const cols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }));
  ws['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reclamações');
  const data = new Date();
  const fname = `reclamacoes_${data.toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('✓ Excel exportado: ' + fname);
}

function exportarPDF() {
  const lista = getListaFiltrada();
  if (!lista.length) { toast('Nenhum registo para exportar.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const data = new Date();
  const dataStr = data.toLocaleDateString('pt-PT');
  const escritorioLabel = (() => {
    const f = document.getElementById('filterEscritorio').value || filtroEscritorio;
    if (!f) return 'Todos os escritórios';
    return window.nomeEscritorio ? window.nomeEscritorio(f) : f;
  })();

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Reclamações de Horas em Falta', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 160);
  doc.text(`Exportado em ${dataStr} · ${escritorioLabel} · ${lista.length} registo(s)`, 14, 22);
  doc.setTextColor(0, 0, 0);

  // Tabela principal — colunas resumidas para caber em A4 landscape
  const head = [['#','Estado','Nome','NIF','Empresa','Escritório','Períodos','Turnos','Registado por','Data']];
  const body = lista.map((r, i) => {
    const periodos = (r.periodos || []).map(p =>
      `${p.mesNome?.slice(0,3) || ''} ${p.ano}: ${(p.dias || []).join(',')} (${p.totalHoras || ''})`
    ).join('\n');
    const turnos = (r.periodos || []).flatMap(p =>
      (p.turnos || []).map(t => `${t.entrada || ''}→${t.saida || ''}`)
    ).join(' ');
    return [
      String(i + 1).padStart(2, '0'),
      ESTADO_LABEL[r.estado] || r.estado || '—',
      r.nome || '—',
      r.nif || '—',
      r.empresa || '—',
      window.nomeEscritorio ? window.nomeEscritorio(r.escritorio) : (r.escritorio || '—'),
      periodos || '—',
      turnos || '—',
      r.criadoPor || '—',
      fmtData(r.criadoEm),
    ];
  });

  const estadoCores = {
    'Nova': [240, 240, 244],
    'Em Verificação': [255, 251, 235],
    'Enviada à Empresa': [239, 246, 255],
    'Confirmada': [245, 243, 255],
    'Aguarda Processamento': [240, 253, 250],
    'Paga': [240, 253, 244],
    'Negada pela Empresa': [254, 242, 242],
    'Sem Fundamento': [244, 244, 246],
  };

  doc.autoTable({
    startY: 28,
    head,
    body,
    headStyles: { fillColor: [26, 26, 34], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 26 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20 },
      6: { cellWidth: 40 },
      7: { cellWidth: 28 },
      8: { cellWidth: 28 },
      9: { cellWidth: 20 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const cor = estadoCores[data.cell.text[0]];
        if (cor) data.cell.styles.fillColor = cor;
      }
    },
    margin: { left: 14, right: 14 },
    styles: { overflow: 'linebreak', cellPadding: 2 },
    alternateRowStyles: { fillColor: [247, 247, 249] },
  });

  // Notas separadas (se existirem)
  const comNotas = lista.filter(r => r.notas);
  if (comNotas.length) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Notas internas', 14, 16);
    let y = 24;
    comNotas.forEach(r => {
      if (y > 180) { doc.addPage(); y = 16; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(26, 26, 34);
      doc.text(`${r.nome || '—'} · ${r.empresa || '—'} · ${fmtData(r.criadoEm)}`, 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 130);
      const linhas = doc.splitTextToSize(r.notas, 250);
      doc.text(linhas, 14, y);
      y += linhas.length * 4.5 + 4;
    });
  }

  // Rodapé em todas as páginas
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 170);
    doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' });
    doc.text('Gerado automaticamente — uso interno', 14, doc.internal.pageSize.height - 8);
  }

  const fname = `reclamacoes_${data.toISOString().slice(0,10)}.pdf`;
  doc.save(fname);
  toast('✓ PDF exportado: ' + fname);
}

function renderStats(lista,escFiltro){
  const f=escFiltro?lista.filter(r=>r.escritorio===escFiltro):lista;
  document.getElementById('statsBar').innerHTML=`
    <div class="stat-chip s-total"><span class="stat-val">${f.length}</span><span class="stat-lbl">Total</span></div>
    <div class="stat-chip s-aberto"><span class="stat-val">${f.filter(r=>ESTADOS_ATIVOS.includes(r.estado)).length}</span><span class="stat-lbl">Em aberto</span></div>
    <div class="stat-chip s-enviado"><span class="stat-val">${f.filter(r=>r.estado==='enviada').length}</span><span class="stat-lbl">Enviadas</span></div>
    <div class="stat-chip s-confirmado"><span class="stat-val">${f.filter(r=>r.estado==='confirmada'||r.estado==='aguarda-proc').length}</span><span class="stat-lbl">Confirmadas</span></div>
    <div class="stat-chip s-pago"><span class="stat-val">${f.filter(r=>r.estado==='paga').length}</span><span class="stat-lbl">Pagas</span></div>
    <div class="stat-chip s-negado"><span class="stat-val">${f.filter(r=>r.estado==='negada').length}</span><span class="stat-lbl">Negadas</span></div>`;
}
