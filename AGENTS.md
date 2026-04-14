# AGENTS.md — Algartempo

## O que é esta app

**Algartempo** é um sistema interno de gestão multi-escritório para RH e operações. Construído em HTML/CSS/JavaScript vanilla com Firebase (Auth + Firestore + Storage).

### Módulos principais

| Módulo | Função |
|---|---|
| Dashboard | Painel com KPIs e acesso rápido aos módulos |
| Tarefas | Criação, filtro, estado e prioridade por escritório |
| Comunicados | Comunicados internos com destino controlado |
| Admissões | Processos de admissão/cessação com anexos |
| Reclamações | Gestão de reclamações de horas com exportação |
| Calendário | Editor de carga de trabalho por mês/escritório |
| Escalas | Gestão de escalas de trabalho |
| Utilizadores | Criação de contas, roles e permissões granulares |
| Definições | Gestão de escritórios e módulos administrativos |
| Gerir Calendários | Publicação e manutenção dos calendários |
| Auditoria | Histórico de alterações da app |

---

## Arquitetura

### Duas entidades nucleares

**Utilizadores** + **Escritórios** — tudo entra nesta lógica:
- Autenticação → Firebase Authentication (email/password)
- Sessão → Firestore `utilizadores/{uid}`
- Escopo → Escritório ativo do utilizador
- Permissões → Definidas por role + permissões granulares

### Services comuns

| Ficheiro | Função |
|---|---|
| `js/firebase-init.js` | Inicialização do Firebase |
| `js/auth.js` | Autenticação, sessão, helpers de permissão |
| `js/users-service.js` | Gestão de utilizadores (CRUD, listeners) |
| `js/offices-service.js` | Gestão de escritórios (CRUD, cleanup) |
| `js/config-escritorios.js` | Cache e helpers de escritório ativo |
| `js/module-registry.js` | Registry central dos módulos (navegação + visibilidade) |
| `js/app-platform.js` | Bootstrap único, navbar, navegação, listeners |
| `js/auditoria.js` | Registo de alterações no Firestore |
| `js/utils.js` | Utilitários globais (datas, UI, strings) |

### Services de domínio

- `js/tasks-service.js` — Padrão de reutilização de Firestore para tarefas
- `js/comunicados-service.js` — Mesmo padrão para comunicados

Novos módulos devem criar um service análogo se tiverem dados próprios.

---

## Como criar um módulo novo

Exemplo: criar `frota.html`

### 1. Estrutura base

Criar 3 ficheiros:
- `frota.html` (página)
- `js/frota.js` (lógica)
- `css/frota.css` (estilos)

Opcionalmente:
- `js/frota-service.js` (se tiver dados Firestore)

### 2. Registar no module-registry

Adicionar a `js/module-registry.js`:

```js
{
  id: 'frota',
  label: 'Frota',
  href: 'frota.html',
  group: 'main',
  order: 70,
  adminOnly: false,
  requiredPermissions: [],
  usesEscritorio: true,
}
```

### 3. HTML da página

Carregamento obrigatório (ordem importa):

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<!-- Base comum -->
<script src="js/firebase-init.js"></script>
<script src="js/utils.js"></script>
<script src="js/module-registry.js"></script>
<script src="js/auth.js"></script>
<script src="js/offices-service.js"></script>
<script src="js/config-escritorios.js"></script>
<script src="js/app-platform.js"></script>

