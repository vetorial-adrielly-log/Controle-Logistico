// f_MetaCarvao — metas de carvão (m³) da planilha "Gestão da Partição".
// Lê TODOS os arquivos "Gestão da Partição AAAA.xlsx" da pasta "Controle Partição" e TODAS as
// abas de mês (Jan, Fev, ..., Setembro, Outubro, e as que forem criadas, como Novembro).
// Uma aba entra quando tem o bloco "UPC - PRÓPRIA" com as colunas PLAN de CMG e RRP.
// O mês vem da célula com a abreviação do mês no topo da aba (P4: "Out"); se faltar, do nome da aba.
// O ano vem do nome do arquivo. A data da célula W1 NÃO é usada (na aba Agosto ela está 01/07).
let
    Meses    = [Jan = 1, Fev = 2, Mar = 3, Abr = 4, Mai = 5, Jun = 6, Jul = 7, Ago = 8,
                Set = 9, Out = 10, Nov = 11, Dez = 12,
                Janeiro = 1, Fevereiro = 2, Março = 3, Abril = 4, Maio = 5, Junho = 6, Julho = 7,
                Agosto = 8, Setembro = 9, Outubro = 10, Novembro = 11, Dezembro = 12],
    MesDe    = (v as any) as nullable number =>
                   if v is text then Record.FieldOrDefault(Meses, Text.Proper(Text.Trim(v)), null) else null,

    // lê uma aba no layout "PLANEJADO X REALIZADO - PUXADA DE CARVÃO"
    LerAba   = (t as table, aba as text) as table =>
        let
            // células com erro (#REF!, #VALUE!, #NAME?) viram vazio: as abas de mês têm
            // fórmulas quebradas da linha 108 para baixo e isso travava a carga
            SemErro = Table.ReplaceErrorValues(t, List.Transform(Table.ColumnNames(t), each {_, null})),
            Linhas = List.Buffer(Table.ToRows(SemErro)),
            Pos    = (txt as text) as number =>
                         List.PositionOf(List.Transform(Linhas, each List.Contains(_, txt)), true),
            iProp  = Pos("UPC - PRÓPRIA"),
            iCont  = Pos("UPC - CONTRATO"),
            Cab    = if iProp >= 0 then Linhas{iProp} else {},
            cNome  = List.PositionOf(Cab, "UPC - PRÓPRIA"),
            cPlan  = List.PositionOf(Cab, "PLAN", Occurrence.All),
            Topo   = List.Combine(List.FirstN(Linhas, 6)),
            MesNum = List.First(List.RemoveNulls(List.Transform(Topo, MesDe)), MesDe(aba)),
            Valida = iProp >= 0 and cNome >= 1 and List.Count(cPlan) >= 2 and MesNum <> null,
            Idx    = if Valida then
                         List.Select(List.Positions(Linhas), (i) =>
                             i > iProp
                             and Linhas{i}{cNome} is text
                             and Text.StartsWith(Linhas{i}{cNome}, "UPC ")
                             and Linhas{i}{cNome - 1} <> null)
                     else {},
            Saida  = List.Combine(List.Transform(Idx, (i) =>
                         let
                             r    = Linhas{i},
                             tipo = if iCont >= 0 and i > iCont then "Contrato" else "Própria"
                         in
                             { {MesNum, r{cNome}, Text.From(r{cNome - 1}), tipo, "CMG", r{cPlan{0}}},
                               {MesNum, r{cNome}, Text.From(r{cNome - 1}), tipo, "RRP", r{cPlan{1}}} })),
            Tabela = #table({"MesNum", "UPC Partição", "Código UPC", "Tipo", "DESTINO", "Meta m³"}, Saida)
        in
            Table.SelectRows(Tabela, each [#"Meta m³"] is number and [#"Meta m³"] <> 0),

    Pasta    = fnArquivosPasta(
                   pSiteLog,
                   {"Shared Documents", "Campo Grande", "4. Carvão", "Programação de Expedição",
                    "Indicadores", "Controle Partição"}
               ),
    Arquivos = Table.SelectRows(Pasta, each Text.StartsWith(Text.Lower([Name]), "gest")
                                          and Text.Contains(Text.Lower([Name]), "parti")),
    ComAno   = Table.AddColumn(Arquivos, "Ano",
                   each try Number.From(Text.Start(Text.Select([Name], {"0".."9"}), 4)) otherwise null,
                   Int64.Type),
    AnoOk    = Table.SelectRows(ComAno, each [Ano] <> null and [Ano] > 2000),
    Abas     = Table.AddColumn(AnoOk, "Abas",
                   each Table.SelectRows(Excel.Workbook([Content], false, true), each [Kind] = "Sheet"),
                   type table),
    Expande  = Table.ExpandTableColumn(Table.SelectColumns(Abas, {"Ano", "Abas"}), "Abas",
                   {"Name", "Data"}, {"Aba", "Dados"}),
    Lidas    = Table.AddColumn(Expande, "Metas", each LerAba([Dados], [Aba]), type table),
    Empilha  = Table.ExpandTableColumn(Table.SelectColumns(Lidas, {"Ano", "Metas"}), "Metas",
                   {"MesNum", "UPC Partição", "Código UPC", "Tipo", "DESTINO", "Meta m³"}),
    ComMes   = Table.AddColumn(Empilha, "Mês", each #date([Ano], [MesNum], 1), type date),
    Tipado   = Table.TransformColumnTypes(ComMes, {
                   {"UPC Partição", type text}, {"Código UPC", type text}, {"Tipo", type text},
                   {"DESTINO", type text}, {"Meta m³", type number}}),
    Final    = Table.SelectColumns(Tipado, {"Mês", "UPC Partição", "Código UPC", "Tipo", "DESTINO", "Meta m³"})
in
    Final
