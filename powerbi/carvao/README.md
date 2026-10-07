# Tela Carvão — metas da Gestão da Partição

A tela **Carvão** foi refeita com a mesma formatação e as mesmas comparações de **Ferro Gusa**:

| Origem | Uso |
|---|---|
| **Meta** | planilha `Gestão da Partição AAAA.xlsx` (site Logística Rodoferroviária › Campo Grande › 4. Carvão › Programação de Expedição › Indicadores › Controle Partição), coluna PLAN de CMG e RRP de cada UPC |
| **Realizado** | base atual de puxada (`f_basePlan`, `CARREGADO = "OK"`, m³ pela data da carga) |
| **Estoque** | `f_Estoque_VS` (estoque VS CMG e VS RRP), última posição lançada no período |

## Como aplicar (Power BI Desktop)

O arquivo `Controle_Logistico_Geral.pbix` já traz a página nova, mas as tabelas e medidas novas
precisam entrar no modelo. **Até lá, a página Carvão mostra os visuais com erro.**

1. Abra `Controle_Logistico_Geral.pbix` no Power BI Desktop.
2. Vá em **Exibição TMDL** (ícone `</>` na barra lateral esquerda).
3. Cole todo o conteúdo de `modelo-carvao.tmdl` e clique em **Aplicar**.
4. Clique em **Atualizar** (Página Inicial). Se pedir credencial do SharePoint, use a mesma das outras bases.
5. Salve.

O script cria:

| Objeto | O que é |
|---|---|
| `f_MetaCarvao` | metas por mês × UPC × destino (CMG/RRP) × tipo (Própria/Contrato) |
| `d_UPC_Map` | liga cada UPC da base de puxada ao nome da UPC na partição |
| `d_UPC_Carvao` | lista de UPCs da partição (linhas da tabela e filtro Própria/Contrato) |
| `Medidas Carvão` | 19 medidas da tela |
| 4 relações | `f_MetaCarvao` → `d_UPC_Carvao` e `d_Destino`; `f_basePlan` → `d_UPC_Map` → `d_UPC_Carvao` |

**Sem a exibição TMDL:** crie as três consultas em Power Query (Nova fonte › Consulta nula ›
Editor avançado) com o conteúdo de `f_MetaCarvao.m`, `d_UPC_Map.m` e `d_UPC_Carvao.m`. Depois crie
a tabela `Medidas Carvão` e as medidas de `medidas-carvao.dax`, com os mesmos nomes, e as 4 relações.

## Abas novas da planilha (Novembro, Dezembro, 2027…)

A consulta lê **todas** as abas de **todos** os arquivos "Gestão da Partição …" da pasta. Uma aba
entra quando tem o bloco `UPC - PRÓPRIA` com as colunas `PLAN` de CMG e RRP. Para criar Novembro,
basta duplicar a aba de Outubro e trocar o mês na célula P4 ("Nov").

- O **mês** vem da abreviação no topo da aba (P4: "Out"). Se faltar, vem do nome da aba.
- O **ano** vem do nome do arquivo (`Gestão da Partição 2026.xlsx`).
- A data da célula **W1 não é usada**: na aba **Agosto** ela está como 01/07/2026, o que jogaria
  a meta de agosto em julho. Vale corrigir na planilha também.

## Ligação entre as UPCs da base e da partição

A base de puxada e a partição usam nomes diferentes para as UPCs. A ligação é por palavra-chave
(lista no início de `d_UPC_Map.m`):

| UPC na base de puxada | UPC na partição |
|---|---|
| BOM FUTURO - SONORA | UPC BOM FUTURO |
| BRABO BIOENERGETICA - CFM FAZ. LAJEADO | UPC LAGEADO |
| LAJEADO AGROPASTORIL - FAZ. OURO VERDE | UPC OURO VERDE |
| LOBO ARAUCO | UPC LOBO |
| MATA VERDE | UPC MATA VERDE |
| UPC MÓVEL / UPC MÓVEL - PARANAÍBA | UPC MÓVEL 1 |
| VETORIAL ENERGETICA - FAZ. CABECEIRA FUNDA / NOVA DA MATA / VERDE MAR / ÁGUA LIMPA | UPC CABECEIRA FUNDA / NOVA DA MATA / VERDE MAR / ÁGUA LIMPA |
| **GERDAU/UPC 104** | **sem correspondência**: entra no total como "SEM META DE PARTIÇÃO" |

Se GERDAU/UPC 104 for alguma UPC da partição (FGMG?), acrescente `{"GERDAU", "UPC FGMG"}` na lista.

## O que cada indicador compara (igual a Ferro Gusa)

| Card / visual | Carvão |
|---|---|
| Meta (m³) / % da meta realizada | meta da partição no mês / carregado ÷ meta |
| Carregado (m³) / Real x Meta | carregado no mês / carregado − meta |
| Ritmo (tendência) / % Ritmo | carregado + média diária × dias restantes (base D-1), limitado à meta |
| Média necessária x realizada / dispersão | (meta − carregado) ÷ dias restantes; média diária realizada; diferença entre as duas |
| Informações sobre o período | dias totais, decorridos e restantes |
| Previsão de conclusão / dias | último dia carregado + dias para fechar a meta no ritmo atual |
| Estoque (bloco à esquerda) | estoque VS RRP e VS CMG na última posição + barras dos últimos 7 dias |
| Carregamento por UPC | Destino, UPC, Tipo, Meta, Carregado, Real x Meta, % Alcance, Tendência, % Ritmo |
| Selecionar visualização | Própria / Contrato |
| Desempenho mensal / comportamento diário | carregado por mês e por dia, média realizada e média necessária |

## Números para conferência (simulados com os dados do arquivo e da planilha, em 07/10/2026)

| Mês | Meta | Carregado | % meta | Tendência | % ritmo | Média/dia | Necessária/dia | Previsão |
|---|---|---|---|---|---|---|---|---|
| set/2026 | 81.798 | 64.897 | 79,3% | 64.897 | 79,3% | 2.163 | — (mês fechado) | 08/10/2026 |
| out/2026 | 77.202 | 12.004 | 15,5% | 62.029 | 80,3% | 2.001 | 2.608 | 08/11/2026 |

Estoque na última posição (06/10/2026): VS CMG 7.172 · VS RRP 2.010.

## Fora desta mudança

- O card de Carvão da **Visão Geral** (`Cards Visão Geral`) continua com as medidas antigas
  (planejado da base de puxada). Dá para trocar para `Meta Carvão (m³)` e as demais medidas novas.
- O arquivo foi gerado fora do Power BI Desktop e não foi aberto nele. O `SecurityBindings` foi
  removido do pacote; o Desktop o recria ao salvar.
