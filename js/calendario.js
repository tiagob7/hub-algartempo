// ── Número de dias do mês ativo ──
function numDias() { return new Date(_calAno, _calMes, 0).getDate(); }
function diaSemana(d) { return new Date(_calAno, _calMes - 1, d).getDay(); } // 0=Dom,6=Sab
function isWeekend(d) { const wd = diaSemana(d); return wd === 0 || wd === 6; }
const WD_LABELS = ["D","S","T","Q","Q","S","S"];
function atualizarCssNumDias() { document.documentElement.style.setProperty("--num-days", numDias()); }

// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════

// Each dept: { id, name, colors[6], data[30] }
let departments = [
  {
    id: 'conta',
    name: 'Contabilidade',
    colors: ['#d4d4d8','#e8b4b4','#d97777','#c44040','#a81a1a','#6e0808'],
    data: [5,5,5,5,5,5,4,4,3,3,2,1,1,2,2,3,3,3,4,4,4,4,4,5,5,5,5,5,5,5]
  },
  {
    id: 'payroll',
    name: 'Payroll / RH',
    colors: ['#d4d4d8','#a8b8d8','#5f85c0','#2d5fa8','#163d80','#0a1f4a'],
    data: [1,4,4,4,4,4,4,3,3,5,3,3,3,3,3,5,5,4,4,4,4,3,3,3,3,3,3,3,3,3]
  }
];

let events = [
  {dayFrom:1,  dayTo:1,  label:'Faturação Mensais/2Q', deptId:'conta',   pinned:true},
  {dayFrom:5,  dayTo:5,  label:'SAFT',                 deptId:'conta',   pinned:true},
  {dayFrom:6,  dayTo:7,  label:'Pagamentos',            deptId:'conta',   pinned:true},
  {dayFrom:10, dayTo:10, label:'Seg. Social prelim.',   deptId:'payroll', pinned:true},
  {dayFrom:16, dayTo:17, label:'Seg. Social final',     deptId:'payroll', pinned:true},
  {dayFrom:21, dayTo:30, label:'Recibos escritório',    deptId:'conta',   pinned:true},
];

// ── STATE ──
let selDeptId  = 'conta';
let selDay     = null;
let newPin     = false;
let evType     = 'single';
let editEvIdx  = null;
let editEvPin  = false;
let editEvType = 'single';
let editDeptIdx   = null; // null = new
let editDeptColors = [];
let editorOpen = false;

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function getDept(id) { return departments.find(d => d.id === id); }
function genId()     { return 'dept_' + Math.random().toString(36).slice(2,8); }

function segColor(dept, val) {
  return dept.colors[Math.min(5, Math.max(0, val))];
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function render() {
  atualizarCssNumDias();
  buildLegend();
  buildDaysRow();
  buildTracks();
  buildEvGrid();
  buildSummary();
  if (editorOpen) {
    buildDeptSelList();
    buildDayMiniGrid();
    updatePrevBar();
    buildEvList();
    buildDeptCards();
    rebuildDeptSelects();
  }
}

function buildLegend() {
  const legend = document.getElementById('legend');
  const btn    = document.getElementById('editToggleBtn');
  const status = document.getElementById('syncStatus');
  legend.innerHTML = '';
  departments.forEach(dept => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const scale = document.createElement('div');
    scale.className = 'legend-scale';
    dept.colors.forEach(c => {
      const s = document.createElement('div');
      s.className = 'scale-seg';
      s.style.background = c;
      scale.appendChild(s);
    });
    item.appendChild(scale);
    item.appendChild(document.createTextNode(dept.name));
    legend.appendChild(item);
  });
  if (status) legend.appendChild(status);
  if (btn)    legend.appendChild(btn);
}

function buildDaysRow() {
  const dr = document.getElementById('daysRow');
  dr.innerHTML = '';
  for (let d=1;d<=numDias();d++) {
    const weekend = isWeekend(d);
    const el = document.createElement('div');
    el.className = 'day-num' + (weekend ? ' weekend' : '');
    el.innerHTML = '<span class="wd">' + WD_LABELS[diaSemana(d)] + '</span><span class="dn">' + d + '</span>';
    dr.appendChild(el);
  }
}

