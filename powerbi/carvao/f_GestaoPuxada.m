// f_GestaoPuxada — planejado PCP x planejado Log x realizado, por dia (quadro "GESTÃO DE TRANSPORTE DE CARVÃO").
// Mês atual: aba "Gestão de Puxada" da planilha de planejamento puxada (stg_Puxada).
// Histórico: planilhas "Gestao Puxada AAAA.xlsx" da pasta Indicadores › "Gestão de Puxada Log x Pcp"
// (todas as abas que tiverem o cabeçalho Data / Plan PCP nas 30 primeiras linhas; anos novos entram sozinhos).
// Quando o mesmo dia aparece nas duas, vale a aba "Gestão de Puxada".
// Uma linha por dia, em m³ (a planilha mostra mil m³: 2,15 = 2.150 m³; valores < 100 são multiplicados por 1.000).
let
    Normal   = (t as any) as text =>
                   List.Accumulate(
                       {{"á","a"},{"à","a"},{"ã","a"},{"â","a"},{"é","e"},{"ê","e"},{"í","i"},
                        {"ó","o"},{"ô","o"},{"õ","o"},{"ú","u"},{"ç","c"},{"  "," "}},
                       Text.Lower(Text.Trim(Text.From(t))),
                       (acc, par) => Text.Replace(acc, par{0}, par{1})),
    Meses    = [jan = 1, fev = 2, mar = 3, abr = 4, mai = 5, jun = 6,
                jul = 7, ago = 8, set = 9, out = 10, nov = 11, dez = 12],
    // datas vêm como data do Excel; se vierem como texto ("01/out", "01/10/2026"), converte
    ParaData = (v as any, ano as number) as nullable date =>
                   if v is date or v is datetime then Date.From(v)
                   else if v is number then (if v > 40000 and v < 80000 then Date.From(v) else null)
                   else if v is text then
                       let
                           p   = Text.Split(Normal(v), "/"),
                           dia = try Number.From(p{0}) otherwise null,
                           mes = if List.Count(p) < 2 then null
                                 else Record.FieldOrDefault(Meses, Text.Start(p{1}, 3),
                                          try Number.From(p{1}) otherwise null),
                           a   = if List.Count(p) >= 3 then (try Number.From(p{2}) otherwise ano) else ano
                       in
                           if dia <> null and mes <> null then (try #date(if a < 100 then 2000 + a else a, mes, dia) otherwise null) else null
                   else null,
    Num      = (v as any) as nullable number =>
                   if v is number then v
                   else if v is text then try Number.From(Text.Trim(v), "pt-BR") otherwise null
                   else null,
    MilM3    = (v as nullable number) as nullable number =>
                   if v = null then null else if Number.Abs(v) < 100 then v * 1000 else v,

    Campos   = {{"Plan PCP m³",   "plan pcp"},
                {"Plan Log m³",   "plan log"},
                {"Real Log m³",   "real log"},
                {"Veículos Plan", "veiculos plan"},
                {"Adicionais",    "adicionais"},
                {"Furos Log",     "furos log"},
                {"Furos PCP",     "furos pcp"},
                {"MDC Entregue",  "mdc entregue"}},

    // lê uma aba no layout do quadro. Para ser rápido:
    //  - procura o cabeçalho (Data / Plan PCP) só nas 30 primeiras linhas; aba sem ele é pulada na hora
    //  - normaliza (acentos/maiúsculas) só a linha do cabeçalho, não a aba inteira
    //  - lê só as 9 colunas usadas, e só da linha do cabeçalho para baixo
    LerAba   = (t as table, ano as number) as table =>
        let
            Vazia   = #table({"Data"} & List.Transform(Campos, each _{0}), {}),
            Topo    = Table.ToRows(Table.ReplaceErrorValues(Table.FirstN(t, 30),
                          List.Transform(Table.ColumnNames(t), each {_, null}))),
            Rotulo  = (c as any) as text => if c is text then Text.Lower(Text.Trim(c)) else "",
            iCab    = List.PositionOf(List.Transform(Topo, (r) =>
                          let x = List.Transform(r, Rotulo) in List.Contains(x, "data") and List.Contains(x, "plan pcp")), true),
            Cab     = if iCab < 0 then {} else List.Transform(Topo{iCab}, (c) => if c is text then Normal(c) else ""),
            Nomes   = Table.ColumnNames(t),
            kData   = List.PositionOf(Cab, "data"),
            kCampos = List.Transform(Campos, (c) => List.PositionOf(Cab, c{1})),
            Usadas  = List.Transform(List.Select({kData} & kCampos, (k) => k >= 0), (k) => Nomes{k}),
            Corpo   = Table.SelectColumns(Table.Skip(t, iCab + 1), List.Distinct(Usadas)),
            SemErro = Table.ReplaceErrorValues(Corpo, List.Transform(List.Distinct(Usadas), each {_, null})),
            // linhas sem data (total, linhas em branco até o fim da aba) saem antes da conversão
            Linhas  = Table.ToRecords(Table.SelectRows(SemErro, each Record.Field(_, Nomes{kData}) <> null)),
            Pega    = (r as record, k as number) => if k < 0 then null else Record.Field(r, Nomes{k}),
            Dias    = List.RemoveNulls(List.Transform(Linhas, (r) =>
                          let
                              data = ParaData(Pega(r, kData), ano),
                              vals = List.Transform(List.Zip({Campos, kCampos}), (z) =>
                                         let v = Num(Pega(r, z{1}))
                                         in if Text.EndsWith(z{0}{0}, "m³") then MilM3(v) else v)
                          in
                              if data = null then null else {data} & vals))
        in
            if iCab < 0 or kData < 0 then Vazia
            else #table({"Data"} & List.Transform(Campos, each _{0}), Dias),

    // ---- mês atual: aba "Gestão de Puxada" da planilha de planejamento puxada
    AbaAtual = List.First(List.Select(Table.ToRecords(stg_Puxada),
                   each [Kind] = "Sheet" and Normal([Item]) = "gestao de puxada"), null),
    Atual    = if AbaAtual = null then
                   error "Aba ""Gestão de Puxada"" não encontrada na planilha de puxada. Abas: "
                         & Text.Combine(Table.SelectRows(stg_Puxada, each [Kind] = "Sheet")[Item], " | ")
               else Table.Buffer(Table.AddColumn(LerAba(AbaAtual[Data], Date.Year(DateTime.LocalNow())),
                                    "Origem", each "Gestão de Puxada", type text)),

    // ---- histórico: Indicadores › Gestão de Puxada Log x Pcp › Gestao Puxada AAAA.xlsx
    Indic    = fnPastaSP(
                   pSiteLog,
                   {"Shared Documents", "Campo Grande", "4. Carvão", "Programação de Expedição", "Indicadores"}
               ),
    PastaHist = Table.SelectRows(Indic, each [Content] is table
                                            and Text.Contains(Normal([Name]), "gestao de puxada")),
    Arquivos = if Table.IsEmpty(PastaHist) then
                   error "Pasta ""Gestão de Puxada Log x Pcp"" não encontrada em Indicadores. Pastas: "
                         & Text.Combine(Table.SelectRows(Indic, each [Content] is table)[Name], " | ")
               else Table.SelectRows(PastaHist{0}[Content], each
                        not ([Content] is table)
                        and [Extension] = ".xlsx"
                        and not Text.StartsWith([Name], "~$")
                        and Text.Contains(Normal([Name]), "puxada")),
    ComAno   = Table.AddColumn(Arquivos, "Ano",
                   each try Number.From(Text.Start(Text.Select([Name], {"0".."9"}), 4)) otherwise null),
    AnoOk    = Table.SelectRows(ComAno, each [Ano] is number and [Ano] > 2000),
    Lidos    = List.Transform(Table.ToRecords(AnoOk), (f) =>
                   Table.Combine(
                       {#table({"Data"} & List.Transform(Campos, each _{0}), {})} &
                       List.Transform(
                           Table.SelectRows(Excel.Workbook(f[Content], false, true), each [Kind] = "Sheet")[Data],
                           each LerAba(_, f[Ano])))),
    Hist0    = Table.Combine({#table({"Data"} & List.Transform(Campos, each _{0}), {})} & Lidos),
    // dia repetido em mais de uma aba do histórico: fica a primeira ocorrência
    Hist1    = Table.Distinct(Table.SelectRows(Hist0, each [#"Plan PCP m³"] <> null or [#"Real Log m³"] <> null), {"Data"}),
    DiasAtual = List.Buffer(Atual[Data]),
    Hist     = Table.AddColumn(Table.SelectRows(Hist1, each not List.Contains(DiasAtual, [Data])),
                   "Origem", each "Histórico", type text),

    Junta    = Table.Combine({Atual, Hist}),
    // dias sem nada lançado (resto do mês, linhas com 0) ficam de fora
    ComDados = Table.SelectRows(Junta, each
                   List.AnyTrue(List.Transform({[#"Plan PCP m³"], [#"Plan Log m³"], [#"Real Log m³"], [#"Veículos Plan"]},
                                               (v) => v <> null and v <> 0))),
    Tipado   = Table.TransformColumnTypes(ComDados, {
                   {"Data", type date}, {"Plan PCP m³", type number}, {"Plan Log m³", type number},
                   {"Real Log m³", type number}, {"Veículos Plan", type number}, {"Adicionais", type number},
                   {"Furos Log", type number}, {"Furos PCP", type number}, {"MDC Entregue", type number},
                   {"Origem", type text}}),
    Final    = Table.Sort(Tipado, {{"Data", Order.Ascending}})
in
    Final
