# Planejamento diário do PCP (e-mail) → Power BI

O PCP envia todo dia o e-mail **"Planejamento de Expedição de Carvão - dd/mm"** com uma tabela
UPC × RRP (Ribas) × CMG (Corumbá), em m³. O fluxo abaixo grava essa tabela numa planilha no
SharePoint, e o Power BI lê a planilha (consulta `f_PlanPCPCarvao`).

```
E-mail do PCP ──► Power Automate ──► Office Script ──► Planejamento PCP Carvao.xlsx ──► Power BI
                  (chegou e-mail)    (lê a tabela)      (tabela tbPlanPCP)              (f_PlanPCPCarvao)
```

O caminho por planilha é para a atualização agendada no serviço funcionar sem gateway.
Ler HTML direto no Power Query (`Web.Page`) exigiria um gateway.

## 1. Planilha no SharePoint

Suba `Planejamento PCP Carvao.xlsx` para:
**Logística Rodoferroviária › Documentos › Campo Grande › 4. Carvão › Programação de Expedição ›
Indicadores › Planejamento PCP** (crie a pasta "Planejamento PCP").

A planilha já vem com a tabela `tbPlanPCP` e as 6 linhas do e-mail de 09/10:
- RRP: Água Limpa 250 · Cabeceira Funda 455 · Móvel 120 · Lobo 120 = **945**
- CMG: Lageado 770 · Bom Futuro 240 = **1.010**

## 2. Office Script

1. Abra a planilha no Excel Online › guia **Automatizar** › **Novo script**.
2. Apague o conteúdo e cole `PlanejamentoCarvaoPCP.osts.ts`.
3. Salve com o nome **PlanejamentoCarvaoPCP**.

O script:
- pega a data do assunto ("- 09/10"), com o ano da data de recebimento. Uma programação de
  janeiro enviada em dezembro vai para o ano seguinte;
- lê a tabela cujo cabeçalho tem "UPC", "RRP" e "CMG". "-" vira 0 e "1.010" vira 1010. A linha
  TOTAL é ignorada e só entram valores maiores que zero;
- **substitui** as linhas do mesmo dia se o e-mail for reenviado ou corrigido. Nada duplica;
- devolve "OK: aaaa-mm-dd · N linhas" ou "ERRO: …".

## 3. Fluxo no Power Automate

Crie um **Fluxo da nuvem automatizado**:

| Passo | Conector / ação | Configuração |
|---|---|---|
| Gatilho | Office 365 Outlook › **Quando um novo email chegar (V3)** | Pasta: Caixa de Entrada · Filtro de assunto: `Planejamento de Expedição de Carvão` · Incluir anexos: Não |
| 1 | Excel Online (Business) › **Executar script** | Local: site *logistica.rodoferroviaria* · Biblioteca: Documentos · Arquivo: `/Campo Grande/4. Carvão/Programação de Expedição/Indicadores/Planejamento PCP/Planejamento PCP Carvao.xlsx` · Script: **PlanejamentoCarvaoPCP** |
| | parâmetros do script | `corpoHtml` = **Corpo** · `assunto` = **Assunto** · `recebidoEm` = **Hora do recebimento** |
| 2 (opcional) | Controle › **Condição** | se `result` (saída do script) começa com `ERRO`, envie um e-mail ou Teams avisando |

O e-mail precisa chegar na caixa da conta dona do fluxo. Na troca de e-mails de 08/10, o Everton
pediu à Mayara para incluir a Adrielly nos próximos envios. Se preferir não depender disso, use uma
regra do Outlook que encaminha esses e-mails para uma caixa compartilhada, e use o gatilho
"Quando um novo email chegar em uma caixa de correio compartilhada (V2)".

## 4. Power BI

O `modelo-carvao.tmdl` já traz:
- a tabela `f_PlanPCPCarvao` (Data, UPC do e-mail, UPC da partição, DESTINO, Planejado m³), ligada a
  `d_Calendario`, `d_Destino` e `d_UPC_Carvao`. TERCEIRO e IMPORTADO entram com o próprio nome;
- 4 medidas (tabela Medidas Carvão):

| Medida | O que é |
|---|---|
| **Planejado PCP (m³)** | soma do planejado nos e-mails |
| **Carregado nos Dias do PCP (m³)** | carregado só nos dias que têm planejamento (comparação justa) |
| **% Aderência ao PCP** | carregado ÷ planejado |
| **Desvio PCP (m³)** | carregado − planejado |

Agende a atualização do conjunto de dados depois do horário do e-mail (chega por volta das 13h).

## Teste feito

O leitor da tabela foi testado no e-mail real ("RE: Planejamento de Expedição de Carvão - 09/10.").
Ele extraiu as 6 linhas acima, com totais iguais aos do e-mail (945 / 1.010). A substituição de um
dia já gravado também foi testada, inclusive com a data salva como número pelo Excel. O fluxo do
Power Automate em si precisa ser montado e testado no seu ambiente.

## 5. Comparativo PCP x realizado e furo compensado

As contas são **acumuladas de 08/10/2026 até hoje, inclusive**. A data de início fica na medida
oculta `_Início PCP`; para mudar, altere só ela. Hoje compara o dia de hoje; amanhã, a soma dos
dois dias; e assim até o fim do mês. A partir do mês seguinte, o acumulado começa no dia 1.
O planejamento de um dia futuro, que chega por e-mail na véspera, só entra quando o dia chegar.

| Coluna da tabela | Medida | O que é |
|---|---|---|
| Plan. PCP Acum. (m³) | Planejado PCP Acumulado (m³) | soma do planejado nos e-mails, de 08/10 até hoje |
| Real. Acum. (m³) | Carregado Acumulado PCP (m³) | carregado (OK) no mesmo período, incluindo o que já carregou hoje |
| Desvio PCP (m³) | Desvio PCP (m³) | realizado − planejado |
| % Ader. PCP | % Aderência ao PCP | realizado ÷ planejado |
| Furo (m³) | Furo PCP (m³) | por dia, UPC e destino: o planejado que **não** foi carregado |
| Compensado (m³) | Furo Compensado PCP (m³) | por dia, UPC e destino: o que foi carregado **acima** do planejado |
| Saldo (m³) | Saldo Furo x Compensado (m³) | compensado − furo (= desvio) |

Também existe a medida **% Furo Compensado** (compensado ÷ furo), que não está na tabela.

Conferência com os dados de 08/10 (16h15): planejado 1.955 · realizado 2.938 · furo 761
(Cabeceira Funda/RRP 111, Lageado/CMG 650) · compensado 1.744 · saldo +983.