function buildTracks() {
  const container = document.getElementById('tracks');
  container.innerHTML = '';
  departments.forEach(dept => {
    const section = document.createElement('div');
    section.className = 'track-section';
    const nameEl = document.createElement('div');
    nameEl.className = 'track-name';
    nameEl.textContent = dept.name;
    const track = document.createElement('div');
    track.className = 'track';
    for (let d=1;d<=numDias();d++) {
      const seg = document.createElement('div');
      const val = dept.data[d-1];
      const wknd = isWeekend(d);
      seg.className = 'seg' + (wknd ? ' weekend' : '') + (selDay===d && selDeptId===dept.id ? ' sel' : '');
      seg.style.background = segColor(dept, val);
      seg.addEventListener('click', e => {
        e.stopPropagation();
        if (selDay===d && selDeptId===dept.id) {
          selDay = null;
        } else {
          selDay = d; selDeptId = dept.id;
          if (editorOpen) {
            document.getElementById('slider').value = val;
            document.getElementById('sliderVal').textContent = val;
            switchTab('intensity');
          }
        }
        render();
      });
      seg.addEventListener('mousemove', e => showTip(e, d, dept));
      seg.addEventListener('mouseleave', hideTip);
      track.appendChild(seg);
    }
    section.appendChild(nameEl);
    section.appendChild(track);
    container.appendChild(section);
    // small spacer
    const sp = document.createElement('div');
    sp.style.height = '6px';
    container.appendChild(sp);
  });
}

function buildEvGrid() {
  const grid = document.getElementById('evGrid');
  grid.innerHTML = '';
  const pinned = events.filter(ev => ev.pinned);
  for (let d=1;d<=numDias();d++) {
    const cell = document.createElement('div');
    cell.className = 'ev-cell' + (isWeekend(d) ? ' weekend' : '');
    pinned.filter(ev => ev.dayFrom===d && ev.dayTo===d).forEach(ev => {
      const dept = getDept(ev.deptId);
      const dot = document.createElement('div');
      dot.className = 'ev-dot';
      dot.style.background = dept ? dept.colors[4] : '#888';
      const txt = document.createElement('div');
      txt.className = 'ev-text';
      txt.textContent = ev.label;
      cell.appendChild(dot);
      cell.appendChild(txt);
    });
    pinned.filter(ev => ev.dayFrom===d && ev.dayTo>d).forEach(ev => {
      const dept = getDept(ev.deptId);
      const dot = document.createElement('div');
      dot.className = 'ev-dot';
      dot.style.background = dept ? dept.colors[4] : '#888';
      const bar = document.createElement('div');
      bar.className = 'ev-range-bar';
      bar.style.background = dept ? dept.colors[3] : '#aaa';
      bar.dataset.span = ev.dayTo - ev.dayFrom + 1;
      const txt = document.createElement('div');
      txt.className = 'ev-text';
      txt.textContent = ev.label;
      cell.appendChild(dot);
      cell.appendChild(bar);
      cell.appendChild(txt);
    });
    grid.appendChild(cell);
  }
  requestAnimationFrame(() => {
    document.querySelectorAll('.ev-range-bar').forEach(bar => {
      const span = parseInt(bar.dataset.span);
      const cell = bar.closest('.ev-cell');
      if (!cell) return;
      bar.style.width = (cell.offsetWidth * span + 2*(span-1)) + 'px';
    });
  });
}

function buildSummary() {
  const wrap = document.getElementById('summaryGrid');
  wrap.innerHTML = '';
  const cols = Math.min(departments.length, 3);
  wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  departments.forEach(dept => {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.style.borderLeft = `3px solid ${dept.colors[4]}`;
    const evList = events.filter(ev => ev.deptId===dept.id).sort((a,b) => a.dayFrom-b.dayFrom);
    const dayLabel = ev => ev.dayFrom===ev.dayTo ? `Dia ${ev.dayFrom}` : `Dia ${ev.dayFrom}–${ev.dayTo}`;
    const rows = evList.length
      ? evList.map(ev => `<li><span class="li-day">${dayLabel(ev)}</span><span class="li-label">${ev.label}</span></li>`).join('')
      : '<li><span class="li-label no-events">Sem eventos</span></li>';
    card.innerHTML = `<h3 style="color:${dept.colors[4]}">${dept.name}</h3><ul>${rows}</ul>`;
    wrap.appendChild(card);
  });
}

// ── EDITOR PANELS ──
function buildDeptSelList() {
  const list = document.getElementById('deptSelList');
  list.innerHTML = '';
  departments.forEach(dept => {
    const item = document.createElement('div');
    item.className = 'dept-sel-item' + (selDeptId===dept.id ? ' active' : '');
    const sw = document.createElement('div');
    sw.className = 'dept-sel-swatch';
    const grad = `linear-gradient(to right, ${dept.colors.join(',')})`;
    sw.style.background = grad;
    item.appendChild(sw);
    item.appendChild(document.createTextNode(dept.name));
    item.onclick = () => { selDeptId = dept.id; render(); };
    list.appendChild(item);
  });
}

