// ══════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════

const NOMES_MES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ESCRITORIOS_VALIDOS: obtido dinamicamente via window.loadEscritorios() no authReady

// Feriados nacionais — estrutura base por ano
// Para anos diferentes o Carnaval/Páscoa/Corpo de Deus mudam
const FERIADOS_FIXOS = [
  { mes:1,  dia:1,  label:'Ano Novo' },
  { mes:4,  dia:25, label:'Dia da Liberdade' },
  { mes:5,  dia:1,  label:'Dia do Trabalhador' },
  { mes:6,  dia:10, label:'Dia de Portugal' },
  { mes:8,  dia:15, label:'Assunção de Nossa Senhora' },
  { mes:10, dia:5,  label:'Implantação da República' },
  { mes:11, dia:1,  label:'Todos os Santos' },
  { mes:12, dia:1,  label:'Restauração da Independência' },
  { mes:12, dia:8,  label:'Imaculada Conceição' },
  { mes:12, dia:25, label:'Natal' },
];

// Cálculo da Páscoa (algoritmo de Butcher)
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const mes = Math.floor((h + l - 7*m + 114) / 31);
  const dia = ((h + l - 7*m + 114) % 31) + 1;
  return { mes, dia };
}

function feriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano);
  const dt = new Date(ano, pascoa.mes - 1, pascoa.dia);

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return { mes: r.getMonth() + 1, dia: r.getDate() };
  }

  return [
    { ...addDays(dt, -47), label: 'Carnaval' },
    { ...addDays(dt, -2),  label: 'Sexta-Feira Santa' },
    { ...pascoa,           label: 'Páscoa' },
    { ...addDays(dt, 60),  label: 'Corpo de Deus' },
  ];
}

function feriadosDoAno(ano) {
  return [...FERIADOS_FIXOS, ...feriadosMoveis(ano)]
    .sort((a, b) => a.mes !== b.mes ? a.mes - b.mes : a.dia - b.dia);
}

// ══════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════════════

let db;
let verDados = [];
let eventosPendentes = [];

document.addEventListener('authReady', () => {
  window.renderNavbar('gerir-calendarios');

  if (!window.isAdmin()) {
    document.querySelector('.page').innerHTML =
      '<div style="text-align:center;padding:80px 20px;font-size:13px;color:var(--muted);">Acesso restrito a administradores.</div>';
    return;
  }

  db = firebase.firestore();
  preencherSelects();

  // Carregar escritórios dinamicamente
  window.loadEscritorios().then(lista => {
    const checkHtml = lista.map(e =>
      `<label class="ck on" onclick="toggleCk(this)"><input type="checkbox" value="${e.id}" checked>${e.nome}</label>`
    ).join('');
    ['f-escritorios','e-escritorios','a-escritorios'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = checkHtml;
    });
    const vEsc = document.getElementById('v-escritorio');
    if (vEsc) {
      vEsc.innerHTML = lista.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
    }
  });

  renderFeriadosList(parseInt(document.getElementById('f-ano').value));

  // Atualizar feriados quando o ano muda
  document.getElementById('f-ano').addEventListener('change', () => {
    renderFeriadosList(parseInt(document.getElementById('f-ano').value));
  });

  // Mostrar/esconder campo de texto no modo apagar
  document.querySelectorAll('input[name=modoApagar]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('a-textoWrap').style.display =
        document.querySelector('input[name=modoApagar]:checked').value === 'texto' ? 'block' : 'none';
    });
  });
});

// ══════════════════════════════════════════════════════
// HELPERS GERAIS
// ══════════════════════════════════════════════════════

function preencherSelects() {
  const ids = ['f-mesInicio','f-mesFim','e-mesInicio','e-mesFim','a-mesInicio','a-mesFim','v-mesInicio','v-mesFim'];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = NOMES_MES.slice(1).map((n,i) =>
      `<option value="${i+1}" ${(id.includes('Fim') ? i===11 : i===2) ? 'selected' : ''}>${n}</option>`
    ).join('');
  });
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
}

function toggleCk(el) {
  el.classList.toggle('on');
  el.querySelector('input').checked = el.classList.contains('on');
}

