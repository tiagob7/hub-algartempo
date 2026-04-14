/* ══════════════════════════════════════════════════════
   UTILS LOCAIS
   ══════════════════════════════════════════════════════ */
function uid(){return Math.random().toString(36).slice(2,9);}
function deepClone(o){return JSON.parse(JSON.stringify(o));}
function esc(s){return(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

/* ══════════════════════════════════════════════════════
   FIRESTORE
   Coleção: escalas/{escritorioId}/dias/{YYYY-MM-DD}
   Documento: { columns: [...], empresas: {...}, updatedAt: ts, updatedBy: uid }
   ══════════════════════════════════════════════════════ */
const db = firebase.firestore();

let currentEscritorio = '';

function getEscalasRef() {
  return db.collection('escalas').doc(currentEscritorio || 'default').collection('dias');
}

// Cache local — evita re-renders desnecessários e serve de fallback offline
// Chave inclui escritório: "{escritorioId}_{YYYY-MM-DD}"
const DIAS_DATA = {};
function cacheKey(key) { return (currentEscritorio || 'default') + '_' + key; }

// Indicador de gravação em curso para debounce
let _saveTimer = null;
let _saving = false;

async function loadDay(key) {
  const ck = cacheKey(key);
  if (DIAS_DATA[ck]) return DIAS_DATA[ck];           // já em cache
  setStatus('A carregar…', 'var(--muted)');
  try {
    const snap = await getEscalasRef().doc(key).get();
    if (snap.exists) {
      const data = snap.data();
      // Reconstituir columns a partir de columnsObj (compatibilidade)
      if (data.columnsObj && !data.columns) {
        const n = data.numColumns || Object.keys(data.columnsObj).length;
        data.columns = [];
        for (let i = 0; i < n; i++) data.columns.push(data.columnsObj[String(i)] || []);
        delete data.columnsObj;
        delete data.numColumns;
      }
      DIAS_DATA[ck] = data;
    } else {
      DIAS_DATA[ck] = { columns: [], empresas: {} };
    }
  } catch(e) {
    console.warn('[escalas] loadDay error', e);
    DIAS_DATA[ck] = { columns: [], empresas: {} };
  }
  setStatus('', '');
  return DIAS_DATA[ck];
}

// Guardar imediatamente (chamado pelo botão Guardar)
async function saveDay(key) {
  const day = DIAS_DATA[cacheKey(key)];
  if (!day) return;
  const btnSave = document.getElementById('btnSave');
  btnSave.classList.add('saving');
  setStatus('A guardar…', 'var(--amber)');
  // Firestore nao suporta arrays aninhados.
  // Serializar columns como objecto: { "0": [id,id], "1": [id] }
  const columnsObj = {};
  (day.columns || []).forEach((col, i) => { columnsObj[String(i)] = col; });

  try {
    await getEscalasRef().doc(key).set({
      empresas: day.empresas || {},
      columnsObj,
      numColumns: (day.columns || []).length,
      updatedAt: Date.now(),
      updatedBy: window.currentUser ? window.currentUser.uid : '',
    });
    setStatus('Guardado ✓', 'var(--green)');
    showToast('Escala guardada ✓');
    setTimeout(() => setStatus('', ''), 2500);
  } catch(e) {
    console.error('[escalas] saveDay error', e);
    setStatus('Erro ao guardar', 'var(--red)');
    showToast('Erro ao guardar — verifica a ligação');
  } finally {
    btnSave.classList.remove('saving');
  }
}

// Auto-save com debounce de 3 s (chamado a cada mutação)
function scheduleSave(key) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveDay(key), 3000);
  setStatus('Alterações por guardar…', 'var(--amber)');
}

// Marcar dia como "sujo" após qualquer mutação
function markDirty() {
  scheduleSave(dateKey(currentDate));
}

/* ══════════════════════════════════════════════════════
   CORES
   ══════════════════════════════════════════════════════ */
