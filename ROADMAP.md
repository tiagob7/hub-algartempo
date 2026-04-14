# Roadmap

Plano tecnico curto para evoluir a base atual de `hub-algartempo` sem voltar a misturar modulos ativos, prototipos e arquitetura.

---

## Fase 1 - Estabilizar a base

Objetivo: garantir que a base atual fica previsivel, segura e pronta para crescer.

Tarefas:

1. Rever `firestore.rules` e `storage.rules` com dados reais do projeto novo.
2. Validar login, criacao de utilizadores, criacao de escritorios e uploads no projeto `hub-algartempo`.
3. Limpar referencias antigas ou texto legado que ainda fale em `Calendario`.
4. Rever `storage.rules` para usar regras mais especificas por modulo.

---

## Fase 2 - Consolidar services

Objetivo: tirar cada vez mais logica de Firestore das paginas.

Tarefas:

1. Refinar os services de dominio ja criados:
   - `tasks-service.js`
   - `comunicados-service.js`
   - `admissoes-service.js`
   - `reclamacoes-service.js`
   - `calendario-service.js`
2. Centralizar auditoria dentro dos services quando a alteracao for sensivel.
3. Reduzir o uso de `collection().doc().update()` diretamente nas paginas.

---

## Fase 3 - Permissoes e escritorio

Objetivo: tornar a logica de acesso completamente consistente.

Tarefas:

1. Migrar definitivamente os perfis antigos para `permissoes.modules.*`.
2. Rever as regras por escritorio em leitura e escrita.
3. Decidir se vais suportar no futuro:
   - `escritoriosPermitidos[]`
   - modulos visiveis por escritorio
   - scopes mais granulares

---

## Fase 4 - Modulos novos

Objetivo: construir novas ferramentas sem improviso.

Regra:

1. Criar HTML, JS e CSS do modulo.
2. Registar no `module-registry.js`.
3. Arrancar com `bootProtectedPage(...)`.
4. Criar `js/<modulo>-service.js` se tiver dados proprios.
5. Usar a pasta `templates/` como ponto de partida.

---

## Fase 5 - Qualidade e operacao

Objetivo: preparar a app para crescer com menos risco.

Tarefas:

1. Criar checklist de release:
   - rules publicadas
   - modulo registado
   - permissao configurada
   - escritorio validado
   - smoke test manual
2. Criar ambiente de teste mais controlado se necessario.
3. Documentar melhor os dados base em `config` e `utilizadores`.

---

## Proximos passos recomendados

Se fores continuar ja, a melhor ordem e:

1. validar a base no projeto Firebase novo
2. rever rules com dados reais
3. escolher o proximo modulo novo a construir
4. cria-lo diretamente em cima do template novo
