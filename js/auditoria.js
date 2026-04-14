// ═══════════════════════════════════════════════════════════
// auditoria.js — Módulo partilhado de audit log
// Incluir em TODAS as páginas protegidas (depois do auth.js)
// ═══════════════════════════════════════════════════════════

(function () {

  // Nomes legíveis para cada campo (para o diff antes/depois)
  const FIELD_LABELS = {
    // Comuns
    titulo:        'Título',
    descricao:     'Descrição',
    estado:        'Estado',
    escritorio:    'Escritório',
    notas:         'Notas',
    arquivado:     'Arquivado',
    // Utilizadores
    role:          'Role',
    ativo:         'Ativo',
    funcao:        'Função',
    nome:          'Nome',
    apelido:       'Apelido',
    nomeCompleto:  'Nome Completo',
    // Permissões
    'permissoes.criarTarefas':      'Perm: Criar Tarefas',
    'permissoes.resolverTarefas':   'Perm: Resolver Tarefas',
    'permissoes.gerirComunicados':  'Perm: Gerir Comunicados',
    'permissoes.criarAdmissoes':    'Perm: Criar Admissões',
    'permissoes.resolverAdmissoes': 'Perm: Resolver Admissões',
    'permissoes.editarCalendario':  'Perm: Editar Calendário',
    'permissoes.criarReclamacoes':  'Perm: Criar Reclamações',
    // Admissões / reclamações
    prioridade:    'Prioridade',
    tipo:          'Tipo',
    dataEntrada:   'Data de Entrada',
    valorBase:     'Valor Base',
    empresa:       'Empresa',
    categoria:     'Categoria',
    nif:           'NIF',
    numeroCliente: 'Numero Cliente',
    grupo:         'Grupo',
    ultimaPropostaRef: 'Ref. Ultima Proposta',
    ultimaPropostaData: 'Data Ultima Proposta',
  };

  // Módulos reconhecidos
  const MODULO_LABELS = {
    tarefas:       'Tarefas',
    comunicados:   'Comunicados',
    admissoes:     'Admissões',
    reclamacoes:   'Reclamações',
    clientes:      'Clientes',
    utilizadores:  'Utilizadores',
    calendarios:   'Calendários',
  };

  // Acções reconhecidas
  const ACAO_LABELS = {
    criado:    'Criado',
    atualizado:'Atualizado',
    eliminado: 'Eliminado',
    estado:    'Estado alterado',
    permissao: 'Permissão alterada',
  };

  /**
   * Calcula o diff entre dois objectos — devolve só os campos que mudaram.
   * Suporta objectos aninhados até 1 nível (ex: permissoes.criarTarefas).
   *
   * @param {Object} antes  - Dados anteriores
   * @param {Object} depois - Dados novos (pode ser patch parcial)
   * @returns {Array<{campo, label, antes, depois}>}
   */
  function calcularDiff(antes, depois) {
    const changes = [];

    function processar(a, d, prefix) {
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(d || {})]);
      keys.forEach(k => {
        const fullKey = prefix ? prefix + '.' + k : k;
        const vA = a ? a[k] : undefined;
        const vD = d ? d[k] : undefined;

        // Ignorar campos internos
        if (['criadoEm', 'ultimoAcesso', 'uid', 'criadoPor'].includes(k)) return;
        // Ignorar arrays complexos (ficheiros, etc.)
        if (Array.isArray(vA) || Array.isArray(vD)) return;

        if (vA !== null && typeof vA === 'object' && vD !== null && typeof vD === 'object') {
          // Objecto aninhado — recursivo (só 1 nível)
          processar(vA, vD, fullKey);
        } else if (vA !== vD) {
          changes.push({
            campo:  fullKey,
            label:  FIELD_LABELS[fullKey] || fullKey,
            antes:  vA !== undefined ? vA : '—',
            depois: vD !== undefined ? vD : '—',
          });
        }
      });
    }

    processar(antes, depois, '');
    return changes;
  }

  /**
   * Regista uma entrada no audit log.
   *
   * @param {Object} opts
   * @param {string}  opts.modulo   - 'tarefas' | 'comunicados' | 'admissoes' | 'reclamacoes' | 'utilizadores' | 'calendarios'
   * @param {string}  opts.acao     - 'criado' | 'atualizado' | 'eliminado' | 'estado' | 'permissao'
   * @param {string}  opts.docId    - ID do documento afectado
   * @param {string}  [opts.titulo] - Título/nome do documento (para mostrar no log)
   * @param {Object}  [opts.antes]  - Estado anterior (para diff)
   * @param {Object}  [opts.depois] - Estado novo / patch aplicado (para diff)
   * @param {string}  [opts.nota]   - Nota livre opcional
   * @returns {Promise<void>}
   */
  window.registarAuditoria = async function registarAuditoria(opts) {
    try {
      if (!window.currentUser || !window.userProfile) return;

      const diff = (opts.antes && opts.depois)
        ? calcularDiff(opts.antes, opts.depois)
        : [];

      const entrada = {
        modulo:     opts.modulo  || 'desconhecido',
        acao:       opts.acao    || 'atualizado',
        docId:      opts.docId   || '',
        titulo:     opts.titulo  || '',
        diff,
        nota:       opts.nota    || '',
        // Quem
        uid:        window.currentUser.uid,
        email:      window.currentUser.email || '',
        nomeUser:   window.userProfile.nomeCompleto || window.userProfile.nome || window.currentUser.email || '',
        escritorioUser: window.userProfile.escritorio || '',
        // Quando
        ts:         Date.now(),
        // Escritório do documento (se disponível)
        escritorioDoc: (opts.depois && opts.depois.escritorio)
                    || (opts.antes  && opts.antes.escritorio)
                    || '',
      };

      await firebase.firestore().collection('auditoria').add(entrada);
    } catch (err) {
      // Audit log nunca deve bloquear o fluxo principal
      console.warn('[auditoria] Falha ao registar:', err);
    }
  };

  // Expõe os labels para a página auditoria.html
  window._auditoriaLabels = { FIELD_LABELS, MODULO_LABELS, ACAO_LABELS };

})();


