let users = [];
let roleFilter = '';
let escritorioFilter = '';
let searchFilter = '';

// ── Cache de utilizadores ─────────────────────────────────────────────────────
// Página admin: usada com pouca frequência; .get() único é suficiente.
// O botão "↺ Atualizar" força nova leitura quando necessário.
const _utilCache = { ts: 0 };
const UTIL_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function _utilCacheValid() {
  return users.length > 0 && (Date.now() - _utilCache.ts) < UTIL_CACHE_TTL;
}

function carregarUtilizadores() {
  if (_utilCacheValid()) {
    renderUsers();
    setStatus('✓ ' + users.length + ' utilizador(es) — cache', '#16a34a');
    setTimeout(() => setStatus(''), 3000);
    return;
  }
  setStatus('A carregar…', '#f59e0b');
  window.UsersService.listAll()
    .then(nextUsers => {
      users = nextUsers;
      _utilCache.ts = Date.now();
      renderUsers();
      setStatus('✓ ' + users.length + ' utilizador(es)', '#16a34a');
      setTimeout(() => setStatus(''), 3000);
    })
    .catch(err => {
      console.error('[utilizadores] Erro ao carregar:', err);
      setStatus('Erro ao carregar: ' + (err.code || err.message), '#dc2626');
    });
}

function refreshUtilizadores() {
  _utilCache.ts = 0; // invalidar cache
  carregarUtilizadores();
}

const PERMS_DEF = (window.getPermissionDefinitions ? window.getPermissionDefinitions() : [])
  .filter(def => ![
    'modules.tarefas.view',
    'modules.comunicados.view',
    'modules.calendario.view',
    'modules.admissoes.view',
    'modules.reclamacoes.view',
    'modules.escalas.view',
    'modules.utilizadores.manage',
    'modules.definicoes.manage',
    'modules.gerir-calendarios.manage',
    'modules.auditoria.view',
  ].includes(def.key));