function buildDayMiniGrid() {
  const g = document.getElementById('dayMiniGrid');
  g.innerHTML = '';
  for (let d=1;d<=numDias();d++) {
    const b = document.createElement('button');
    b.className = 'dmb'+(d===selDay?' active':'');
    b.textContent = d;
    b.onclick = e => {
      e.stopPropagation();
      selDay = d===selDay ? null : d;
      if (selDay) {
        const dept = getDept(selDeptId);
        const v = dept ? dept.data[d-1] : 3;
        document.getElementById('slider').value = v;
        document.getElementById('sliderVal').textContent = v;
      }
      render();
    };
    g.appendChild(b);
  }
}

function updatePrevBar() {
  const bar = document.getElementById('prevBar');
  const v = parseInt(document.getElementById('slider').value);
  const dept = getDept(selDeptId);
  const cols = dept ? dept.colors : Array(6).fill('#ccc');
  bar.innerHTML = '';
  cols.forEach((c,i) => {
    const s = document.createElement('div');
    s.className = 'prev-seg';
    s.style.background = c;
    s.style.opacity = i===v ? '1' : '0.28';
    bar.appendChild(s);
  });
}

function buildEvList() {
  const list = document.getElementById('evList');
  list.innerHTML = '';
  const sorted = [...events].sort((a,b)=>a.dayFrom-b.dayFrom);
  if (!sorted.length) { list.innerHTML = '<div style="font-size:10px;color:#bbb;text-align:center;padding:10px;">Sem eventos</div>'; return; }
  sorted.forEach(ev => {
    const idx = events.indexOf(ev);
    const dept = getDept(ev.deptId);
    const dayLbl = ev.dayFrom===ev.dayTo ? `Dia ${ev.dayFrom}` : `${ev.dayFrom}–${ev.dayTo}`;
    const item = document.createElement('div');
    item.className = 'ev-list-item';
    item.innerHTML = `
      <div class="ev-dot-sm" style="background:${dept?dept.colors[4]:'#888'}"></div>
      <div class="ev-day-lbl">${dayLbl}</div>
      <div class="ev-name">${ev.label}</div>
      <span style="font-size:9px;color:${ev.pinned?'var(--accent)':'#ccc'};">${ev.pinned?'📌':''}</span>
      <button class="icon-btn" title="Editar" onclick="openEditEvModal(${idx})">✎</button>
      <button class="icon-btn del" title="Eliminar" onclick="delEvent(${idx})">×</button>
    `;
    list.appendChild(item);
  });
}

function buildDeptCards() {
  const wrap = document.getElementById('deptCards');
  wrap.innerHTML = '';
  departments.forEach((dept, i) => {
    const card = document.createElement('div');
    card.className = 'dept-card';
    const header = document.createElement('div');
    header.className = 'dept-card-header';
    const sw = document.createElement('div');
    sw.className = 'dept-card-swatch';
    sw.style.background = `linear-gradient(to right, ${dept.colors.join(',')})`;
    const nm = document.createElement('div');
    nm.className = 'dept-card-name';
    nm.textContent = dept.name;
    const actions = document.createElement('div');
    actions.className = 'dept-card-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.textContent = '✎ Editar';
    editBtn.style.fontSize = '10px';
    editBtn.onclick = () => openEditDeptModal(i);
    actions.appendChild(editBtn);
    if (departments.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-red btn-sm';
      delBtn.textContent = '× Remover';
      delBtn.style.fontSize = '10px';
      delBtn.onclick = () => removeDept(i);
      actions.appendChild(delBtn);
    }
    header.appendChild(sw);
    header.appendChild(nm);
    header.appendChild(actions);
    // mini color scale preview
    const scaleRow = document.createElement('div');
    scaleRow.className = 'color-scale-editor';
    dept.colors.forEach((c, ci) => {
      const step = document.createElement('div');
      step.className = 'color-step';
      const wrap2 = document.createElement('div');
      wrap2.className = 'color-picker-wrap';
      const preview = document.createElement('div');
      preview.className = 'color-step-preview';
      preview.style.background = c;
      preview.title = `Nível ${ci}`;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = c;
      input.addEventListener('input', e => {
        dept.colors[ci] = e.target.value;
        preview.style.background = e.target.value;
        render();
      });
      wrap2.appendChild(preview);
      wrap2.appendChild(input);
      const lbl = document.createElement('div');
      lbl.className = 'color-step-label';
      lbl.textContent = ci === 0 ? 'min' : ci === 5 ? 'max' : ci;
      step.appendChild(wrap2);
      step.appendChild(lbl);
      scaleRow.appendChild(step);
    });
    card.appendChild(header);
    card.appendChild(scaleRow);
    wrap.appendChild(card);
  });
}

