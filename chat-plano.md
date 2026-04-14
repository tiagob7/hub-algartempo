# Módulo Chat — Plano de Implementação

> Criado em 2026-04-14. Implementar quando decidido.

---

## Modelo de dados Firestore

### `conversas/{conversaId}`
```
tipo: 'dm' | 'grupo'
participantes: [uid1, uid2, ...]
ultimaMensagem: string        ← preview sem reads extra
ultimaMensagemTs: number
ultimaMensagemUid: string
nome: string | null           ← só grupos
criadoEm: number
criadoPor: string
```
> Chat é transversal a escritórios — DMs e grupos não têm scope de escritório.

### `conversas/{conversaId}/mensagens/{msgId}`
```
texto: string
autorUid: string
autorNome: string             ← desnormalizado, sem read extra
ts: number
estado: 'enviada' | 'lida'   ← só DMs
tipo: 'texto' | 'sistema'
```

### `chat_lidos/{uid}_{conversaId}`
```
uid: string
conversaId: string
ultimoLidoTs: number          ← timestamp da última msg lida
```

### Decisões de design
- ID dos DMs é **determinístico**: dois UIDs ordenados alfabeticamente unidos por `_`. Evita conversas duplicadas.
- `ultimaMensagem` desnormalizado na conversa → lista de conversas é um único `onSnapshot`.
- `chat_lidos` é colecção plana → 1 query para todos os não-lidos do utilizador.

### Índices Firestore necessários (`firestore.indexes.json`)
| Colecção | Campos | Fim |
|---|---|---|
| `conversas` | `participantes` (array-contains) + `ultimaMensagemTs` desc | Lista ordenada por recência |
| `mensagens` (subcol.) | `ts` asc | Thread em ordem |
| `chat_lidos` | `uid` == | Contagem de não-lidos |

---

## Ficheiros a criar

```
chat.html              ← página do módulo
js/chat-service.js     ← todas as operações Firestore
js/chat.js             ← lógica e UI (bootProtectedPage)
css/chat.css           ← estilos
```

### Ficheiros a alterar
- `js/module-registry.js` — registar módulo
- `js/app-platform.js` — badge de não-lidos na navbar
- `firestore.rules` — regras de segurança
- `firestore.indexes.json` — 3 índices compostos necessários (ver secção Índices)

---

## Registo no module-registry.js

```js
{
  id: 'chat',
  label: 'Chat',
  href: 'chat.html',
  group: 'main',
  order: 25,
  adminOnly: false,
  requiredPermissions: [],
  usesEscritorio: false,
  icon: '<path d="M13 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3l2 2 2-2h3a1 1 0 001-1V3a1 1 0 00-1-1z"/>',
}
```

---

## Script load order em `chat.html`

```html
<script src="js/firebase-init.js"></script>
<script src="js/utils.js"></script>
<script src="js/module-registry.js"></script>
<script src="js/auth.js"></script>
<script src="js/auditoria.js"></script>   <!-- só para criação de conversa/grupo -->
<script src="js/offices-service.js"></script>
<script src="js/config-escritorios.js"></script>
<script src="js/app-platform.js"></script>
<script src="js/users-service.js"></script>   <!-- picker de utilizadores -->
<script src="js/chat-service.js"></script>
<script src="js/chat.js"></script>
```

---

## Layout UI

### Desktop — dois painéis lado a lado
```
┌─────────────────────────┬──────────────────────────────────┐
│  Lista de conversas     │  Thread da conversa              │
│  [Pesquisar…]           │  [Nome + avatar do interlocutor] │
│  ─────────────────────  │  ─────────────────────────────── │
│  [AB] Ana B.    14:22   │      "Olá, viste o relatório?"   │
│       Olá, viste… (3)   │                          14:22 ✓ │
│  ─────────────────────  │  "Sim, já enviei"                │
│  [JF] João F.   Ontem   │                          14:25 ✓✓│
│       Ok, confirmo…     │  ─────────────────────────────── │
│                         │  [Escreve uma mensagem…]  [▶]    │
│  [+ Nova conversa]      │                                  │
└─────────────────────────┴──────────────────────────────────┘
```

### Mobile
- Painel único: lista → thread com botão voltar.
- `history.pushState` ao entrar no thread + `popstate` para voltar à lista.
- Classe `chat-view-thread` no `.chat-wrap` controla qual painel é visível.

### Detalhes de UI
- **Avatar**: círculo com iniciais, cor derivada do UID (hash) — padrão já usado no `app-platform.js`
- **Bubbles próprias**: alinhadas à direita, `var(--accent)` background
- **Bubbles de outros**: alinhadas à esquerda, `var(--surface2)` background
- **Nome do remetente**: só visível em grupos, acima do bubble
- **Status DMs**: `✓` enviada, `✓✓` lida
- **Composer**: `<textarea>` auto-grow (1–4 linhas), Enter envia, Shift+Enter newline
- `.page` com `max-width: 1100px` e `padding: 0` para este módulo
- **Scroll-to-bottom**: automático ao abrir thread e ao enviar; ao receber mensagem nova só faz scroll se já estiver a ≤100px do fundo (não interrompe quem está a ler histórico)