function fmtDateShort(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function setRoleFilter(v) {
  roleFilter = v || '';
  renderUsers();
}

function setEscritorioFilter(v) {
  escritorioFilter = v || '';
  renderUsers();
}

function setSearch(v) {
  searchFilter = (v || '').toLowerCase().trim();
  renderUsers();
}

function filteredUsers() {
  let list = users.slice();
  if (roleFilter) list = list.filter(u => u.role === roleFilter);
  if (escritorioFilter) list = list.filter(u => u.escritorio === escritorioFilter);
  if (searchFilter) {
    list = list.filter(u =>
      (u.nomeCompleto || u.nome || '').toLowerCase().includes(searchFilter) ||
      (u.email || '').toLowerCase().includes(searchFilter)
    );
  }
  return list;
}

async function updateUser(uid, patch) {
  try {
    await window.UsersService.update(uid, patch);
    toast('Alteracoes guardadas.');
  } catch (e) {
    console.error(e);
    toast('Erro ao guardar alteracoes.');
  }
}

function togglePerms(uid) {
  const row = document.getElementById('permsRow_' + uid);
  const btn = document.getElementById('btnPerms_' + uid);
  if (!row) return;

  const isOpen = row.classList.contains('open');
  document.querySelectorAll('.perms-row.open').forEach(r => r.classList.remove('open'));
  document.querySelectorAll('.btn-perms.active').forEach(b => b.classList.remove('active'));

  if (!isOpen) {
    row.classList.add('open');
    if (btn) btn.classList.add('active');
  }
}

async function setPermissao(uid, perm, val) {
  const item = document.getElementById('permItem_' + uid + '_' + perm);
  if (item) item.classList.toggle('on', val);

  try {
    await window.UsersService.setPermission(uid, perm, val);
    toast('Permissao ' + (val ? 'ativada' : 'removida') + '.');
  } catch (e) {
    console.error(e);
    toast('Erro ao atualizar permissao.');
  }
}

function renderOfficeOptions() {
  const offices = window.getEscritoriosSync ? window.getEscritoriosSync({ includeInactive: true }) : [];

  const filtro = document.getElementById('escritorioFilter');
  if (filtro) {
    filtro.innerHTML = '<option value="">Todos os escritorios</option>' +
      offices.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
    if (escritorioFilter) filtro.value = escritorioFilter;
  }

  const novoEsc = document.getElementById('newEscritorio');
  if (novoEsc) {
    novoEsc.innerHTML = '<option value="">Selecionar...</option>' +
      offices.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  }

  document.querySelectorAll('select[data-escritorio-select]').forEach(sel => {
    const uid = sel.getAttribute('data-escritorio-select');
    const user = users.find(item => item.uid === uid);
    const atual = user && user.escritorio ? user.escritorio : '';
    sel.innerHTML = '<option value="">-</option>' +
      offices.map(e => `<option value="${e.id}" ${atual === e.id ? 'selected' : ''}>${e.nome}</option>`).join('');
  });
}

function renderUsers() {
  const tbody = document.getElementById('usersTbody');
  const countBadge = document.getElementById('countBadge');
  if (!tbody || !countBadge) return;

  const meUid = window.currentUser ? window.currentUser.uid : null;
  const list = filteredUsers().sort((a, b) => {
    const na = (a.nomeCompleto || a.nome || a.email || '').toLowerCase();
    const nb = (b.nomeCompleto || b.nome || b.email || '').toLowerCase();
    return na.localeCompare(nb, 'pt-PT');
  });

  countBadge.textContent = list.length + ' utilizador' + (list.length !== 1 ? 'es' : '');

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum utilizador encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  list.forEach(u => {
    const tr = document.createElement('tr');
    if (u.uid === meUid) tr.classList.add('me-row');

    const nome = u.nomeCompleto || u.nome || '';
    const email = u.email || '';
    const role = u.role || 'colaborador';
    const ativo = u.ativo !== false;

    tr.innerHTML = `
      <td>
        <div class="name-cell">${escHtml(nome || email)}</div>
        <div class="email-cell">${escHtml(email)}</div>
      </td>
      <td>
        <select class="select-small" data-escritorio-select="${u.uid}" onchange="updateUser('${u.uid}', { escritorio: this.value })">
          <option value="">-</option>
        </select>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="chip-role ${role === 'admin' ? 'chip-admin' : 'chip-colab'}">
            ${role === 'admin' ? 'Admin' : 'Colaborador'}
          </span>
          <select class="select-small" onchange="updateUser('${u.uid}', { role: this.value })">
            <option value="colaborador" ${role === 'colaborador' ? 'selected' : ''}>Colaborador</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="toggle ${ativo ? 'on' : ''}">
            <div class="toggle-thumb"></div>
          </div>
          ${ativo
            ? '<span class="chip-ativo">Ativo</span>'
            : (Date.now() - (u.criadoEm || 0) < 7 * 24 * 60 * 60 * 1000
                ? '<span class="chip-pendente">Pendente</span>'
                : '<span class="chip-inativo">Inativo</span>')
          }
        </div>
      </td>
      <td>
        <div>${fmtDateShort(u.ultimoAcesso)}</div>
      </td>
      <td>
        <button class="btn-perms" id="btnPerms_${u.uid}" onclick="togglePerms('${u.uid}')">Config</button>
      </td>
    `;

    const toggle = tr.querySelector('.toggle');
    toggle.onclick = () => {
      const novo = !toggle.classList.contains('on');
      toggle.classList.toggle('on', novo);
      updateUser(u.uid, { ativo: novo });
    };

    tbody.appendChild(tr);

    const permsProfile = { ...u, permissoes: u.permissoes || {} };
    const trPerms = document.createElement('tr');
    trPerms.className = 'perms-row';
    trPerms.id = 'permsRow_' + u.uid;

    let innerHtml;
    if (role === 'admin') {
      innerHtml = '<span class="perm-all-badge">Admin - todas as permissoes ativas</span>';
    } else {
      innerHtml = PERMS_DEF.map(p => {
        const checked = window.temPermissaoNoPerfil ? window.temPermissaoNoPerfil(permsProfile, p.key) : false;
        return `<div class="perm-item ${checked ? 'on' : ''}" id="permItem_${u.uid}_${p.key}">
          <input type="checkbox" id="perm_${u.uid}_${p.key}" ${checked ? 'checked' : ''} onchange="setPermissao('${u.uid}','${p.key}',this.checked)">
          <label for="perm_${u.uid}_${p.key}">${p.label}</label>
        </div>`;
      }).join('');
    }

    trPerms.innerHTML = `<td colspan="6" class="perms-cell">
      <div class="perms-label">Permissoes especificas</div>
      <div class="perms-grid">${innerHtml}</div>
    </td>`;
    tbody.appendChild(trPerms);
  });

  renderOfficeOptions();
}

function abrirModalNovo() {
  document.getElementById('modalNovoUser').classList.add('open');
  document.getElementById('newNome').value = '';
  document.getElementById('newApelido').value = '';
  document.getElementById('newEmail').value = '';
  document.getElementById('newEscritorio').value = '';
  document.getElementById('newRole').value = 'colaborador';
  document.getElementById('newPassword').value = '';

  const errEl = document.getElementById('modalNovoErr');
  errEl.textContent = '';
  errEl.style.display = 'none';

  const btn = document.getElementById('btnSalvarNovo');
  btn.disabled = false;
  btn.textContent = 'Criar conta';

  renderOfficeOptions();
  document.getElementById('newNome').focus();
}

function fecharModalNovo() {
  document.getElementById('modalNovoUser').classList.remove('open');
}

async function criarUtilizador() {
  const nome = document.getElementById('newNome').value.trim();
  const apelido = document.getElementById('newApelido').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const escritorio = document.getElementById('newEscritorio').value;
  const role = document.getElementById('newRole').value;
  const password = document.getElementById('newPassword').value;
  const errEl = document.getElementById('modalNovoErr');
  const btnSalvar = document.getElementById('btnSalvarNovo');

  errEl.textContent = '';
  errEl.style.display = 'none';

  if (!nome || !email || !password) {
    errEl.textContent = 'Nome, email e password sao obrigatorios.';
    errEl.style.display = 'block';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Email invalido.';
    errEl.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'A password deve ter pelo menos 6 caracteres.';
    errEl.style.display = 'block';
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = 'A criar...';

  try {
    await window.UsersService.create({
      nome,
      apelido,
      email,
      escritorio,
      role,
      password,
    });

    _utilCache.ts = 0; // novo utilizador → forçar re-leitura
    fecharModalNovo();
    toast('Conta criada com sucesso para ' + email + '.');
    carregarUtilizadores(); // recarregar lista
  } catch (err) {
    console.error('[criarUtilizador]', err);
    const msgs = {
      'auth/email-already-in-use': 'Este email ja esta registado.',
      'auth/invalid-email': 'Email invalido.',
      'auth/weak-password': 'Password demasiado fraca.',
    };
    errEl.textContent = msgs[err.code] || ('Erro: ' + (err.message || err.code));
    errEl.style.display = 'block';
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Criar conta';
  }
}

window.bootProtectedPage({
  activePage: 'utilizadores',
  moduleId: 'utilizadores',
  requireAdmin: true,
}, ({ profile }) => {
  const me = profile ? (profile.nomeCompleto || profile.nome || profile.email || '') : '';
  const meInfo = document.getElementById('meInfo');
  if (meInfo) meInfo.textContent = 'Sessao iniciada como Admin: ' + me;

  window.loadEscritorios({ includeInactive: true }).then(() => {
    renderOfficeOptions();
  });

  // Injetar botão "↺ Atualizar" junto ao status, se ainda não existir
  setTimeout(() => {
    const statusEl = document.getElementById('statusBar') || document.querySelector('.status-bar');
    if (statusEl && !document.getElementById('btnRefreshUtil')) {
      const btn = document.createElement('button');
      btn.id = 'btnRefreshUtil';
      btn.title = 'Forçar atualização da lista';
      btn.textContent = '↺ Atualizar';
      btn.style.cssText = 'margin-left:10px;background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;color:var(--muted);font-family:inherit;';
      btn.onmouseover = () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; };
      btn.onmouseout  = () => { btn.style.borderColor = 'var(--border)';  btn.style.color = 'var(--muted)'; };
      btn.onclick = () => refreshUtilizadores();
      statusEl.appendChild(btn);
    }
  }, 500);

  // Usar .get() em vez de onSnapshot — elimina listener permanente de 500 docs
  carregarUtilizadores();
});
