// Atalhos locais — Firebase já foi inicializado em firebase-init.js
const auth = firebase.auth();
const db   = firebase.firestore();

function createRegisterPermissions() {
  if (typeof window.createDefaultPermissions === 'function') {
    return window.createDefaultPermissions();
  }

  return {
    modules: {
      tarefas: { view: true, create: false, resolve: false },
      comunicados: { view: true, manage: false },
      calendario: { view: true, edit: false },
      admissoes: { view: true, create: false, resolve: false },
      reclamacoes: { view: true, manage: false },
      escalas: { view: true, manage: false },
      utilizadores: { manage: false },
      definicoes: { manage: false },
      'gerir-calendarios': { manage: false },
      auditoria: { view: false }
    },
    criarTarefas: false,
    resolverTarefas: false,
    gerirComunicados: false,
    criarAdmissoes: false,
    resolverAdmissoes: false,
    editarCalendario: false,
    criarReclamacoes: false
  };
}

// Flag para impedir redirect automático durante o registo
let isRegistering = false;

// ── SE JÁ ESTÁ LOGADO, VAI DIRETO AO DASHBOARD ──
auth.onAuthStateChanged(user => {
  if (user && !isRegistering) {
    window.location.href = 'dashboard.html';
  }
});

// Preencher lista de escritórios no registo de forma dinâmica
document.addEventListener('DOMContentLoaded', () => {
  if (window.loadEscritorios) {
    loadEscritorios().then(lista => {
      const sel = document.getElementById('regEscritorio');
      if (!sel) return;
      sel.innerHTML = '<option value=\"\">Selecionar…</option>' +
        lista.map(e => `<option value=\"${e.id}\">${e.nome}</option>`).join('');
    });
  }
});

// Mensagens por query param
(function() {
  const p = new URLSearchParams(window.location.search).get('conta') ||
            new URLSearchParams(window.location.search).get('email');
  if (p === 'desativada') {
    showError('Conta inativa. Aguarda aprovação do administrador. Caso contrário, contacta o administrador.');
  }
})();

// ── TABS ──
function switchTab(tab) {
  clearAlerts();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));

  if (tab === 'login') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('panelLogin').classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('panelRegister').classList.add('active');
  }
}

// ── LOGIN ──
async function doLogin() {
  clearAlerts();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) { showError('Preenche email e password.'); return; }

  const btn = document.getElementById('btnLogin');
  setLoading(btn, true);

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged redireciona automaticamente
  } catch (err) {
    setLoading(btn, false);
    showError(translateAuthError(err.code));
  }
}

// ── REGISTER ──
async function doRegister() {
  clearAlerts();
  const nome      = document.getElementById('regNome').value.trim();
  const apelido   = document.getElementById('regApelido').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const escritorio= document.getElementById('regEscritorio').value;
  const password  = document.getElementById('regPassword').value;

  if (!nome || !email || !escritorio || !password) {
    showError('Preenche todos os campos obrigatórios.');
    return;
  }
  if (password.length < 6) {
    showError('A password deve ter pelo menos 6 caracteres.');
    return;
  }

  const btn = document.getElementById('btnRegister');
  setLoading(btn, true);
  isRegistering = true;

  let cred;
  try {
    // 1. Criar utilizador no Firebase Auth
    cred = await auth.createUserWithEmailAndPassword(email, password);
  } catch (authErr) {
    // Erros de autenticação bloqueiam o registo
    isRegistering = false;
    setLoading(btn, false);
    showError(translateAuthError(authErr.code));
    return;
  }

  const uid = cred.user.uid;

  try {
    // 2. Guardar perfil no Firestore
    await db.collection('utilizadores').doc(uid).set({
      uid,
      nome,
      apelido,
      nomeCompleto: nome + ' ' + apelido,
      email,
      escritorio,
      funcao: '',
      role: 'colaborador',
      ativo: false,          // inativa até um admin aprovar
      criadoEm: Date.now(),
      ultimoAcesso: Date.now(),
      permissoes: createRegisterPermissions()
    });
    // 3. Atualizar display name no Auth
    await cred.user.updateProfile({ displayName: nome + ' ' + apelido });
  } catch (dbErr) {
    console.error('[registo] Falha ao guardar perfil no Firestore:', dbErr.code, dbErr.message);
  }

  // Fazer logout imediato — conta fica pendente até aprovação do admin
  await auth.signOut();

  showSuccess('Conta criada! Aguarda aprovação do administrador antes de poderes entrar.');
  setLoading(document.getElementById('btnRegister'), false);
  isRegistering = false;
}

// ── FORGOT PASSWORD ──
async function showForgot() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    showInfo('Escreve o teu email no campo acima e clica novamente.');
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showSuccess('Email de recuperação enviado para ' + email);
  } catch (err) {
    showError(translateAuthError(err.code));
  }
}

// ── UTILS ──
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.innerHTML = isPass
    ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
        <circle cx="8" cy="8" r="2"/>
        <line x1="2" y1="2" x2="14" y2="14"/>
       </svg>`
    : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
        <circle cx="8" cy="8" r="2"/>
       </svg>`;
}

function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function clearAlerts() {
  ['alertError','alertSuccess','alertInfo'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
}
function showError(msg)   { clearAlerts(); const el = document.getElementById('alertError');   el.classList.add('show'); document.getElementById('alertErrorMsg').textContent   = msg; }
function showSuccess(msg) { clearAlerts(); const el = document.getElementById('alertSuccess'); el.classList.add('show'); document.getElementById('alertSuccessMsg').textContent = msg; }
function showInfo(msg)    { clearAlerts(); const el = document.getElementById('alertInfo');    el.classList.add('show'); document.getElementById('alertInfoMsg').textContent    = msg; }

function translateAuthError(code) {
  const map = {
    'auth/invalid-email':            'Email inválido.',
    'auth/user-not-found':           'Não existe conta com este email.',
    'auth/wrong-password':           'Password incorreta.',
    'auth/invalid-credential':       'Email ou password incorretos.',
    'auth/email-already-in-use':     'Já existe uma conta com este email.',
    'auth/weak-password':            'Password demasiado fraca (mínimo 6 caracteres).',
    'auth/too-many-requests':        'Demasiadas tentativas. Aguarda um momento.',
    'auth/network-request-failed':   'Erro de ligação. Verifica a internet.',
    'auth/user-disabled':            'Esta conta foi desativada. Contacta o administrador.',
  };
  return map[code] || 'Erro inesperado (' + code + '). Tenta novamente.';
}

// ── ENTER KEY ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginActive = document.getElementById('panelLogin').classList.contains('active');
    if (loginActive) doLogin();
    else doRegister();
  }
});
