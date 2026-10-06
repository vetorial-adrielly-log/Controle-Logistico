// Cria a tela "Dashboard — Controle Logístico Geral - Visão Geral" no arquivo Figma
// "Dataviz - Painéis Log" (fileKey 5SpGz0d631h1Q4Wsb9g493), na coluna das telas de
// Controle Logístico Geral, logo abaixo de "Visão executiva - Matéria Prima".
// Reaproveita sidebar, logo e cabeçalho da tela de Matéria Prima (150:95) para manter
// a identidade visual idêntica. Executar via Figma MCP (use_figma) ou plugin "Scripter".
const SRC = await figma.getNodeByIdAsync('150:95');
const NAME = 'Dashboard — Controle Logístico Geral - Visão Geral';
const old = figma.currentPage.findOne(n => n.type === 'FRAME' && n.name === NAME && n.parent === figma.currentPage);
if (old) old.remove();
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = h => [{ type: 'SOLID', color: hex(h) }];
const GREEN = '#284D38', TINT = '#F0F7F2', CELL = '#F6F9F7', BORDER = '#E5E8EB', GRAY = '#6B7B72';

const F = SRC.clone();
F.name = NAME; F.x = SRC.x; F.y = SRC.y + SRC.height + 240;
const abs = n => n.absoluteBoundingBox;
const rel = n => ({ x: abs(n).x - abs(F).x, y: abs(n).y - abs(F).y, w: abs(n).width, h: abs(n).height });

// fontes usadas no arquivo
const texts = F.findAll(n => n.type === 'TEXT');
const fontOf = t => t.getRangeFontName(0, 1);
const subtitle = texts.find(t => t.characters.startsWith('Visão Executiva'));
const kpiLabel = texts.find(t => /^META/.test(t.characters)) || texts.find(t => rel(t).y > 100);
const REG = fontOf(subtitle), BOLD = fontOf(kpiLabel);
await Promise.all([REG, BOLD].map(f => figma.loadFontAsync(f)));
for (const t of texts) for (const s of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(s.fontName);
subtitle.characters = 'Visão Executiva – Visão Geral';

// sidebar: localizar rótulos e ícones de navegação
const side = F.children.find(n => rel(n).x <= 0 && rel(n).h > 900) || F.findOne(n => n.name === 'Sidebar');
const navText = name => F.findAll(n => n.type === 'TEXT' && rel(n).x < 104 && n.characters.replace(/\s+/g, ' ').trim() === name)[0];
const iconAbove = t => {
  const r = rel(t);
  return F.findAll(n => n.type !== 'TEXT' && rel(n).x < 104 && rel(n).w < 70 && rel(n).h < 70 && rel(n).w > 20 &&
      rel(n).y + rel(n).h <= r.y + 4 && rel(n).y + rel(n).h > r.y - 30)
    .sort((a, b) => (rel(b).y - rel(a).y))[0];
};
// destaque da sidebar: retângulo verde-claro (#4D8264) -> mover para "Visão Geral"
const isHL = n => 'fills' in n && Array.isArray(n.fills) && n.fills.some(p => p.type === 'SOLID' && Math.abs(p.color.r - 0x4d / 255) < 0.03 && Math.abs(p.color.g - 0x82 / 255) < 0.03);
const hl = F.findAll(n => rel(n).x < 104 && rel(n).w > 80 && rel(n).w < 110 && rel(n).h > 60 && rel(n).h < 100 && isHL(n))[0];
const vgText = navText('Visão Geral');
if (hl && vgText) {
  const dy = (rel(vgText).y + rel(vgText).h + 10 - rel(hl).h) - rel(hl).y;
  hl.y += dy;
}
// textos de navegação: branco normal, já estão corretos no clone

// remover conteúdo da tela de MP (tudo à direita da sidebar e abaixo do cabeçalho) e o botão Filtros
for (const n of [...F.children]) {
  const r = rel(n);
  if (r.x >= 110 && r.y >= 95) n.remove();
}
const filt = F.findAll(n => n.type === 'TEXT' && n.characters.trim() === 'Filtros')[0];
let filtGroup = filt; while (filtGroup && filtGroup.parent !== F) filtGroup = filtGroup.parent;
if (filtGroup) filtGroup.remove();
const upd = (() => { const t = F.findAll(n => n.type === 'TEXT' && /atualiza/i.test(n.characters))[0]; let g = t; while (g && g.parent !== F) g = g.parent; return g; })();

const rect = (x, y, w, h, fill, r = 8, stroke = BORDER, name = 'Card') => {
  const n = figma.createRectangle(); n.name = name; F.appendChild(n);
  n.x = x; n.y = y; n.resize(w, h); n.cornerRadius = r; n.fills = solid(fill);
  if (stroke) { n.strokes = solid(stroke); n.strokeWeight = 1; n.strokeAlign = 'INSIDE'; }
  return n;
};
const text = (x, y, s, size, font = BOLD, color = GREEN, name = 'Label', w) => {
  const t = figma.createText(); F.appendChild(t); t.fontName = font; t.fontSize = size; t.characters = s;
  t.fills = solid(color); t.name = name; t.x = x; t.y = y;
  if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, t.height); t.textAlignHorizontal = 'CENTER'; }
  return t;
};
// cabeçalho: caixas Mês / Ano / Última atualização (alinhadas à direita)
if (upd) { upd.x = 1518; upd.y = 17; }
for (const [x, w, s] of [[1230, 170, 'Mês'], [1410, 100, 'Ano']]) {
  rect(x, 17, w, 60, '#FFFFFF', 8, BORDER, 'Slicer ' + s);
  text(x + 7, 21, s, 8, REG, '#000000', 'Slicer Label');
}

