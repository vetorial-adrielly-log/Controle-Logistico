# Correções DAX — Visão Geral e Matéria Prima

As duas correções são em medidas DAX. Cole cada uma no lugar da medida atual
(Power BI Desktop → painel Dados → clique na medida → barra de fórmulas).

## 1. Estoque de Ferro Gusa cortado na Visão Geral

**Medida:** `Medidas - animações[Estoque Gusa Animado_visaoGeral]`

**Causa:** o desenho do bloco vai até x = 574 (moldura `x=4 width=570`, sigla RRP/CMG
em x = 465, cartão "Estoque Total" de 380 a 550), mas o `viewBox` do SVG foi definido com
largura **500**. Tudo à direita de 500 é recortado. A medida original
(`Estoque Gusa Animado`, tela Ferro Gusa) usa `0 0 578` e por isso não corta.

**Correção:** trocar `viewBox=""0 0 500 "` por `viewBox=""0 0 578 "`. O SVG é escalado
para caber no visual (534 × 399), sem precisar mudar o tamanho do visual.

```dax
-- filiais que têm movimento de estoque
VAR _fils =
    CALCULATETABLE (
        VALUES ( f_Estoque_Gusa[Filial] ),
        ALL ( f_Estoque_Gusa ),
        ALL ( d_Calendario ),
        f_Estoque_Gusa[Soma] = 1
    )

VAR _d1 = ADDCOLUMNS ( _fils, "@Ult", CALCULATE ( MAX ( f_Estoque_Gusa[Data] ) ) )

VAR _dados =
    ADDCOLUMNS (
        _d1,
        "@Ac",
            VAR _u = [@Ult]
            RETURN COALESCE ( CALCULATE ( SUM ( f_Estoque_Gusa[Valor] ),
                f_Estoque_Gusa[Data] = _u, f_Estoque_Gusa[Atributo] = "Aciária", f_Estoque_Gusa[Soma] = 1 ), 0 ),
        "@Dm",
            VAR _u = [@Ult]
            RETURN COALESCE ( CALCULATE ( SUM ( f_Estoque_Gusa[Valor] ),
                f_Estoque_Gusa[Data] = _u, f_Estoque_Gusa[Atributo] = "Demais", f_Estoque_Gusa[Soma] = 1 ), 0 ),
        "@Ff",
            VAR _u = [@Ult]
            RETURN COALESCE ( CALCULATE ( SUM ( f_Estoque_Gusa[Valor] ),
                f_Estoque_Gusa[Data] = _u, f_Estoque_Gusa[Atributo] = "Fora de faixa", f_Estoque_Gusa[Soma] = 1 ), 0 )
    )

VAR _n  = COUNTROWS ( _dados )
VAR _hb = 100    -- altura máxima da barra

VAR _blocos =
    CONCATENATEX (
        _dados,
        VAR _f  = f_Estoque_Gusa[Filial]
        VAR _ac = [@Ac]
        VAR _dm = [@Dm]
        VAR _ff = [@Ff]
        VAR _t  = _ac + _dm + _ff

        -- ordem alfabética decrescente: Ribas do Rio Pardo antes de Corumbá
        VAR _i = COUNTROWS ( FILTER ( _dados, f_Estoque_Gusa[Filial] > _f ) ) + 0
        VAR _y = 8 + _i * 203

        VAR _sigla =
            SWITCH (
                _f,
                "Ribas do Rio Pardo", "RRP",
                "Corumbá", "CMG",
                "VS Monjolinho", "VSM",
                "VS Laís", "VSL",
                UPPER ( LEFT ( _f, 3 ) )
            )

        -- escala por bloco: a maior categoria da filial ocupa a barra cheia
        VAR _mx  = MAX ( MAX ( _ac, MAX ( _dm, _ff ) ), 1 )
        VAR _bAc = IF ( _ac > 0, MAX ( 3, INT ( DIVIDE ( _ac, _mx ) * _hb ) ), 0 )
        VAR _bDm = IF ( _dm > 0, MAX ( 3, INT ( DIVIDE ( _dm, _mx ) * _hb ) ), 0 )
        VAR _bFf = IF ( _ff > 0, MAX ( 3, INT ( DIVIDE ( _ff, _mx ) * _hb ) ), 0 )

        VAR _solo = _y + 164
        VAR _atr  = _i * 150

        RETURN
            -- moldura do bloco
            "<rect x=""4"" y=""" & _y & """ width=""570"" height=""191"" rx=""10"" fill=""#FFFFFF"" stroke=""#E5E3DC"" stroke-width=""1""/>" &
            "<text x=""24"" y=""" & ( _y + 26 ) & """ font-size=""12"" font-weight=""600"" fill=""#284D38"">ESTOQUE DE FERRO GUSA:</text>" &
            "<text x=""465"" y=""" & ( _y + 42 ) & """ font-size=""30"" font-weight=""600"" text-anchor=""middle"" fill=""#284D38"">" & _sigla & "</text>" &

            -- cartão do total
            "<rect x=""380"" y=""" & ( _y + 54 ) & """ width=""170"" height=""110"" rx=""8"" fill=""#1E4430"" opacity=""0"">" &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""400ms"" begin=""" & ( _atr + 600 ) & "ms"" fill=""freeze""/></rect>" &
            "<rect x=""380"" y=""" & ( _y + 54 ) & """ width=""170"" height=""110"" rx=""8"" fill=""#FFFFFF"" opacity=""0"">" &
                "<animate attributeName=""opacity"" values=""0;0.12;0"" dur=""2800ms"" begin=""" & ( _atr + 1200 ) & "ms"" repeatCount=""indefinite""/></rect>" &
            "<text x=""465"" y=""" & ( _y + 88 ) & """ font-size=""15"" text-anchor=""middle"" fill=""#FFFFFF"" opacity=""0"">Estoque Total" &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""400ms"" begin=""" & ( _atr + 700 ) & "ms"" fill=""freeze""/></text>" &
            "<text x=""465"" y=""" & ( _y + 134 ) & """ font-size=""32"" font-weight=""600"" text-anchor=""middle"" fill=""#FFFFFF"" opacity=""0"">" & FORMAT ( _t, "#,##0" ) &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""400ms"" begin=""" & ( _atr + 800 ) & "ms"" fill=""freeze""/></text>" &

            -- Aciária
            IF ( _bAc = 0, "",
                "<g transform=""translate(59," & _solo & ")""><g>" &
                "<animateTransform attributeName=""transform"" type=""scale"" values=""1 0;1 1"" dur=""500ms"" begin=""" & _atr & "ms"" fill=""freeze""/>" &
                "<rect x=""0"" y=""-" & _bAc & """ width=""52"" height=""" & _bAc & """ fill=""#4D8264""/></g></g>" ) &
            "<text x=""85"" y=""" & ( _solo - _bAc - 8 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#3D3D3A"" opacity=""0"">" & FORMAT ( _ac, "#,##0" ) &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""300ms"" begin=""" & ( _atr + 500 ) & "ms"" fill=""freeze""/></text>" &
            "<text x=""85"" y=""" & ( _solo + 18 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#5F5E5A"">Aciária</text>" &

            -- Demais
            IF ( _bDm = 0, "",
                "<g transform=""translate(164," & _solo & ")""><g>" &
                "<animateTransform attributeName=""transform"" type=""scale"" values=""1 0;1 1"" dur=""500ms"" begin=""" & ( _atr + 200 ) & "ms"" fill=""freeze""/>" &
                "<rect x=""0"" y=""-" & _bDm & """ width=""52"" height=""" & _bDm & """ fill=""#4D8264""/></g></g>" ) &
            "<text x=""190"" y=""" & ( _solo - _bDm - 8 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#3D3D3A"" opacity=""0"">" & FORMAT ( _dm, "#,##0" ) &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""300ms"" begin=""" & ( _atr + 700 ) & "ms"" fill=""freeze""/></text>" &
            "<text x=""190"" y=""" & ( _solo + 18 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#5F5E5A"">Demais</text>" &

            -- Fora de faixa
            IF ( _bFf = 0, "",
                "<g transform=""translate(269," & _solo & ")""><g>" &
                "<animateTransform attributeName=""transform"" type=""scale"" values=""1 0;1 1"" dur=""500ms"" begin=""" & ( _atr + 400 ) & "ms"" fill=""freeze""/>" &
                "<rect x=""0"" y=""-" & _bFf & """ width=""52"" height=""" & _bFf & """ fill=""#4D8264""/></g></g>" ) &
            "<text x=""295"" y=""" & ( _solo - _bFf - 8 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#3D3D3A"" opacity=""0"">" & FORMAT ( _ff, "#,##0" ) &
                "<animate attributeName=""opacity"" values=""0;1"" dur=""300ms"" begin=""" & ( _atr + 900 ) & "ms"" fill=""freeze""/></text>" &
            "<text x=""295"" y=""" & ( _solo + 18 ) & """ font-size=""13"" text-anchor=""middle"" fill=""#5F5E5A"">Fora de faixa</text>",
        ""
    )

RETURN
    IF (
        ISBLANK ( _n ),
        "<div style=""font:13px sans-serif;color:#5F5E5A"">Sem estoque no filtro atual</div>",
        "<div style=""width:100%;overflow:hidden"">" &
        "<svg xmlns=""http://www.w3.org/2000/svg"" width=""100%"" viewBox=""0 0 578 " & ( _n * 203 + 5 ) & """ preserveAspectRatio=""xMidYMid meet"">" &
            _blocos &
        "</svg></div>"
    )
```

