# Perfis de RLS (segurança em nível de linha)

`perfis-rls.tmdl` cria 6 perfis. Cada perfil vê os dados do próprio segmento; as tabelas dos outros
segmentos ficam bloqueadas (`FALSE()`).

| Perfil | Vê | Filtro |
|---|---|---|
| **Ferro Gusa** | pedidos/NFs de gusa, estoque de gusa | `f_MetaPV[Item]` = FERRO GUSA, FERRO GUSA-FORMATO IRREGULAR |
| **Minério de Ferro** | pedidos/NFs de minério, estoque e embarques do porto | `f_MetaPV[Item]` = MINERIO DE FERRO, MINERIO DE FERRO HT-15 |
| **Co Produtos** | pedidos/NFs de moinha, escória, finos, resíduo… | `f_MetaPV[Item]` fora de carvão, gusa e minério (mesma regra da tela Co Produtos) |
| **Carvão** | puxada, metas da partição, PCP, estoque VS | — |
| **Matéria Prima** | metas PC, tickets, estoque MP | NFs só dos clientes VS RRP / VS CMG (o recebimento de minério das usinas vem delas) |
| **Gestão (todos os segmentos)** | tudo | — |

As NFs (`f_Volumetria`) são filtradas pelo filtro do pedido (`f_MetaPV`), que é quem filtra a
`f_Volumetria` no modelo.

## Antes de aplicar: relação do estoque de carvão

A relação **d_Calendario ↔ f_Estoque_VS** era **1:1 em ambas as direções**. Em relação 1:1, o
filtro de segurança atravessa nos dois sentidos. Assim, o `FALSE()` em `f_Estoque_VS` (perfis
Gusa, Minério, Co Produtos e Matéria Prima) esvaziava o **calendário**, e todas as telas desses
perfis davam erro ou ficavam vazias. O perfil Carvão funcionava porque não bloqueia o estoque.

Correção: deixar a relação **muitos-para-um, filtro em direção única** (calendário → estoque),
como as demais tabelas de fatos.

- **Exibição TMDL:** cole `corrige-relacao-estoque.tmdl` › Aplicar; **ou**
- **Exibição de modelo:** clique duas vezes na linha entre `d_Calendario` e `f_Estoque_VS` ›
  Tabela "de": `f_Estoque_VS` (DATA) · Tabela "para": `d_Calendario` (Date) ›
  **Cardinalidade: Muitos para um (*:1)** › **Direção do filtro cruzado: Única** › OK.

## Como aplicar

1. Power BI Desktop › **Exibição TMDL** › cole `perfis-rls.tmdl` › **Aplicar**.
2. Teste: **Modelagem › Exibir como** › escolha o perfil. Por exemplo, "Carvão" deve mostrar as
   telas de Gusa, Minério e Co Produtos vazias.
3. Publique. No serviço: conjunto de dados › **⋯ › Segurança** › em cada perfil, adicione as
   pessoas ou grupos do Microsoft 365. Grupos facilitam a manutenção.

## Importante

- **RLS esconde dados, não páginas.** Um usuário do perfil Carvão ainda vê as abas de Gusa e
  Minério, só que vazias. Para esconder as abas, publique o relatório num **aplicativo** com um
  **público** por segmento, mostrando só as páginas daquele segmento.
- A Visão Geral mostra, para cada perfil, só o card do próprio segmento preenchido.
- Quem tem papel de Administrador, Membro ou Colaborador no workspace **não** é afetado pelo RLS.
  Os usuários restritos precisam ser **Visualizadores** ou acessar pelo aplicativo.
- Para um usuário ver dois segmentos (ex.: Gusa e Minério), coloque-o nos dois perfis. O Power BI
  soma os acessos.
