# Iconic Item Mancer — Web v1.0.1

Assistente web para criar armas e equipamentos icônicos do **Multiverse D616**. Baseado no módulo **Iconic Item Mancer v2.0.8**, com os catálogos JSON do Charactermancer disponíveis no repositório do sistema **v0.2.99** em 29/10/2026.

## Funcionalidades

- Tema visual do Charactermancer Site v0.0.21: fundo escuro, painéis arredondados, etapas horizontais e destaques azuis.

- Seis etapas: Básico, Origem, Restrições, Poderes, Configuração e Revisão.
- 398 poderes regulares, 40 origens, 39 restrições e 30 propriedades especiais (incluindo Weapon automático para armas).
- Power Value calculado com as regras do módulo: `max(1, Power Picks − restrições)`.
- Busca por nome, conjunto, efeito e pré-requisitos; detalhes dos poderes em português.
- Parâmetros de restrições, limite de categorias, exceção do Narrador e incompatibilidade Constructable/Unattached.
- Substituição entre níveis da mesma família de poderes numerados.
- Configuração de armas, Iconic Reliance e opções de propriedades especiais.
- Prévia ao vivo com seis símbolos vetoriais, seis cores e imagens personalizadas opcionais.
- Rascunho automático e coleção local, com abertura, duplicação, exclusão e exportação.
- JSON para importação pelo Foundry, incluindo poderes associados como cópias independentes `type: power`.
- Importação de JSON do próprio site ou de Iconic Items exportados pelo módulo, preservando poderes editados e anexos manuais.
- Ficha para impressão ou PDF pelo navegador.
- Layout responsivo, navegação por teclado e respeito à preferência de movimento reduzido.

O site funciona sem conta, servidor de aplicação, instalação de dependências ou serviços externos. Rascunhos e coleção pertencem ao navegador e ao endereço onde o site está aberto; não são sincronizados entre dispositivos ou entre a prévia e o GitHub Pages. Exporte os itens em JSON para backup.

## Executar e desenvolver

A pasta `dist/` contém o site completo e o código-fonte legível, sem etapa de build. Abra por HTTP; abrir `index.html` com `file://` bloqueia a leitura dos catálogos em navegadores comuns.

```bash
python3 -m http.server 8080 --directory dist
```

Abra `http://localhost:8080`. Para conferir as regras e exportações, com Node.js 20 ou superior:

```bash
npm test
npm run check
```

## Publicar no GitHub Pages

O pacote de entrega `iconic-item-mancer-web-v1.0.1.zip` organiza os arquivos assim:

- `docs/`: site completo e suas fontes, pronto para GitHub Pages.
- `web-tests/`: testes sem dependências. Execute `node --test web-tests/*.test.mjs` na raiz.
- `SITE-README.md`, `SITE-CHANGELOG.md`, `LICENSE-SITE` e `THIRD-PARTY-NOTICES.md`: documentação, licença e créditos independentes.

Para o repositório `rodrigosinistro/iconic-item-mancer`, que já contém o módulo Foundry:

1. Extraia o ZIP.
2. Adicione a pasta `docs/`, a pasta `web-tests/` e os arquivos `SITE-*` e `LICENSE-SITE` na raiz do repositório. Nenhum arquivo do módulo precisa ser substituído.
3. Em **Settings → Pages → Build and deployment**, escolha **Deploy from a branch**.
4. Selecione **main** e a pasta **/docs**. Salve.
5. Aguarde o GitHub Pages concluir a publicação. O endereço exato aparecerá nessa mesma página.

A pasta `docs/` também pode ser usada em qualquer hospedagem estática. Todos os caminhos internos são relativos, compatíveis com subpastas de projeto.

## Levar um item para o Foundry

1. Finalize o item e clique em **Exportar para Foundry**, na etapa Revisão.
2. No mundo com **Multiverse D616 v0.2.99+**, crie um Item do mesmo tipo: Arma ou Equipamento.
3. No diretório Itens, clique com o botão direito nesse item e escolha **Importar dados**.
4. Importe o JSON e adicione o item ao inventário do personagem.
5. Use o módulo **Iconic Item Mancer v2.0.8+** para reabrir no Mancer e usar suas integrações e automações.

O JSON utiliza `flags.iconic-item-mancer` (schema 3) e `flags.multiverse-d616.attachedPowers`, incluindo cópias regulares e especiais. Adamantium em arma inclui o Active Effect usado pelo módulo. O site não executa rolagens nem automações de combate; isso acontece no Foundry.

Os símbolos e cores do site são metadados de apresentação. Uma imagem enviada é incorporada no campo `img`; um caminho do Foundry é preservado, mas só é visível no ambiente que possui esse arquivo.

## Verificação

- 20 testes automatizados de regras, custos, validação, exportação e reimportação.
- Verificação no navegador: preenchimento, busca de origem, restrições estruturadas, seleção de poderes, substituição Flight 1 → Flight 2, configuração, salvamento, recuperação do rascunho, coleção, download e reimportação do JSON.
- Layout conferido em uma área de 390 px com o site real em iframe, sem rolagem horizontal.
- A compatibilidade do formato foi conferida contra os adaptadores do módulo v2.0.8. O pacote não foi executado em uma instância real do Foundry; esse teste em jogo deve ser feito no seu mundo.

## Fontes e manutenção

- Módulo: https://github.com/rodrigosinistro/iconic-item-mancer — v2.0.8.
- Sistema: https://github.com/rodrigosinistro/multiverse-D616 — v0.2.99.
- Catálogos de poderes e origens: `apps/charactermancer/data/` do sistema.
- Aparência: https://github.com/rodrigosinistro/multiverse-d616-charactermancer-site — v0.0.21, com os estilos originais em `dist/styles/mmc-base.css` e `dist/styles/mmc-skin.css`.
- Restrições, propriedades especiais e regras: ZIP original do módulo fornecido pelo autor.
- Proveniência dos arquivos em `dist/data/catalog-meta.json`.

O catálogo web é uma cópia dos JSONs disponíveis no repositório na data indicada, não uma conexão ao mundo Foundry. Alterações locais de compêndio ou migrações realizadas em tempo de execução não são consultadas automaticamente. Ao importar um Iconic Item, suas cópias associadas já editadas são preservadas.

MIT para o código — veja `LICENSE`. Conteúdos do jogo e marcas continuam pertencendo aos seus respectivos titulares.