## 2. Minério duplicado na tabela de Matérias Primas

**Medida:** `Medidas MP[Expedido MP Dia]` (alimenta Recebido, Real x Meta, % Alcance,
Tendência, % Ritmo, Previsão MP, médias e o card de Matéria Prima da Visão Geral).

**Causa:** em `f_MetaPC` existe uma meta de minério por filial **e por mês**:

| Filial | Recebido em | Meta (t) |
|---|---|---|
| Corumbá | 01/09/2026 | 47.057 |
| Corumbá | 01/10/2026 | 40.000 |
| Ribas do Rio Pardo | 01/09/2026 | 24.000 |
| Ribas do Rio Pardo | 01/10/2026 | 24.000 |

O recebido de minério não vem de ticket: vem das NFs de expedição (`f_Volumetria`) do
cliente VS CMG / VS RRP. Para isso a medida:

1. pega as filiais com meta de minério **ignorando a data da meta**
   (`REMOVEFILTERS ( f_MetaPC[Data] )` em `_filiaisMinerio`);
2. soma as NFs nas datas do **filtro de mês** (`_datas`), também ignorando a data da meta.

Na linha "VETRIA · 01/10/2026 · MINERIO" da tabela, com o mês de setembro filtrado, a meta
de outubro fica em branco (a data dela não está em setembro), mas a medida encontra a filial
Corumbá e soma **as NFs de setembro** de novo: 46.416,47, o mesmo valor da linha de 01/09.
Nada amarra o recebido ao mês da meta da linha. Como o valor não é vazio, a linha aparece.
O total da tabela não duplica, porque nele cada filial é contada uma vez; só a soma das
linhas fica errada. O mesmo acontece com Ribas do Rio Pardo, com a linha de outubro.

