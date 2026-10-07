// d_UPC_Map — liga a UPC da base de puxada (f_basePlan) à UPC da planilha de partição.
// A busca é por palavra-chave, na ordem da lista (OURO VERDE antes de LAJEADO, etc.).
// UPC sem correspondência fica como "SEM META DE PARTIÇÃO": o carregado dela continua no total.
// Para ligar uma UPC nova, acrescente {"PALAVRA DA BASE", "NOME NA PARTIÇÃO"} na lista.
let
    Mapa    = {
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
                  {"FGMG",            "UPC FGMG"}
              },
    Fonte   = Table.Distinct(Table.SelectColumns(Table.SelectRows(f_basePlan, each [UPC] <> null), {"UPC"})),
    ComPart = Table.AddColumn(Fonte, "UPC Partição", each
                  let
                      u   = Text.Upper([UPC]),
                      hit = List.First(List.Select(Mapa, (p) => Text.Contains(u, p{0})), null)
                  in
                      if hit = null then "SEM META DE PARTIÇÃO" else hit{1},
                  type text)
in
    ComPart
