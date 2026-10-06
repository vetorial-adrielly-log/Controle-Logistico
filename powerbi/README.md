# Power BI — Controle Logístico Geral

`Controle_Logistico_Geral.pbix` traz a nova tela **Visão Geral**: um resumo das telas
Ferro Gusa, Minério de Ferro, Co Produtos, Carvão e Matéria Prima.

## O que tem na tela

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | Filtros de **Mês** e **Ano**, "Mês selecionado" e "Última atualização" |
| 5 cards de segmento | Realizado no mês (destaque), barra realizado x meta e 6 indicadores |
| Produtos | Barras **Meta x Expedido por item** (`f_MetaPV[Item]`, sem carvão) |
| Matérias primas | Barras **Meta x Recebido por material** (`d_MP[Descrição MP]`) |

Indicadores por segmento (as medidas são as mesmas das telas de origem):

| Segmento | Destaque | Indicadores |
|---|---|---|
| Ferro Gusa / Minério / Co Produtos | `Total Expedido` | `Soma meta pasta`, `% Atingimento`, `Tendencia`, `% Ritmo`, `Previsão`, `Média Expedição Diária` |
| Carvão | `Carregado m³` | `Total m³`, `Cancelado m³`, `Falta carregar m³`, `Total planejado`, `Carregado`, `Falta carregar` |
| Matéria Prima | `Expedido MP Dia` | `Meta (t)`, `% Alcance`, `Tendência MP`, `% Ritmo MP`, `Previsão MP`, `Média Diária MP (Mês)` |

Os filtros de página de cada tela viraram filtros de visual nos cards correspondentes
(itens de Ferro Gusa; itens de Minério + filiais VS Laís/VS Monjolinho; Co Produtos =
todos menos carvão, gusa e minério). Assim os números batem com os das telas de origem.

## Outras mudanças no arquivo

- O botão **Visão Geral** da barra lateral, em todas as telas, agora abre a nova página.
  Antes ele apontava para a "Página 2" (Tela Temporariamente Indisponível), que foi mantida.
- A página fica oculta em modo de exibição, como as demais, e é acessada pela barra lateral.
- O arquivo `SecurityBindings` foi removido do pacote. O Power BI Desktop recusa um .pbix
  com relatório alterado fora dele quando esse arquivo está presente, e o recria ao salvar.

## Figma

`figma/` contém a tela no padrão visual das demais (Montserrat, verde #284D38, cards brancos
com borda #E5E8EB):

- `Dashboard — Controle Logístico Geral - Visão Geral.png`: fundo usado no Power BI (1811×1035).
- `visao-geral.svg`: versão editável. Arraste para o Figma e posicione abaixo de
  "Visão executiva - Matéria Prima" (x −2155, y 4688).
- `visao-geral.figma.js`: script para o Figma MCP (`use_figma`) ou plugin Scripter. Ele
  monta a tela clonando sidebar e cabeçalho da tela de Matéria Prima, na mesma coluna.
