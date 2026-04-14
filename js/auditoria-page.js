// ── Estado ──────────────────────────────────────────────
const db        = firebase.firestore();
const PAGE_SIZE = 50;

let todosRegistos = [];   // cache local
let filtrados     = [];   // após filtros
let lastDoc       = null; // cursor para paginação
let carregando    = false;

// ── Auth ready ──────────────────────────────────────────
document.addEventListener('authReady', async () => {
  window.renderNavbar('auditoria');
  if (!window.isAdmin()) {
    document.querySelector('.page').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p>Acesso restrito a administradores</p>
      </div>`;
    return;
  }

  // Carregar escritórios para o filtro
  const lista = await window.loadEscritorios();
  const sel = document.getElementById('filtroEscritorio');
  lista.forEach(e => {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.nome;
    sel.appendChild(o);
  });

  await carregarRegistos();
});

// ── Carregar do Firestore ────────────────────────────────
async function carregarRegistos(mais = false) {
  if (carregando) return;
  carregando = true;
  document.getElementById('loadingBar').style.display = mais ? 'none' : 'block';

  try {
    let q = db.collection('auditoria')
              .orderBy('ts', 'desc')
              .limit(PAGE_SIZE);

    if (mais && lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();

    if (!snap.empty) {
      lastDoc = snap.docs[snap.docs.length - 1];
      const novos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (mais) {
        todosRegistos = [...todosRegistos, ...novos];
      } else {
        todosRegistos = novos;
      }
    }

    document.getElementById('loadMoreWrap').style.display =
      snap.docs.length === PAGE_SIZE ? 'block' : 'none';

  } catch (err) {
    console.error('[auditoria] Erro ao carregar:', err);
    toast('Erro ao carregar registos.');
  }

  carregando = false;
  document.getElementById('loadingBar').style.display = 'none';
  aplicarFiltros();
}

async function carregarMais() {
  await carregarRegistos(true);
}

// ── Filtros ──────────────────────────────────────────────
function aplicarFiltros() {
  const modulo    = document.getElementById('filtroModulo').value;
  const acao      = document.getElementById('filtroAcao').value;
  const escritorio= document.getElementById('filtroEscritorio').value;
  const texto     = document.getElementById('filtroTexto').value.toLowerCase().trim();

  filtrados = todosRegistos.filter(r => {
    if (modulo     && r.modulo !== modulo)         return false;
    if (acao       && r.acao   !== acao)            return false;
    if (escritorio && r.escritorioDoc !== escritorio
                   && r.escritorioUser !== escritorio) return false;
    if (texto) {
      const haystack = [r.titulo, r.nomeUser, r.email, r.nota].join(' ').toLowerCase();
      if (!haystack.includes(texto)) return false;
    }
    return true;
  });

  renderStats();
  renderTimeline();
}

function limparFiltros() {
  document.getElementById('filtroModulo').value    = '';
  document.getElementById('filtroAcao').value      = '';
  document.getElementById('filtroEscritorio').value= '';
  document.getElementById('filtroTexto').value     = '';
  aplicarFiltros();
}

// ── Render Stats ─────────────────────────────────────────
function renderStats() {
  const contagens = {};
  filtrados.forEach(r => {
    contagens[r.modulo] = (contagens[r.modulo] || 0) + 1;
  });

  const { MODULO_LABELS } = window._auditoriaLabels || {};
  const labels = MODULO_LABELS || {};

  const html = [
    `<div class="stat-pill"><strong>${filtrados.length}</strong> registo(s)</div>`,
    ...Object.entries(contagens).map(([m, n]) =>
      `<div class="stat-pill"><strong>${n}</strong> ${labels[m] || m}</div>`
    )
  ].join('');

  document.getElementById('statsRow').innerHTML = html;
}

// ── Render Timeline ──────────────────────────────────────
function renderTimeline() {
  const container = document.getElementById('timeline');

  if (!filtrados.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
        <p>Nenhum registo encontrado</p>
      </div>`;
    return;
  }

  // Agrupar por data (dia)
  const grupos = {};
  filtrados.forEach(r => {
    const d = new Date(r.ts);
    const key = d.toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(r);
  });

  const { MODULO_LABELS, ACAO_LABELS } = window._auditoriaLabels || {};
  const modLabels  = MODULO_LABELS || {};
  const acaoLabels = ACAO_LABELS   || {};

  let html = '';
  Object.entries(grupos).forEach(([data, registos]) => {
    html += `<div class="tl-group">`;
    html += `<div class="tl-date">${data}</div>`;
    registos.forEach(r => {
      const hora  = new Date(r.ts).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
      const modCls = 'mod-' + (r.modulo || 'desconhecido');
      const acoaCls= 'acao-' + (r.acao   || '');
      const temDiff = r.diff && r.diff.length > 0;
      const temNota = r.nota && r.nota.trim();

      html += `
        <div class="tl-entry ${acoaCls}" id="entry_${r.id}"
             onclick="toggleEntry('${r.id}', ${temDiff || temNota})">
          <div class="tl-top">
            <span class="tl-modulo ${modCls}">${modLabels[r.modulo] || r.modulo}</span>
            <span class="tl-acao">${acaoLabels[r.acao] || r.acao}</span>
            <span class="tl-titulo" title="${escHtml(r.titulo)}">${escHtml(r.titulo) || '—'}</span>
            <span class="tl-hora">${hora}</span>
          </div>
          <div class="tl-user">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>
            </svg>
            ${escHtml(r.nomeUser || r.email)}
            ${r.escritorioUser ? `<span style="opacity:.5">· ${escHtml(r.escritorioUser)}</span>` : ''}
          </div>
          ${temDiff || temNota ? `
          <div class="tl-diff">
            ${temDiff ? `
            <table class="diff-table">
              <tr>
                <th>Campo</th>
                <th>Antes</th>
                <th>Depois</th>
              </tr>
              ${r.diff.map(d => `
              <tr>
                <td class="diff-campo">${escHtml(d.label)}</td>
                <td class="diff-antes">${formatVal(d.antes)}</td>
                <td class="diff-depois">${formatVal(d.depois)}</td>
              </tr>`).join('')}
            </table>` : ''}
            ${temNota ? `<div class="nota-badge">📝 ${escHtml(r.nota)}</div>` : ''}
          </div>` : ''}
        </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

// ── Helpers ──────────────────────────────────────────────
function toggleEntry(id, temConteudo) {
  if (!temConteudo) return;
  const el = document.getElementById('entry_' + id);
  if (el) el.classList.toggle('expanded');
}

function formatVal(v) {
  if (v === undefined || v === null || v === '—') return '<span class="diff-empty">—</span>';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return escHtml(String(v));
}



// ── Exportar CSV ─────────────────────────────────────────
function exportarCSV() {
  if (!filtrados.length) { toast('Nenhum registo para exportar.'); return; }

  const { MODULO_LABELS, ACAO_LABELS } = window._auditoriaLabels || {};
  const modL  = MODULO_LABELS  || {};
  const acaoL = ACAO_LABELS    || {};

  const linhas = [
    ['Data/Hora', 'Módulo', 'Ação', 'Documento', 'Utilizador', 'Email', 'Escritório', 'Campos alterados', 'Nota']
  ];

  filtrados.forEach(r => {
    const dt = new Date(r.ts).toLocaleString('pt-PT');
    const campos = (r.diff || []).map(d => `${d.label}: ${d.antes} → ${d.depois}`).join(' | ');
    linhas.push([
      dt,
      modL[r.modulo]  || r.modulo,
      acaoL[r.acao]   || r.acao,
      r.titulo        || r.docId,
      r.nomeUser      || '',
      r.email         || '',
      r.escritorioDoc || r.escritorioUser || '',
      campos,
      r.nota          || '',
    ]);
  });

  const csv = linhas.map(l =>
    l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✓ CSV exportado');
}