function rebuildDeptSelects() {
  ['evDept','editEvDept'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.id;
      opt.textContent = dept.name;
      sel.appendChild(opt);
    });
    if (departments.find(d=>d.id===prev)) sel.value = prev;
  });
}

// ═══════════════════════════════════════════════
// ACTIONS — INTENSITY
// ═══════════════════════════════════════════════
function toggleEditor() {
  editorOpen = !editorOpen;
  document.getElementById('editor').classList.toggle('open', editorOpen);
  document.getElementById('editToggleBtn').classList.toggle('active', editorOpen);
  document.querySelector('.layout').classList.toggle('editor-open', editorOpen);
  if (editorOpen) render();
}

function onSlider(v) {
  document.getElementById('sliderVal').textContent = v;
  updatePrevBar();
}

function applyDay() {
  if (!selDay) { toast('Selecione um dia primeiro.'); return; }
  const v = parseInt(document.getElementById('slider').value);
  const dept = getDept(selDeptId);
  if (dept) { dept.data[selDay-1] = v; render(); }
}

function applyRange() {
  const from = parseInt(document.getElementById('rFrom').value);
  const to   = parseInt(document.getElementById('rTo').value);
  const v    = parseInt(document.getElementById('slider').value);
  if (isNaN(from)||isNaN(to)||from<1||to>numDias()||from>to) { toast('Intervalo inválido.'); return; }
  const dept = getDept(selDeptId);
  if (dept) { for(let d=from;d<=to;d++) dept.data[d-1]=v; render(); }
}

// ═══════════════════════════════════════════════
// ACTIONS — EVENTS
// ═══════════════════════════════════════════════
function setEvType(t) {
  evType = t;
  document.getElementById('typeSingle').classList.toggle('active', t==='single');
  document.getElementById('typeRange').classList.toggle('active', t==='range');
  document.getElementById('evSingleFields').style.display = t==='single'?'':'none';
  document.getElementById('evRangeFields').style.display  = t==='range'?'':'none';
}

function togglePin() {
  newPin = !newPin;
  document.getElementById('pinToggle').classList.toggle('on', newPin);
}

function addEvent() {
  const label  = document.getElementById('evLabel').value.trim();
  const deptId = document.getElementById('evDept').value;
  let dayFrom, dayTo;
  if (evType==='single') {
    dayFrom = dayTo = parseInt(document.getElementById('evDay').value);
    if (!dayFrom||dayFrom<1||dayFrom>numDias()) { toast('Dia inválido.'); return; }
  } else {
    dayFrom = parseInt(document.getElementById('evFrom').value);
    dayTo   = parseInt(document.getElementById('evTo').value);
    if (isNaN(dayFrom)||isNaN(dayTo)||dayFrom<1||dayTo>numDias()||dayFrom>dayTo) { toast('Intervalo inválido.'); return; }
  }
  if (!label) { toast('Preencha a descrição.'); return; }
  events.push({dayFrom, dayTo, label, deptId, pinned:newPin});
  document.getElementById('evDay').value = '';
  document.getElementById('evFrom').value = '';
  document.getElementById('evTo').value = '';
  document.getElementById('evLabel').value = '';
  newPin = false;
  document.getElementById('pinToggle').classList.remove('on');
  render();
}

function delEvent(i) { events.splice(i,1); render(); }

// ── edit event modal ──
function setEditEvType(t) {
  editEvType = t;
  document.getElementById('editTypeSingle').classList.toggle('active', t==='single');
  document.getElementById('editTypeRange').classList.toggle('active', t==='range');
  document.getElementById('editSingleFields').style.display = t==='single'?'':'none';
  document.getElementById('editRangeFields').style.display  = t==='range'?'':'none';
}

function toggleEditPin() {
  editEvPin = !editEvPin;
  document.getElementById('editPinToggle').classList.toggle('on', editEvPin);
}