const PALETA=[
  {bg:'#f0fdf4',border:'#bbf7d0',text:'#166534'},
  {bg:'#eff6ff',border:'#bfdbfe',text:'#1e40af'},
  {bg:'#fefce8',border:'#fde68a',text:'#854d0e'},
  {bg:'#f5f3ff',border:'#ddd6fe',text:'#5b21b6'},
  {bg:'#fff7ed',border:'#fed7aa',text:'#9a3412'},
  {bg:'#fdf4ff',border:'#e9d5ff',text:'#6b21a8'},
  {bg:'#f0fdfa',border:'#99f6e4',text:'#0f766e'},
  {bg:'#fef2f2',border:'#fecaca',text:'#991b1b'},
  {bg:'#f8fafc',border:'#cbd5e1',text:'#334155'},
];
const CORES_FIXAS={
  'Hotel Algarve':PALETA[0],'Hotel Oriental':PALETA[1],'Nau Morgado':PALETA[2],
  'Golf Palmares':PALETA[0],'Belmar':PALETA[3],'Cascade':PALETA[5],
  'Hotel Wyndham':PALETA[4],'Mar Historias':PALETA[4],'Vale das Oliveiras':PALETA[2],
  'Nau Salema':PALETA[6],'Domes Lake':PALETA[0],'Hilton':PALETA[1],
  'Tivoli':PALETA[2],'A Paisagem':PALETA[6],'Vila Galé Ampalius':PALETA[3],
  'Quarteira':PALETA[8],
};
let _pi=0;
function cor(n){return CORES_FIXAS[n]||(CORES_FIXAS[n]=PALETA[_pi++%PALETA.length]);}

/* ══════════════════════════════════════════════════════
   MODELO DE DADOS
   ══════════════════════════════════════════════════════ */
const DIAS  =['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES =['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let currentDate = new Date();   // hoje por defeito
function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function formatDate(d){return DIAS[d.getDay()]+', '+d.getDate()+' de '+MESES[d.getMonth()]+' '+d.getFullYear();}

function getDayData(){
  const k=cacheKey(dateKey(currentDate));
  if(!DIAS_DATA[k]) DIAS_DATA[k]={columns:[],empresas:{}};
  return DIAS_DATA[k];
}

/* ── makeEmp helper ── */
function makeEmp(nome,secoes){
  const id=uid();
  return {id,empresa:nome,secoes:secoes.map(s=>({
    id:uid(),nome:s.nome,
    workers:s.workers.map(w=>({id:uid(),nome:w.nome,horario:w.horario||null,ok:w.ok!==false}))
  }))};
}

/* ══════════════════════════════════════════════════════
   ESTADO UI
   ══════════════════════════════════════════════════════ */
let selectedId=null;
let clipboard=null;
let colSortables=[];
let layoutMode='masonry'; // 'masonry' | 'grid'

function toggleLayout(){
  layoutMode = layoutMode==='masonry' ? 'grid' : 'masonry';
  const btn=document.getElementById('btnToggleLayout');
  const wrap=document.getElementById('masonryWrap');
  const outer=wrap.parentElement;
  if(layoutMode==='grid'){
    btn.classList.add('active');
    btn.innerHTML=`<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> Grid auto`;
    outer.classList.add('mode-grid-active');
  } else {
    btn.classList.remove('active');
    btn.innerHTML=`<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> Colunas livres`;
    outer.classList.remove('mode-grid-active');
  }
  render();
}

/* ══════════════════════════════════════════════════════
   RENDER PRINCIPAL  (agora async: carrega do Firestore)
   ══════════════════════════════════════════════════════ */
async function render(){
  document.getElementById('dateDisplay').textContent=formatDate(currentDate);

  // Carregar do Firestore se ainda não estiver em cache
  const key = dateKey(currentDate);
  await loadDay(key);

  const day=getDayData();
  updateChips(day);

  const wrap=document.getElementById('masonryWrap');
  wrap.innerHTML='';
  colSortables.forEach(s=>s.destroy());
  colSortables=[];

  /* ── MODO GRID AUTO ── */
  if(layoutMode==='grid'){
    wrap.classList.add('mode-grid');
    wrap.style.flex='';

    const allIds=day.columns.flat();
    if(!allIds.length){
      wrap.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--muted);font-size:12px;">Sem escala para este dia.</div>';
      return;
    }

    allIds.forEach(id=>{
      const emp=day.empresas[id];
      if(emp) wrap.appendChild(buildCard(emp,day));
    });

    const s=Sortable.create(wrap,{
      group:'cards',animation:150,
      ghostClass:'sortable-ghost',chosenClass:'sortable-chosen',
      handle:'.empresa-header',
      onEnd(){
        const newOrder=[...wrap.querySelectorAll('.empresa-card')].map(c=>c.dataset.id);
        day.columns=[newOrder];
        markDirty();
      }
    });
    colSortables.push(s);
    return;
  }

  /* ── MODO MASONRY ── */
  wrap.classList.remove('mode-grid');
  wrap.style.flex='1';

  while(day.columns.length<4) day.columns.push([]);

  day.columns.forEach((colIds,ci)=>{
    const col=document.createElement('div');
    col.className='masonry-col';
    col.dataset.ci=ci;
    if(!colIds.length) col.classList.add('col-empty');

    colIds.forEach(id=>{
      const emp=day.empresas[id];
      if(emp) col.appendChild(buildCard(emp,day));
    });

    wrap.appendChild(col);
  });

  wrap.querySelectorAll('.masonry-col').forEach(col=>{
    const s=Sortable.create(col,{
      group:'cards',
      animation:150,
      ghostClass:'sortable-ghost',
      chosenClass:'sortable-chosen',
      handle:'.empresa-header',
      onStart(){
        wrap.querySelectorAll('.masonry-col').forEach(c=>c.classList.remove('col-empty'));
      },
      onEnd(){
        wrap.querySelectorAll('.masonry-col').forEach(colEl=>{
          const ci=parseInt(colEl.dataset.ci);
          day.columns[ci]=[...colEl.querySelectorAll(':scope > .empresa-card')]
            .map(c=>c.dataset.id);
          colEl.classList.toggle('col-empty', day.columns[ci].length===0);
        });
        markDirty();
      }
    });
    colSortables.push(s);
  });
}