---

## chat-service.js — funções principais

| Função | O que faz |
|---|---|
| `getDmId(uidA, uidB)` | ID determinístico — UIDs ordenados + `_` |
| `getOrCreateDm(uidA, uidB)` | Cria conversa DM se não existir — audita criação |
| `createGroup(nome, participantes)` | Cria grupo (sem scope de escritório) — audita criação |
| `listenConversas(uid, cb)` | `onSnapshot` das conversas do utilizador |
| `listenMensagens(conversaId, limit, cb)` | `onSnapshot` últimas N msgs |
| `sendMensagem(conversaId, texto, profile)` | Batch: msg + atualiza preview na conversa |
| `markRead(uid, conversaId)` | Escreve `chat_lidos` |
| `listenUnreadCounts(uid, cb)` | `onSnapshot` dos `chat_lidos` do utilizador |

---

## Badge de não-lidos na navbar

### Lógica (0 reads extra — só aritmética client-side)
```
conversas listener  +  chat_lidos listener
         ↓
   para cada conversa:
     msgs com ts > ultimoLidoTs  →  soma total
         ↓
   updateNavbarBadge(total)
```

### V1 vs V2
- **V1**: badge só aparece na página de chat
- **V2**: criar `js/chat-badge.js` incluído em todas as páginas (1 listener leve global)

---

## Custos de reads

| Listener | Frequência de reads |
|---|---|
| `conversas` (lista) | 1 por mensagem recebida em qualquer conversa |
| `mensagens` (thread aberto) | 1 por mensagem nova na conversa ativa |
| `chat_lidos` | Mínimo (escreve raramente) |

### O que evitar
- ❌ Não carregar mensagens de todas as conversas à partida
- ❌ Não usar `collectionGroup('mensagens')`
- ❌ Não guardar `readBy: { uid: ts }` em cada mensagem para grupos
- ✅ Paginar mensagens: 40 por abertura, scroll-up carrega mais

---

## Segurança — Firestore Rules a adicionar

```js
match /conversas/{conversaId} {
  allow read: if isActiveUser()
    && request.auth.uid in resource.data.participantes;

  allow create: if isActiveUser()
    && request.auth.uid in request.resource.data.participantes
    && request.resource.data.participantes.size() >= 2;

  allow update: if isActiveUser()
    && request.auth.uid in resource.data.participantes
    && request.resource.data.diff(resource.data).changedKeys()
       .hasOnly(['ultimaMensagem','ultimaMensagemTs','ultimaMensagemUid']);

  match /mensagens/{msgId} {
    allow read: if isActiveUser()
      && request.auth.uid in get(/databases/$(database)/documents/conversas/$(conversaId)).data.participantes;
    allow create: if isActiveUser()
      && request.resource.data.autorUid == request.auth.uid
      && request.auth.uid in get(/databases/$(database)/documents/conversas/$(conversaId)).data.participantes;
    allow update: if false; // mensagens são imutáveis
    allow delete: if false;
  }
}

match /chat_lidos/{docId} {
  // create: resource ainda não existe, usar request.resource
  allow create: if isActiveUser()
    && request.auth.uid == request.resource.data.uid;
  // read, update, delete: resource já existe
  allow read, update, delete: if isActiveUser()
    && request.auth.uid == resource.data.uid;
}
```

### Permissões por acção
| Acção | Regra |
|---|---|
| Ler conversa | UID tem de estar em `participantes` |
| Criar DM | Ambos os UIDs válidos; `participantes.size() == 2` |
| Criar grupo | Só admins (`modules.chat.manage`) |
| Escrever mensagem | UID em `participantes` da conversa-pai |
| Editar/apagar mensagem | ❌ Proibido |
| Escrever `chat_lidos` | Só o próprio utilizador |

---

## Edge cases e riscos

| Risco | Mitigação |
|---|---|
| Leak de listeners ao trocar conversas | Guardar unsubscribe fns; chamar ao trocar e no `beforeunload` |
| Picker de utilizadores carrega muitos docs | Filtrar por escritório por defeito; admins vêem todos |
| Back button mobile | `history.pushState` + `popstate` |
| Novo utilizador sem `chat_lidos` | Tratar ausência como `ultimoLidoTs: 0` |
| Escrita simultânea em `ultimaMensagem` | Last-write-wins é aceitável para preview |
| `ultimaMensagem` com texto longo | Truncar a 80 chars antes de escrever no Firestore |

---

## Scope V1 vs V2

| Funcionalidade | V1 | V2 |
|---|---|---|
| Mensagens diretas (DMs) | ✅ | — |
| Grupos por escritório | ✅ | — |
| Badge navbar (só na pág. chat) | ✅ | — |
| Badge navbar em todas as páginas | — | ✅ |
| Anexos / imagens | — | ✅ |
| Reacções a mensagens | — | ✅ |
| Editar / apagar mensagens | — | ✅ |
