/**
 * Office Script — "Planejamento PCP Carvão"
 *
 * Chamado pelo Power Automate a cada e-mail "Planejamento de Expedição de Carvão - dd/mm".
 * Lê a tabela do corpo do e-mail (UPC x RRP (Ribas) x CMG (Corumbá), em m³) e grava uma
 * linha por UPC e destino na tabela "tbPlanPCP" desta pasta de trabalho.
 * Se a programação do mesmo dia chegar de novo (reenvio/correção), as linhas daquele dia
 * são substituídas pelas do e-mail mais recente.
 *
 * Colunas de tbPlanPCP: Data | UPC | Destino | Planejado m3 | Assunto | Recebido em
 */
function main(workbook: ExcelScript.Workbook, corpoHtml: string, assunto: string, recebidoEm: string): string {
  const recebido = new Date(recebidoEm);
  const data = dataDoAssunto(assunto, corpoHtml, recebido);
  if (!data) return "ERRO: data não encontrada no assunto nem no corpo";
  const linhas = lerTabela(corpoHtml);
  if (linhas.length === 0) return "ERRO: tabela UPC/RRP/CMG não encontrada no corpo";

  const tabela = workbook.getTable("tbPlanPCP");
  if (!tabela) return "ERRO: tabela tbPlanPCP não existe na pasta de trabalho";

  // remove as linhas do mesmo dia (de baixo para cima)
  const valores = tabela.getRangeBetweenHeaderAndTotal().getValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    if (chaveData(valores[i][0]) === data) tabela.deleteRowsAt(i, 1);
  }
  const novas = linhas.map(l => [data, l.upc, l.destino, l.m3, assunto, recebido.toISOString()]);
  tabela.addRows(-1, novas);
  return `OK: ${data} · ${novas.length} linhas`;
}

/** "dd/mm" do assunto (ou "D – dd/mm" do corpo); o ano vem da data de recebimento. */
function dataDoAssunto(assunto: string, html: string, recebido: Date): string | null {
  const m = /(\d{1,2})\/(\d{1,2})/.exec(assunto) || /D\s*[–-]\s*(\d{1,2})\/(\d{1,2})/.exec(textoPlano(html));
  if (!m) return null;
  const dia = Number(m[1]), mes = Number(m[2]);
  let ano = recebido.getFullYear();
  // programação de janeiro enviada em dezembro
  if (mes === 1 && recebido.getMonth() === 11) ano += 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Lê as linhas da tabela cujo cabeçalho tem "UPC", "RRP" e "CMG". */
function lerTabela(html: string): { upc: string; destino: string; m3: number }[] {
  const out: { upc: string; destino: string; m3: number }[] = [];
  const tabelas = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const t of tabelas) {
    const linhas = (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(tr =>
      (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(td => textoPlano(td)));
    const iCab = linhas.findIndex(c => c.some(x => /^UPC$/i.test(x)) && c.some(x => /RRP/i.test(x)) && c.some(x => /CMG/i.test(x)));
    if (iCab < 0) continue;
    const cab = linhas[iCab];
    const cUpc = cab.findIndex(x => /^UPC$/i.test(x));
    const cRrp = cab.findIndex(x => /RRP/i.test(x));
    const cCmg = cab.findIndex(x => /CMG/i.test(x));
    for (const c of linhas.slice(iCab + 1)) {
      const upc = (c[cUpc] || "").trim();
      if (!upc || /^TOTAL/i.test(upc)) continue;
      for (const [destino, col] of [["RRP", cRrp], ["CMG", cCmg]] as [string, number][]) {
        const v = numero(c[col]);
        if (v > 0) out.push({ upc, destino, m3: v });
      }
    }
    if (out.length) break;
  }
  return out;
}

/** valor da coluna Data como "aaaa-mm-dd", seja texto ou número de série do Excel */
function chaveData(v: string | number | boolean): string {
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

/** "1.010" -> 1010 · "250" -> 250 · "-" ou vazio -> 0 */
function numero(s: string | undefined): number {
  const t = (s || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return isFinite(n) && t !== "" && t !== "-" ? n : 0;
}

function textoPlano(html: string): string {
  return html.replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ").trim();
}
