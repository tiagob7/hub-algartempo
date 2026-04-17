/* ══════════════════════════════════════════════════════
   CHAT SERVICE
   Coleções: conversas/{id}, conversas/{id}/mensagens/{id},
             chat_lidos/{uid}_{conversaId}
   ══════════════════════════════════════════════════════ */
(function () {
  const db = window.db || firebase.firestore();

  /* ── ID determinístico para DMs ── */
  function getDmId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
  }

  /* ── Obter ou criar conversa DM ── */
  async function getOrCreateDm(uidA, uidB) {
    const id = getDmId(uidA, uidB);
    const ref = db.collection('conversas').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        tipo: 'dm',
        participantes: [uidA, uidB],
        ultimaMensagem: null,
        ultimaMensagemTs: Date.now(),
        ultimaMensagemUid: null,
        nome: null,
        criadoEm: Date.now(),
        criadoPor: uidA,
      });
      if (typeof window.registarAuditoria === 'function') {
        window.registarAuditoria({
          acao: 'chat_dm_criado',
          dados: { conversaId: id, participantes: [uidA, uidB] },
        });
      }
    }
    return id;
  }

  /* ── Criar grupo ── */
  async function createGroup(nome, participantes, criadoPor) {
    const ref = db.collection('conversas').doc();
    await ref.set({
      tipo: 'grupo',
      participantes,
      ultimaMensagem: null,
      ultimaMensagemTs: Date.now(),
      ultimaMensagemUid: null,
      nome: nome.trim(),
      criadoEm: Date.now(),
      criadoPor,
    });
    if (typeof window.registarAuditoria === 'function') {
      window.registarAuditoria({
        acao: 'chat_grupo_criado',
        dados: { conversaId: ref.id, nome, participantes },
      });
    }
    return ref.id;
  }

  /* ── Listener de conversas do utilizador ── */
  function listenConversas(uid, cb) {
    return db.collection('conversas')
      .where('participantes', 'array-contains', uid)
      .orderBy('ultimaMensagemTs', 'desc')
      .onSnapshot(snap => {
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.warn('[chat] listenConversas error', err));
  }

  /* ── Listener de mensagens de uma conversa ── */
  function listenMensagens(conversaId, limit, cb) {
    return db.collection('conversas').doc(conversaId)
      .collection('mensagens')
      .orderBy('ts', 'asc')
      .limitToLast(limit || 40)
      .onSnapshot(snap => {
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.warn('[chat] listenMensagens error', err));
  }

  /* ── Enviar mensagem (batch: msg + preview) ── */
  async function sendMensagem(conversaId, texto, autorUid, autorNome) {
    const ts = Date.now();
    const batch = db.batch();

    const msgRef = db.collection('conversas').doc(conversaId)
      .collection('mensagens').doc();
    batch.set(msgRef, {
      texto: texto.slice(0, 4000),
      autorUid,
      autorNome: autorNome || 'Utilizador',
      ts,
      tipo: 'texto',
    });

    const conversaRef = db.collection('conversas').doc(conversaId);
    batch.update(conversaRef, {
      ultimaMensagem: texto.slice(0, 80),
      ultimaMensagemTs: ts,
      ultimaMensagemUid: autorUid,
    });

    await batch.commit();
  }

  /* ── Marcar conversa como lida ── */
  async function markRead(uid, conversaId, ts) {
    const docId = uid + '_' + conversaId;
    await db.collection('chat_lidos').doc(docId).set({
      uid,
      conversaId,
      ultimoLidoTs: ts || Date.now(),
    });
  }

  /* ── Listener de read status (para badges de não lido) ── */
  function listenUnreadCounts(uid, cb) {
    return db.collection('chat_lidos')
      .where('uid', '==', uid)
      .onSnapshot(snap => {
        const lidos = {};
        snap.docs.forEach(d => {
          lidos[d.data().conversaId] = d.data().ultimoLidoTs;
        });
        cb(lidos);
      }, err => console.warn('[chat] listenUnreadCounts error', err));
  }

  /* ── Carregar utilizadores para o picker ── */
  async function loadUtilizadores() {
    const snap = await db.collection('utilizadores').where('ativo', '==', true).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  window.ChatService = {
    getDmId,
    getOrCreateDm,
    createGroup,
    listenConversas,
    listenMensagens,
    sendMensagem,
    markRead,
    listenUnreadCounts,
    loadUtilizadores,
  };
})();
