# Iconic Item Mancer

Assistente de criação e edição de **Iconic Items** para **Marvel Multiverse RPG**, desenvolvido como módulo independente para **Foundry VTT v14** e para o sistema **Multiverse D616 v0.2.99+**.

O módulo permite criar **armas** e **equipamentos** icônicos com poderes associados ao próprio Item. A interface segue a identidade visual do Charactermancer do D616.

## Funcionalidades

- Botão **Criar Iconic Item** no diretório **Itens** do Foundry.
- Assistente em seis etapas: **Básico → Origem → Restrições → Poderes → Configuração → Revisão**.
- Seleção de **Arma** (`weapon`) ou **Equipamento** (`item`).
- Origens e poderes comuns carregados dos compêndios do D616; restrições e poderes especiais definidos pelo catálogo do módulo.
- Restrições com campos de seleção, sugestões pesquisáveis e validação dos valores; Habilidade mínima de **2 a 9**, Multiplicador de Dano mínimo de **2 a 6**.
- Cálculo de **Power Value** com custo dos poderes numerados e redução por restrições.
- **Poderes regulares e especiais** associados ao equipamento como cópias independentes do tipo `Power`, na estrutura nativa `flags.multiverse-d616.attachedPowers`.
- Poderes associados exibidos na aba **Poderes** do item e integrados aos **Poderes dos Itens** no HUD do D616, quando disponíveis ao personagem.
- **Bandaging** com tentativa de remoção passiva de Sangramento, além de atalho manual no HUD e botão de diagnóstico na ficha. Os demais poderes especiais, quando não automatizados, têm o efeito exibido para consulta.
- Edição de itens icônicos existentes pelo botão **Editar no Mancer**, preservando poderes associados editados e anexos manuais.
- Migração automática, ao entrar como GM, de itens icônicos criados em versões anteriores, sem duplicar poderes especiais já migrados. **Faça backup do mundo antes da atualização**.
- Suporte a armas com modos **Melee/Agility**, bônus de dano e Adamantium conforme as integrações já disponíveis no D616.
- Equipamentos com restrição **Worn** possuem controle **Vestido/Retirado** na ficha do Item pertencente ao personagem.

## Compatibilidade

| Dependência | Versão |
| --- | --- |
| Foundry Virtual Tabletop | v14 |
| Sistema de RPG | `multiverse-d616` v0.2.99 ou superior |
| Módulo | Iconic Item Mancer v2.0.8 |

Este repositório contém o módulo Foundry e a versão web do Iconic Item Mancer, na pasta `docs/`. O sistema Multiverse D616 não é alterado nem incluído no pacote do módulo.

## Instalação

**Pelo manifesto (depois de publicar a release e o manifesto da mesma versão):**

1. Abra o Foundry VTT → **Add-on Modules** → **Install Module**.
2. Cole o endereço do manifesto:

   `https://raw.githubusercontent.com/rodrigosinistro/iconic-item-mancer/main/module.json`

3. Instale e ative **Iconic Item Mancer** no mundo que usa o Multiverse D616.

**Manual:** baixe o arquivo da release `iconic-item-mancer-v2.0.8.zip` e extraia a pasta `iconic-item-mancer/` para `FoundryVTT/Data/modules/`. Recarregue o Foundry e ative o módulo.

## Como usar

1. Na barra lateral do Foundry, abra **Itens** e clique em **Criar Iconic Item**.
2. Selecione Arma ou Equipamento, defina Origem, Restrições e Poderes.
3. Ajuste configurações da arma e **Iconic Reliance** na etapa **Configuração**.
4. Revise os valores e crie o item. Adicione-o ao inventário do personagem.
5. Para usar poderes do equipamento, abra a aba **Poderes** desse item ou os atalhos do HUD do D616. Armas devem estar equipadas quando a mecânica exigir.

Os poderes especiais ficam disponíveis como poderes associados; **a presença no HUD não significa que todos tenham automação**. Os poderes sem regra automatizada mostram a descrição para aplicação pelo Narrador.

## Power Value e restrições

`Power Value = max(1, Power Picks − número de restrições)`

- Poder regular numerado custa a quantidade de *picks* correspondente ao nível; poderes especiais custam um pick por propriedade, conforme o catálogo.
- A propriedade **Weapon** é adicionada automaticamente aos itens do tipo Arma.
- O padrão permite até **três restrições**; só o Narrador pode autorizar mais. Apenas a categoria *Obvious* permite várias restrições da mesma categoria.
- Restrições que exigem parâmetros devem ser preenchidas. **Constructable** é incompatível com **Unattached**.

## Bandaging

Bandaging tenta interromper **Sangramento (Bleeding)** em um personagem utilizando o equipamento. A função manual no HUD e o botão **Testar Bandaging** (para o GM, na ficha de um equipamento possuído) podem executar a remoção explicitamente. A automação passiva foi implementada no módulo; seu resultado pode depender da forma como a condição foi aplicada no mundo.

Diagnóstico no console do GM (F12):

```javascript
game.iconicItemMancer.diagnoseBandaging()
```

Para repetir a verificação passiva:

```javascript
game.iconicItemMancer.rescanBandaging()
```

O módulo não restaura Health perdido pelo Sangramento.

## Publicação de uma versão no GitHub (mantenedores)

1. Atualize os arquivos e pastas **dentro de `iconic-item-mancer/`** na raiz da branch `main` (em especial `module.json`, scripts, estilos, templates, dados, traduções, README e CHANGELOG). **Não coloque uma pasta `iconic-item-mancer/` adicional dentro da raiz do repositório.**
2. Crie uma release com a tag **`v2.0.8`**.
3. Anexe à release o arquivo **`iconic-item-mancer-v2.0.8.zip`**, mantendo exatamente esse nome.
4. Verifique se a URL de `download` em `module.json` coincide com a release criada. O arquivo contém a pasta `iconic-item-mancer/`, pronta para instalação manual pelo Foundry.

> A atualização do repositório e a criação da release são ações manuais do mantenedor; este pacote não publica nada automaticamente.

## Licença

MIT — veja [LICENSE](LICENSE).
