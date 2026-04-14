# Algartempo — Gestão Interna

Sistema interno de gestão multi-escritório para RH e operações, construído em HTML/CSS/JavaScript puro com Firebase.

---

## O que esta app faz

| Módulo | Descrição |
|---|---|
| **Dashboard** | Painel geral com KPIs, layout personalizável, pesquisa global e temas de cor |
| **Tarefas** | Criação, filtro, estado e prioridade de tarefas por escritório |
| **Comunicados** | Comunicados internos por tipo e por destino |
| **Admissões** | Processos de admissão e cessação com anexos e modo gestor |
| **Reclamações** | Gestão de reclamações de horas com exportação e anexos |
| **Calendário** | Editor de carga de trabalho por escritório/departamento/mês |
| **Escalas** | Gestão de escalas de trabalho por escritório (sub-coleção Firestore) |
| **Chat** | Mensagens diretas e grupos entre todos os colaboradores (cross-office) |
| **Utilizadores** | Criação de contas, roles, perfis e permissões granulares |
| **Perfis** | Criação e gestão de perfis de permissão reutilizáveis |
| **Definições** | Gestão de escritórios, seed de dados e acesso a módulos administrativos |
| **Gerir Calendários** | Publicação e manutenção dos calendários |
| **Auditoria** | Histórico das alterações da app |

---

## Stack

- **Frontend:** HTML5, CSS3, JavaScript ES6+ sem framework
- **Fontes:** Inter (corpo/UI) + Poppins (títulos/headings)
- **Auth:** Firebase Authentication (Email/Password)
- **Base de dados:** Firestore
- **Storage:** Firebase Storage
- **Tempo real:** listeners Firestore com `onSnapshot()`
- **UI partilhada:** scripts globais carregados por página
- **Segurança:** `firestore.rules` com controlo por utilizador, permissão e escritório

---

## Visual e temas

### Sistema de fontes

Toda a app usa:
- **Inter** — corpo de texto, inputs, botões, labels
- **Poppins** — títulos (`h1`, headings de painéis, nomes em negrito)

### Tokens de cor base

```css
--bg: #f1f5f9      /* fundo da página */
--surface: #fff    /* cards e painéis */
--border: #e2e8f0  /* bordas */
--text: #0f172a    /* texto principal */
--muted: #94a3b8   /* texto secundário */
--accent: #0284c7  /* cor de ação (muda com o tema) */
```

### Temas de cor

O dashboard tem um personalizador com 4 temas. O tema ativo é guardado em Firestore (`preferencias.dashboard.themePreset`) e aplicado em todas as páginas via atributo `data-theme` no `<html>`.

| Tema | Accent | Sidebar |
|---|---|---|
| `default` | Sky blue `#0284c7` | Navy `#0f172a` |
| `forest` | Teal `#0f766e` | Dark teal `#12312b` |
| `sunset` | Orange `#c2410c` | Dark brown `#3c1f12` |
| `violet` | Violet `#7c3aed` | Dark purple `#21163d` |

O ficheiro `js/dashboard-customizer.js` gere a selecção e persistência do tema.

### Arquitectura CSS

Existem duas estratégias de CSS conforme a página:

**Páginas que carregam `styles.css`** (base partilhada):
`tarefas`, `admissoes`, `reclamacoes`, `utilizadores`, `auditoria`, `seed`, `perfis`, `chat`

**Páginas com CSS standalone** (têm o seu próprio `@import` e `:root`):
`comunicados`, `calendario`, `gerir-calendarios`, `escalas`, `definicoes`

Ambas as estratégias têm os blocos `[data-theme]` para que a cor de destaque mude com o tema seleccionado.

---

## Arquitetura atual

### 1. Base comum da app