**Correção:** dentro de cada filial, as NFs passam a contar só nos dias que caem em um mês
que tenha meta de minério visível no contexto. Numa linha da tabela, isso é o mês da própria
meta. Nos cards, no total e no gráfico diário, todas as metas da filial estão visíveis,
então o filtro de mês e de dia continua decidindo, como hoje. A linha de 01/10 fica vazia
em setembro e some da tabela. Em outubro, ela mostra as NFs de outubro e a de 01/09 some.

```dax
VAR _statusOk    = { "Autorizado o uso da NF-e", "Autorizada" }
VAR _itemMinerio = "MP000000071"

-- datas do contexto atual (um dia no gráfico, o mês nos cards),
-- ignorando a coluna "Recebido em:" da tabela de fornecedores
VAR _datas =
    CALCULATETABLE (
        VALUES ( d_Calendario[Date] ),
        REMOVEFILTERS ( f_MetaPC[Data] )
    )

-- ---------- demais MPs: ticket de entrada ----------
VAR _idsComMeta =
    CALCULATETABLE ( VALUES ( f_MetaPC[ID] ), REMOVEFILTERS ( d_Calendario ) )

VAR _tickets =
    CALCULATE (
        SUM ( f_tickets[QUANTIDADE] ),
        TREATAS ( _idsComMeta, f_tickets[ID] ),
        CROSSFILTER ( f_MetaPC[Data], d_Calendario[Date], NONE ),
        KEEPFILTERS ( f_tickets[PRODUTO] <> _itemMinerio )
    )

-- ---------- minério: NF de expedição (igual à aba Minério) ----------
-- filiais que têm meta de minério no filtro atual (fornecedor, filial,
-- descrição MP e status continuam valendo; só a data é ignorada)
VAR _filiaisMinerio =
    CALCULATETABLE (
        VALUES ( f_MetaPC[Filial2] ),
        REMOVEFILTERS ( d_Calendario ),
        REMOVEFILTERS ( f_MetaPC[Data] ),
        KEEPFILTERS ( f_MetaPC[Código do Item] = _itemMinerio )
    )

VAR _minerio =
    SUMX (
        _filiaisMinerio,
        VAR _fil = f_MetaPC[Filial2]
        VAR _cli =
            SWITCH (
                _fil,
                "Ribas do Rio Pardo", "VS RRP",
                "Corumbá", "VS CMG"
            )
        -- meses das metas de minério desta filial visíveis no contexto:
        -- numa linha da tabela é só o mês da própria meta ("Recebido em:");
        -- nos cards/total/gráfico são todos, e quem decide é o filtro de data
        VAR _mesesMeta =
            CALCULATETABLE (
                SELECTCOLUMNS ( VALUES ( f_MetaPC[Data] ), "@Mes", EOMONTH ( f_MetaPC[Data], 0 ) ),
                REMOVEFILTERS ( d_Calendario ),
                KEEPFILTERS ( f_MetaPC[Código do Item] = _itemMinerio ),
                f_MetaPC[Filial2] = _fil
            )
        -- só os dias do filtro que caem num mês com meta: evita somar as NFs
        -- de setembro de novo na linha da meta de outubro
        VAR _datasMeta =
            FILTER ( _datas, EOMONTH ( d_Calendario[Date], 0 ) IN _mesesMeta )
        RETURN
            IF (
                NOT ISBLANK ( _cli ) && NOT ISEMPTY ( _datasMeta ),
                CALCULATE (
                    SUM ( f_Volumetria[Quantidade Real] ),
                    REMOVEFILTERS ( d_Calendario ),               -- solta a data...
                    TREATAS ( _datasMeta, f_Volumetria[Data do Documento] ),  -- ...e recoloca a certa
                    REMOVEFILTERS ( d_Filial ),                   -- corta Filial2 -> d_Filial -> f_MetaPV
                    f_MetaPV[Cliente] = _cli,
                    KEEPFILTERS ( f_Volumetria[Status NFe SEFAZ] IN _statusOk )
                )
            )
    )

VAR _total = COALESCE ( _tickets, 0 ) + COALESCE ( _minerio, 0 )

RETURN
    IF ( _total <> 0, _total )
```

### Como conferir

Na tela Matéria Prima, com setembro/2026 filtrado:

- A linha "VETRIA · 01/10/2026 · MINERIO" deve sumir da tabela.
- As linhas de 01/09 (Corumbá 46.416,47 e Ribas 23.979,83) e o total (77.624,18) não mudam.
