# Algartempo - Gestao Interna

Sistema interno de gestao multi-escritorio para RH e operacoes, construido em HTML/CSS/JavaScript puro com Firebase.

---

## O que esta app faz

| Modulo | Descricao |
|---|---|
| **Dashboard** | Painel geral com KPIs, layout personalizavel, pesquisa global e acesso rapido aos modulos |
| **Tarefas** | Criacao, filtro, estado e prioridade de tarefas por escritorio |
| **Comunicados** | Comunicados internos por tipo e por destino |
| **Admissoes** | Processos de admissao e cessacao com anexos e modo gestor |
| **Reclamacoes** | Gestao de reclamacoes de horas com exportacao e anexos |
| **Calendario** | Editor de carga de trabalho por escritorio/departamento/mes |
| **Escalas** | Gestao de escalas de trabalho |
| **Utilizadores** | Criacao de contas, roles e permissoes granulares |
| **Definicoes** | Gestao de escritorios e acesso aos modulos administrativos |
| **Gerir Calendarios** | Publicacao e manutencao dos calendarios |
| **Auditoria** | Historico das alteracoes da app |

---

## Stack

- **Frontend:** HTML5, CSS3, JavaScript ES6+ sem framework
- **Auth:** Firebase Authentication (Email/Password)
- **Base de dados:** Firestore
- **Storage:** Firebase Storage
- **Tempo real:** listeners Firestore com `onSnapshot()`
- **UI partilhada:** scripts globais carregados por pagina
- **Seguranca:** `firestore.rules` com controlo por utilizador, permissao e escritorio

---

## Paginas fora de ambito

Estas paginas existem no repositorio mas sao tratadas como testes/prototipos e **nao fazem parte da base principal atual**:

- `reclamacao-bot.html`
- `reclamacao-bot2.html`
- `reclamacao-publica.html`
- `reclamacao-publica2.html`
- `separador_recibos_v11.2.html`
- `voz-teste.html`

Ao evoluir a arquitetura principal, estas paginas podem ser ignoradas.

---

## Arquitetura atual

### 1. Base comum da app

A app passou a ter uma camada comum para suportar modulos novos sem repetir logica:

| Ficheiro | Funcao |
|---|---|
| `js/module-registry.js` | Registry central dos modulos da app, com id, rota, grupo, ordem e regras de visibilidade |
| `js/users-service.js` | Servico comum de utilizadores, com criacao de contas, updates, permissoes e listeners |
| `js/offices-service.js` | Servico comum de escritorios, com leitura, escrita, ordenacao e remocao com cleanup |
| `js/tasks-service.js` | Servico de dominio para tarefas |
| `js/comunicados-service.js` | Servico de dominio para comunicados |
| `js/config-escritorios.js` | Servico comum de escritorios, com cache, escritorio default, escritorios ativos e helpers de consulta |
| `js/app-platform.js` | Camada de plataforma para navbar, escritorio ativo, bootstrap comum de paginas protegidas e integracao da navegacao com o registry |
| `js/auth.js` | Autenticacao, sessao e helpers de permissao |
| `js/utils.js` | Utilitarios partilhados |
| `js/auditoria.js` | Registo de alteracoes no Firestore |

### 2. Entidades nucleares

Os dois pilares de integracao da app sao:

- **Utilizadores**
- **Escritorios**

Isto significa que qualquer ferramenta nova deve encaixar na mesma logica de:

- autenticacao
- permissao
- escritorio ativo
- navegacao
- auditoria

### 3. Criadores principais

As paginas mais importantes para a expansao da app sao:

- [utilizadores.html](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/utilizadores.html)
- [definicoes.html](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/definicoes.html)

Elas nao sao apenas paginas administrativas. Funcionam como ponto de entrada para a configuracao comum que os modulos novos vao reutilizar.

---

## Estrutura principal de ficheiros