| Ficheiro | Função |
|---|---|
| `js/firebase-init.js` | Inicialização do Firebase (expõe `window.firebaseAuth`, `window.firebaseDb`) |
| `js/utils.js` | Utilitários partilhados (datas, UI, strings, `window.escHtml`, `window.toast`) |
| `js/auth.js` | Autenticação, sessão e helpers de permissão (`window.temPermissao`, `window.isAdmin`) |
| `js/auditoria.js` | Registo de alterações no Firestore (`window.registarAuditoria`) |
| `js/users-service.js` | Serviço de utilizadores (CRUD, listeners, permissões) |
| `js/offices-service.js` | Serviço de escritórios (CRUD, ordenação, cleanup) |
| `js/tasks-service.js` | Serviço de domínio para tarefas |
| `js/comunicados-service.js` | Serviço de domínio para comunicados |
| `js/chat-service.js` | Serviço de domínio para chat (conversas, mensagens, lidos) |
| `js/perfis-service.js` | Serviço de perfis de permissão (`window.PerfisService`) |
| `js/config-escritorios.js` | Cache e helpers de escritório activo |
| `js/module-registry.js` | Registry central dos módulos (navegação, ordem, visibilidade) |
| `js/app-platform.js` | Bootstrap, navbar, sidebar, topbar e listeners de plataforma |
| `js/dashboard-customizer.js` | Gestão de temas de cor e personalização do dashboard |

### 2. Entidades nucleares

Os dois pilares da app são **Utilizadores** e **Escritórios**. Qualquer módulo novo deve encaixar na mesma lógica de:

- autenticação e sessão
- permissões por perfil/role/utilizador
- escritório activo como âmbito (ou `usesEscritorio: false` para módulos cross-office)
- navegação via module registry
- auditoria de alterações

### 3. Shell da app

O `app-platform.js` injeta automaticamente em todas as páginas protegidas:

- **Sidebar** esquerda com navegação por módulo (cor muda com tema)
- **Topbar** com título da página, escritório activo e avatar do utilizador
- **Menu mobile** de módulos

---

## Estrutura principal de ficheiros

```text
hub-algartempo/
│
├── styles.css                  ← base partilhada (Inter, tokens, temas, componentes)
├── login.html
├── dashboard.html
├── chat.html
├── perfis.html
├── seed.html
│
├── css/
│   ├── login.css
│   ├── dashboard.css
│   ├── chat.css                ← usa styles.css como base
│   ├── perfis.css              ← usa styles.css como base
│   ├── comunicados.css         ← standalone (tem :root próprio + temas)
│   ├── calendario.css          ← standalone
│   ├── gerir-calendarios.css   ← standalone
│   ├── escalas.css             ← standalone
│   ├── definicoes.css          ← standalone
│   ├── tarefas.css             ← usa styles.css como base
│   ├── admissoes.css           ← usa styles.css como base
│   ├── reclamacoes.css         ← usa styles.css como base
│   ├── utilizadores.css        ← usa styles.css como base
│   └── auditoria.css           ← usa styles.css como base
│
├── js/
│   ├── firebase-init.js
│   ├── utils.js
│   ├── auth.js
│   ├── auditoria.js
│   ├── users-service.js
│   ├── offices-service.js
│   ├── tasks-service.js
│   ├── comunicados-service.js
│   ├── chat-service.js
│   ├── perfis-service.js
│   ├── config-escritorios.js
│   ├── module-registry.js
│   ├── app-platform.js
│   ├── dashboard-customizer.js
│   ├── dashboard.js
│   ├── tarefas.js
│   ├── comunicados.js
│   ├── admissoes.js
│   ├── reclamacoes.js
│   ├── calendario.js
│   ├── escalas.js
│   ├── chat.js
│   ├── perfis.js
│   ├── definicoes.js
│   ├── utilizadores.js
│   ├── gerir-calendarios.js
│   └── auditoria-page.js
│
├── templates/
│   ├── module-template.html
│   ├── module-template.js
│   └── module-template.css
│
├── firestore.rules
├── firestore.indexes.json      ← índice composto para chat (conversas)
├── storage.rules
├── firebase.json
└── .firebaserc
```

---

## Ordem de carregamento nas páginas protegidas

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<!-- Base comum (ordem importa) -->
<script src="js/firebase-init.js"></script>
<script src="js/utils.js"></script>
<script src="js/module-registry.js"></script>
<script src="js/auth.js"></script>
<script src="js/offices-service.js"></script>
<script src="js/config-escritorios.js"></script>
<script src="js/app-platform.js"></script>

