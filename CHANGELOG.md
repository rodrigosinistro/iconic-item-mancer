# CHANGELOG — Iconic Item Mancer

## v2.0.8 — 2026-10-29
- Preparação da versão estável aprovada para publicação manual no repositório `rodrigosinistro/iconic-item-mancer`.
- `module.json` com versão 2.0.8, compatibilidade Foundry v14 / D616 v0.2.99+, URL do manifesto na branch `main` e link para download do ZIP na release `v2.0.8`.
- README atualizado com funcionalidades atuais, seis etapas, poderes associados ao HUD, migração, instalação pelo manifesto e passos de publicação no GitHub.
- Nenhuma mudança nas mecânicas, na interface ou na integração funcional validada da v2.0.7.

## v2.0.7 — 2026-10-29
- Poderes exclusivos de Iconic Item (exceto a propriedade Weapon) passam a gerar snapshots independentes `type: power` em `flags.multiverse-d616.attachedPowers` e aparecem na aba Poderes do Item.
- Atalhos no HUD nativo do D616 para os poderes especiais associados; Bandaging possui clique próprio, enquanto os outros poderes exibem o efeito para consulta sem rolagens fictícias.
- Migração automática e idempotente de itens já criados, no diretório e no inventário de personagens: mantém os poderes comuns e as cópias especiais editadas.
- Automação passiva Bandaging continua separada da associação ao HUD, com observação adicional de mensagens de dano de Sangramento como recuperação tardia; a eficiência depende de teste no Foundry.
- Mantidas as seis etapas do assistente e as regras de criação. Nenhum arquivo do sistema D616 é alterado.

## v2.0.6 — 2026-10-29
- Bandaging passa a impedir preventivamente a criação de um ActiveEffect exclusivamente Sangrando, desde que o item esteja ativo e a aplicação esteja ocorrendo no GM principal; isto evita a dependência da conclusão dos hooks posteriores e do avanço do combate.
- Mantido o mecanismo de remoção de Sangramento já existente (em Actor, Token e ActorDelta), sem mexer nas regras D616.
- Detecção de item no inventário de Actor sintético tolera wrappers de parent/UUID diferentes; amplia compatibilidade de status ainda não persistidos (`_source`).
- Botão **Testar Bandaging** na ficha de itens que contenham esse poder, visível ao GM, com diagnóstico específico e tentativa segura de remoção.
- Relatório do console agora distingue GM autorizado, estado ativo do item e detecção de condições.
- Novos testes automatizados para bloqueio preventivo, Worn, GM, inventário sintético e `_source`.

## v2.0.5 — 2026-10-29
- Correção de Bandaging para condições armazenadas no TokenDocument e em Actors sintéticos de tokens não vinculados, além de Actor.effects.
- Hooks adicionais de Token, ActorDelta e combate; verificação antes e depois de avançar turno para reduzir condições persistentes.
- Compatibilidade com variações de propriedade do Item que representam a mesma ficha por UUID.
- Exibe diagnóstico detalhado no console com `game.iconicItemMancer.diagnoseBandaging()` e oferece rechecagem manual com `rescanBandaging()`.
- Confirma a cura somente se Sangrando estiver efetivamente ausente, sem remover outros efeitos ou modificar Health.
- Nenhuma alteração às seis etapas, à interface de criação ou aos arquivos do sistema.

## v2.0.4 — 2026-10-29
- Automação passiva **Bandaging**: remove `mmrpg.bleeding` do Actor portador imediatamente, sem rolagem, ação ou cura artificial.
- Reage a Active Effects novos/atualizados, equipamento recebido, alterações do equipamento, mundo recém-aberto e cenas carregadas, com apenas um GM responsável pelo processamento.
- Limpeza seletiva: preserva quaisquer outros status no mesmo ActiveEffect; impede dupla execução por Actor.
- Respeita equipamento de arma não equipada e a restrição Worn em itens comuns.
- Controle de vestir/retirar para itens icônicos com a restrição Worn na ficha do Item pertencente ao personagem (sem alterar as seis etapas do Mancer).
- Compatibilidade do banner da ficha com ItemSheetV2 (`app.document`) e versões anteriores (`app.item`).
- Mensagem de confirmação automática no chat quando Bandaging remove Sangrando.
- Outras propriedades especiais permanecem documentadas, sem automações presumidas.