```text
Calendario/
|
|-- styles.css
|-- css/
|   |-- dashboard.css
|   |-- tarefas.css
|   |-- comunicados.css
|   |-- admissoes.css
|   |-- reclamacoes.css
|   |-- calendario.css
|   |-- escalas.css
|   |-- definicoes.css
|   |-- utilizadores.css
|   |-- gerir-calendarios.css
|   `-- auditoria.css
|
|-- js/
|   |-- firebase-init.js
|   |-- utils.js
|   |-- auth.js
|   |-- auditoria.js
|   |-- users-service.js
|   |-- offices-service.js
|   |-- tasks-service.js
|   |-- comunicados-service.js
|   |-- config-escritorios.js
|   |-- module-registry.js
|   |-- app-platform.js
|   |-- dashboard.js
|   |-- tarefas.js
|   |-- comunicados.js
|   |-- admissoes.js
|   |-- reclamacoes.js
|   |-- calendario.js
|   |-- escalas.js
|   |-- definicoes.js
|   |-- utilizadores.js
|   |-- gerir-calendarios.js
|   `-- auditoria-page.js
|
|-- dashboard.html
|-- tarefas.html
|-- comunicados.html
|-- admissoes.html
|-- reclamacoes.html
|-- calendario.html
|-- escalas.html
|-- definicoes.html
|-- utilizadores.html
|-- gerir-calendarios.html
`-- auditoria.html
```

Tambem existe agora:

- `.firebaserc`
- `firestore.rules`
- `storage.rules`
- `firebase.json`
- `templates/module-template.html`
- `templates/module-template.js`
- `templates/module-template.css`

---

## Ordem de carregamento nas paginas protegidas

Ordem recomendada:

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

<!-- Modulo da pagina -->
<script src="js/[pagina].js"></script>
```

Notas:

- `module-registry.js` define os modulos e a sua ordem/visibilidade.
- `offices-service.js` guarda a logica principal de escritorios.
- `tasks-service.js` e `comunicados-service.js` sao os primeiros services de dominio e mostram o padrao para extrair Firestore das paginas.
- `config-escritorios.js` funciona como camada de compatibilidade para a API global ja usada pelos modulos.
- `app-platform.js` cola a navegacao, o escritorio ativo e o bootstrap das paginas ao resto da app.

### Firestore Rules

O projeto passa a ter uma base inicial em [firestore.rules](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/firestore.rules) com estas ideias:

- leitura/escrita apenas para utilizadores autenticados
- perfil de utilizador como fonte de verdade para `role`, `ativo` e `permissoes`
- controlo por modulo
- controlo por escritorio quando aplicavel
- fallback legacy para as permissoes antigas durante a migracao

Estas rules sao uma primeira base e devem ser revistas antes de deploy final, especialmente para anexos, auditoria e colecoes que ainda nao foram totalmente migradas para services.

### Firebase CLI

O workspace ja ficou preparado para o projeto Firebase:

- `projectId`: `hub-algartempo`
- default local em [/.firebaserc](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/.firebaserc)
- config em [firebase.json](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/firebase.json)
- web app configurada em [js/firebase-init.js](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/js/firebase-init.js)

Comandos uteis:

```bash
cmd /c firebase login --reauth
cmd /c firebase use hub-algartempo
cmd /c firebase deploy --only firestore:rules
cmd /c firebase deploy --only storage
```

Se quiseres testar localmente:

```bash
cmd /c firebase emulators:start --only firestore,storage
```

### Bootstrap comum

As paginas protegidas devem arrancar com `window.bootProtectedPage(...)` em vez de registarem toda a logica de auth manualmente.

Exemplo:

```js
window.bootProtectedPage({
  activePage: 'tarefas',
  moduleId: 'tarefas',
}, ({ profile, isAdmin, escritorio }) => {
  // inicializacao da pagina
});
```

Se a pagina for administrativa:

```js
window.bootProtectedPage({
  activePage: 'utilizadores',
  moduleId: 'utilizadores',
  requireAdmin: true,
}, ({ profile }) => {
  // inicializacao da pagina
});
```

---

## Regra para modulos novos

Quando fores criar uma ferramenta nova, a ideia agora e esta:

1. Criar a pagina HTML e o JS/CSS do modulo.
2. Adicionar o modulo ao `js/module-registry.js`.
3. Carregar a stack comum da app.
4. Usar a mesma logica de escritorio ativo e permissao.

### Permissoes por modulo

A app passou a suportar permissoes canonicas por modulo, por exemplo:

- `modules.tarefas.view`
- `modules.tarefas.create`
- `modules.tarefas.resolve`
- `modules.comunicados.manage`
- `modules.admissoes.create`
- `modules.admissoes.resolve`
- `modules.calendario.edit`

As permissoes antigas continuam a funcionar por compatibilidade, mas o padrao novo para modulos futuros deve usar as chaves `modules.<modulo>.<acao>`.

### Exemplo minimo

Se criares um modulo novo `frota.html`:

1. Criar:
   - `frota.html`
   - `js/frota.js`
   - `css/frota.css`

2. Registar em `js/module-registry.js` algo do genero:

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

3. Na pagina, carregar a base comum antes do script do modulo.

4. No JS do modulo, assumir:
   - `window.userProfile`
   - `window.temPermissao()`
   - `window.escritorioAtivo()`
   - `window.loadEscritorios()`
   - `window.renderNavbar()`
   - `window.bootProtectedPage()`