<!-- Módulo da página -->
<script src="js/[pagina].js"></script>
```

Se a página usar auditoria: carregar `js/auditoria.js` depois de `auth.js`.
Se a página usar o serviço de utilizadores: carregar `js/users-service.js` depois de `auth.js`.

---

## Bootstrap de páginas protegidas

```js
window.bootProtectedPage({
  activePage: 'tarefas',
  moduleId: 'tarefas',
}, ({ profile, isAdmin, escritorio }) => {
  // inicialização da página
});
```

Para páginas administrativas (apenas admins):

```js
window.bootProtectedPage({
  activePage: 'utilizadores',
  moduleId: 'utilizadores',
  requireAdmin: true,
}, ({ profile }) => {
  // só admins chegam aqui
});
```

---

## Regra para módulos novos

1. Criar `[modulo].html`, `js/[modulo].js`, `css/[modulo].css`
2. Registar em `js/module-registry.js`:

```js
{
  id: 'frota',
  label: 'Frota',
  href: 'frota.html',
  group: 'main',
  order: 70,
  adminOnly: false,
  requiredPermissions: ['modules.frota.view'],
  usesEscritorio: true,
}
```

3. Carregar a stack comum antes do script do módulo
4. Usar `window.bootProtectedPage()` no JS do módulo
5. Se tiver dados próprios, criar `js/[modulo]-service.js`
6. Para CSS standalone: copiar o bloco `:root` + `[data-theme]` de um módulo existente
7. Partir dos templates em `templates/`
8. **Integrar com escritórios desde o início** — usar seletor de pills para admin, subtítulo com escritório ativo para utilizador comum
9. **Adicionar permissões ao `perfis-service.js`** — em `MODULE_ACTIONS` para incluir o novo módulo nos perfis configuráveis

---

## APIs globais disponíveis

| API | Função |
|---|---|
| `window.userProfile` | Objeto do utilizador autenticado |
| `window.currentUser` | Objeto Firebase Auth |
| `window.temPermissao(p)` | Verifica permissão do utilizador atual |
| `window.temPermissaoNoPerfil(profile, p)` | Verifica permissão num perfil arbitrário |
| `window.escritorioAtivo()` | ID do escritório activo |
| `window.loadEscritorios()` | Lista de escritórios (Promise) |
| `window.getEscritoriosSync()` | Lista de escritórios (síncrono, da cache) |
| `window.nomeEscritorio(id)` | Nome legível do escritório |
| `window.renderNavbar(page)` | Re-renderiza sidebar + topbar |
| `window.isAdmin()` | Verifica se é admin |
| `window.registarAuditoria({acao, dados})` | Grava entrada de auditoria |
| `window.PerfisService` | API de perfis de permissão |
| `window.ChatService` | API de chat (conversas e mensagens) |
| `firebase.firestore()` | Referência Firestore (usar diretamente; `window.db` não existe) |

> **Nota:** `firebase-init.js` expõe `window.firebaseAuth` e `window.firebaseDb` mas a convenção nos services é usar `firebase.firestore()` diretamente.

---

## Sistema de permissões

### Arquitetura

As permissões são escritas diretamente no documento do utilizador (`utilizadores/{uid}.permissoes`) em formato canónico. As Firestore Rules lêem estas permissões via `map.get()` dinâmico — não precisam de switch hardcoded por módulo.

### Perfis de permissão

Os perfis são geridos em `config/perfis` e atribuídos via `perfis.html`. Quando um perfil é aplicado a um utilizador, as suas permissões são **denormalizadas** para `utilizadores/{uid}.permissoes`. Assim:

- Firestore Rules lêem apenas um documento por pedido
- Não há `get()` extra nas rules
- Atualizar um perfil propaga automaticamente a todos os utilizadores com esse perfil

| Perfil | Descrição |
|---|---|
| **Rececionista** | Ver tudo, criar admissões |
| **Técnico** | Criar e gerir tarefas, admissões, reclamações |
| **Gestor RH** | Acesso completo a todos os módulos operacionais |
| **Gestor Operacional** | Como Gestor RH mas sem admissões |

### Permissões canónicas

Padrão: `modules.<modulo>.<acao>`

| Ação | Descrição |
|---|---|
| `view` | Ver o módulo (se `false`, o módulo não aparece na navegação) |
| `create` | Criar novos registos |
| `resolve` | Gerir/fechar registos existentes |
| `edit` | Editar conteúdo (calendário) |
| `manage` | Criar, editar e apagar (comunicados, reclamações, escalas) |

### Permissões legacy (ainda em uso para compatibilidade)

`criarTarefas`, `resolverTarefas`, `gerirComunicados`, `criarAdmissoes`, `resolverAdmissoes`, `editarCalendario`, `criarReclamacoes`

Estas são mapeadas para as canónicas em `auth.js` (`LEGACY_PERMISSION_MAP`) e nas Firestore Rules (`legacyPerm`).

---

## Lógica de escritórios

Guardados em `config/escritorios`. Formato:

```js
{
  id: 'quarteira',
  nome: 'Quarteira',
  cor: '#0284c7',
  default: true,
  ativo: true,
  ordem: 10
}
```

Escritórios inativos não aparecem nos módulos. O escritório default serve de fallback. Novos módulos devem consumir via `loadEscritorios()`, nunca arrays hardcoded.

Módulos cross-office (como chat) devem declarar `usesEscritorio: false` no module registry.

---

## Estrutura Firestore

| Coleção | Estrutura | Notas |
|---|---|---|
| `utilizadores/{uid}` | Perfil, permissões, escritório | Fonte de verdade das rules |
| `config/escritorios` | `{ lista: [...] }` | Lista de escritórios |
| `config/perfis` | `{ lista: [...] }` | Perfis de permissão |
| `tarefas_todo/{id}` | Tarefa com `escritorio` | Filtrado por escritório |
| `comunicados/{id}` | Comunicado com `destinosEscritorio` | Filtrado por destinos |
| `admissoes/{id}` | Processo com `escritorio` | Filtrado por escritório |
| `reclamacoes_horas/{id}` | Reclamação com `escritorio` | Filtrado por escritório |
| `calendarios/{id}` | Calendário | Acesso universal |
| `escalas/{escritorioId}/dias/{YYYY-MM-DD}` | Escala diária | Sub-coleção por escritório |
| `conversas/{id}` | Conversa com `participantes[]` | Cross-office |
| `conversas/{id}/mensagens/{id}` | Mensagem individual | Imutável após criação |
| `chat_lidos/{uid}_{conversaId}` | Timestamp de último lido | Por utilizador |
| `auditoria/{id}` | Entrada de auditoria | Append-only |

---

## Firestore Rules

Ficheiro: `firestore.rules`

- Leitura/escrita apenas para utilizadores autenticados
- Permissões verificadas via `canonicalPerm(module, action)` com `map.get()` dinâmico — **escalável para qualquer módulo novo sem alterar as rules**
- Fallback `legacyPerm(module, action)` para permissões antigas durante migração
- Controlo por escritório via `officeMatches()` e `destinosMatch()`
- Chat protegido por `participantes[]`
- Auditoria append-only (update/delete proibidos)

---

## Firebase CLI

- **projectId:** `hub-algartempo`

```bash
# Login
firebase login --reauth
firebase use hub-algartempo

