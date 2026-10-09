// d_UPC_Carvao — uma linha por UPC da partição (com o Tipo mais recente: Própria/Contrato),
// mais as UPCs da base de puxada que não estão na partição.
let
    DaMeta = Table.Buffer(Table.Sort(
                 Table.SelectColumns(f_MetaCarvao, {"UPC Partição", "Tipo", "Mês"}),
                 {{"Mês", Order.Descending}})),
    Unicas = Table.Distinct(Table.SelectColumns(DaMeta, {"UPC Partição", "Tipo"}), {"UPC Partição"}),
    DoMapa = Table.SelectRows(
                 Table.Distinct(Table.SelectColumns(d_UPC_Map, {"UPC Partição"})),
                 each not List.Contains(Unicas[UPC Partição], [UPC Partição])),
    Extras = Table.AddColumn(DoMapa, "Tipo", each "Sem partição", type text),
    Final  = Table.TransformColumnTypes(Table.Combine({Unicas, Extras}),
                 {{"UPC Partição", type text}, {"Tipo", type text}})
in
    Final
