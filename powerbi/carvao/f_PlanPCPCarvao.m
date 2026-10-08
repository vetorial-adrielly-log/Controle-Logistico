// f_PlanPCPCarvao — planejamento diário de puxada de carvão enviado pelo PCP por e-mail.
// O Power Automate grava cada e-mail "Planejamento de Expedição de Carvão - dd/mm" na tabela
// tbPlanPCP do arquivo "Planejamento PCP Carvao.xlsx" (pasta Indicadores › Planejamento PCP).
// Uma linha por dia x UPC x destino (RRP/CMG), em m³.
let
    // mesma ligação de nomes usada em d_UPC_Map (o PCP usa nomes curtos: "Lageado", "Móvel"...)
    Mapa     = {
                   {"OURO VERDE",      "UPC OURO VERDE"},
                   {"MATA VERDE",      "UPC MATA VERDE"},
                   {"VERDE MAR",       "UPC VERDE MAR"},
                   {"LAJEADO",         "UPC LAGEADO"},
                   {"LAGEADO",         "UPC LAGEADO"},
                   {"NOVA DA MATA",    "UPC NOVA DA MATA"},
                   {"CABECEIRA FUNDA", "UPC CABECEIRA FUNDA"},
                   {"ÁGUA LIMPA",      "UPC ÁGUA LIMPA"},
                   {"AGUA LIMPA",      "UPC ÁGUA LIMPA"},
                   {"MÓVEL",           "UPC MÓVEL 1"},
                   {"MOVEL",           "UPC MÓVEL 1"},
                   {"BOM FUTURO",      "UPC BOM FUTURO"},
                   {"LOBO",            "UPC LOBO"},
                   {"SÃO JOÃO",        "UPC SÃO JOÃO"},
                   {"MANGABA",         "UPC MANGABA"},
                   {"AGROBUSINESS",    "UPC AGROBUSINESS"},
                   {"DOURAFORTE",      "UPC DOURAFORTE"},
                   {"FGMG",            "UPC FGMG"},
                   {"GERDAU",          "UPC GERDAU"}
               },
    Arquivo  = fnArquivoSP(
                   pSiteLog,
                   {"Shared Documents", "Campo Grande", "4. Carvão", "Programação de Expedição",
                    "Indicadores", "Planejamento PCP"},
                   "Planejamento PCP Carvao.xlsx"
               ),
    Pasta    = Excel.Workbook(Arquivo, null, true),
    Tabela   = Pasta{[Item = "tbPlanPCP", Kind = "Table"]}[Data],
    Datas    = Table.TransformColumns(Tabela, {{"Data", each
                   if _ is number then Date.From(_)                       // série do Excel
                   else if _ is date or _ is datetime then Date.From(_)
                   else Date.FromText(Text.Start(Text.From(_), 10), [Format = "yyyy-MM-dd"]), type date}}),
    Tipado   = Table.TransformColumnTypes(Datas, {{"UPC", type text}, {"Destino", type text}, {"Planejado m3", type number}}),
    Validas  = Table.SelectRows(Tipado, each [Data] <> null and [UPC] <> null and [#"Planejado m3"] <> null),
    ComPart  = Table.AddColumn(Validas, "UPC Partição", each
                   let
                       u   = Text.Upper([UPC]),
                       hit = List.First(List.Select(Mapa, (p) => Text.Contains(u, p{0})), null)
                   in
                       if hit <> null then hit{1}
                       else Text.Trim(Text.Upper(Text.BeforeDelimiter([UPC], "("))),   // TERCEIRO, IMPORTADO...
                   type text),
    Final    = Table.RenameColumns(
                   Table.SelectColumns(ComPart, {"Data", "UPC", "UPC Partição", "Destino", "Planejado m3"}),
                   {{"UPC", "UPC (e-mail)"}, {"Destino", "DESTINO"}, {"Planejado m3", "Planejado m³"}})
in
    Final