function openEditEvModal(i) {
  editEvIdx = i;
  const ev = events[i];
  const isRange = ev.dayFrom !== ev.dayTo;
  editEvType = isRange ? 'range' : 'single';
  setEditEvType(editEvType);
  if (isRange) { document.getElementById('editFrom').value=ev.dayFrom; document.getElementById('editTo').value=ev.dayTo; }
  else { document.getElementById('editDay').value=ev.dayFrom; }
  rebuildDeptSelects();
  document.getElementById('editEvDept').value = ev.deptId;
  document.getElementById('editLabel').value  = ev.label;
  editEvPin = ev.pinned;
  document.getElementById('editPinToggle').classList.toggle('on', editEvPin);
  document.getElementById('editModal').classList.add('open');
}

function saveEditEvent() {
  if (editEvIdx===null) return;
  const label  = document.getElementById('editLabel').value.trim();
  const deptId = document.getElementById('editEvDept').value;
  if (!label) { toast('Preencha a descrição.'); return; }
  let dayFrom, dayTo;
  if (editEvType==='single') {
    dayFrom = dayTo = parseInt(document.getElementById('editDay').value);
    if (!dayFrom||dayFrom<1||dayFrom>numDias()) { toast('Dia inválido.'); return; }
  } else {
    dayFrom = parseInt(document.getElementById('editFrom').value);
    dayTo   = parseInt(document.getElementById('editTo').value);
    if (isNaN(dayFrom)||isNaN(dayTo)||dayFrom<1||dayTo>numDias()||dayFrom>dayTo) { toast('Intervalo inválido.'); return; }
  }
  events[editEvIdx] = {dayFrom, dayTo, label, deptId, pinned:editEvPin};
  closeModal('editModal');
  render();
}

// ═══════════════════════════════════════════════
// ACTIONS — DEPARTMENTS
// ═══════════════════════════════════════════════
function openAddDeptModal() {
  editDeptIdx = null;
  document.getElementById('deptModalTitle').textContent = 'Novo Departamento';
  document.getElementById('deptName').value = '';
  editDeptColors = ['#d4d4d8','#c0c0c8','#a0a0b8','#7070a0','#404080','#1a1a60'];
  buildDeptColorScaleEdit();
  document.getElementById('deptModal').classList.add('open');
}

function openEditDeptModal(i) {
  editDeptIdx = i;
  const dept = departments[i];
  document.getElementById('deptModalTitle').textContent = 'Editar Departamento';
  document.getElementById('deptName').value = dept.name;
  editDeptColors = [...dept.colors];
  buildDeptColorScaleEdit();
  document.getElementById('deptModal').classList.add('open');
}

function buildDeptColorScaleEdit() {
  const row = document.getElementById('deptColorScaleEdit');
  row.innerHTML = '';
  editDeptColors.forEach((c, i) => {
    const step = document.createElement('div');
    step.className = 'modal-color-step';
    const wrap = document.createElement('div');
    wrap.className = 'color-picker-wrap';
    wrap.style.position = 'relative';
    const preview = document.createElement('div');
    preview.className = 'modal-color-preview';
    preview.style.background = c;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = c;
    input.addEventListener('input', e => {
      editDeptColors[i] = e.target.value;
      preview.style.background = e.target.value;
    });
    wrap.appendChild(preview);
    wrap.appendChild(input);
    const lbl = document.createElement('div');
    lbl.className = 'modal-color-label';
    lbl.textContent = i===0?'min':i===5?'max':i;
    step.appendChild(wrap);
    step.appendChild(lbl);
    row.appendChild(step);
  });
}

function saveDept() {
  const name = document.getElementById('deptName').value.trim();
  if (!name) { toast('Preencha o nome.'); return; }
  if (editDeptIdx === null) {
    // new
    departments.push({
      id: genId(),
      name,
      colors: [...editDeptColors],
      data: Array(31).fill(0)
    });
  } else {
    departments[editDeptIdx].name   = name;
    departments[editDeptIdx].colors = [...editDeptColors];
  }
  closeModal('deptModal');
  render();
}

async function removeDept(i) {
  if (departments.length <= 1) { toast('Deve existir pelo menos um departamento.'); return; }
  const dept = departments[i];
  if (!await confirmar({ titulo: `Remover "${dept.name}"?`, texto: 'Os eventos deste departamento serão também eliminados.', btnOk: 'Remover', perigo: true })) return;
  events = events.filter(ev => ev.deptId !== dept.id);
  departments.splice(i,1);
  if (selDeptId === dept.id) selDeptId = departments[0].id;
  render();
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editEvIdx = null; editDeptIdx = null;
}

document.getElementById('editModal').addEventListener('click', function(e){ if(e.target===this) closeModal('editModal'); });
document.getElementById('deptModal').addEventListener('click', function(e){ if(e.target===this) closeModal('deptModal'); });

