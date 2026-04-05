let users = [];
let roleFilter = '';
let escritorioFilter = '';
let searchFilter = '';

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

    fecharModalNovo();
    toast('Conta criada com sucesso para ' + email + '.');
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

  setStatus('A ligar...', '#f59e0b');

  window.loadEscritorios({ includeInactive: true }).then(() => {
    renderOfficeOptions();
  });

  const unsubscribe = window.UsersService.listenAll({
    limit: 500,
    onData(nextUsers) {
      users = nextUsers;
      renderUsers();
      setStatus('Sincronizado - ' + users.length + ' doc(s) no Firestore', '#16a34a');
      setTimeout(() => setStatus(''), 5000);
    },
    onError(err) {
      console.error('[utilizadores] Erro no onSnapshot:', err);
      setStatus('Erro ao carregar: ' + err.code, '#dc2626');
    },
  });

  window._utilUnsub = unsubscribe;
  window.addEventListener('beforeunload', () => {
    if (window._utilUnsub) window._utilUnsub();
  }, { once: true });
});