function getMeses(inicioId, fimId) {
  const ini = parseInt(document.getElementById(inicioId).value);
  const fim = parseInt(document.getElementById(fimId).value);
  const meses = [];
  for (let m = ini; m <= fim; m++) meses.push(m);
  return meses;
}

function getEscritorios(wrapId) {
  return [...document.querySelectorAll(`#${wrapId} .ck.on input`)].map(i => i.value);
}

function docId(esc, ano, mes) {
  return `calendario_${esc}_${ano}_${String(mes).padStart(2,'0')}`;
}

// ── Log helpers ──
function logMsg(prefix, msg, type = '') {
  const el = document.getElementById(prefix + '-log');
  const wrap = document.getElementById(prefix + '-logWrap');
  if (!el || !wrap) return;
  wrap.style.display = 'block';
  el.innerHTML += `<div class="${type}">${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}
function logClear(prefix) {
  const el = document.getElementById(prefix + '-log');
  const wrap = document.getElementById(prefix + '-logWrap');
  if (el) el.innerHTML = '';
  if (wrap) wrap.style.display = 'none';
}
function setProgress(prefix, pct) {
  const el = document.getElementById(prefix + '-progress');
  if (el) el.style.width = pct + '%';
}

// ══════════════════════════════════════════════════════
// TAB 1 — FERIADOS
// ══════════════════════════════════════════════════════

function renderFeriadosList(ano) {
  const lista = feriadosDoAno(ano);
  const wrap = document.getElementById('feriadosList');
  wrap.innerHTML = lista.map((f, i) => `
    <div class="feriado-item on" onclick="toggleFeriado(this)">
      <input type="checkbox" checked data-idx="${i}">
      <span class="feriado-dia">Dia ${f.dia}</span>
      <span class="feriado-nome">${f.label}</span>
      <span class="feriado-mes">${NOMES_MES[f.mes]}</span>
    </div>
  `).join('');
  wrap._lista = lista;
}

function toggleFeriado(el) {
  el.classList.toggle('on');
  el.querySelector('input').checked = el.classList.contains('on');
}

function selecionarTodosFeriados(val) {
  document.querySelectorAll('#feriadosList .feriado-item').forEach(el => {
    el.classList.toggle('on', val);
    el.querySelector('input').checked = val;
  });
}

async function publicarFeriados() {
  const ano        = parseInt(document.getElementById('f-ano').value);
  const meses      = getMeses('f-mesInicio', 'f-mesFim');
  const escritorios = getEscritorios('f-escritorios');
  const substituir = document.getElementById('f-substituir').classList.contains('on');

  if (!escritorios.length) { toast('Seleciona pelo menos um escritório.'); return; }

  // Feriados selecionados
  const todosF = document.getElementById('feriadosList')._lista || feriadosDoAno(ano);
  const selecionados = [...document.querySelectorAll('#feriadosList .feriado-item.on')]
    .map(el => todosF[parseInt(el.querySelector('input').dataset.idx)]);

  if (!selecionados.length) { toast('Seleciona pelo menos um feriado.'); return; }

  const btn = document.getElementById('f-btnPublicar');
  btn.disabled = true;
  logClear('f');
  setProgress('f', 0);

  const total = escritorios.length * meses.length;
  let done = 0;

  try {
  logMsg('f', `▶ A publicar ${selecionados.length} feriado(s) em ${total} documento(s)…`, 'info');

  for (const esc of escritorios) {
    for (const mes of meses) {
      const feriadosMes = selecionados
        .filter(f => f.mes === mes)
        .map(f => ({ dayFrom: f.dia, dayTo: f.dia, label: f.label, deptId: '', pinned: true }));

      const id  = docId(esc, ano, mes);
      const ref = db.collection('calendarios').doc(id);

      try {
        const snap = await ref.get();

        if (snap.exists) {
          const data = snap.data();
          const base = substituir ? [] : (data.events || []).filter(ev => ev.deptId !== '');
          const deptsEv = substituir ? [] : (data.events || []).filter(ev => ev.deptId === '');
          // Juntar: remover feriados antigos (deptId='') e adicionar novos
          const evFinais = substituir
            ? [...(data.events||[]).filter(ev => ev.deptId !== ''), ...feriadosMes]
            : [...(data.events||[]).filter(ev => ev.deptId !== ''), ...feriadosMes];
          await ref.update({ events: evFinais, updatedAt: Date.now() });
          logMsg('f', `✓ ${id} — ${feriadosMes.length} feriado(s)${feriadosMes.length === 0 ? ' (mês sem feriados, ignorado)' : ''}`, feriadosMes.length ? 'ok' : 'warn');
        } else {
          if (!feriadosMes.length) {
            logMsg('f', `· ${id} — sem feriados neste mês, ignorado`, 'warn');
          } else {
            const defaultDepts = defaultDepartamentos();
            await ref.set({ departments: defaultDepts, events: feriadosMes, updatedAt: Date.now() });
            logMsg('f', `✓ ${id} — criado com ${feriadosMes.length} feriado(s)`, 'ok');
          }
        }
      } catch(e) {
        logMsg('f', `✗ ${id} — ERRO: ${e.message}`, 'err');
      }

      done++;
      setProgress('f', Math.round(done / total * 100));
    }
  }

  logMsg('f', `✔ Concluído! ${done} documento(s) processado(s).`, 'info');
  } catch(e) {
    logMsg('f', `✗ Erro inesperado: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
// TAB 2 — PUBLICAR EVENTOS
// ══════════════════════════════════════════════════════

function adicionarEvento() {
  const diaIni = parseInt(document.getElementById('e-diaInicio').value);
  const diaFimV = document.getElementById('e-diaFim').value.trim();
  const diaFim = diaFimV ? parseInt(diaFimV) : diaIni;
  const label  = document.getElementById('e-label').value.trim();
  const pinned = document.getElementById('e-pinToggle').classList.contains('on');

  if (!diaIni || diaIni < 1 || diaIni > 31) { toast('Dia de início inválido (1–31).'); return; }
  if (diaFim < diaIni || diaFim > 31) { toast('Dia de fim inválido.'); return; }
  if (!label) { toast('Introduz uma descrição para o evento.'); return; }

  const mesesFiltro = [...document.querySelectorAll('#e-mesesEsp .ck.on input')]
    .map(i => parseInt(i.value));

  eventosPendentes.push({ dayFrom: diaIni, dayTo: diaFim, label, pinned, deptId: '', mesesFiltro });

  document.getElementById('e-diaInicio').value = '';
  document.getElementById('e-diaFim').value = '';
  document.getElementById('e-label').value = '';
  document.getElementById('e-pinToggle').classList.remove('on');
  document.querySelectorAll('#e-mesesEsp .ck').forEach(el => {
    el.classList.remove('on');
    el.querySelector('input').checked = false;
  });

  renderEvenrosPendentes();
}

function removerEvento(i) {
  eventosPendentes.splice(i, 1);
  renderEvenrosPendentes();
}

function renderEvenrosPendentes() {
  const wrap = document.getElementById('e-evList');
  if (!eventosPendentes.length) {
    wrap.innerHTML = '<div class="empty-msg">Nenhum evento adicionado.</div>';
    return;
  }
  wrap.innerHTML = eventosPendentes.map((ev, i) => {
    const range = ev.dayFrom === ev.dayTo ? `Dia ${ev.dayFrom}` : `Dia ${ev.dayFrom}–${ev.dayTo}`;
    const mesesStr = ev.mesesFiltro.length
      ? ev.mesesFiltro.map(m => NOMES_MES[m].slice(0,3)).join(', ')
      : 'Todos os meses';
    return `
      <div class="ev-pill">
        <div class="ev-dot" style="background:${ev.pinned ? 'var(--purple)' : 'var(--accent)'}"></div>
        <span class="ev-label">${ev.label}${ev.pinned ? ' 📌' : ''}</span>
        <span class="ev-range">${range} · ${mesesStr}</span>
        <button class="ev-del" onclick="removerEvento(${i})">×</button>
      </div>`;
  }).join('');
}

async function publicarEventos() {
  if (!eventosPendentes.length) { toast('Adiciona pelo menos um evento antes de publicar.'); return; }

  const ano        = parseInt(document.getElementById('e-ano').value);
  const meses      = getMeses('e-mesInicio', 'e-mesFim');
  const escritorios = getEscritorios('e-escritorios');
  const substituir = document.getElementById('e-substituir').classList.contains('on');

  if (!escritorios.length) { toast('Seleciona pelo menos um escritório.'); return; }

  const btn = document.getElementById('e-btnPublicar');
  btn.disabled = true;
  logClear('e');
  setProgress('e', 0);

  const total = escritorios.length * meses.length;
  let done = 0;

  try {
  logMsg('e', `▶ A publicar em ${total} documento(s)…`, 'info');

  for (const esc of escritorios) {
    for (const mes of meses) {
      const evDoMes = eventosPendentes
        .filter(ev => !ev.mesesFiltro.length || ev.mesesFiltro.includes(mes))
        .map(({ dayFrom, dayTo, label, pinned, deptId }) => ({ dayFrom, dayTo, label, pinned, deptId }));

      const id  = docId(esc, ano, mes);
      const ref = db.collection('calendarios').doc(id);

      try {
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data();
          const base = substituir ? [] : (data.events || []);
          const novos = evDoMes.filter(ne =>
            !base.some(e => e.label === ne.label && e.dayFrom === ne.dayFrom)
          );
          await ref.update({ events: [...base, ...novos], updatedAt: Date.now() });
          logMsg('e', `✓ ${id} — ${novos.length} evento(s) adicionado(s)`, 'ok');
        } else {
          await ref.set({ departments: defaultDepartamentos(), events: evDoMes, updatedAt: Date.now() });
          logMsg('e', `✓ ${id} — criado com ${evDoMes.length} evento(s)`, 'ok');
        }
      } catch(e) {
        logMsg('e', `✗ ${id} — ERRO: ${e.message}`, 'err');
      }

      done++;
      setProgress('e', Math.round(done / total * 100));
    }
  }

  logMsg('e', `✔ Concluído! ${done} documento(s) processado(s).`, 'info');
  } catch(e) {
    logMsg('e', `✗ Erro inesperado: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
// TAB 3 — APAGAR EVENTOS
// ══════════════════════════════════════════════════════

async function apagarEventos() {
  const ano        = parseInt(document.getElementById('a-ano').value);
  const meses      = getMeses('a-mesInicio', 'a-mesFim');
  const escritorios = getEscritorios('a-escritorios');
  const modo       = document.querySelector('input[name=modoApagar]:checked').value;
  const textoFiltro = document.getElementById('a-texto').value.trim().toLowerCase();

  if (!escritorios.length) { toast('Seleciona pelo menos um escritório.'); return; }
  if (modo === 'texto' && !textoFiltro) { toast('Introduz o texto a pesquisar.'); return; }

  const confirmMsg = modo === 'tudo'
    ? `Apagar TODOS os eventos de ${escritorios.length} escritório(s) × ${meses.length} mês(es)?\n\nEsta operação não pode ser desfeita.`
    : modo === 'feriados'
    ? `Apagar todos os feriados/eventos gerais de ${escritorios.length} escritório(s) × ${meses.length} mês(es)?`
    : `Apagar eventos que contenham "${textoFiltro}" de ${escritorios.length} escritório(s) × ${meses.length} mês(es)?`;

  if (!await confirmar({ titulo: confirmMsg, btnOk: 'Apagar', perigo: true })) return;

  const btn = document.getElementById('a-btnApagar');
  btn.disabled = true;
  logClear('a');
  setProgress('a', 0);

  const total = escritorios.length * meses.length;
  let done = 0;
  let totalApagados = 0;

  try {
  logMsg('a', `▶ Modo: ${modo === 'tudo' ? 'Apagar tudo' : modo === 'feriados' ? 'Só feriados' : `Texto: "${textoFiltro}"`}`, 'info');

  for (const esc of escritorios) {
    for (const mes of meses) {
      const id  = docId(esc, ano, mes);
      const ref = db.collection('calendarios').doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) {
          logMsg('a', `· ${id} — documento não existe, ignorado`, 'warn');
        } else {
          const data = snap.data();
          const eventos = data.events || [];
          let novosEventos;

          if (modo === 'tudo') {
            novosEventos = [];
          } else if (modo === 'feriados') {
            novosEventos = eventos.filter(ev => ev.deptId && ev.deptId !== '');
          } else {
            novosEventos = eventos.filter(ev => !ev.label.toLowerCase().includes(textoFiltro));
          }

          const nApagados = eventos.length - novosEventos.length;
          totalApagados += nApagados;

          await ref.update({ events: novosEventos, updatedAt: Date.now() });
          logMsg('a', `✓ ${id} — ${nApagados} evento(s) removido(s) (${novosEventos.length} restante(s))`, nApagados > 0 ? 'ok' : 'warn');
        }
      } catch(e) {
        logMsg('a', `✗ ${id} — ERRO: ${e.message}`, 'err');
      }

      done++;
      setProgress('a', Math.round(done / total * 100));
    }
  }

  logMsg('a', `✔ Concluído! ${totalApagados} evento(s) apagado(s) em ${done} documento(s).`, 'info');
  } catch(e) {
    logMsg('a', `✗ Erro inesperado: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
// TAB 4 — VER / PESQUISAR
// ══════════════════════════════════════════════════════

async function carregarVer() {
  const esc   = document.getElementById('v-escritorio').value;
  const ano   = parseInt(document.getElementById('v-ano').value);
  const meses = getMeses('v-mesInicio', 'v-mesFim');
  const wrap  = document.getElementById('v-resultados');

  wrap.innerHTML = '<p style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0;">A carregar…</p>';
  verDados = [];

  for (const mes of meses) {
    const id  = docId(esc, ano, mes);
    const ref = db.collection('calendarios').doc(id);
    try {
      const snap = await ref.get();
      verDados.push({
        id,
        mes,
        exists: snap.exists,
        events: snap.exists ? (snap.data().events || []) : [],
      });
    } catch(e) {
      verDados.push({ id, mes, exists: false, events: [], erro: e.message });
    }
  }

  renderVerResultados();
}

function renderVerResultados() {
  const wrap   = document.getElementById('v-resultados');
  const filtro = document.getElementById('v-filtro').value.trim().toLowerCase();

  if (!verDados.length) {
    wrap.innerHTML = '<p style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0;">Faz uma pesquisa primeiro.</p>';
    return;
  }

  wrap.innerHTML = verDados.map(doc => {
    const evsFiltrados = filtro
      ? doc.events.filter(ev => ev.label.toLowerCase().includes(filtro))
      : doc.events;

    const nomeDoc = `${NOMES_MES[doc.mes]}`;
    const badge = doc.exists
      ? `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;">${evsFiltrados.length} evento(s)</span>`
      : `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:#f4f4f6;color:#aaa;border:1px solid #e2e2e8;">Sem documento</span>`;

    const evHtml = evsFiltrados.length
      ? evsFiltrados.sort((a,b) => a.dayFrom - b.dayFrom).map(ev => {
          const range = ev.dayFrom === ev.dayTo ? `Dia ${ev.dayFrom}` : `Dia ${ev.dayFrom}–${ev.dayTo}`;
          const dept  = ev.deptId ? `<span style="font-size:9px;color:var(--accent);">${ev.deptId}</span>` : `<span style="font-size:9px;color:var(--muted);">geral</span>`;
          return `<div class="inline-ev">
            <span class="inline-ev-day">${range}</span>
            <span class="inline-ev-label">${ev.label}${ev.pinned ? ' 📌' : ''}</span>
            ${dept}
          </div>`;
        }).join('')
      : '<div style="font-size:10px;color:#bbb;padding:6px 0;">Sem eventos' + (filtro ? ' com esse filtro' : '') + '.</div>';

    return `
      <div class="doc-item" onclick="toggleDocItem(this)">
        <span class="doc-name">${nomeDoc} <span style="font-size:9px;color:var(--muted);">${doc.id}</span></span>
        ${badge}
        <span class="doc-chevron">›</span>
      </div>
      <div class="doc-events">${evHtml}</div>`;
  }).join('');
}

function toggleDocItem(el) {
  el.classList.toggle('open');
}

// ══════════════════════════════════════════════════════
// HELPER — estrutura padrão de departamentos
// ══════════════════════════════════════════════════════

function defaultDepartamentos() {
  return [
    { id:'conta',   name:'Contabilidade', colors:['#d4d4d8','#e8b4b4','#d97777','#c44040','#a81a1a','#6e0808'], data: Array(31).fill(0) },
    { id:'payroll', name:'Payroll / RH',  colors:['#d4d4d8','#a8b8d8','#5f85c0','#2d5fa8','#163d80','#0a1f4a'], data: Array(31).fill(0) },
  ];
}