document.addEventListener('click', e => {
  const cal    = document.getElementById('calPanel');
  const editor = document.getElementById('editor');
  const inCal    = cal    && cal.contains(e.target);
  const inEditor = editor && editor.contains(e.target);
  if (!inCal && !inEditor) { selDay=null; render(); }
});

function switchTab(t) {
  const tabs = ['intensity','events','depts'];
  document.querySelectorAll('.tab').forEach((b,i) => b.classList.toggle('active', tabs[i]===t));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
}

// TOOLTIP
const tipEl = document.getElementById('tip');
function showTip(e, day, dept) {
  const v   = dept.data[day-1];
  const evs = events.filter(ev => ev.deptId===dept.id && day>=ev.dayFrom && day<=ev.dayTo);
  tipEl.innerHTML = `
    <strong>Dia ${day} — ${dept.name}</strong>
    <span>${'●'.repeat(v)}${'○'.repeat(5-v)}</span>
    ${evs.map(ev=>`<span class="tn">${ev.pinned?'📌':'·'} ${ev.label}</span>`).join('')}
  `;
  tipEl.classList.add('on');
  tipEl.style.left = Math.min(e.clientX+14, window.innerWidth-240)+'px';
  tipEl.style.top  = (e.clientY-10)+'px';
}
function hideTip(){ tipEl.classList.remove('on'); }

// ═══════════════════════════════════════════════

const db = firebase.firestore();

let CALENDAR_ID = null;
let docRef      = null;
let isSaving    = false;


async function saveToFirebase() {
  if (!docRef || isSaving) return;
  isSaving = true;
  setStatus('A guardar…', '#f59e0b');
  try {
    await docRef.set({ departments, events, updatedAt: Date.now() });
    setStatus('✓ Guardado', '#16a34a');
    setTimeout(() => setStatus(''), 3000);
  } catch(e) {
    console.error(e);
    setStatus('Erro ao guardar', '#dc2626');
  }
  isSaving = false;
}

function startRealtimeSync() {
  setStatus('A ligar…', '#f59e0b');
  const unsubscribe = docRef.onSnapshot((snap) => {
    if (!snap.exists) {
      // Documento novo — resetar para estado limpo (sem copiar dados do mês anterior)
      departments = departments.map(d => ({ ...d, data: Array(31).fill(0) }));
      events = [];
      render();
      saveToFirebase();
      return;
    }
    const data = snap.data();
    if (!isSaving) {
      if (data.departments && data.departments.length) {
        departments = data.departments.map(d => ({ ...d, data: d.data.length < 31 ? [...d.data, ...Array(31 - d.data.length).fill(0)] : d.data }));
      }
      if (data.events) events = data.events;
      if (!departments.find(d => d.id === selDeptId)) selDeptId = departments[0]?.id || '';
      render();
      setStatus('✓ Sincronizado', '#16a34a');
      setTimeout(() => setStatus(''), 3000);
    }
  }, err => {
    console.error(err);
    setStatus('Erro de ligação', '#dc2626');
  });
  window._calUnsubscribe = unsubscribe;
}

// Patch: guardar automaticamente ao editar + registar auditoria
function _auditCal(acao, titulo, antes, depois) {
  registarAuditoria({
    modulo: 'calendarios',
    acao,
    docId:  CALENDAR_ID || '',
    titulo: titulo || '',
    antes:  antes  || undefined,
    depois: depois || undefined,
    nota:   'Escritório: ' + (_calEscritorio || '') + ' · ' + (typeof NOMES_MES !== 'undefined' ? NOMES_MES[_calMes-1] : '') + ' ' + _calAno,
  });
}

const _applyDay = applyDay;
applyDay = function() {
  const dept = getDept(selDeptId);
  const antes = dept ? dept.data[selDay - 1] : undefined;
  _applyDay();
  saveToFirebase();
  if (dept && selDay) {
    _auditCal('atualizado',
      `${dept.name} — Dia ${selDay}`,
      { intensidade: antes },
      { intensidade: dept.data[selDay - 1] }
    );
  }
};

const _applyRange = applyRange;
applyRange = function() {
  const from = parseInt(document.getElementById('rFrom').value);
  const to   = parseInt(document.getElementById('rTo').value);
  const v    = parseInt(document.getElementById('slider').value);
  const dept = getDept(selDeptId);
  _applyRange();
  saveToFirebase();
  if (dept && !isNaN(from) && !isNaN(to)) {
    _auditCal('atualizado',
      `${dept.name} — Dias ${from}–${to}`,
      { intensidade: '(vários)' },
      { intensidade: v }
    );
  }
};

