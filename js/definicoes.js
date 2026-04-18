const CORES = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#374151',
  '#6366f1', '#059669', '#ea580c', '#9333ea',
];

let paineis = { Aparencia: false, Utilizadores: false, Escritorios: false };

const THEME_PRESETS = [
  { id: 'default', label: 'Azul clean',       accent: '#0284c7', bg: '#f1f5f9' },
  { id: 'forest',  label: 'Verde atlântico',  accent: '#0f766e', bg: '#f0fffe' },
  { id: 'sunset',  label: 'Terracota',        accent: '#c2410c', bg: '#fefaf5' },
  { id: 'violet',  label: 'Violeta',          accent: '#7c3aed', bg: '#faf8ff' },
];
let escritoriosData = [];
let utilizadoresAll = [];
let escEditandoId = null;
let escApagarId = null;
let corSel = CORES[0];

function ordenarEscritorios() {
  escritoriosData = (window.OfficesService ? window.OfficesService.normalizeList(escritoriosData) : escritoriosData.slice());
}

window.bootProtectedPage({
  activePage: 'definicoes',
  moduleId: 'definicoes',
  requireAdmin: true,
  onDenied() {
    document.querySelector('.page').innerHTML =
      '<div style="text-align:center;padding:80px 20px;font-size:13px;color:var(--muted);">Acesso restrito a administradores.</div>';
  },
}, () => {
  renderColorSwatches();

  document.getElementById('escNome').addEventListener('input', function() {
    if (!escEditandoId) {
      document.getElementById('escId').value = this.value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharModal();
    if (e.key === 'Enter' && document.getElementById('modalEscritorio').classList.contains('open')) {
      guardarEscritorio();
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) fecharModal(); })
  );
});

