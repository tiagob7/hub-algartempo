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
| **Escalas** | Gestão de escalas de trabalho |
| **Utilizadores** | Criação de contas, roles e permissões granulares |
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
`tarefas`, `admissoes`, `reclamacoes`, `utilizadores`, `auditoria`, `seed`

**Páginas com CSS standalone** (têm o seu próprio `@import` e `:root`):
`comunicados`, `calendario`, `gerir-calendarios`, `escalas`, `definicoes`

Ambas as estratégias têm os blocos `[data-theme]` para que a cor de destaque mude com o tema seleccionado. Os ficheiros CSS standalone também incluem estes overrides directamente.

### Botões primários

Todos os botões de acção primária usam `background: var(--accent)`, que muda automaticamente com o tema. Nunca usar `background: var(--text)` para botões de acção.

---

## Arquitetura atual

### 1. Base comum da app

| Ficheiro | Função |
|---|---|
| `js/firebase-init.js` | Inicialização do Firebase |
| `js/utils.js` | Utilitários partilhados (datas, UI, strings) |
| `js/auth.js` | Autenticação, sessão e helpers de permissão |
| `js/auditoria.js` | Registo de alterações no Firestore |
| `js/users-service.js` | Serviço de utilizadores (CRUD, listeners, permissões) |
| `js/offices-service.js` | Serviço de escritórios (CRUD, ordenação, cleanup) |
| `js/tasks-service.js` | Serviço de domínio para tarefas |
| `js/comunicados-service.js` | Serviço de domínio para comunicados |
| `js/config-escritorios.js` | Cache e helpers de escritório activo |
| `js/module-registry.js` | Registry central dos módulos (navegação, ordem, visibilidade) |
| `js/app-platform.js` | Bootstrap, navbar, sidebar, topbar e listeners de plataforma |
| `js/dashboard-customizer.js` | Gestão de temas de cor e personalização do dashboard |

### 2. Entidades nucleares

Os dois pilares da app são **Utilizadores** e **Escritórios**. Qualquer módulo novo deve encaixar na mesma lógica de:

- autenticação e sessão
- permissões por role/utilizador
- escritório activo como âmbito
- navegação via module registry
- auditoria de alterações

### 3. Shell da app

O `app-platform.js` injeta automaticamente em todas as páginas protegidas:

- **Sidebar** esquerda com navegação por módulo (cor muda com tema)
- **Topbar** com título da página, escritório activo e avatar do utilizador
- **Menu mobile** de módulos

O item activo na sidebar usa cores adaptadas ao tema seleccionado.

---

## Estrutura principal de ficheiros

```text
hub-algartempo/
│
├── styles.css                  ← base partilhada (Inter, tokens, temas, componentes)
├── login.html
├── dashboard.html
├── seed.html
│
├── css/
│   ├── login.css
│   ├── dashboard.css
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

<!-- Base comum -->
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
  requiredPermissions: [],
  usesEscritorio: true,
}
```

3. Carregar a stack comum antes do script do módulo
4. Usar `window.bootProtectedPage()` no JS do módulo
5. Se tiver dados próprios, criar `js/[modulo]-service.js`
6. Para CSS standalone: copiar o bloco `:root` + `[data-theme]` de um módulo existente
7. Partir dos templates em `templates/`

---

## APIs globais disponíveis

| API | Função |
|---|---|
| `window.userProfile` | Objeto do utilizador autenticado |
| `window.temPermissao(p)` | Verifica permissão |
| `window.escritorioAtivo()` | ID do escritório activo |
| `window.loadEscritorios()` | Lista de escritórios |
| `window.renderNavbar(page)` | Re-renderiza sidebar + topbar |
| `window.db` | Referência Firestore |
| `window.isAdmin()` | Verifica se é admin |

---

## Sistema de permissões

### Permissões actuais (em uso)

| Permissão | Permite |
|---|---|
| `criarTarefas` | Criar tarefas |
| `resolverTarefas` | Alterar estado de tarefas |
| `gerirComunicados` | Criar, editar e arquivar comunicados |
| `criarAdmissoes` | Criar processos de admissão/cessação |
| `resolverAdmissoes` | Alterar estado de admissões/cessações |
| `editarCalendario` | Editar calendário de trabalho |
| `criarReclamacoes` | Criar reclamações internas de horas |

### Permissões canónicas (para módulos novos)

Padrão: `modules.<modulo>.<acao>`

Exemplos: `modules.frota.view`, `modules.frota.create`, `modules.frota.edit`

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

---

## Firestore Rules

Ficheiro: `firestore.rules`

- Leitura/escrita apenas para utilizadores autenticados
- Perfil do utilizador como fonte de verdade para `role`, `ativo` e `permissoes`
- Controlo por módulo e por escritório quando aplicável
- Fallback legacy para permissões antigas durante migração

Estas rules são uma primeira base e devem ser revistas antes de deploy final.

---

## Firebase CLI

- **projectId:** `hub-algartempo`

```bash
firebase login --reauth
firebase use hub-algartempo
firebase deploy --only firestore:rules
firebase deploy --only storage
```

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
| Permissões | Ainda centradas no frontend |
| Criação de utilizadores | Feita do lado do cliente admin |
| Dark mode | Estrutura preparada (classe `.dark`) mas não implementado |

---

## Próximos passos recomendados

- [ ] Endurecer Firestore Rules e Storage Rules
- [ ] Migrar criação de utilizadores para backend/server-side
- [ ] Evoluir permissões para convenção canónica por módulo
- [ ] Implementar dark mode (variáveis e lógica de toggle já previstas)
- [ ] Adicionar testes para fluxos críticos de auth, escritório e permissões