const _addEvent = addEvent;
addEvent = function() {
  const label  = document.getElementById('evLabel').value.trim();
  const deptId = document.getElementById('evDept').value;
  const dept   = getDept(deptId);
  _addEvent();
  saveToFirebase();
  if (label) {
    _auditCal('criado', label, undefined, { label, deptId, dept: dept ? dept.name : deptId });
  }
};

const _delEvent = delEvent;
delEvent = function(i) {
  const ev   = events[i];
  const dept = ev ? getDept(ev.deptId) : null;
  _delEvent(i);
  saveToFirebase();
  if (ev) {
    _auditCal('eliminado', ev.label, { label: ev.label, dept: dept ? dept.name : ev.deptId }, undefined);
  }
};

const _saveEditEvent = saveEditEvent;
saveEditEvent = function() {
  const antes = editEvIdx !== null ? { ...events[editEvIdx] } : undefined;
  _saveEditEvent();
  saveToFirebase();
  if (antes) {
    const depois = editEvIdx !== null ? { ...events[editEvIdx] } : undefined;
    _auditCal('atualizado', antes.label, antes, depois);
  }
};

const _saveDept = saveDept;
saveDept = function() {
  const isNew = (editDeptIdx === null);
  const nomeBefore = !isNew ? departments[editDeptIdx].name : '';
  _saveDept();
  saveToFirebase();
  const nomeAfter = document.getElementById('deptName') ? '' : ''; // já foi fechado
  _auditCal(
    isNew ? 'criado' : 'atualizado',
    isNew ? (departments[departments.length - 1] && departments[departments.length - 1].name) || 'Novo departamento' : nomeBefore,
    isNew ? undefined : { nome: nomeBefore },
    undefined
  );
};

const _removeDept = removeDept;
removeDept = async function(i) {
  const dept = departments[i];
  _removeDept(i);
  saveToFirebase();
  if (dept) {
    _auditCal('eliminado', dept.name, { nome: dept.name }, undefined);
  }
};

const _buildDeptCards = buildDeptCards;
buildDeptCards = function() {
  _buildDeptCards();
  document.querySelectorAll('.dept-card input[type=color]').forEach(input => {
    input.addEventListener('change', () => {
      saveToFirebase();
      _auditCal('atualizado', 'Cor de departamento alterada', undefined, undefined);
    });
  });
};

// ── Estado de navegação mês/ano ──
const _now = new Date();
let _calAno = _now.getFullYear();
let _calMes = _now.getMonth() + 1; // 1–12
let _calEscritorio = '';
let _ESCR_MAP = {}; // id -> {id,nome,cor,...}
const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function calDocId(esc, ano, mes) {
  return 'calendario_' + esc + '_' + ano + '_' + String(mes).padStart(2,'0');
}

// ── Injetar estilos partilhados (escritório + mês) ──
function injetarEstilosNav() {
  if (document.getElementById('escBtnStyle')) return;
  const st = document.createElement('style');
  st.id = 'escBtnStyle';
  st.textContent = `
    .esc-btn{padding:5px 14px;border:1px solid var(--border);background:transparent;font-family:'DM Mono',monospace;font-size:10px;border-radius:20px;cursor:pointer;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;transition:all .15s;}
    .esc-btn:hover{border-color:var(--accent);color:var(--accent);}
    .esc-btn.esc-active{background:var(--accent);border-color:var(--accent);color:#fff;}
    .mes-nav{display:flex;align-items:center;gap:6px;}
    .mes-nav-btn{width:26px;height:26px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0;}
    .mes-nav-btn:hover{border-color:var(--accent);color:var(--accent);}
    .mes-label{font-family:'Manrope',sans-serif;font-weight:700;font-size:13px;color:var(--text);min-width:130px;text-align:center;letter-spacing:-.01em;}
    .mes-label .ano{font-size:10px;color:var(--muted);font-weight:500;font-family:'DM Mono',monospace;margin-left:4px;}
    .mes-hoje-btn{padding:4px 10px;border:1px solid var(--border);background:transparent;font-family:'DM Mono',monospace;font-size:9px;border-radius:20px;cursor:pointer;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;transition:all .15s;}
    .mes-hoje-btn:hover{border-color:var(--accent);color:var(--accent);}
    .cal-nav-wrap{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;row-gap:10px;}
    .cal-nav-sep{width:1px;height:20px;background:var(--border);}
  `;
  document.head.appendChild(st);
}