// cards por segmento
const segs = [
  ['Ferro Gusa', 'FERRO GUSA', 'Expedição · toneladas', 'EXPEDIDO NO MÊS (t)', ['META (t)', '% ATINGIMENTO', 'RITMO (TENDÊNCIA)', '% RITMO', 'PREVISÃO CONCLUSÃO', 'MÉDIA DIÁRIA (t)']],
  ['Minério de Ferro', 'MINÉRIO DE FERRO', 'Expedição · toneladas', 'EXPEDIDO NO MÊS (t)', ['META (t)', '% ATINGIMENTO', 'RITMO (TENDÊNCIA)', '% RITMO', 'PREVISÃO CONCLUSÃO', 'MÉDIA DIÁRIA (t)']],
  ['Co Produtos', 'CO PRODUTOS', 'Expedição · toneladas', 'EXPEDIDO NO MÊS (t)', ['META (t)', '% ATINGIMENTO', 'RITMO (TENDÊNCIA)', '% RITMO', 'PREVISÃO CONCLUSÃO', 'MÉDIA DIÁRIA (t)']],
  ['Carvão', 'CARVÃO', 'Carregamento · m³', 'CARREGADO NO MÊS (m³)', ['PLANEJADO (m³)', 'CANCELADO (m³)', 'FALTA CARREGAR (m³)', 'CARGAS PLANEJADAS', 'CARGAS CARREGADAS', 'CARGAS A CARREGAR']],
  ['Matéria Prima', 'MATÉRIA PRIMA', 'Recebimento · toneladas', 'RECEBIDO NO MÊS (t)', ['META (t)', '% ALCANCE', 'RITMO (TENDÊNCIA)', '% RITMO', 'PREVISÃO CONCLUSÃO', 'MÉDIA DIÁRIA (t)']],
];
const CW = 324, CH = 536, CY = 104, X0 = 128, GAP = 10;
const created = [];
segs.forEach(([nav, name, sub, big, kpis], i) => {
  const x = X0 + i * (CW + GAP);
  created.push(rect(x, CY, CW, CH, '#FFFFFF', 8, BORDER, 'Card ' + name).id);
  const c = figma.createEllipse(); F.appendChild(c); c.name = 'Icon Circle'; c.x = x + 16; c.y = CY + 16; c.resize(52, 52); c.fills = solid(TINT);
  const t = navText(nav); const ic = t && iconAbove(t);
  if (ic) {
    const k = ic.clone(); F.appendChild(k);
    const s = 30 / Math.max(k.width, k.height); k.rescale(s);
    k.x = x + 42 - k.width / 2; k.y = CY + 42 - k.height / 2;
    const paint = n => { if ('fills' in n && Array.isArray(n.fills) && n.fills.length && n.type !== 'FRAME' && n.type !== 'GROUP') n.fills = n.fills.map(p => p.type === 'SOLID' ? { ...p, color: hex(GREEN) } : p);
      if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length) n.strokes = n.strokes.map(p => p.type === 'SOLID' ? { ...p, color: hex(GREEN) } : p); };
    paint(k); if ('findAll' in k) k.findAll(() => true).forEach(paint);
    k.name = 'Icon ' + nav;
  }
  text(x + 80, CY + 18, name, 15, BOLD, GREEN, 'Segment Title');
  text(x + 80, CY + 40, sub, 11, REG, GRAY, 'Segment Subtitle');
  const ln = figma.createLine(); F.appendChild(ln); ln.x = x + 16; ln.y = CY + 84; ln.resize(CW - 32, 0); ln.strokes = solid('#EDF0EE');
  text(x + 16, CY + 96, big, 11, BOLD, GREEN, 'Big KPI Label');
  text(x + 16, CY + 128, '0', 30, BOLD, '#242424', 'Big KPI Value (Power BI)');
  // barra de progresso (representa o Linear Gauge do Power BI)
  rect(x + 16, CY + 182, CW - 32, 12, '#E8EFEA', 6, null, 'Gauge Track');
  rect(x + 16, CY + 182, (CW - 32) * 0.62, 12, GREEN, 6, null, 'Gauge Fill');
  text(x + 16, CY + 206, 'Realizado x meta do mês', 9, REG, GRAY, 'Gauge Caption');
  kpis.forEach((k, j) => {
    const r = Math.floor(j / 2), cc = j % 2, cx = x + 16 + cc * 150, cy = CY + 232 + r * 100;
    rect(cx, cy, 142, 92, CELL, 6, '#E9EFEB', 'KPI ' + k);
    text(cx + 10, cy + 10, k, 9.5, BOLD, GREEN, 'KPI Label');
    text(cx + 10, cy + 40, '—', 17, BOLD, '#242424', 'KPI Value (Power BI)');
  });
});
// gráficos inferiores
[['PRODUTOS — META x EXPEDIDO POR ITEM (t)'], ['MATÉRIAS PRIMAS — META x RECEBIDO POR MATERIAL (t)']].forEach(([t], j) => {
  const x = X0 + j * 835;
  created.push(rect(x, 650, 825, 370, '#FFFFFF', 8, BORDER, 'Chart ' + (j ? 'Matérias Primas' : 'Produtos')).id);
  text(x, 666, t, 13, BOLD, GREEN, 'Chart Title', 825);
});
return { frameId: F.id, name: F.name, x: F.x, y: F.y, highlightMoved: !!hl, iconsFound: segs.map(s => !!(navText(s[0]) && iconAbove(navText(s[0])))), created: created.length };