// ═══════════════════════════════════════════════════════════
// GUIA DE INTEGRAÇÃO — como usar em cada módulo
// ═══════════════════════════════════════════════════════════
//
// ── CRIAR documento ──────────────────────────────────────
//   const docRef = await col.add(dados);
//   await registarAuditoria({
//     modulo: 'tarefas',
//     acao:   'criado',
//     docId:  docRef.id,
//     titulo: dados.titulo,
//     depois: dados,
//   });
//
// ── ATUALIZAR documento ──────────────────────────────────
//   // 1. Ler o estado anterior
//   const snap = await col.doc(id).get();
//   const antes = snap.data();
//   // 2. Aplicar o update
//   await col.doc(id).update(patch);
//   // 3. Registar
//   await registarAuditoria({
//     modulo: 'tarefas',
//     acao:   'atualizado',
//     docId:  id,
//     titulo: antes.titulo,
//     antes,
//     depois: patch,
//   });
//
// ── ELIMINAR documento ──────────────────────────────────
//   const snap = await col.doc(id).get();
//   const antes = snap.data();
//   await col.doc(id).delete();
//   await registarAuditoria({
//     modulo: 'tarefas',
//     acao:   'eliminado',
//     docId:  id,
//     titulo: antes.titulo,
//     antes,
//   });
//
// ── ALTERAR ESTADO ───────────────────────────────────────
//   await col.doc(id).update({ estado: novoEstado });
//   await registarAuditoria({
//     modulo: 'tarefas',
//     acao:   'estado',
//     docId:  id,
//     titulo: tarefa.titulo,
//     antes:  { estado: estadoAntigo },
//     depois: { estado: novoEstado },
//   });
//
// ── PERMISSÕES de utilizador ────────────────────────────
//   await db.collection('utilizadores').doc(uid).update(patch);
//   await registarAuditoria({
//     modulo: 'utilizadores',
//     acao:   'permissao',
//     docId:  uid,
//     titulo: nomeDoUtilizador,
//     antes:  estadoAnteriorDoUtilizador,
//     depois: patch,
//   });
// ═══════════════════════════════════════════════════════════