function injetarNavCalendario(isAdmin) {
  injetarEstilosNav();

  const now = new Date();
  const eHoje = (_calAno === now.getFullYear() && _calMes === now.getMonth()+1);

  let escHtml = '';
  if (isAdmin) {
    const lista = window.getEscritoriosSync ? window.getEscritoriosSync() : [];
    escHtml = `
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);">Escritório:</span>
      ${lista.map(e =>
        `<button class="esc-btn${_calEscritorio===e.id?' esc-active':''}" data-e="${e.id}" onclick="switchEscritorio('${e.id}')">${e.nome}</button>`
      ).join('')}
      <div class="cal-nav-sep"></div>
    `;
  }

  const navHtml = `
    <div id="calNavWrap" class="cal-nav-wrap">
      ${escHtml}
      <div class="mes-nav">
        <button class="mes-nav-btn" onclick="navMes(-1)" title="Mês anterior">&#8249;</button>
        <div class="mes-label">${NOMES_MES[_calMes-1]}<span class="ano">${_calAno}</span></div>
        <button class="mes-nav-btn" onclick="navMes(1)" title="Mês seguinte">&#8250;</button>
      </div>
      ${!eHoje ? `<button class="mes-hoje-btn" onclick="irParaHoje()">Hoje</button>` : ''}
    </div>`;

  const existing = document.getElementById('calNavWrap');
  if (existing) {
    existing.outerHTML = navHtml;
  } else {
    document.querySelector('.page').insertAdjacentHTML('afterbegin', navHtml);
  }
}

function navMes(delta) {
  _calMes += delta;
  if (_calMes > 12) { _calMes = 1;  _calAno++; }
  if (_calMes < 1)  { _calMes = 12; _calAno--; }
  if (window._calUnsubscribe) window._calUnsubscribe();
  injetarNavCalendario(window.isAdmin());
  loadCalendario(_calEscritorio);
}

function irParaHoje() {
  const now = new Date();
  _calAno = now.getFullYear();
  _calMes = now.getMonth() + 1;
  if (window._calUnsubscribe) window._calUnsubscribe();
  injetarNavCalendario(window.isAdmin());
  loadCalendario(_calEscritorio);
}

// INIT - aguarda autenticacao
document.addEventListener('authReady', async ({ detail }) => {
  window.renderNavbar('calendario');

  const isAdmin = window.isAdmin();

  // Carregar escritórios dinamicamente e construir mapa de nomes
  if (window.loadEscritorios) {
    const lista = await window.loadEscritorios();
    _ESCR_MAP = {};
    lista.forEach(e => { _ESCR_MAP[e.id] = e; });
  }

  let escritorio = window.escritorioAtivo() || '';
  if (!escritorio || escritorio === 'todos') {
    const lista = window.getEscritoriosSync ? window.getEscritoriosSync() : [];
    escritorio = (lista[0] && lista[0].id) || '';
  }
  _calEscritorio = escritorio;

  // Esconder botão de editar para quem não tem permissão
  if (!window.temPermissao('modules.calendario.edit')) {
    const editBtn = document.getElementById('editToggleBtn');
    if (editBtn) editBtn.style.display = 'none';
  }

  injetarNavCalendario(isAdmin);
  loadCalendario(_calEscritorio);
});

function switchEscritorio(esc) {
  _calEscritorio = esc;
  document.querySelectorAll('.esc-btn').forEach(b => {
    b.classList.toggle('esc-active', b.dataset.e === esc);
  });
  if (window._calUnsubscribe) window._calUnsubscribe();
  loadCalendario(esc);
}

function loadCalendario(escritorio) {
  _calEscritorio = escritorio;
  const nomeEscritorio = (_ESCR_MAP[escritorio] && _ESCR_MAP[escritorio].nome) || escritorio;
  const nomeMes = NOMES_MES[_calMes - 1];

  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = 'Calendário — ' + nomeEscritorio;
  document.getElementById('pageSubtitle').textContent =
    nomeMes + ' ' + _calAno + ' · Escritório de ' + nomeEscritorio;

  CALENDAR_ID = calDocId(escritorio, _calAno, _calMes);
  docRef = window.CalendarioService.proxy(CALENDAR_ID);

  // Limpar estado imediatamente para não mostrar dados do mês anterior enquanto carrega
  departments = departments.map(d => ({ ...d, data: Array(31).fill(0) }));
  events = [];
  selDay = null;

  atualizarCssNumDias();
  render();
  startRealtimeSync();
}
