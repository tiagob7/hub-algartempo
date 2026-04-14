/* ══════════════════════════════════════════════════════
   CHAT.JS — Lógica principal do módulo de mensagens
   ══════════════════════════════════════════════════════ */

/* ── Estado global ── */
let _uid = '';
let _profile = null;
let _conversas = [];
let _lidos = {};
let _currentConversaId = null;
let _unsubConversas = null;
let _unsubMensagens = null;
let _unsubLidos = null;
let _allUsers = [];
let _groupSelected = [];

/* ══════════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════════ */
function uidColor(uid) {
  let h = 0;
  for (let i = 0; i < (uid || '').length; i++) {
    h = (h * 31 + uid.charCodeAt(i)) & 0xffffffff;
  }
  const colors = ['#2563eb','#7c3aed','#db2777','#16a34a','#d97706','#0d9488','#dc2626','#0284c7'];
  return colors[Math.abs(h) % colors.length];
}

function initials(nome) {
  if (!nome) return '?';
  const parts = nome.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function buildAvatar(nome, uid, size) {
  const sz = size || 36;
  const div = document.createElement('div');
  div.style.cssText = [
    `width:${sz}px`, `height:${sz}px`, 'border-radius:50%',
    `background:${uidColor(uid)}`,
    'display:flex', 'align-items:center', 'justify-content:center',
    'color:#fff', `font-size:${Math.round(sz * 0.38)}px`,
    "font-family:'Poppins',sans-serif", 'font-weight:700', 'flex-shrink:0',
    'user-select:none',
  ].join(';');
  div.textContent = initials(nome);
  return div;
}

function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = todayStart - msgDay;
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (diff <= 0) return `${hh}:${mm}`;
  if (diff === 86400000) return 'Ontem';
  return `${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function formatMsgDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = todayStart - msgDay;
  if (diff <= 0) return 'Hoje';
  if (diff === 86400000) return 'Ontem';
  const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function scrollToBottom(force) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  if (force || nearBottom) el.scrollTop = el.scrollHeight;
}

/* ── Nome da conversa (DM = nome do outro utilizador) ── */
function conversaNome(c) {
  if (!c) return 'Conversa';
  if (c.tipo === 'grupo') return c.nome || 'Grupo';
  const otherUid = (c.participantes || []).find(u => u !== _uid);
  const other = _allUsers.find(u => u.uid === otherUid);
  return (other && (other.nomeCompleto || other.nome)) || 'Utilizador';
}

function conversaUidRef(c) {
  if (!c || c.tipo === 'grupo') return c ? c.id : '';
  return (c.participantes || []).find(u => u !== _uid) || (c ? c.id : '');
}

function unreadCount(c) {
  const lido = _lidos[c.id] || 0;
  if (!c.ultimaMensagemTs) return 0;
  if (c.ultimaMensagemUid === _uid) return 0;
  return c.ultimaMensagemTs > lido ? 1 : 0;
}

/* ══════════════════════════════════════════════════════
   RENDER — LISTA DE CONVERSAS
   ══════════════════════════════════════════════════════ */
function renderConversaList(filtro) {
  const list = document.getElementById('chatList');
  if (!list) return;

  const search = (filtro || '').toLowerCase().trim();
  let items = _conversas;
  if (search) items = items.filter(c => conversaNome(c).toLowerCase().includes(search));

  if (!items.length) {
    list.innerHTML = '<div class="chat-list-empty">Sem conversas ainda.<br>Clica em + para começar.</div>';
    return;
  }

  list.innerHTML = '';
  items.forEach(c => {
    const nome = conversaNome(c);
    const uid = conversaUidRef(c);
    const unread = unreadCount(c);
    const isActive = c.id === _currentConversaId;

    const item = document.createElement('div');
    item.className = 'chat-item' + (isActive ? ' active' : '') + (unread ? ' unread' : '');
    item.dataset.id = c.id;

    item.appendChild(buildAvatar(nome, uid, 40));

    const meta = document.createElement('div');
    meta.className = 'chat-item-meta';
    meta.innerHTML = `
      <div class="chat-item-row">
        <span class="chat-item-name">${esc(nome)}</span>
        <span class="chat-item-ts">${formatTs(c.ultimaMensagemTs)}</span>
      </div>
      <div class="chat-item-row">
        <span class="chat-item-preview">${esc(c.ultimaMensagem || 'Sem mensagens')}</span>
        ${unread ? '<span class="chat-unread-badge"></span>' : ''}
      </div>`;
    item.appendChild(meta);
    item.addEventListener('click', () => openConversa(c.id));
    list.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════════
   ABRIR CONVERSA
   ══════════════════════════════════════════════════════ */
function openConversa(conversaId) {
  _currentConversaId = conversaId;
  const conversa = _conversas.find(c => c.id === conversaId);

  // Mobile: transição para o painel da thread
  const wrap = document.getElementById('chatWrap');
  if (!wrap.classList.contains('chat-view-thread')) {
    wrap.classList.add('chat-view-thread');
    history.pushState({ chatThread: conversaId }, '');
  }

  // Mostrar inner, esconder empty
  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('threadInner').style.display = 'flex';

  // Montar header
  const nome = conversaNome(conversa);
  const uid = conversaUidRef(conversa);
  const headEl = document.getElementById('threadHead');
  headEl.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'chat-back-btn';
  backBtn.innerHTML = '&#8249;';
  backBtn.onclick = closeThread;
  headEl.appendChild(backBtn);

  headEl.appendChild(buildAvatar(nome, uid, 38));

  const info = document.createElement('div');
  info.className = 'thread-info';
  const sub = (conversa && conversa.tipo === 'grupo')
    ? `<span class="thread-sub">${(conversa.participantes || []).length} participantes</span>` : '';
  info.innerHTML = `<span class="thread-name">${esc(nome)}</span>${sub}`;
  headEl.appendChild(info);

  // Atualizar lista (highlight ativo)
  renderConversaList(document.getElementById('chatSearch').value);

  // Cancelar listener anterior de mensagens
  if (_unsubMensagens) { _unsubMensagens(); _unsubMensagens = null; }
  document.getElementById('chatMessages').innerHTML = '';

  // Novo listener de mensagens
  _unsubMensagens = ChatService.listenMensagens(conversaId, 40, msgs => {
    renderMensagens(msgs, conversa || { tipo: 'dm' });
    if (msgs.length) {
      const lastTs = msgs[msgs.length - 1].ts;
      ChatService.markRead(_uid, conversaId, lastTs).catch(() => {});
      _lidos[conversaId] = lastTs;
      renderConversaList(document.getElementById('chatSearch').value);
    }
  });

  setTimeout(() => document.getElementById('chatInput').focus(), 80);
}

/* ── Fechar thread (mobile back) ── */
function closeThread() {
  _currentConversaId = null;
  document.getElementById('chatWrap').classList.remove('chat-view-thread');
  if (_unsubMensagens) { _unsubMensagens(); _unsubMensagens = null; }
  document.getElementById('chatEmpty').style.display = 'flex';
  document.getElementById('threadInner').style.display = 'none';
  renderConversaList(document.getElementById('chatSearch').value);
}

/* ══════════════════════════════════════════════════════
   RENDER — MENSAGENS
   ══════════════════════════════════════════════════════ */
function renderMensagens(msgs, conversa) {
  const el = document.getElementById('chatMessages');
  const isGroup = conversa && conversa.tipo === 'grupo';
  el.innerHTML = '';
  let lastDay = null;

  msgs.forEach(msg => {
    const isOwn = msg.autorUid === _uid;
    const dayKey = new Date(msg.ts).toDateString();

    if (dayKey !== lastDay) {
      lastDay = dayKey;
      const sep = document.createElement('div');
      sep.className = 'msg-day-sep';
      sep.textContent = formatMsgDay(msg.ts);
      el.appendChild(sep);
    }

    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap ' + (isOwn ? 'msg-own' : 'msg-other');

    if (!isOwn && isGroup) {
      const author = document.createElement('div');
      author.className = 'msg-author';
      author.textContent = msg.autorNome || 'Utilizador';
      wrap.appendChild(author);
    }

    const row = document.createElement('div');
    row.className = 'msg-row';

    if (!isOwn) row.appendChild(buildAvatar(msg.autorNome, msg.autorUid, 28));

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = esc(msg.texto).replace(/\n/g, '<br>');

    const ts = document.createElement('span');
    ts.className = 'msg-ts';
    ts.textContent = formatTs(msg.ts);

    row.appendChild(bubble);
    row.appendChild(ts);
    wrap.appendChild(row);
    el.appendChild(wrap);
  });

  scrollToBottom(true);
}

/* ══════════════════════════════════════════════════════
   ENVIAR MENSAGEM
   ══════════════════════════════════════════════════════ */
function sendMessage() {
  const input = document.getElementById('chatInput');
  const texto = input.value.trim();
  if (!texto || !_currentConversaId) return;

  input.value = '';
  input.style.height = 'auto';

  const nome = _profile ? (_profile.nomeCompleto || _profile.nome || 'Utilizador') : 'Utilizador';
  ChatService.sendMensagem(_currentConversaId, texto, _uid, nome)
    .then(() => scrollToBottom(true))
    .catch(err => console.error('[chat] send error', err));
}

/* ══════════════════════════════════════════════════════
   MODAL — NOVA CONVERSA
   ══════════════════════════════════════════════════════ */
function openNewChatModal() {
  document.getElementById('newChatModal').classList.add('open');
  switchTab('dm');
  renderUserPicker('', 'dm');
}

function closeNewChatModal() {
  document.getElementById('newChatModal').classList.remove('open');
  document.getElementById('userSearch').value = '';
  document.getElementById('groupName').value = '';
  document.getElementById('groupUserSearch').value = '';
  _groupSelected = [];
  renderGroupSelected();
}

function switchTab(tab) {
  document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('tabDm').style.display = tab === 'dm' ? 'flex' : 'none';
  document.getElementById('tabGrupo').style.display = tab === 'grupo' ? 'flex' : 'none';
  if (tab === 'dm') renderUserPicker(document.getElementById('userSearch').value, 'dm');
  if (tab === 'grupo') renderUserPicker(document.getElementById('groupUserSearch').value, 'grupo');
}

function renderUserPicker(search, mode) {
  const listId = mode === 'dm' ? 'userList' : 'groupUserList';
  const el = document.getElementById(listId);
  if (!el) return;

  const q = (search || '').toLowerCase().trim();
  const users = _allUsers.filter(u => {
    if (u.uid === _uid) return false;
    if (mode === 'grupo' && _groupSelected.includes(u.uid)) return false;
    const nome = (u.nomeCompleto || u.nome || '').toLowerCase();
    return !q || nome.includes(q);
  });

  if (!users.length) {
    el.innerHTML = '<div class="picker-empty">Sem resultados</div>';
    return;
  }

  el.innerHTML = '';
  users.slice(0, 25).forEach(u => {
    const nome = u.nomeCompleto || u.nome || 'Utilizador';
    const row = document.createElement('div');
    row.className = 'picker-row';
    row.appendChild(buildAvatar(nome, u.uid, 32));

    const nameEl = document.createElement('span');
    nameEl.className = 'picker-name';
    nameEl.textContent = nome;
    if (u.funcao) {
      const sub = document.createElement('span');
      sub.className = 'picker-sub';
      sub.textContent = u.funcao;
      nameEl.appendChild(sub);
    }
    row.appendChild(nameEl);

    if (mode === 'dm') {
      row.onclick = async () => {
        closeNewChatModal();
        const id = await ChatService.getOrCreateDm(_uid, u.uid);
        // Garantir que a conversa está em _conversas antes de abrir
        if (!_conversas.find(c => c.id === id)) {
          _conversas.unshift({
            id, tipo: 'dm',
            participantes: [_uid, u.uid],
            ultimaMensagem: null,
            ultimaMensagemTs: Date.now(),
            ultimaMensagemUid: null,
            nome: null,
          });
        }
        openConversa(id);
      };
    } else {
      row.onclick = () => {
        _groupSelected.push(u.uid);
        renderGroupSelected();
        renderUserPicker(document.getElementById('groupUserSearch').value, 'grupo');
      };
    }

    el.appendChild(row);
  });
}

function renderGroupSelected() {
  const el = document.getElementById('groupSelected');
  if (!el) return;
  if (!_groupSelected.length) { el.innerHTML = ''; return; }
  el.innerHTML = _groupSelected.map(uid => {
    const u = _allUsers.find(x => x.uid === uid);
    const nome = u ? (u.nomeCompleto || u.nome || 'Utilizador') : 'Utilizador';
    return `<span class="group-sel-chip">${esc(nome)}<button class="chip-remove" data-uid="${uid}">✕</button></span>`;
  }).join('');
  el.querySelectorAll('.chip-remove').forEach(btn => {
    btn.onclick = () => {
      _groupSelected = _groupSelected.filter(u => u !== btn.dataset.uid);
      renderGroupSelected();
      renderUserPicker(document.getElementById('groupUserSearch').value, 'grupo');
    };
  });
}

async function doCreateGroup() {
  const nome = document.getElementById('groupName').value.trim();
  if (!nome) { document.getElementById('groupName').focus(); return; }
  if (!_groupSelected.length) {
    document.getElementById('groupUserSearch').focus();
    return;
  }
  const btn = document.getElementById('btnCreateGroup');
  btn.disabled = true;
  btn.textContent = 'A criar…';
  try {
    const participantes = [_uid, ..._groupSelected];
    const id = await ChatService.createGroup(nome, participantes, _uid);
    closeNewChatModal();
    if (!_conversas.find(c => c.id === id)) {
      _conversas.unshift({
        id, tipo: 'grupo',
        participantes,
        ultimaMensagem: null,
        ultimaMensagemTs: Date.now(),
        ultimaMensagemUid: null,
        nome,
      });
    }
    openConversa(id);
  } catch (e) {
    console.error('[chat] createGroup error', e);
    btn.disabled = false;
    btn.textContent = 'Criar grupo';
  }
}

/* ══════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ══════════════════════════════════════════════════════ */
window.bootProtectedPage({
  activePage: 'chat',
  moduleId: 'chat',
}, ({ profile }) => {
  _profile = profile;
  _uid = (profile && profile.uid) || (window.currentUser && window.currentUser.uid) || '';

  // Carregar utilizadores para o picker
  ChatService.loadUtilizadores()
    .then(users => { _allUsers = users; })
    .catch(err => console.warn('[chat] loadUtilizadores error', err));

  // Listener de lidos
  _unsubLidos = ChatService.listenUnreadCounts(_uid, lidos => {
    _lidos = lidos;
    renderConversaList(document.getElementById('chatSearch').value);
  });

  // Listener de conversas
  _unsubConversas = ChatService.listenConversas(_uid, conversas => {
    _conversas = conversas;
    renderConversaList(document.getElementById('chatSearch').value);
  });

  // Pesquisa de conversas
  document.getElementById('chatSearch').addEventListener('input', e => {
    renderConversaList(e.target.value);
  });

  // Botão nova conversa
  document.getElementById('btnNewDm').addEventListener('click', openNewChatModal);
  document.getElementById('btnCloseNewChat').addEventListener('click', closeNewChatModal);
  document.getElementById('newChatModal').addEventListener('click', e => {
    if (e.target === document.getElementById('newChatModal')) closeNewChatModal();
  });

  // Tabs do modal
  document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search no picker
  document.getElementById('userSearch').addEventListener('input', e => {
    renderUserPicker(e.target.value, 'dm');
  });
  document.getElementById('groupUserSearch').addEventListener('input', e => {
    renderUserPicker(e.target.value, 'grupo');
  });

  // Criar grupo
  document.getElementById('btnCreateGroup').addEventListener('click', doCreateGroup);
  document.getElementById('btnCancelGroup').addEventListener('click', closeNewChatModal);

  // Composer — Enter envia, Shift+Enter nova linha
  const chatInput = document.getElementById('chatInput');
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
  });
  document.getElementById('btnSend').addEventListener('click', sendMessage);

  // Mobile: botão back do browser fecha a thread
  window.addEventListener('popstate', () => {
    if (document.getElementById('chatWrap').classList.contains('chat-view-thread')) {
      closeThread();
    }
  });

  // Cleanup ao sair da página
  window.addEventListener('beforeunload', () => {
    if (_unsubConversas) _unsubConversas();
    if (_unsubMensagens) _unsubMensagens();
    if (_unsubLidos) _unsubLidos();
  });
});