/* ══════════════════════════════════════════════════════
   BUILD CARD
   ══════════════════════════════════════════════════════ */
function buildCard(emp,day){
  const c=cor(emp.empresa);
  const {eTotal,eOk}=countEmp(emp);

  const card=document.createElement('div');
  card.className='empresa-card';
  card.dataset.id=emp.id;
  if(selectedId===emp.id) card.classList.add('selected');
  card.style.borderColor=c.border;

  const hdr=document.createElement('div');
  hdr.className='empresa-header';
  hdr.style.background=c.bg;
  hdr.title='Arrastar para mover';

  const badgeHtml=eTotal>0
    ?`<span class="emp-badge ${eOk===eTotal?'ok':'pend'}" id="badge-${emp.id}">${eOk}/${eTotal}</span>`
    :`<span class="emp-badge" id="badge-${emp.id}" style="display:none"></span>`;

  hdr.innerHTML=`
    <input class="empresa-nome-input" value="${esc(emp.empresa)}" style="color:${c.text};" title="Editar nome">
    ${badgeHtml}
    <button class="hdr-btn" data-act="add-sec" title="Adicionar secção">＋</button>
    <button class="hdr-btn clone" data-act="clone-card" title="Clonar empresa para outra data">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="10" height="10" rx="1.5"/><path d="M4 4V3a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1h-1"/></svg>
    </button>
    <button class="hdr-btn del" data-act="del" title="Remover empresa">✕</button>
    <span class="chevron" id="chev-${emp.id}" style="color:${c.text};">▾</span>`;

  const ni=hdr.querySelector('.empresa-nome-input');
  ni.addEventListener('mousedown',e=>e.stopPropagation());
  ni.addEventListener('change',e=>{emp.empresa=e.target.value; markDirty();});

  hdr.querySelector('[data-act="add-sec"]').addEventListener('click',e=>{
    e.stopPropagation(); addSecao(emp,body,day);
  });
  hdr.querySelector('[data-act="clone-card"]').addEventListener('click',e=>{
    e.stopPropagation(); openCloneModal('card', emp.id);
  });
  hdr.querySelector('[data-act="del"]').addEventListener('click',e=>{
    e.stopPropagation(); delEmpresa(emp.id,day);
  });

  const body=document.createElement('div');
  body.className='empresa-body';
  body.id='body-'+emp.id;

  emp.secoes.forEach(sec=>body.appendChild(buildSecao(emp,sec,day)));

  const btnS=document.createElement('button');
  btnS.className='btn-add-secao';
  btnS.textContent='＋ secção';
  btnS.addEventListener('click',()=>addSecao(emp,body,day));
  body.appendChild(btnS);

  let aberto=true;
  hdr.addEventListener('click',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON') return;
    aberto=!aberto;
    body.style.display=aberto?'':'none';
    document.getElementById('chev-'+emp.id)?.classList.toggle('fechado',!aberto);
  });

  card.addEventListener('click',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON') return;
    selectCard(emp.id,card);
  });

  card.addEventListener('contextmenu',e=>{
    e.preventDefault();
    selectCard(emp.id,card);
    showCtx(e.clientX,e.clientY,emp,day);
  });

  card.appendChild(hdr);
  card.appendChild(body);
  return card;
}

/* ══════════════════════════════════════════════════════
   BUILD SECÇÃO
   ══════════════════════════════════════════════════════ */