# Deploy regras + índices (recomendado após alterações)
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project hub-algartempo

# Deploy storage
firebase deploy --only storage
```

> Usar `npx firebase-tools` em vez de `firebase` para evitar problemas de execution policy no Windows.

Testar localmente:

```bash
firebase emulators:start --only firestore,storage
```

---

## Testar localmente

Com VS Code + Live Server:

1. Abrir a pasta do projeto
2. Abrir `login.html` com Live Server
3. Testar a app a partir do browser

---

## Limitações conhecidas

| Item | Estado |
|---|---|
| Firestore Security Rules | Precisam de endurecimento antes de produção |
| Criação de utilizadores | Feita do lado do cliente admin |
| Dark mode | Estrutura preparada (classe `.dark`) mas não implementado na maioria das páginas |
| Migração dados escalas | Dados no path antigo `escalas/{date}` não são lidos; novo path é `escalas/{escritorioId}/dias/{date}` |

---

## Próximos passos recomendados

- [ ] Endurecer Firestore Rules e Storage Rules antes de produção
- [ ] Migrar criação de utilizadores para backend/server-side
- [ ] Implementar dark mode completo
- [ ] Migrar dados existentes de escalas para o novo path com sub-coleção
- [ ] Adicionar testes para fluxos críticos de auth, escritório e permissões