function togglePainel(nome) {
  const jaAberto = paineis[nome];
  Object.keys(paineis).forEach(k => {
    paineis[k] = false;
    document.getElementById('panel' + k).classList.remove('open');
    document.getElementById('card' + k).classList.remove('active');
  });

  if (!jaAberto) {
    paineis[nome] = true;
    document.getElementById('panel' + nome).classList.add('open');
    document.getElementById('card' + nome).classList.add('active');
    setTimeout(() => document.getElementById('panel' + nome).scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    if (nome === 'Aparencia') carregarAparencia();
    if (nome === 'Utilizadores') carregarUtilizadores();
    if (nome === 'Escritorios') carregarEscritorios();
  }
}

function carregarAparencia() {
  renderAparencia();
}

function renderAparencia() {
  const body = document.getElementById('aparenciaBody');
  const temaAtual = document.documentElement.getAttribute('data-theme') || 'default';
  const dark = document.documentElement.classList.contains('dark');

  body.innerHTML = `
    <p class="field-label" style="margin-bottom:10px;">Tema de cor</p>
    <div class="tema-grid">
      ${THEME_PRESETS.map(t => `
        <button class="tema-card ${t.id === temaAtual ? 'sel' : ''}" onclick="definirTema('${t.id}')">
          <div class="tema-swatches">
            <div class="tema-swatch" style="background:${t.accent};"></div>
            <div class="tema-swatch" style="background:${t.bg};border:1px solid #d1d5db;"></div>
          </div>
          <div class="tema-label">${t.label}</div>
          ${t.id === temaAtual ? '<div class="tema-check">✓</div>' : ''}
        </button>`).join('')}
    </div>
    <p class="field-label" style="margin-top:20px;margin-bottom:10px;">Modo de visualização</p>
    <div class="toggle-dark-row ${dark ? 'on' : ''}" onclick="toggleModoEscuro()">
      <div class="toggle-dark-track"><div class="toggle-dark-thumb"></div></div>
      <span class="toggle-dark-label">${dark ? 'Modo escuro ativo' : 'Modo claro ativo'}</span>
      <span style="font-size:18px;line-height:1;">${dark ? '🌙' : '☀️'}</span>
    </div>`;
}

async function definirTema(id) {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  if (id === 'default') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', id);
  try {
    await window.db.collection('utilizadores').doc(uid).update({ 'preferencias.dashboard.themePreset': id });
  } catch(e) { /* silently ignore */ }
  renderAparencia();
  toast('Tema aplicado');
}

function toggleModoEscuro() {
  if (window.toggleDarkMode) window.toggleDarkMode();
  renderAparencia();
}

async function carregarUtilizadores() {
  const body = document.getElementById('utilizadoresBody');
  try {
    utilizadoresAll = await window.UsersService.listAll();
    const users = utilizadoresAll
      .slice()
      .sort((a, b) => (a.nomeCompleto || a.nome || '').localeCompare((b.nomeCompleto || b.nome || ''), 'pt-PT'));

    if (!users.length) {
      body.innerHTML = '<p style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0;">Sem utilizadores.</p>';
      return;
    }

    body.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Nome</th><th>Email</th><th>Escritorio</th><th>Role</th><th>Estado</th></tr></thead>
          <tbody>${users.map(u => `
            <tr>
              <td>${u.nomeCompleto || u.nome || '-'}</td>
              <td style="color:var(--muted);">${u.email || '-'}</td>
              <td style="text-transform:capitalize;">${window.nomeEscritorio ? window.nomeEscritorio(u.escritorio) : (u.escritorio || '-')}</td>
              <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-colab'}">${u.role === 'admin' ? 'Admin' : 'Colaborador'}</span></td>
              <td><span class="badge ${u.ativo !== false ? 'badge-ativo' : 'badge-inativo'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px;text-align:right;">
        <a href="utilizadores.html" class="btn btn-primary">Gerir utilizadores -></a>
      </div>`;
  } catch (e) {
    body.innerHTML = `<p style="font-size:11px;color:#dc2626;text-align:center;padding:16px 0;">Erro: ${e.message}</p>`;
  }
}

async function carregarEscritorios() {
  const wrap = document.getElementById('escritoriosList');
  wrap.innerHTML = '<p style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0;">A carregar...</p>';

  try {
    escritoriosData = await window.OfficesService.load({ includeInactive: true });
    utilizadoresAll = utilizadoresAll.length ? utilizadoresAll : await window.UsersService.listAll();
  } catch (e) {
    escritoriosData = window.OfficesService ? window.OfficesService.DEFAULT_OFFICES.slice() : [];
  }

  ordenarEscritorios();
  renderLista();
}

function renderLista() {
  const wrap = document.getElementById('escritoriosList');
  if (!wrap) return;

  if (!escritoriosData.length) {
    wrap.innerHTML = '<p style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0;">Nenhum escritorio.</p>';
    return;
  }

  wrap.innerHTML = escritoriosData.map(esc => {
    const n = utilizadoresAll.filter(u => u.escritorio === esc.id).length;
    return `
      <div class="esc-row">
        <div class="esc-dot" style="background:${esc.cor || '#aaa'};"></div>
        <span class="esc-nome">${esc.nome}</span>
        <span class="esc-id">${esc.id}</span>
        <span class="esc-users">${esc.ativo !== false ? 'ativo' : 'inativo'} · ordem ${esc.ordem}</span>
        <span class="esc-users">${n} utilizador${n !== 1 ? 'es' : ''}</span>
        <div class="esc-actions">
          <button class="btn btn-secondary btn-sm" onclick='abrirEditar(${JSON.stringify(esc)})'>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><path d="M11 2.5l2 2L5 13H3v-2L11 2.5z"/></svg>
            Editar
          </button>
          ${!esc.default ? `
          <button class="btn btn-danger btn-sm" onclick="pedirApagar('${esc.id}','${esc.nome}',${n})">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><path d="M3 5h10l-1 9H4L3 5z"/><path d="M1 5h14M6 5V3h4v2"/></svg>
            Apagar
          </button>` : '<span style="font-size:9px;color:#bbb;padding:0 6px;">base</span>'}
        </div>
      </div>`;
  }).join('');
}

function abrirModalNovo() {
  escEditandoId = null;
  document.getElementById('modalTitulo').textContent = 'Novo Escritorio';
  document.getElementById('escNome').value = '';
  document.getElementById('escId').value = '';
  document.getElementById('escId').readOnly = false;
  document.getElementById('escAtivo').checked = true;
  document.getElementById('escOrdem').value = escritoriosData.length
    ? Math.max(...escritoriosData.map(e => e.ordem || 0)) + 10
    : 10;
  corSel = CORES[0];
  renderColorSwatches();
  document.getElementById('modalEscritorio').classList.add('open');
  setTimeout(() => document.getElementById('escNome').focus(), 80);
}

function abrirEditar(esc) {
  escEditandoId = esc.id;
  document.getElementById('modalTitulo').textContent = 'Editar Escritorio';
  document.getElementById('escNome').value = esc.nome;
  document.getElementById('escId').value = esc.id;
  document.getElementById('escId').readOnly = true;
  document.getElementById('escAtivo').checked = esc.ativo !== false;
  document.getElementById('escOrdem').value = esc.ordem || 10;
  corSel = esc.cor || CORES[0];
  renderColorSwatches();
  document.getElementById('modalEscritorio').classList.add('open');
  setTimeout(() => document.getElementById('escNome').focus(), 80);
}

async function guardarEscritorio() {
  const nome = document.getElementById('escNome').value.trim();
  const id = document.getElementById('escId').value.trim().toLowerCase();
  const ativo = document.getElementById('escAtivo').checked;
  const ordem = parseInt(document.getElementById('escOrdem').value, 10);

  if (!nome) { toast('Introduz o nome do escritorio.'); return; }
  if (!id || !/^[a-z0-9]+$/.test(id)) { toast('O ID so pode ter letras minusculas e numeros, sem espacos.'); return; }
  if (!Number.isFinite(ordem)) { toast('Define uma ordem numerica valida.'); return; }

  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = 'A guardar...';

  try {
    if (!escEditandoId && escritoriosData.find(e => e.id === id)) {
      toast('Ja existe um escritorio com esse ID.');
      btn.disabled = false;
      btn.textContent = 'Guardar';
      return;
    }

    escritoriosData = await window.OfficesService.upsert({
      id: escEditandoId || id,
      nome,
      cor: corSel,
      ativo,
      ordem,
      default: escritoriosData.find(e => e.id === (escEditandoId || id) && e.default === true) ? true : false,
    });
    fecharModal();
    renderLista();
  } catch (e) {
    toast('Erro ao guardar: ' + e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Guardar';
}

function pedirApagar(id, nome, nUsers) {
  escApagarId = id;
  let msg = `Tens a certeza que queres apagar o escritorio <b>${nome}</b>?`;
  if (nUsers > 0) {
    msg += `<br><br><span style="color:#dc2626;">Tem <b>${nUsers} utilizador(es)</b> associado(s). O campo escritorio deles ficara vazio.</span>`;
  }
  document.getElementById('confirmarTexto').innerHTML = msg;
  document.getElementById('modalConfirmar').classList.add('open');
}

async function confirmarApagar() {
  if (!escApagarId) return;
  const btn = document.getElementById('btnConfirmar');
  btn.disabled = true;

  try {
    escritoriosData = await window.OfficesService.remove(escApagarId);
    utilizadoresAll = await window.UsersService.listAll();
    fecharModal();
    renderLista();
  } catch (e) {
    toast('Erro ao apagar: ' + e.message);
  }

  btn.disabled = false;
  escApagarId = null;
}

function renderColorSwatches() {
  document.getElementById('colorSwatches').innerHTML = CORES.map(c => `
    <div class="swatch ${c === corSel ? 'selected' : ''}" style="background:${c};" onclick="selecionarCor('${c}')"></div>
  `).join('');
}

function selecionarCor(c) {
  corSel = c;
  renderColorSwatches();
}

function fecharModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  escEditandoId = null;
}