## v2.0.3 — 2026-10-28
- Limita a restrição Habilidade mínima necessária a 2–9 e Multiplicador de Dano mínimo a 2–6, com validação também ao salvar.
- Substitui sugestões nativas datalist por lista dentro do card, pesquisável, rolável e navegável pelo teclado. Valores numéricos extensos agora também usam menu interno rolável.
- Separa Configuração de Arma, parâmetros de poderes especiais e Iconic Reliance na nova etapa 5, antes da Revisão (etapa 6).
- Revisão passa a exibir a configuração da arma e Iconic Reliance; nenhuma alteração no Multiverse D616.

## v2.0.2
- Restrições Habilidade, Defesa e bônus não-combate passam a usar dois dropdowns compactos (atributo e valor), evitando listas longas.
- Mantida compatibilidade dos parâmetros antigos gravados como texto no item.
- Restauração do alinhamento à esquerda nos cards de restrições e poderes especiais.
- Removido o botão de informação dos poderes especiais; efeito mecânico agora aparece integralmente na célula.
- Melhor descrição dos efeitos com custos, ações e condições conforme o PDF fornecido.

## v2.0.1
- Corrigido o estouro visual dos campos de restrição dentro dos cards.
- Campos de restrição com sugestões assistidas por dropdown/datalist; Rank e Multiplicador mínimo agora usam seleção direta.
- Ícone de informação adicionado aos poderes regulares e especiais, exibindo suas descrições.
- A lista de poderes agora preserva a posição da rolagem ao selecionar opções.
- Ajustes de UX e compatibilidade visual com o estilo do Charactermancer.

## v2.0.0 — 2026-10-28
- Reescrita completa do motor e interface para ApplicationV2 + HandlebarsApplicationMixin do Foundry v14.
- Reestruturação em módulos de regras testáveis (`rules.mjs`) e integração de catálogo/interface (`iconic-item-mancer.js`).
- Botão na aba Itens e seleção explícita Arma / Equipamento no assistente.
- Poderes regulares agora são snapshots nativos do sistema em `flags.multiverse-d616.attachedPowers`, não apenas links na descrição.
- Preservação de edições manuais dos poderes associados e anexos existentes ao editar itens icônicos.
- Edição pelo banner da ficha do Item, inclusive itens legados v1.1.1.
- Armas mantêm ataques Melee/Agility e alternância de modo; Weapon especial é incluído automaticamente.
- Adamantium em arma usa o Active Effect oficial do sistema, sem duplicação.
- Validação de restrições parametrizadas, incompatibilidades e poderes-alvo; lista de poderes numerados impede seleção simultânea de níveis da mesma família.
- Compatibilidade mínima: Multiverse-D616 v0.2.99.
- Não modifica o sistema nem automatiza outros poderes especiais que dependem do Narrador.


## v1.1.1 — 2026-10-05
- Interface: visual do Iconic Item Mancer alinhado ao Charactermancer nativo do Multiverse-D616.
- Layout: mesma largura/altura padrão do Charactermancer (1100×700), etapas em chips compactos e cards escuros.
- Tema: mesmos tons, bordas, inputs, foco azul e destaque dourado usados pelo Charactermancer.
- Navegação: botões compactos no mesmo padrão visual do Charactermancer.
- Mecânicas e criação de Iconic Items permanecem inalteradas.

## 1.1.0 — Foundry VTT 14 / Multiverse-D616 0.1.95
- Migração do assistente para Foundry VTT v14 usando `foundry.appv1.api.Application`.
- Integração explícita com `multiverse-d616` v0.1.95+.
- Origins e Powers agora são lidas dos compêndios do sistema.
- Power Value corrigido para contar power picks de poderes numerados.
- Regular Powers passam a poder ser escolhidos no assistente.
- Restrições com parâmetros e regras de categoria.
- Correções de nomes: Negatite e Reverbium.
- Stackable corrigido e regras de Constructable/Unattached validadas.
- Weapon passa a criar um documento `weapon` válido no schema atual do D616.
- Dados próprios foram movidos para `flags.iconic-item-mancer`, evitando campos não reconhecidos pelo DataModel do sistema.
- Suporte a modos Melee/Agility para armas icônicas.