5. Se o modulo tiver dados proprios, criar um service dedicado em `js/<modulo>-service.js`.

6. Podes partir do template em:
   - [module-template.html](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/templates/module-template.html)
   - [module-template.js](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/templates/module-template.js)
   - [module-template.css](C:/Users/Tiago/Documents/GitHub/CalendarioGPT/Calendario/templates/module-template.css)

Isto faz com que o novo modulo entre na mesma logica de navegacao e segmentacao.

---

## Logica de escritorios

Os escritorios vivem em:

- `config/escritorios`

Formato esperado da lista:

```js
[
  {
    id: 'quarteira',
    nome: 'Quarteira',
    cor: '#2563eb',
    default: true,
    ativo: true,
    ordem: 10
  }
]
```

### Campos

- `id`: identificador interno estavel
- `nome`: nome visivel
- `cor`: cor usada na UI
- `default`: escritorio por omissao
- `ativo`: se entra nos modulos e filtros
- `ordem`: ordem de apresentacao

### Regras

- Escritorios inativos nao devem aparecer nos fluxos normais.
- O escritorio default serve de fallback quando necessario.
- Novos modulos devem consumir a lista via `loadEscritorios()` e nao via arrays hardcoded.

---

## Logica de utilizadores

Colecao:

- `utilizadores/{uid}`

Campos principais:

- `uid`
- `nome`
- `apelido`
- `nomeCompleto`
- `email`
- `escritorio`
- `role`
- `ativo`
- `permissoes{}`
- `ultimoAcesso`

### Regras de negocio atuais

- `admin` ve todos os modulos e tem todas as permissoes.
- `colaborador` depende das permissoes atribuidas.
- O escritorio do utilizador define o seu escopo normal na app.

---

## Sistema de permissoes atual

Permissoes existentes:

| Permissao | Permite |
|---|---|
| `criarTarefas` | Criar tarefas |
| `resolverTarefas` | Alterar estado de tarefas |
| `gerirComunicados` | Criar, editar e arquivar comunicados |
| `criarAdmissoes` | Criar processos de admissao/cessacao |
| `resolverAdmissoes` | Alterar estado de admissoes/cessacoes |
| `editarCalendario` | Editar calendario de trabalho |
| `criarReclamacoes` | Criar reclamacoes internas de horas |

No futuro, a recomendacao e evoluir para permissoes mais orientadas por modulo, mas a base atual continua funcional.

---

## Configuracao inicial

### 1. Ativar Authentication

1. Abrir o projeto no Firebase Console
2. Ir a `Authentication`
3. Ativar `Email/Password`

### 2. Criar o primeiro admin

Opcao simples:

1. Abrir `login.html`
2. Criar conta
3. Promover manualmente no Firestore:
   - `utilizadores/{uid}.role = "admin"`

### 3. Configurar escritorios

Pela app:

- `definicoes.html` -> painel `Escritorios`

Ou diretamente no Firestore:

- `config/escritorios`

---

## Testar localmente

Com VS Code + Live Server:

1. Abrir a pasta do projeto
2. Abrir `login.html` com Live Server
3. Testar a app a partir do browser

---

## Limitacoes conhecidas

| Item | Estado |
|---|---|
| Firestore Security Rules | Ainda precisam de endurecimento antes de producao |
| Permissoes | Ainda estao muito centradas no frontend |
| Dashboard | Ainda ha zonas com leitura ampla e filtro no cliente |
| Criacao de utilizadores | Continua a ser feita do cliente admin |
| Integracoes de teste | Mantidas no repo mas fora do fluxo principal |

---

## Proximos passos recomendados

- [ ] Endurecer Firestore Rules e Storage Rules
- [ ] Migrar criacao de utilizadores para backend/server-side quando for altura
- [ ] Evoluir o sistema de permissoes para uma convencao por modulo
- [ ] Fazer o dashboard consumir mais configuracao do registry e menos hardcode visual
- [ ] Criar um template oficial para modulos novos
- [ ] Adicionar testes para fluxos criticos de auth, escritorio e permissoes

---

## Resumo pratico

Hoje a app ja tem uma base comum para crescer:

- os **utilizadores** definem acesso e escopo
- os **escritorios** definem segmentacao e organizacao
- o **module registry** define como cada ferramenta entra na app

Ou seja: a partir daqui, criar uma nova ferramenta deve passar por integrar no mesmo sistema, e nao por reinventar autenticacao, escritorio, navbar ou permissao em cada pagina.