<!-- Módulo -->
<script src="js/frota.js"></script>
```

### 4. JavaScript do módulo

Usar `bootProtectedPage()`:

```js
window.bootProtectedPage({
  activePage: 'frota',
  moduleId: 'frota',
}, ({ profile, isAdmin, escritorio }) => {
  // Inicialização
  console.log('Admin?', isAdmin);
  console.log('Escritório ativo:', escritorio);
});
```

Ou se for módulo administrativo:

```js
window.bootProtectedPage({
  activePage: 'frota',
  moduleId: 'frota',
  requireAdmin: true,
}, ({ profile }) => {
  // Apenas admins chegam aqui
});
```

### 5. Apis globais disponíveis

- `window.userProfile` — Objeto do utilizador autenticado
- `window.temPermissao(permissao)` — Verifica se tem uma permissão
- `window.escritorioAtivo()` — ID do escritório ativo
- `window.loadEscritorios()` — Carrega lista de escritórios
- `window.renderNavbar()` — Re-renderiza a navbar
- `window.db` — Referência Firestore

---

## Sistema de permissões

### Permissões legado (em uso)

- `criarTarefas`
- `resolverTarefas`
- `gerirComunicados`
- `criarAdmissoes`
- `resolverAdmissoes`
- `editarCalendario`
- `criarReclamacoes`

### Permissões canonicas (para novos módulos)

Padrão: `modules.<modulo>.<acao>`

Exemplos:
- `modules.frota.view`
- `modules.frota.create`
- `modules.frota.edit`
- `modules.frota.delete`

Definidas em `utilizadores/{uid}.permissoes.modules.frota.view = true`

---

## Firestore

### Projeto Firebase

- **ID**: `hub-algartempo`
- **Configuração**: `.firebaserc`, `firebase.json`
- **Regras**: `firestore.rules`, `storage.rules`

### Colecções principais

- `utilizadores/{uid}` — Dados do utilizador
- `config/escritorios` — Lista de escritórios
- Outras colecções por módulo (ex: `tarefas`, `comunicados`)

### Listeners em tempo real

A app usa `onSnapshot()` para manter sincronização. Configurado centralmente em `app-platform.js` para bootstrap.

### Deploy

```bash
# Fazer login
firebase login --reauth

# Usar projeto
firebase use hub-algartempo

# Deploy de regras
firebase deploy --only firestore:rules
firebase deploy --only storage

# Testar localmente (emulator)
firebase emulators:start --only firestore,storage
```

---

## Estrutura de ficheiros

```
hub-algartempo/
├── prototipos/              # Testes/prototipagem (fora do escopo)
├── css/                     # Estilos por módulo
├── js/
│   ├── (base comum)
│   ├── (services de domínio)
│   ├── (lógica de módulos)
│   └── voz-ai.js
├── templates/               # Templates para módulos novos
├── [modulo].html           # Páginas de módulos
├── login.html
├── styles.css              # Estilos globais
├── firebase.json
├── firestore.rules
├── storage.rules
└── LEIA-ME.md              # README detalhado
```

---

## Fluxos importantes

### Autenticação

1. `login.html` → `js/auth.js` → Firebase Auth
2. Sucesso → Redireciona a primeira página protegida
3. Falha → Volta a `login.html`

### Página protegida

1. Carregar base comum + `app-platform.js`
2. `app-platform.js` verifica auth via `js/auth.js`
3. Se não autenticado → redireciona a `login.html`
4. Se autenticado → `bootProtectedPage()` inicializa o módulo

### Escritório ativo

- Guardado em localStorage (chave: `escritorio_ativo`)
- Carregado ao iniciar a app
- Disponível via `window.escritorioAtivo()`

### Permissões

- Lidas de `utilizadores/{uid}.permissoes`
- Admins têm todas as permissões
- Verificadas via `window.temPermissao('nomePermissao')`

### Auditoria

- Qualquer alteração grava em `auditoria/{doc}`
- Automático via `logAuditoria()` em `js/auditoria.js`

---

## Convenções

| Item | Padrão |
|---|---|
| IDs de escritório | `lowercase-sem-espacos` |
| IDs de módulo | Mesmo que `id` no registry |
| Permissões legacy | `camelCase` |
| Permissões canonicas | `modules.<id>.<acao>` |
| Variáveis globais | `window.*` |
| Colecções | `minusculas` ou `kebab-case` |

---

## Próximos passos conhecidos

- [ ] Endurecer Firestore Rules antes de produção
- [ ] Migrar criação de utilizadores para servidor
- [ ] Expandir auditoria para todas as colecções
- [ ] Adicionar testes para auth, escritório, permissões

---

## Templates

Para começar um módulo do zero:

- `templates/module-template.html`
- `templates/module-template.js`
- `templates/module-template.css`

Copiar e adaptar.

---

## Referências rápidas

- **README completo**: Ver `LEIA-ME.md`
- **Como testar**: Abrir `login.html` com Live Server
- **Firebase Console**: https://console.firebase.google.com (projeto: `hub-algartempo`)
- **Emulators locais**: `firebase emulators:start --only firestore,storage`