function buildSecao(emp,sec,day){
  const wrap=document.createElement('div');
  wrap.dataset.secId=sec.id;
  wrap.dataset.empId=emp.id;

  const sh=document.createElement('div');
  sh.className='secao-header';
  sh.innerHTML=`<input class="secao-nome-input" value="${esc(sec.nome||'')}" placeholder="Secção…">
    <button class="secao-del">✕</button>`;
  sh.querySelector('.secao-nome-input').addEventListener('change',e=>{sec.nome=e.target.value||null; markDirty();});
  sh.querySelector('.secao-del').addEventListener('click',()=>{
    emp.secoes=emp.secoes.filter(s=>s.id!==sec.id);
    wrap.remove();
    refreshBadge(emp,day);
    markDirty();
  });
  wrap.appendChild(sh);

  const wList=document.createElement('div');
  wList.className='workers-list';
  wList.dataset.secId=sec.id;
  wList.dataset.empId=emp.id;
  wList.style.minHeight='4px';

  sec.workers.forEach(w=>wList.appendChild(buildWorker(emp,sec,w,day)));

  Sortable.create(wList,{
    group:{name:'workers', pull:true, put:true},
    animation:120,
    ghostClass:'sortable-ghost',
    handle:'.wdrag',
    onEnd(evt){
      if(evt.from===evt.to){
        const m=sec.workers.splice(evt.oldIndex,1)[0];
        sec.workers.splice(evt.newIndex,0,m);
        refreshBadge(emp,day);
        updateChips(day);
        markDirty();
      }
    },
    onRemove(evt){
      const wid=evt.item.dataset.wid;
      sec.workers=sec.workers.filter(x=>x.id!==wid);
      refreshBadge(emp,day);
      updateChips(day);
      markDirty();
    },
    onAdd(evt){
      const wid=evt.item.dataset.wid;
      const newIdx=evt.newIndex;
      let wObj=findWorkerGlobal(wid,day);
      if(!wObj){
        const ni=evt.item.querySelector('.worker-nome');
        const hi=evt.item.querySelector('.worker-horario');
        const ok=evt.item.querySelector('.ok-btn');
        wObj={id:wid,nome:ni?ni.value:'',horario:hi&&hi.value?hi.value:null,ok:ok?ok.dataset.ok==='true':false};
      } else {
        wObj=deepClone(wObj);
        wObj.id=wid;
      }
      sec.workers.splice(newIdx,0,wObj);
      const newRow=buildWorker(emp,sec,wObj,day);
      evt.item.replaceWith(newRow);
      refreshBadge(emp,day);
      updateChips(day);
      markDirty();
    }
  });

  wrap.appendChild(wList);

  const btnW=document.createElement('button');
  btnW.className='btn-add-worker';
  btnW.textContent='＋ trabalhador';
  btnW.addEventListener('click',()=>addWorker(emp,sec,wList,day));
  wrap.appendChild(btnW);

  return wrap;
}

function findWorkerGlobal(wid,day){
  for(const emp of Object.values(day.empresas)){
    for(const sec of emp.secoes){
      const w=sec.workers.find(x=>x.id===wid);
      if(w) return w;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════
   BUILD WORKER
   ══════════════════════════════════════════════════════ */
function buildWorker(emp,sec,w,day){
  const row=document.createElement('div');
  row.className='worker-row';
  row.dataset.wid=w.id;

  row.innerHTML=`
    <span class="wdrag" title="Arrastar para mover">⠿</span>
    <input class="worker-nome" value="${esc(w.nome)}" placeholder="Nome…">
    <input class="worker-horario" value="${esc(w.horario||'')}" placeholder="horário">
    <button class="ok-btn ${w.ok?'confirmado':'pendente'}" data-ok="${w.ok}">${w.ok?'ok':'—'}</button>
    <button class="wdel" title="Remover">✕</button>`;

  row.querySelector('.worker-nome').addEventListener('change',e=>{w.nome=e.target.value; markDirty();});
  row.querySelector('.worker-horario').addEventListener('change',e=>{w.horario=e.target.value||null; markDirty();});

  const okBtn=row.querySelector('.ok-btn');
  okBtn.addEventListener('click',()=>{
    w.ok=!w.ok;
    okBtn.dataset.ok=w.ok;
    okBtn.className='ok-btn '+(w.ok?'confirmado':'pendente');
    okBtn.textContent=w.ok?'ok':'—';
    refreshBadge(emp,day);
    updateChips(day);
    markDirty();
    showToast(w.ok?'Confirmado ✓':'Confirmação removida');
  });

  row.querySelector('.wdel').addEventListener('click',()=>{
    sec.workers=sec.workers.filter(x=>x.id!==w.id);
    row.remove();
    refreshBadge(emp,day);
    updateChips(day);
    markDirty();
  });

  row.addEventListener('contextmenu',e=>{
    e.preventDefault();
    e.stopPropagation();
    showCtxWorker(e.clientX,e.clientY,emp,sec,w,day);
  });

  return row;
}

/* ══════════════════════════════════════════════════════
   OPERAÇÕES
   ══════════════════════════════════════════════════════ */
function addEmpresa(){
  const day=getDayData();
  const e=makeEmpObj('Nova Empresa');
  day.empresas[e.id]=e;
  if(layoutMode==='grid'){
    if(!day.columns.length) day.columns.push([]);
    day.columns[0].push(e.id);
  } else {
    if(!day.columns.length) day.columns.push([]);
    let minCol=0,minLen=Infinity;
    day.columns.forEach((c,i)=>{if(c.length<minLen){minLen=c.length;minCol=i;}});
    day.columns[minCol].push(e.id);
  }
  render().then(()=>{
    setTimeout(()=>{
      const inp=document.querySelector(`[data-id="${e.id}"] .empresa-nome-input`);
      if(inp){inp.focus();inp.select();}
    },50);
  });
  markDirty();
}
function makeEmpObj(nome){
  return {id:uid(),empresa:nome,secoes:[{id:uid(),nome:null,workers:[]}]};
}

function delEmpresa(id,day){
  delete day.empresas[id];
  day.columns.forEach((c,i)=>{day.columns[i]=c.filter(x=>x!==id);});
  if(selectedId===id) selectedId=null;
  render();
  markDirty();
}

function addSecao(emp,body,day){
  const sec={id:uid(),nome:'Secção',workers:[]};
  emp.secoes.push(sec);
  const btnS=body.querySelector('.btn-add-secao');
  const el=buildSecao(emp,sec,day);
  body.insertBefore(el,btnS);
  setTimeout(()=>{const i=el.querySelector('.secao-nome-input');if(i){i.focus();i.select();}},30);
  markDirty();
}

function addWorker(emp,sec,wList,day){
  const w={id:uid(),nome:'',horario:null,ok:false};
  sec.workers.push(w);
  const row=buildWorker(emp,sec,w,day);
  wList.appendChild(row);
  setTimeout(()=>{const i=row.querySelector('.worker-nome');if(i)i.focus();},30);
  refreshBadge(emp,day);
  updateChips(day);
  markDirty();
}

function addColumn(){
  const day=getDayData();
  day.columns.push([]);
  render();
  markDirty();
}

function selectCard(id,cardEl){
  document.querySelectorAll('.empresa-card.selected').forEach(c=>c.classList.remove('selected'));
  selectedId=id;
  if(cardEl) cardEl.classList.add('selected');
}

/* ══════════════════════════════════════════════════════
   COPY / PASTE — WORKER
   ══════════════════════════════════════════════════════ */
let workerClipboard=null;

function copyWorker(w){
  workerClipboard=deepClone(w);
  navigator.clipboard.writeText(`${w.nome}${w.horario?' '+w.horario:''}`).catch(()=>{});
  showToast(`Copiado: ${w.nome}`);
}

function pasteWorker(emp,sec,wList,day){
  if(!workerClipboard){showToast('Nada para colar');return;}
  const clone=deepClone(workerClipboard);
  clone.id=uid();
  sec.workers.push(clone);
  const row=buildWorker(emp,sec,clone,day);
  wList.appendChild(row);
  refreshBadge(emp,day);
  updateChips(day);
  markDirty();
  showToast(`Colado: ${clone.nome}`);
}

let ctxW=null,ctxWEmp=null,ctxWSec=null,ctxWDay=null,ctxWList=null;

function showCtxWorker(x,y,emp,sec,w,day){
  ctxW=w; ctxWEmp=emp; ctxWSec=sec; ctxWDay=day;
  ctxWList=document.querySelector(`.workers-list[data-sec-id="${sec.id}"]`);
  const m=document.getElementById('ctxWorkerMenu');
  m.style.left=Math.min(x,window.innerWidth-180)+'px';
  m.style.top=Math.min(y,window.innerHeight-160)+'px';
  m.classList.add('show');
}
function hideCtxWorker(){document.getElementById('ctxWorkerMenu').classList.remove('show');}

/* ══════════════════════════════════════════════════════
   COPY / PASTE — CARD
   ══════════════════════════════════════════════════════ */
function copyCard(id,day){
  const emp=day.empresas[id];
  if(!emp) return;
  clipboard=deepClone(emp);
  const linhas=[`📋 ${emp.empresa}`];
  emp.secoes.forEach(s=>{
    if(s.nome) linhas.push(`  [${s.nome}]`);
    s.workers.forEach(w=>linhas.push(`    ${w.nome}${w.horario?' '+w.horario:''}${w.ok?' ✓':' —'}`));
  });
  navigator.clipboard.writeText(linhas.join('\n')).catch(()=>{});
  showToast(`Copiado: ${emp.empresa}`);
}

function pasteCard(){
  if(!clipboard){showToast('Nada para colar');return;}
  const day=getDayData();
  const clone=deepClone(clipboard);
  clone.id=uid();
  clone.empresa+=' (cópia)';
  clone.secoes.forEach(s=>{s.id=uid();s.workers.forEach(w=>{w.id=uid();});});
  day.empresas[clone.id]=clone;
  let targetCol=day.columns.length-1;
  if(selectedId){
    day.columns.forEach((c,i)=>{if(c.includes(selectedId)) targetCol=i;});
  }
  const idx=selectedId?day.columns[targetCol].indexOf(selectedId)+1:day.columns[targetCol].length;
  day.columns[targetCol].splice(idx,0,clone.id);
  render();
  markDirty();
  showToast('Card colado');
}

/* ══════════════════════════════════════════════════════
   BADGES / CHIPS
   ══════════════════════════════════════════════════════ */
function countEmp(emp){
  let eTotal=0,eOk=0;
  emp.secoes.forEach(s=>s.workers.forEach(w=>{eTotal++;if(w.ok)eOk++;}));
  return{eTotal,eOk};
}
function refreshBadge(emp,day){
  const{eTotal,eOk}=countEmp(emp);
  const b=document.getElementById('badge-'+emp.id);
  if(!b) return;
  if(eTotal===0){b.style.display='none';return;}
  b.style.display='';
  b.className='emp-badge '+(eOk===eTotal?'ok':'pend');
  b.textContent=`${eOk}/${eTotal}`;
}
function updateChips(day){
  let total=0,okCount=0;
  Object.values(day.empresas).forEach(emp=>{
    const{eTotal,eOk}=countEmp(emp);
    total+=eTotal;okCount+=eOk;
  });
  const pend=total-okCount;
  document.getElementById('chipTotal').textContent=total+' trabalhador'+(total!==1?'es':'');
  document.getElementById('chipOk').textContent=okCount+' confirmado'+(okCount!==1?'s':'');
  document.getElementById('chipPend').textContent=pend+' pendente'+(pend!==1?'s':'');
}

/* ══════════════════════════════════════════════════════
   CONTEXT MENU
   ══════════════════════════════════════════════════════ */
let ctxEmp=null,ctxDay=null;
function showCtx(x,y,emp,day){
  ctxEmp=emp;ctxDay=day;
  const m=document.getElementById('ctxMenu');
  document.getElementById('ctxPaste').style.opacity=clipboard?'1':'.4';
  m.style.left=Math.min(x,window.innerWidth-180)+'px';
  m.style.top=Math.min(y,window.innerHeight-200)+'px';
  m.classList.add('show');
}
function hideCtx(){document.getElementById('ctxMenu').classList.remove('show');}

document.getElementById('ctxCopy').onclick=()=>{if(ctxEmp)copyCard(ctxEmp.id,ctxDay);hideCtx();};
document.getElementById('ctxPaste').onclick=()=>{pasteCard();hideCtx();};
document.getElementById('ctxAddWorker').onclick=()=>{
  if(ctxEmp){
    const s=ctxEmp.secoes[ctxEmp.secoes.length-1];
    if(s){
      const wl=document.querySelector(`.workers-list[data-sec-id="${s.id}"]`);
      if(wl) addWorker(ctxEmp,s,wl,ctxDay);
    }
  }
  hideCtx();
};
document.getElementById('ctxAddSecao').onclick=()=>{
  if(ctxEmp){const b=document.getElementById('body-'+ctxEmp.id);if(b)addSecao(ctxEmp,b,ctxDay);}
  hideCtx();
};
document.getElementById('ctxDelete').onclick=()=>{if(ctxEmp)delEmpresa(ctxEmp.id,ctxDay);hideCtx();};

document.getElementById('ctxWCopy').onclick=()=>{
  if(ctxW) copyWorker(ctxW);
  hideCtxWorker();
};
document.getElementById('ctxWPaste').onclick=()=>{
  if(ctxWEmp&&ctxWSec&&ctxWList) pasteWorker(ctxWEmp,ctxWSec,ctxWList,ctxWDay);
  hideCtxWorker();
};
document.getElementById('ctxWDelete').onclick=()=>{
  if(ctxW&&ctxWSec){
    ctxWSec.workers=ctxWSec.workers.filter(x=>x.id!==ctxW.id);
    const rowEl=document.querySelector(`.worker-row[data-wid="${ctxW.id}"]`);
    if(rowEl) rowEl.remove();
    refreshBadge(ctxWEmp,ctxWDay);
    updateChips(ctxWDay);
    markDirty();
  }
  hideCtxWorker();
};

document.addEventListener('click',e=>{
  if(!document.getElementById('ctxMenu').contains(e.target)) hideCtx();
  if(!document.getElementById('ctxWorkerMenu').contains(e.target)) hideCtxWorker();
});

/* ══════════════════════════════════════════════════════
   TECLADO
   ══════════════════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA') return;
  const day=getDayData();
  if((e.ctrlKey||e.metaKey)&&e.key==='c'&&selectedId){e.preventDefault();copyCard(selectedId,day);}
  if((e.ctrlKey||e.metaKey)&&e.key==='v'){e.preventDefault();pasteCard();}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveDay(dateKey(currentDate));}
  if((e.key==='Delete'||e.key==='Backspace')&&selectedId){delEmpresa(selectedId,day);}
  if(e.key==='Escape'){
    selectedId=null;
    document.querySelectorAll('.empresa-card.selected').forEach(c=>c.classList.remove('selected'));
    hideCtx();
  }
});

/* ══════════════════════════════════════════════════════
   CLONE DIA / CARD
   ══════════════════════════════════════════════════════ */
let cloneMode=null;
let cloneCardId=null;

function dateKey2(d){return dateKey(d);}
function keyToInputVal(k){ return k; }
function inputValToKey(v){ return v; }

function openCloneModal(mode, cardId){
  cloneMode=mode;
  cloneCardId=cardId||null;
  const modal=document.getElementById('cloneModal');
  const title=document.getElementById('cloneModalTitle');
  const sub=document.getElementById('cloneModalSub');
  const inp=document.getElementById('cloneTargetDate');

  if(mode==='day'){
    title.textContent='Clonar dia inteiro';
    sub.textContent='Copia todas as empresas e trabalhadores deste dia para a data escolhida. Os ok\'s são reiniciados.';
  } else {
    const day=getDayData();
    const emp=day.empresas[cardId];
    title.textContent=`Clonar "${emp?emp.empresa:'empresa'}"`;
    sub.textContent='Copia esta empresa e trabalhadores para a data escolhida. O ok é reiniciado.';
  }

  const sugg=new Date(currentDate);
  sugg.setDate(sugg.getDate()+1);
  inp.value=dateKey(sugg);
  checkCloneWarn(inp.value);
  modal.classList.add('open');
  setTimeout(()=>inp.focus(),80);
}

function checkCloneWarn(val){
  const warn=document.getElementById('cloneWarn');
  if(!val){warn.classList.remove('show');return;}
  const k=cacheKey(inputValToKey(val));
  const exists=DIAS_DATA[k]&&Object.keys(DIAS_DATA[k].empresas||{}).length>0;
  warn.classList.toggle('show',exists);
}

function closeCloneModal(){
  document.getElementById('cloneModal').classList.remove('open');
  cloneMode=null; cloneCardId=null;
}

async function execClone(){
  const val=document.getElementById('cloneTargetDate').value;
  if(!val){showToast('Escolhe uma data');return;}
  const targetKey=inputValToKey(val);
  const srcDay=getDayData();

  if(cloneMode==='day'){
    const newEmpresas={};
    const idMap={};
    Object.values(srcDay.empresas).forEach(emp=>{
      const clone=deepClone(emp);
      const newId=uid();
      idMap[emp.id]=newId;
      clone.id=newId;
      clone.secoes.forEach(s=>{
        s.id=uid();
        s.workers.forEach(w=>{ w.id=uid(); w.ok=false; });
      });
      newEmpresas[newId]=clone;
    });
    const newColumns=srcDay.columns.map(col=>col.map(oldId=>idMap[oldId]||oldId).filter(x=>newEmpresas[x]));
    DIAS_DATA[cacheKey(targetKey)]={columns:newColumns,empresas:newEmpresas};
    closeCloneModal();
    currentDate=new Date(targetKey.replace(/-/g,'/'));
    await render();
    await saveDay(targetKey);
    showToast(`Dia clonado para ${formatDateShort(currentDate)}`);

  } else {
    const emp=srcDay.empresas[cloneCardId];
    if(!emp){closeCloneModal();return;}
    // Garantir que o dia destino está carregado
    await loadDay(targetKey);
    if(!DIAS_DATA[cacheKey(targetKey)]) DIAS_DATA[cacheKey(targetKey)]={empresas:{},columns:[]};
    const targetDay=DIAS_DATA[cacheKey(targetKey)];
    const clone=deepClone(emp);
    clone.id=uid();
    clone.secoes.forEach(s=>{
      s.id=uid();
      s.workers.forEach(w=>{ w.id=uid(); w.ok=false; });
    });
    targetDay.empresas[clone.id]=clone;
    if(!targetDay.columns.length) targetDay.columns.push([]);
    while(targetDay.columns.length<4) targetDay.columns.push([]);
    let minCol=0,minLen=Infinity;
    targetDay.columns.forEach((c,i)=>{if(c.length<minLen){minLen=c.length;minCol=i;}});
    targetDay.columns[minCol].push(clone.id);
    closeCloneModal();
    await saveDay(targetKey);
    showToast(`"${emp.empresa}" clonado para ${targetKey}`);
  }
}

function formatDateShort(d){
  return d.getDate()+' '+['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()];
}

document.getElementById('cloneCancelBtn').onclick=closeCloneModal;
document.getElementById('cloneConfirmBtn').onclick=execClone;
document.getElementById('cloneTargetDate').addEventListener('input',e=>checkCloneWarn(e.target.value));
document.getElementById('cloneModal').addEventListener('click',e=>{
  if(e.target===document.getElementById('cloneModal')) closeCloneModal();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.getElementById('cloneModal').classList.contains('open')){
    e.stopImmediatePropagation(); closeCloneModal();
  }
},{capture:true});

/* ══════════════════════════════════════════════════════
   TOAST LOCAL (complementa window.toast de utils.js)
   ══════════════════════════════════════════════════════ */
let _tt;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ══════════════════════════════════════════════════════
   EVENTOS TOOLBAR
   ══════════════════════════════════════════════════════ */
document.getElementById('btnPrev').onclick=()=>{currentDate.setDate(currentDate.getDate()-1);render();};
document.getElementById('btnNext').onclick=()=>{currentDate.setDate(currentDate.getDate()+1);render();};
document.getElementById('btnAddEmpresa').onclick=addEmpresa;
document.getElementById('btnAddCol').onclick=addColumn;
document.getElementById('btnToggleLayout').onclick=toggleLayout;
document.getElementById('btnCloneDay').onclick=()=>openCloneModal('day');
document.getElementById('btnSave').onclick=()=>saveDay(dateKey(currentDate));

/* ══════════════════════════════════════════════════════
   INICIALIZAÇÃO — bootProtectedPage (padrão comum)
   ══════════════════════════════════════════════════════ */
window.bootProtectedPage({
  activePage: 'escalas',
  moduleId: 'escalas',
}, ({ profile, isAdmin, escritorio }) => {
  currentEscritorio = escritorio || '';

  loadEscritorios().then(lista => {
    const sub = document.getElementById('pageSubtitle');
    const escritoriosAtivos = (lista || []).filter(e => e && e.ativo !== false);

    if (!currentEscritorio || currentEscritorio === 'todos') {
      currentEscritorio = (escritoriosAtivos[0] && escritoriosAtivos[0].id) || (lista[0] && lista[0].id) || 'quarteira';
    }

    if (isAdmin && lista.length > 1) {
      const pillsWrap = document.getElementById('escritorioPills');
      pillsWrap.style.display = 'flex';
      pillsWrap.innerHTML = lista.map(e =>
        `<button class="esc-pill${e.id === currentEscritorio ? ' sel' : ''}" data-esc="${e.id}">${e.nome}</button>`
      ).join('');
      pillsWrap.querySelectorAll('.esc-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          currentEscritorio = btn.dataset.esc;
          pillsWrap.querySelectorAll('.esc-pill').forEach(b => b.classList.toggle('sel', b === btn));
          sub.textContent = nomeEscritorio(currentEscritorio) + ' · Trabalhadores temporários';
          render();
        });
      });
    }

    sub.textContent = nomeEscritorio(currentEscritorio) + ' · Trabalhadores temporários';
    render();
  });
});
