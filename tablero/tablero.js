/* tablero.js — Observatorio GERMEN. Lee window.GERMEN (datos_germen.js) y
   window.GERMEN_X (datos_extra.js: CIM y series por institución), ambos agregados y
   anonimizados. Todo se calcula en el navegador; no hay servidor.
   Los perfiles muestran CIM (sistemas automatizados), no halos de inhibición. */
'use strict';
const G = window.GERMEN, X = window.GERMEN_X || {};
const $ = s => document.querySelector(s);
const ORG = {eco: 'Escherichia coli', kpn: 'Klebsiella pneumoniae', ecl: 'Complejo Enterobacter cloacae', sma: 'Serratia marcescens',
  pmi: 'Proteus mirabilis', pae: 'Pseudomonas aeruginosa', aba: 'Complejo Acinetobacter baumannii', sau: 'Staphylococcus aureus',
  efa: 'Enterococcus faecalis', efm: 'Enterococcus faecium'};
const AB = {AMP: 'Ampicilina', SAM: 'Ampicilina/sulbactam', TZP: 'Piperacilina/tazobactam', CZO: 'Cefazolina', CRO: 'Ceftriaxona',
  CAZ: 'Ceftazidima', FEP: 'Cefepima', ATM: 'Aztreonam', ETP: 'Ertapenem', IPM: 'Imipenem', MEM: 'Meropenem', AMK: 'Amikacina',
  GEN: 'Gentamicina', CIP: 'Ciprofloxacina', SXT: 'Trimetoprim/sulfa', NIT: 'Nitrofurantoína', FOS: 'Fosfomicina',
  CZA: 'Ceftazidima/avibactam', CZT: 'Ceftolozano/tazobactam', OXA: 'Oxacilina (SARM)', CLI: 'Clindamicina', ERY: 'Eritromicina',
  TCY: 'Tetraciclina', RIF: 'Rifampicina', VAN: 'Vancomicina', LNZ: 'Linezolid', DAP: 'Daptomicina', GEH: 'Gentamicina alta carga',
  TGC: 'Tigeciclina', COL: 'Colistina', FDC: 'Cefiderocol', IMR: 'Imipenem/relebactam', MEV: 'Meropenem/vaborbactam'};
const IND_CORTO = {eco_cro: 'E. coli R ceftriaxona', kpn_cro: 'K. pneumoniae R ceftriaxona', kpn_car: 'K. pneumoniae R carbapenémicos',
  crpa: 'P. aeruginosa R carbapenémicos', mrsa: 'SARM', eco_cip: 'E. coli R ciprofloxacina', eco_car: 'E. coli R carbapenémicos',
  cre: 'Enterobacterales R carbapenémicos', crab: 'A. baumannii R carbapenémicos', vre: 'E. faecium R vancomicina'};
const MIN_N = 30;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const f1 = (x, d = 1) => x == null || isNaN(x) ? '–' : Number(x).toLocaleString('es-CO', {minimumFractionDigits: d, maximumFractionDigits: d});
const f0 = x => x == null ? '–' : Number(x).toLocaleString('es-CO');
const it = s => `<i>${s}</i>`;
// datos de un grafico SVG propio para el boton «Datos» (descargas.js)
const csvAttr = filas => `data-csv="${encodeURIComponent(JSON.stringify(filas))}"`;
function wilson(x, n, z = 1.96) {
  if (!n) return [NaN, NaN]; const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
}
const sem = p => p >= 90 ? css('--s-hi') : p >= 70 ? css('--s-md') : css('--s-lo');
const chipCls = p => p >= 90 ? 'c-hi' : p >= 70 ? 'c-md' : 'c-lo';
const opts = (sel, arr, val) => { sel.innerHTML = arr.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); if (val != null) sel.value = val; };
const charts = {};
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); return charts[id]; }
Chart.defaults.font.family = "'Instrument Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
function colores() { Chart.defaults.color = css('--tx2'); Chart.defaults.borderColor = css('--borde'); }
// controles segmentados: <div class="seg" id=".." data-v="..."><button data-v>..</button></div>
const segV = id => $(id).dataset.v;
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  $(id).dataset.v = b.dataset.v; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(); }); }

// ---- utilidades de datos -----------------------------------------------------------
const anios = [...new Set(Object.keys(G.s_red).map(k => k.split('.')[0]))].sort().reverse();
function abList(o) { const s = new Set(); for (const k in G.s_tend) { const p = k.split('.'); if (p[2] === o) s.add(p[3]); } return [...s]; }
function cell(obj, key) { const v = obj[key]; return v ? {S: v[0], I: v[1], R: v[2], n: v[0] + v[1] + v[2]} : null; }
const filas = t => { if (!t) return []; const k = Object.keys(t), n = t[k[0]].length, out = []; for (let i = 0; i < n; i++) { const r = {}; k.forEach(c => r[c] = t[c][i]); out.push(r); } return out; };
const CAT = {}, CIMR = {}, CIMI = {}, CIMQ = {};
filas(X.cim_cat).forEach(r => { (CAT[`${r.o}.${r.ab}`] = CAT[`${r.o}.${r.ab}`] || {})[r.pos] = r.cat; });
const acum = (M, k, r) => { const d = M[k] = M[k] || {}; const c = d[r.pos] = d[r.pos] || {n: 0, ops: {}}; c.n += r.N; c.ops[r.op] = (c.ops[r.op] || 0) + r.N; };
filas(X.cim_red).forEach(r => acum(CIMR, `${r.o}.${r.ab}.${r.anio}`, r));
filas(X.cim_inst).forEach(r => acum(CIMI, `${r.letra}.${r.o}.${r.ab}`, r));
filas(X.cim_q).forEach(r => CIMQ[`${r.o}.${r.ab}.${r.anio}`] = r);
const INS = filas(X.inst_series), ITOP = filas(X.inst_top), RTOP = filas(X.red_top), IMU = filas(X.inst_muestra);
function sumaDist(keys, M) { const out = {}; keys.forEach(k => { const d = M[k]; if (!d) return; for (const p in d) { const c = out[p] = out[p] || {n: 0, ops: {}}; c.n += d[p].n; for (const o in d[p].ops) c.ops[o] = (c.ops[o] || 0) + d[p].ops[o]; } }); return out; }
const dilLab = p => { const v = Math.pow(2, p); return v >= 1 ? String(v) : ({0.5: '0,5', 0.25: '0,25', 0.125: '0,12', 0.0625: '0,06', 0.03125: '0,03', 0.015625: '0,015'})[v] || v.toFixed(3); };

// ---- ROSA DE SENSIBILIDAD (barras radiales; radio lineal al %S) ---------------------
function arco(c, r0, r1, a0, a1) {
  const P = (r, a) => [c + r * Math.sin(a), c - r * Math.cos(a)], [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0), g = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${g} 0 ${x3},${y3}Z`;
}
function rosa(items, {size = 520, centro = '', ref = null} = {}) {
  // items: [{ab, p, n, li, ls}]; ref: {ab: pct} -> trazo oscuro (comparador)
  const c = size / 2, r0 = 58, r1 = size / 2 - 78, R = p => r0 + (r1 - r0) * Math.max(0, Math.min(100, p)) / 100, k = items.length, paso = 2 * Math.PI / k;
  const dl = [['Antibiótico', 'Código', '% sensible', 'IC 95 % inferior', 'IC 95 % superior', 'n', ...(ref ? ['Comparador (% sensible)'] : [])],
    ...items.map(r => [AB[r.ab] || r.ab, r.ab, f1(r.p), f1(r.li), f1(r.ls), r.n, ...(ref ? [ref[r.ab] != null ? f1(ref[r.ab]) : ''] : [])])];
  let g = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Perfil de sensibilidad" ${csvAttr(dl)}>`;
  [[100, '100 %', css('--borde2'), '3 5'], [90, '90', css('--s-hi'), ''], [70, '70', css('--s-md'), ''], [50, '50', css('--borde2'), '3 5']].forEach(([p, l, col, d]) => {
    g += `<circle cx="${c}" cy="${c}" r="${R(p)}" fill="none" stroke="${col}" stroke-opacity=".6" stroke-width="${d ? 1 : 1.6}" ${d ? `stroke-dasharray="${d}"` : ''}/><text x="${c + 4}" y="${c - R(p) + 12}" class="ax" fill="${col}">${l}</text>`; });
  g += `<circle cx="${c}" cy="${c}" r="${r0 - 4}" fill="${css('--sup')}" stroke="${css('--borde')}"/>`;
  items.forEach((r, i) => {
    const a0 = i * paso + .035, a1 = (i + 1) * paso - .035, am = (a0 + a1) / 2, col = sem(r.p);
    g += `<path class="petal" style="--d:${.05 + .045 * i}s;transform-origin:${c}px ${c}px" d="${arco(c, r0, R(r.p), a0, a1)}" fill="${col}" fill-opacity=".88"><title>${AB[r.ab] || r.ab}: ${f1(r.p)} % sensible (IC 95 % ${f1(r.li)}–${f1(r.ls)}), n = ${f0(r.n)}${ref && ref[r.ab] != null ? ` · comparador ${f1(ref[r.ab])} %` : ''}</title></path>`;
    if (r.li != null && !isNaN(r.li)) g += `<line x1="${c + R(r.li) * Math.sin(am)}" y1="${c - R(r.li) * Math.cos(am)}" x2="${c + R(r.ls) * Math.sin(am)}" y2="${c - R(r.ls) * Math.cos(am)}" stroke="${css('--ink')}" stroke-width="1.6" opacity=".75"/>`;
    if (ref && ref[r.ab] != null) g += `<path d="${arco(c, R(ref[r.ab]) - 1.4, R(ref[r.ab]) + 1.4, a0 + .02, a1 - .02)}" fill="${css('--ink')}"/>`;
    const lr = r1 + 30, tx = c + lr * Math.sin(am), ty = c - lr * Math.cos(am), an = Math.abs(Math.sin(am)) < .3 ? 'middle' : Math.sin(am) > 0 ? 'start' : 'end';
    g += `<text x="${tx}" y="${ty - 2}" text-anchor="${an}" class="rosa-ab">${r.ab}</text><text x="${tx}" y="${ty + 14}" text-anchor="${an}" class="rosa-p" fill="${col}">${r.p >= 99 && r.p < 100 ? f1(r.p) : Math.round(r.p)}%</text>`;
  });
  return g + `<text x="${c}" y="${c + 5}" text-anchor="middle" class="rosa-c">${centro}</text></svg>`;
}
const leyRosa = refLab => `<div class="leg"><span><i style="background:${css('--s-hi')}"></i>≥ 90 % S</span><span><i style="background:${css('--s-md')}"></i>70–89 %</span><span><i style="background:${css('--s-lo')}"></i>&lt; 70 %</span>${refLab ? `<span><i style="background:${css('--ink')};height:3px;width:18px"></i>${refLab}</span>` : ''}<span><i style="background:${css('--ink')};width:2px;height:13px"></i>IC 95 %</span></div>`;

// ---- ESPECTRO DE CIM ---------------------------------------------------------------
function espectro(fs, {w = 640, rh = 34, labW = 140, derW = 74} = {}) {
  // fs: [{lab, dist: {pos: {n, ops}}, cat: {pos: 'S'|'I'|'SDD'|'R'}}]
  const all = []; fs.forEach(f => { const t = Object.values(f.dist).reduce((s, c) => s + c.n, 0) || 1; for (const p in f.dist) if (f.dist[p].n / t >= .003) all.push(+p); });
  if (!all.length) return '<div class="vacio">Sin resultados de CIM para esta combinación.</div>';
  const pmin = Math.max(-6, Math.min(...all)), pmax = Math.min(9, Math.max(...all)), nc = pmax - pmin + 1, cw = (w - labW - derW) / nc, top = 26, h = top + rh * fs.length + 6;
  const BG = {S: css('--cS'), I: css('--cI'), SDD: css('--cI'), R: css('--cR')}, FG = {S: css('--s-hi'), I: css('--s-md'), SDD: css('--s-md'), R: css('--s-lo')};
  const CATN = {S: 'Sensible', I: 'Intermedio', SDD: 'SDD', R: 'Resistente'}, dl = [['Fila', 'CIM (µg/mL)', 'n', '%', 'Categoría CLSI 2025']];
  fs.forEach(f => { const t = Object.values(f.dist).reduce((s, c) => s + c.n, 0) || 1;
    Object.keys(f.dist).map(Number).sort((a, b) => a - b).forEach(p => { const c = f.dist[p], op = Object.entries(c.ops).sort((a, b) => b[1] - a[1])[0][0];
      dl.push([f.lab, (op === '<=' ? '≤' : op === '>' ? '>' : '') + dilLab(op === '>' ? p - 1 : p), c.n, f1(100 * c.n / t), CATN[(f.cat || {})[p]] || 'Sin punto de corte']); }); });
  let g = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Distribución de CIM" ${csvAttr(dl)}>`;
  for (let j = 0; j < nc; j++) g += `<text x="${labW + (j + .5) * cw}" y="16" text-anchor="middle" class="ax">${dilLab(pmin + j)}</text>`;
  g += `<text x="${w - derW + 8}" y="16" class="ax">n · CIM50/90</text>`;
  fs.forEach((f, i) => {
    const y = top + i * rh, tot = Object.values(f.dist).reduce((s, c) => s + c.n, 0) || 1, mx = Math.max(...Object.values(f.dist).map(c => c.n)) / tot;
    g += `<text x="${labW - 8}" y="${y + rh / 2 + 4}" text-anchor="end" class="bl">${f.lab}</text>`;
    let prev = null;
    for (let j = 0; j < nc; j++) { const p = pmin + j, ct = (f.cat || {})[p] || 'NI', x = labW + j * cw;
      g += `<rect x="${x + .5}" y="${y + 2}" width="${cw - 1}" height="${rh - 4}" fill="${BG[ct] || css('--sup2')}"/>`;
      if (prev === 'S' && ct !== 'S') g += `<line x1="${x}" x2="${x}" y1="${y - 1}" y2="${y + rh + 1}" stroke="${css('--ink')}" stroke-width="2.2"/>`; prev = ct; }
    let cum = 0, q50 = null, q90 = null;
    Object.keys(f.dist).map(Number).sort((a, b) => a - b).forEach(p => { const c = f.dist[p], fr = c.n / tot; cum += fr;
      if (q50 == null && cum >= .5) q50 = p; if (q90 == null && cum >= .9) q90 = p;
      if (p < pmin || p > pmax) return; const j = p - pmin, x = labW + j * cw, bh = (rh - 9) * fr / mx, ct = (f.cat || {})[p] || 'NI';
      const op = Object.entries(c.ops).sort((a, b) => b[1] - a[1])[0][0], pre = op === '<=' ? '≤' : op === '>' ? '>' : '';
      g += `<rect class="col" style="--d:${.02 * j + .03 * i}s" x="${x + cw * .2}" y="${y + rh - 4 - bh}" width="${cw * .6}" height="${bh}" rx="1.5" fill="${FG[ct] || css('--tx3')}"><title>CIM ${pre}${dilLab(op === '>' ? p - 1 : p)} µg/mL: ${f1(100 * fr)} % (${f0(c.n)})</title></rect>`;
      if (fr >= .06 && rh >= 30) g += `<text x="${x + cw / 2}" y="${y + rh - 7 - bh}" text-anchor="middle" class="cel">${pre}${Math.round(100 * fr)}</text>`; });
    g += `<text x="${w - derW + 8}" y="${y + rh / 2 - 1}" class="bl" style="font-family:var(--f-mono)">${f0(tot)}</text><text x="${w - derW + 8}" y="${y + rh / 2 + 12}" class="ax">${q50 != null ? dilLab(q50) : '–'} · ${q90 != null ? dilLab(q90) : '–'}</text>`;
  });
  return g + '</svg>';
}
const leyCim = () => `<div class="leg"><span><i style="background:${css('--cS')};border:1px solid ${css('--s-hi')}"></i>dilución sensible</span><span><i style="background:${css('--cI')};border:1px solid ${css('--s-md')}"></i>intermedia/SDD</span><span><i style="background:${css('--cR')};border:1px solid ${css('--s-lo')}"></i>resistente</span><span><i style="background:${css('--ink')};width:3px;height:14px"></i>punto de corte S (CLSI 2025)</span></div>`;

// ---- SUSCEPTIBILIDAD -------------------------------------------------------------
let sAb = null;
function initS() {
  opts($('#sAnio'), anios.map(a => [a, a]), anios[0]);
  opts($('#sOrg'), Object.entries(ORG).map(([k, v]) => [k, v]), 'eco');
  $('#sAnio').onchange = renderS; $('#sOrg').onchange = () => { sAb = null; renderS(); };
  ['#sGrupo', '#sMu', '#sVista'].forEach(s => seg(s, renderS));
}
function filasS() {
  const a = $('#sAnio').value, g = segV('#sGrupo'), m = segV('#sMu'), o = $('#sOrg').value;
  return abList(o).map(ab => { const c = cell(G.s_red, [a, g, m, o, ab].join('.')); if (!c) return null; const [li, ls] = wilson(c.S, c.n); return {ab, ...c, p: 100 * c.S / c.n, li, ls}; })
    .filter(r => r && r.n >= MIN_N);
}
function renderS() {
  const a = $('#sAnio').value, o = $('#sOrg').value, vista = segV('#sVista');
  const rows = filasS(), nmax = rows.reduce((m, r) => Math.max(m, r.n), 0);
  const grupoTxt = $('#sGrupo .on').textContent, muTxt = $('#sMu .on').textContent;
  $('#sTit').innerHTML = it(ORG[o]); $('#sSub').textContent = `${grupoTxt} · ${muTxt} · ${a} · hasta ${f0(nmax)} aislamientos`;
  if (vista === 'rosa') {
    $('#sViz').innerHTML = rows.length ? rosa(rows, {size: 540, centro: a}) : '<div class="vacio">Sin combinaciones con n ≥ 30 en este estrato.</div>';
    $('#sLeg').innerHTML = leyRosa(); $('#sNota').textContent = 'Cada pétalo es un antibiótico; su largo es el % sensible (radio lineal: 0 en el anillo interior, 100 en el exterior). Anillos de referencia en 70 % y 90 %. Pase el cursor para ver n e IC.';
  } else {
    const fs = rows.map(r => ({lab: r.ab, dist: CIMR[`${o}.${r.ab}.${a}`] || {}, cat: CAT[`${o}.${r.ab}`] || {}})).filter(f => Object.keys(f.dist).length);
    $('#sViz').innerHTML = espectro(fs, {w: 640, rh: Math.min(36, Math.max(26, Math.floor(480 / Math.max(1, fs.length))))});
    $('#sLeg').innerHTML = leyCim(); $('#sNota').textContent = 'Distribución de CIM (µg/mL) del año en la red (todas las muestras y edades; los filtros de grupo y muestra no aplican aquí). Altura relativa a la dilución modal de cada fila; ≤ y > son valores censurados en los límites del panel. Solo resultados por CIM (sistemas automatizados).';
  }
  $('#sTb').innerHTML = [...rows].sort((x, y) => y.p - x.p).map(r => { const q = CIMQ[`${o}.${r.ab}.${a}`];
    return `<tr data-ab="${r.ab}" style="cursor:pointer"${r.ab === sAb ? ' class="sel-row"' : ''}><td>${AB[r.ab] || r.ab}</td><td><span class="chip ${chipCls(r.p)}">${f1(r.p)}</span></td><td class="mu">${f1(r.li)}–${f1(r.ls)}</td>
    <td><div class="barra-s"><span style="width:${r.p}%;background:${sem(r.p)}"></span><em style="left:90%"></em></div></td><td>${f0(r.n)}</td>
    <td>${q ? dilLab(Math.round(Math.log2(q.cim50))) : '–'}</td><td>${q ? dilLab(Math.round(Math.log2(q.cim90))) : '–'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="vacio">Sin datos suficientes</td></tr>';
  $('#sTb').querySelectorAll('tr[data-ab]').forEach(tr => tr.onclick = () => { sAb = tr.dataset.ab; renderS(); });
  if (!sAb || !rows.some(r => r.ab === sAb)) sAb = (rows.find(r => ['MEM', 'CRO', 'VAN', 'OXA'].includes(r.ab)) || rows[0] || {}).ab;
  renderDeriva(o, sAb);
}
function renderDeriva(o, ab) {
  if (!ab) { $('#sDeriva').innerHTML = ''; return; }
  const yrs = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'], fs = yrs.map(y => ({lab: y, dist: CIMR[`${o}.${ab}.${y}`] || {}, cat: CAT[`${o}.${ab}`] || {}})).filter(f => Object.values(f.dist).reduce((s, c) => s + c.n, 0) >= MIN_N);
  $('#sDeriva').innerHTML = `<div class="kick">Diez años de CIM</div><h2>${it(ORG[o])} · ${AB[ab] || ab}: ¿se mueve la distribución o crece la cola?</h2>
  <p class="sub">Una fila por año (red, todas las muestras). Si la resistencia crece por una población nueva, aparece una segunda joroba; si hay deriva («MIC creep»), toda la distribución se corre a la derecha.</p>
  <div class="viz" style="margin-top:10px">${espectro(fs, {w: 1180, rh: 34, labW: 70, derW: 100})}</div>${leyCim()}`;
}

// ---- DISTRIBUCION ------------------------------------------------------------------
function initD() { opts($('#dAnio'), anios.map(a => [a, a]), anios[0]); $('#dAnio').onchange = renderD; seg('#dGrupo', renderD); seg('#dMu', renderD); }
function renderD() {
  const k = [$('#dAnio').value, segV('#dGrupo'), segV('#dMu')].join('.');
  const r = G.dist.filter(d => d.k === k).sort((a, b) => b.n - a.n); const tot = r.reduce((s, d) => s + d.n, 0);
  $('#dTit').textContent = `Lo que se aisló en ${$('#dAnio').value}`; $('#dSub').textContent = `${$('#dGrupo .on').textContent} · ${$('#dMu .on').textContent} · ${f0(tot)} aislamientos (25 más frecuentes)`;
  const top = r.slice(0, 15); colores();
  chart('dCh', {type: 'bar', data: {labels: top.map(d => d.e), datasets: [{data: top.map(d => 100 * d.n / tot),
    backgroundColor: top.map(d => d.g === 'n' ? '#c2462e' : d.g === 'p' ? css('--germen') : '#8fc1eb'), borderRadius: 6}]},
    options: {indexAxis: 'y', maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${f1(c.raw)} % (${f0(top[c.dataIndex].n)})`}}},
      scales: {x: {title: {display: true, text: '% de aislamientos'}}, y: {ticks: {font: {style: 'italic'}}}}}});
  $('#dTb').innerHTML = r.map(d => `<tr><td><i>${d.e}</i></td><td>${f0(d.n)}</td><td>${f1(100 * d.n / tot)}</td></tr>`).join('');
}

// ---- TENDENCIAS -----------------------------------------------------------------
const PALS = ['#4c858b', '#c2462e', '#d69a2d'];
function initT() {
  opts($('#tOrg'), Object.entries(ORG), 'kpn');
  const setAbs = () => { const l = abList($('#tOrg').value).map(a => [a, AB[a] || a]); const def = {eco: ['CRO', 'CIP', 'MEM'], kpn: ['CRO', 'MEM', 'TZP'],
    pae: ['MEM', 'FEP', 'TZP'], sau: ['OXA', 'CLI', 'SXT'], aba: ['MEM', 'AMK', 'SAM'], efm: ['VAN', 'AMP', 'LNZ'], efa: ['AMP', 'VAN', 'NIT']}[$('#tOrg').value] || [];
    ['#tA1', '#tA2', '#tA3'].forEach((s, i) => opts($(s), [['', '—'], ...l], def[i] && l.some(x => x[0] === def[i]) ? def[i] : (l[i] || [''])[0])); renderT(); };
  $('#tOrg').onchange = setAbs; ['#tA1', '#tA2', '#tA3'].forEach(s => $(s).onchange = renderT); seg('#tGrupo', renderT); seg('#tCoh', renderT); setAbs();
  $('#tInd').innerHTML = G.indicadores.map(r => `<tr><td>${r.indicador.replace(/^([A-Z]\. [a-z]+|S\. aureus|P\. aeruginosa|A\. baumannii|E\. faecium)/, m => `<i>${m}</i>`)}</td>
    <td>${f1(r.pct_2016_2018)}</td><td>${f1(r.pct_2023_2025)}</td><td>${f1(r.pct_2025)}</td>
    <td>${r.OR_anual ? `${f1(r.OR_anual, 2)} <span class="mu">(${f1(r.OR_li, 2)}–${f1(r.OR_ls, 2)})</span>` : '–'}</td>
    <td>${r.OR_anual_estable ? `${f1(r.OR_anual_estable, 2)} <span class="mu">(${f1(r.ORe_li, 2)}–${f1(r.ORe_ls, 2)})</span>` : '–'}</td><td>${f1(r.MOR_2023_2025, 2)}</td></tr>`).join('');
}
function renderT() {
  const o = $('#tOrg').value, g = segV('#tGrupo'), src = segV('#tCoh') === 'est' ? G.s_tend_est : G.s_tend;
  const yrs = [...new Set(Object.keys(G.s_tend).map(k => k.split('.')[0]))].sort();
  const ds = []; colores();
  ['#tA1', '#tA2', '#tA3'].forEach((s, i) => { const ab = $(s).value; if (!ab) return;
    const pts = yrs.map(y => { const c = cell(src, [y, g, o, ab].join('.')); if (!c || c.n < MIN_N) return null; const [li, ls] = wilson(c.S, c.n); return {y: 100 * c.S / c.n, li, ls, n: c.n}; });
    ds.push({label: AB[ab] || ab, data: pts.map(p => p && p.y), borderColor: PALS[i], backgroundColor: PALS[i], tension: .25, spanGaps: true, pointRadius: 4, borderWidth: 3, _p: pts});
    ds.push({label: '_li', data: pts.map(p => p && p.li), borderWidth: 0, pointRadius: 0, fill: false, spanGaps: true});
    ds.push({label: '_ls', data: pts.map(p => p && p.ls), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: PALS[i] + '22', spanGaps: true}); });
  $('#tSub').innerHTML = `${it(ORG[o])} · ${$('#tGrupo .on').textContent} · ${$('#tCoh .on').textContent} · % sensible (puntos con n ≥ 30)`;
  chart('tCh', {type: 'line', data: {labels: yrs, datasets: ds}, options: {maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
    plugins: {legend: {labels: {filter: l => !l.text.startsWith('_'), usePointStyle: true}}, tooltip: {filter: c => !c.dataset.label.startsWith('_'),
      callbacks: {label: c => { const p = c.dataset._p[c.dataIndex]; return p ? `${c.dataset.label}: ${f1(p.y)} % (IC ${f1(p.li)}–${f1(p.ls)}; n=${f0(p.n)})` : ''; }}}},
    scales: {y: {min: 0, max: 100, title: {display: true, text: '% sensible'}}}}});
}

// ---- COMPARAR (embudo) --------------------------------------------------------------
function initC() {
  opts($('#cInd'), G.indicadores.map(r => [r.id, r.indicador]), 'kpn_car');
  opts($('#cYo'), [['', '— ninguna —'], ...G.instituciones.map(r => [r.letra, r.codigo])]);
  $('#cInd').onchange = renderC; $('#cYo').onchange = renderC;
}
function qnorm(p) { // aproximacion de Acklam
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924],
    b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857], c = [-.00778489400243029, -.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878], d = [.00778469570904146, .32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(p, 1 - p); let x;
  if (q > .02425) { const r = p - .5, s = r * r; return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1); }
  const r = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  return p < .5 ? x : -x;
}
const Z95 = qnorm(.975), Z998 = qnorm(.999);
const senal = (r, p0) => { const z = (r.pct / 100 - p0) / Math.sqrt(p0 * (1 - p0) / r.n); return z > Z998 ? 2 : z > Z95 ? 1 : z < -Z998 ? -2 : z < -Z95 ? -1 : 0; };
const SEN_TXT = {2: 'Por encima (99,8 %)', 1: 'Por encima (95 %)', 0: 'Dentro de lo esperado', '-1': 'Por debajo (95 %)', '-2': 'Por debajo (99,8 %)'};
function renderC() {
  const id = $('#cInd').value, yo = $('#cYo').value, pts = G.embudo.filter(r => r.id === id);
  if (!pts.length) return; const p0 = pts[0].red / 100, nmax = Math.max(...pts.map(r => r.n)) * 1.08;
  const lim = z => { const out = []; for (let i = 1; i <= 80; i++) { const n = Math.max(10, nmax * i / 80); out.push({x: n, y: Math.max(0, Math.min(100, 100 * (p0 + z * Math.sqrt(p0 * (1 - p0) / n))))}); } return out; };
  colores();
  $('#cSub').innerHTML = `${$('#cInd').selectedOptions[0].text} · red ${f1(pts[0].red)} %`;
  chart('cCh', {type: 'scatter', data: {datasets: [
    {label: 'Instituciones', data: pts.map(r => ({x: r.n, y: r.pct, l: r.letra})), pointRadius: pts.map(r => r.letra === yo ? 11 : 7),
      backgroundColor: pts.map(r => r.letra === yo ? '#c2462e' : senal(r, p0) >= 2 ? '#d69a2d' : css('--tx3')), pointStyle: pts.map(r => r.letra === yo ? 'rectRot' : 'circle')},
    {type: 'line', label: 'Red', data: [{x: 0, y: 100 * p0}, {x: nmax, y: 100 * p0}], borderColor: css('--germen'), borderWidth: 2.5, pointRadius: 0},
    ...[[Z95, [6, 5]], [Z998, []]].flatMap(([z, dash]) => [1, -1].map(s => ({type: 'line', label: '_l', data: lim(s * z), borderColor: css('--borde2'), borderDash: dash, borderWidth: 1.5, pointRadius: 0, tension: .3})))]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {filter: c => c.datasetIndex === 0, callbacks: {label: c => `Institución ${c.raw.l}: ${f1(c.raw.y)} % (n=${f0(c.raw.x)})`}}},
      scales: {x: {title: {display: true, text: 'Aislamientos evaluados 2023–2025'}, min: 0}, y: {title: {display: true, text: '% resistente'}, min: 0}}}});
  $('#cTb').innerHTML = [...pts].sort((a, b) => b.pct - a.pct).map(r => `<tr${r.letra === yo ? ' class="sel-row" style="font-weight:700"' : ''}><td>Institución ${r.letra}</td><td>${f0(r.n)}</td><td>${f1(r.pct)}</td><td class="mu">${SEN_TXT[senal(r, p0)]}</td></tr>`).join('');
}

// ---- MI INSTITUCION ------------------------------------------------------------
function initI() {
  opts($('#iInst'), [['', '— seleccionar —'], ...G.instituciones.map(r => [r.letra, r.codigo])]);
  opts($('#iOrg'), Object.entries(ORG), 'eco'); $('#iInst').onchange = renderI; $('#iOrg').onchange = renderI; seg('#iPer', renderI);
}
// franja: cada institucion es un punto; la propia, un rombo rojo; linea = red
function franjas(L) {
  const ids = [...new Set(G.embudo.map(r => r.id))];
  return ids.map(id => {
    const pts = G.embudo.filter(r => r.id === id), yo = pts.find(r => r.letra === L); if (!pts.length) return '';
    const mx = Math.max(5, ...pts.map(r => r.pct)) * 1.08, X = v => 8 + 384 * v / mx, p0 = pts[0].red / 100;
    let s = `<svg viewBox="0 0 400 34"><line x1="8" x2="392" y1="17" y2="17" stroke="${css('--borde')}" stroke-width="6" stroke-linecap="round"/>`;
    s += `<line x1="${X(pts[0].red)}" x2="${X(pts[0].red)}" y1="4" y2="30" stroke="${css('--germen')}" stroke-width="2.5"/>`;
    pts.filter(r => r !== yo).forEach(r => s += `<circle cx="${X(r.pct)}" cy="17" r="5" fill="${senal(r, p0) >= 2 ? '#d69a2d' : css('--tx3')}" fill-opacity=".55"><title>Institución ${r.letra}: ${f1(r.pct)} % (n=${f0(r.n)})</title></circle>`);
    if (yo) s += `<rect x="${X(yo.pct) - 7}" y="10" width="14" height="14" fill="#c2462e" stroke="#fff" stroke-width="2" transform="rotate(45 ${X(yo.pct)} 17)"><title>Mi institución: ${f1(yo.pct)} % (n=${f0(yo.n)})</title></rect>`;
    s += '</svg>';
    const sg = yo ? senal(yo, p0) : null, col = sg >= 2 ? 'var(--er)' : sg <= -2 ? 'var(--ok)' : 'var(--tx)';
    return `<div class="strip-row"><div class="lab">${IND_CORTO[id] || id}<div class="mu" style="font-size:11px;font-weight:500">${yo ? SEN_TXT[sg] + ' · n=' + f0(yo.n) : 'sin datos suficientes'}</div></div><div class="viz">${s}</div><div class="val" style="color:${col}">${yo ? f1(yo.pct) + ' %' : '–'}</div></div>`;
  }).join('');
}
function renderI() {
  const L = $('#iInst').value, o = $('#iOrg').value, per = segV('#iPer');
  if (!L) { $('#iBox').innerHTML = '<div class="tarjeta vacio">Seleccione su institución para ver sus gráficos frente al resto de la red.</div>'; return; }
  const red = {}; for (const k in G.s_inst) { const [l, p, g, oo, ab] = k.split('.'); if (p !== per || g !== 'adulto' || oo !== o) continue; const v = G.s_inst[k];
    red[ab] = red[ab] || {S: 0, n: 0, inst: null}; red[ab].S += v[0]; red[ab].n += v[0] + v[1] + v[2]; if (l === L) red[ab].inst = {S: v[0], n: v[0] + v[1] + v[2]}; }
  const rows = Object.entries(red).filter(([, r]) => r.inst && r.inst.n >= 10).map(([ab, r]) => ({ab, pi: 100 * r.inst.S / r.inst.n, ni: r.inst.n,
    pr: 100 * (r.S - r.inst.S) / Math.max(1, r.n - r.inst.n), ci: wilson(r.inst.S, r.inst.n)}));
  const rosaItems = rows.filter(r => r.ni >= MIN_N).map(r => ({ab: r.ab, p: r.pi, n: r.ni, li: r.ci[0], ls: r.ci[1]}));
  const refRed = Object.fromEntries(rows.map(r => [r.ab, r.pr]));
  const mu = IMU.filter(r => r.letra === L), ntot = mu.reduce((s, r) => s + r.N, 0);
  const emb = G.embudo.filter(r => r.letra === L), arriba = emb.filter(r => senal(r, r.red / 100) >= 2).length, abajo = emb.filter(r => senal(r, r.red / 100) <= -2).length;
  const q = G.calidad.find(r => r.letra === L) || {};
  // CIM: antibioticos con datos de la institucion
  const abCim = [...new Set(Object.keys(CIMI).filter(k => k.startsWith(`${L}.${o}.`)).map(k => k.split('.')[2]))];
  const abSel = ['MEM', 'CRO', 'OXA', 'VAN', 'CIP'].find(a => abCim.includes(a)) || abCim[0];
  $('#iBox').innerHTML = `
  <div class="tarjeta" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap"><div class="yo-badge"><span>${L}</span>Institución ${L}</div>
    <div class="stats" style="flex:1;margin:0;min-width:300px">
      <div class="stat"><div class="stat-n">${f0(ntot)}</div><div class="stat-l">primeros aislamientos en 2025</div></div>
      <div class="stat"><div class="stat-n" style="color:${arriba ? 'var(--er)' : 'var(--ok)'}">${arriba}</div><div class="stat-l">indicadores por encima de la red (99,8 %)</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--ok)">${abajo}</div><div class="stat-l">indicadores por debajo de la red (99,8 %)</div></div>
      <div class="stat"><div class="stat-n">${q.pct_resultados_interpretables != null ? f1(q.pct_resultados_interpretables, 0) + ' %' : '–'}</div><div class="stat-l">resultados interpretables con CLSI 2025</div></div></div></div>
  <div class="g2">
    <div class="tarjeta"><div class="kick">Perfil comparado · adultos · ${per}</div><h2>${it(ORG[o])}: mi institución frente al resto de la red</h2>
      <p class="sub">Pétalos: % sensible en la institución (n ≥ 30). Trazo oscuro: el resto de la red.</p>
      <div class="viz" style="margin-top:6px">${rosaItems.length ? rosa(rosaItems, {size: 520, centro: 'Institución ' + L, ref: refRed}) : '<div class="vacio">Menos de 30 aislamientos por antibiótico en este periodo.</div>'}</div>${leyRosa('resto de la red')}</div>
    <div class="tarjeta"><div class="kick">¿Dónde estoy? · 2023–2025</div><h2>Mi posición en cada indicador</h2>
      <p class="sub">Cada punto es una institución; el rombo rojo es la suya; la línea, la red. Ámbar: instituciones fuera del límite del 99,8 %.</p>
      <div style="margin-top:8px" ${csvAttr([['Indicador', '% resistente institución', 'n institución', '% resistente red', 'Señal'],
        ...[...new Set(G.embudo.map(r => r.id))].map(id => { const y = G.embudo.find(r => r.id === id && r.letra === L), r0 = G.embudo.find(r => r.id === id);
          return [IND_CORTO[id] || id, y ? f1(y.pct) : '', y ? y.n : '', f1(r0.red), y ? SEN_TXT[senal(y, r0.red / 100)] : 'sin datos suficientes']; })])}>${franjas(L)}</div><p class="nota">% resistente. Es la misma información del embudo («Comparar»), en una sola vista.</p></div>
  </div>
  <div class="tarjeta"><div class="kick">Tendencia 2016–2025</div><h2>Mi institución frente a la red, año a año</h2><p class="sub">% resistente. Línea roja: institución (puntos con n ≥ 20); petróleo: red completa con su IC 95 %.</p>
    <div class="g3" id="iTend" style="margin-top:10px"></div></div>
  <div class="g2">
    <div class="tarjeta"><div class="kick">Espectro de CIM · 2023–2025</div><div class="thead"><h2>${it(ORG[o])}: mis CIM frente a la red</h2><select class="sel" id="iAb">${abCim.map(a => `<option value="${a}"${a === abSel ? ' selected' : ''}>${AB[a] || a}</option>`).join('')}</select></div>
      <div class="viz" id="iCim" style="margin-top:10px"></div>${leyCim()}<p class="nota">Misma escala de diluciones; fondo: categoría CLSI 2025. Una distribución desplazada a la derecha, con el mismo % sensible, es una señal temprana.</p></div>
    <div class="tarjeta"><div class="kick">Qué aíslo · 2025</div><h2>Microorganismos más frecuentes frente a la red</h2><div style="position:relative;height:360px;margin-top:10px"><canvas id="iTop"></canvas></div></div>
  </div>
  <div class="g2">
    <div class="tarjeta"><div class="kick">Perfil · adultos · ${per}</div><h2>${it(ORG[o])}: tabla comparativa</h2>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>Antibiótico</th><th>Institución</th><th>IC 95 %</th><th>Resto de la red</th><th>Diferencia</th><th>n</th></tr></thead><tbody>
    ${rows.sort((a, b) => a.pi - b.pi).map(r => `<tr><td>${AB[r.ab] || r.ab}</td><td><span class="chip ${chipCls(r.pi)}">${f1(r.pi)}</span></td><td class="mu">${f1(r.ci[0])}–${f1(r.ci[1])}</td><td>${f1(r.pr)}</td>
      <td style="color:${r.pi - r.pr < -5 ? 'var(--er)' : r.pi - r.pr > 5 ? 'var(--ok)' : 'inherit'};font-weight:700">${r.pi - r.pr > 0 ? '+' : ''}${f1(r.pi - r.pr)}</td><td>${f0(r.ni)}${r.ni < MIN_N ? ' <span class="mu">(n&lt;30)</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin datos</td></tr>'}
    </tbody></table></div><p class="nota">Diferencia en puntos porcentuales frente al conjunto de las demás instituciones. Con n &lt; 30 la estimación es inestable (M39).</p></div>
    <div class="tarjeta"><div class="kick">Tipo de muestra · 2025</div><h2>De dónde vienen mis aislamientos</h2><div style="position:relative;height:340px;margin-top:10px"><canvas id="iMu"></canvas></div>
      <p class="nota">Una mezcla de muestras distinta a la de la red explica parte de las diferencias de resistencia: compare dentro del mismo tipo de muestra.</p></div>
  </div>`;
  const cimI = () => { const ab = $('#iAb').value; const cat = CAT[`${o}.${ab}`] || {};
    $('#iCim').innerHTML = espectro([{lab: 'Institución ' + L, dist: CIMI[`${L}.${o}.${ab}`] || {}, cat}, {lab: 'Red', dist: sumaDist(['2023', '2024', '2025'].map(y => `${o}.${ab}.${y}`), CIMR), cat}], {w: 600, rh: 64, labW: 110}); };
  if (abCim.length) { $('#iAb').onchange = cimI; cimI(); } else $('#iCim').innerHTML = '<div class="vacio">Sin CIM registradas para este organismo.</div>';
  // tendencias por indicador
  colores();
  const ids = ['mrsa', 'kpn_car', 'kpn_cro', 'eco_cro', 'crpa', 'eco_cip'], yrs = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  $('#iTend').innerHTML = ids.map(id => `<div><div style="font-weight:700;font-size:13px">${IND_CORTO[id]}</div><div style="position:relative;height:170px"><canvas id="iT_${id}"></canvas></div></div>`).join('');
  ids.forEach(id => {
    const red_ = G.series.filter(r => r.id === id && r.grupo === 'Red completa'), mine = INS.filter(r => r.id === id && r.letra === L);
    const R = y => red_.find(r => r.anio === y), M = y => mine.find(r => r.anio === y);
    chart('iT_' + id, {type: 'line', data: {labels: yrs, datasets: [
      {label: '_li', data: yrs.map(y => R(y) ? R(y).li : null), borderWidth: 0, pointRadius: 0},
      {label: '_ls', data: yrs.map(y => R(y) ? R(y).ls : null), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: css('--germen') + '26'},
      {label: 'Red', data: yrs.map(y => R(y) ? R(y).pct : null), borderColor: css('--germen'), backgroundColor: css('--germen'), borderWidth: 2.5, pointRadius: 0, tension: .3},
      {label: 'Institución ' + L, data: yrs.map(y => { const m = M(y); return m && m.n >= 20 ? 100 * m.x / m.n : null; }), borderColor: '#c2462e', backgroundColor: '#c2462e', borderWidth: 2.5, pointRadius: 3.5, tension: .3, spanGaps: true,
        _n: yrs.map(y => M(y) ? M(y).n : 0)}]},
      options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {filter: c => !c.dataset.label.startsWith('_'),
        callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} %${c.dataset._n ? ` (n=${f0(c.dataset._n[c.dataIndex])})` : ''}`}}},
        scales: {x: {ticks: {maxTicksLimit: 5}}, y: {min: 0, ticks: {maxTicksLimit: 4}}}}});
  });
  // composicion
  const it_ = ITOP.filter(r => r.letra === L).slice(0, 8), labs = it_.map(r => r.especie_rep);
  chart('iTop', {type: 'bar', data: {labels: labs, datasets: [
    {label: 'Institución ' + L, data: it_.map(r => r.pct), backgroundColor: '#c2462e', borderRadius: 5},
    {label: 'Red', data: labs.map(e => (RTOP.find(r => r.especie_rep === e) || {}).pct || null), backgroundColor: css('--germen'), borderRadius: 5}]},
    options: {indexAxis: 'y', maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {usePointStyle: true}}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} %`}}},
      scales: {x: {title: {display: true, text: '% de los aislamientos clínicos'}}, y: {ticks: {font: {style: 'italic'}}}}}});
  // muestras
  const redMu = {}; IMU.forEach(r => redMu[r.muestra] = (redMu[r.muestra] || 0) + r.N); const totRed = Object.values(redMu).reduce((a, b) => a + b, 0);
  const mus = Object.keys(redMu).sort((a, b) => redMu[b] - redMu[a]), PM = ['#4c858b', '#8fc1eb', '#c2462e', '#d69a2d', '#6b5ca5', '#2f5f64', '#b9c6c8', '#c77daa', '#7a8c8f'];
  chart('iMu', {type: 'bar', data: {labels: ['Institución ' + L, 'Red'], datasets: mus.map((m, i) => ({label: m, data: [(mu.find(r => r.muestra === m) || {}).pct || 0, 100 * redMu[m] / totRed], backgroundColor: PM[i % PM.length]}))},
    options: {indexAxis: 'y', maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {boxWidth: 12}}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} %`}}},
      scales: {x: {stacked: true, max: 100}, y: {stacked: true}}}});
}

// ---- CARBAPENEMASAS ---------------------------------------------------------------
function renderK() {
  colores(); const ca = G.carb_anio; const tipos = Object.keys(ca[0]).filter(k => k !== 'anio');
  const cols = {'Serincarbapenemasa (KPC)': css('--germen'), 'Metalobetalactamasa (MBL)': '#c2462e', 'KPC + MBL': '#d69a2d', 'OXA-48-like': '#6b5ca5', 'No tipificada': '#b9c6c8'};
  const u = ca[ca.length - 1]; const tot = tipos.reduce((s, t) => s + (u[t] || 0), 0);
  const tasa = G.carb_tasa; const t25 = tasa.find(r => r.anio === 2025) || {};
  $('#kStats').innerHTML = [[f0(tot), `casos en ${u.anio}`], [f0(u['Serincarbapenemasa (KPC)'] || 0), 'KPC (serincarbapenemasa)'],
    [f0((u['Metalobetalactamasa (MBL)'] || 0) + (u['KPC + MBL'] || 0)), 'con MBL (NDM/VIM), sola o con KPC'], [f1(t25.x1000, 1), 'casos clínicos por 1.000 BGN (2025)']]
    .map(([n, l]) => `<div class="stat"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div>`).join('');
  chart('kCh1', {type: 'bar', data: {labels: ca.map(r => r.anio), datasets: tipos.map(t => ({label: t, data: ca.map(r => r[t] || 0), backgroundColor: cols[t] || '#999', borderRadius: 3}))},
    options: {maintainAspectRatio: false, scales: {x: {stacked: true}, y: {stacked: true}}, plugins: {legend: {position: 'bottom', labels: {usePointStyle: true}}}}});
  chart('kCh2', {type: 'line', data: {labels: tasa.map(r => r.anio), datasets: [{label: 'por 1.000 BGN', data: tasa.map(r => r.x1000), borderColor: css('--germen'), backgroundColor: css('--germen') + '30', fill: true, borderWidth: 3, tension: .3}]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {y: {min: 0}}}});
  const e = G.carb_especie_2025; const ks = Object.keys(e[0] || {}).filter(k => k !== 'especie_rep');
  $('#kEsp').innerHTML = `<table><thead><tr><th>Especie</th>${ks.map(k => `<th>${k.replace(' (', '<br>(')}</th>`).join('')}</tr></thead><tbody>${e.slice(0, 10).map(r => `<tr><td><i>${r.especie_rep}</i></td>${ks.map(k => `<td>${r[k] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rs = G.carb_rescate; const tt = [...new Set(rs.map(r => r.tipo_carb_simple))]; const abs = [...new Set(rs.map(r => r.ab))];
  $('#kRes').innerHTML = `<table><thead><tr><th>Antibiótico</th>${tt.map(t => `<th>${t.split(' (')[0]}</th>`).join('')}</tr></thead><tbody>${abs.map(a => `<tr><td>${AB[a] || a}</td>${tt.map(t => { const r = rs.find(x => x.ab === a && x.tipo_carb_simple === t); return `<td>${r ? `<span class="chip ${chipCls(r.pct_S)}">${f1(r.pct_S)}</span> <span class="mu">${r.n}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}

// ---- WISCA -------------------------------------------------------------------------
function initW() { const s = [...new Set(G.wisca.map(r => r.sindrome))];
  $('#wSin').innerHTML = s.map((x, i) => `<button data-v="${x}"${i ? '' : ' class="on"'}>${x.split(' (')[0]}</button>`).join(''); $('#wSin').dataset.v = s[0]; seg('#wSin', renderW); }
const ES = t => t.replace('Cefepime', 'Cefepima').replace('Trimetoprima/sulfamethoxazole', 'Trimetoprim/sulfametoxazol').replace(/\bVancomycin\b/, 'Vancomicina').replace(/\bAmikacin\b/, 'Amikacina');
function renderW() {
  const s = segV('#wSin'), r = G.wisca.filter(x => x.sindrome === s).map(x => ({...x, esquema: ES(x.esquema)})).sort((a, b) => b.cobertura - a.cobertura); colores();
  $('#wTit').textContent = s; $('#wSub').textContent = `${f0(r[0] && r[0].n_aislamientos)} aislamientos 2023–2025`;
  chart('wCh', {type: 'bar', data: {labels: r.map(x => x.esquema), datasets: [{data: r.map(x => x.cobertura), backgroundColor: r.map(x => sem(x.cobertura)), borderRadius: 6}]},
    options: {indexAxis: 'y', maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => { const x = r[c.dataIndex]; return `${f1(x.cobertura)} % (IC 95 % ${f1(x.li)}–${f1(x.ls)})`; }}}},
      scales: {x: {min: 0, max: 100, title: {display: true, text: 'Probabilidad de cobertura (%)'}}}}});
  const c = G.wisca_comp.filter(x => x.sindrome === s);
  $('#wComp').innerHTML = `<table><thead><tr><th>Patógeno</th><th>n</th><th>%</th></tr></thead><tbody>${c.map(x => `<tr><td><i>${x.especie_rep}</i></td><td>${f0(x.N)}</td><td>${f1(x.pct)}</td></tr>`).join('')}</tbody></table>`;
}

// ---- CALIDAD -------------------------------------------------------------------------
function renderQ() {
  const q = [...G.calidad].sort((a, b) => a.letra.localeCompare(b.letra));
  const med = k => { const v = q.map(r => r[k]).filter(x => x != null).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const reglas = {pct_con_antibiograma: [1, null], pct_resultados_interpretables: [1, 80], pct_sin_servicio: [-1, 10], pct_sin_edad: [-1, 10], pct_muestra_otras: [-1, null], pct_cons_sangre: [-1, 30], carb_prueba_en_CRE: [1, 50]};
  const celda = (r, k) => { const v = r[k]; if (v == null) return '<td class="mu">–</td>'; const [dir, lim] = reglas[k]; const m = med(k);
    const mal = lim != null && (dir > 0 ? v < lim : v > lim); const peor = dir > 0 ? v < m : v > m;
    return `<td><span class="chip ${mal ? 'c-lo' : peor ? 'c-md' : 'c-hi'}">${f1(v)}</span></td>`; };
  $('#qTb').innerHTML = q.map(r => `<tr><td><b>${r.letra}</b></td><td>${f0(r.registros)}</td>${['pct_con_antibiograma', 'pct_resultados_interpretables', 'pct_sin_servicio', 'pct_sin_edad', 'pct_muestra_otras', 'pct_cons_sangre', 'carb_prueba_en_CRE'].map(k => celda(r, k)).join('')}</tr>`).join('');
}

// ---- arranque ------------------------------------------------------------------
const RENDER = {s: renderS, d: renderD, t: renderT, c: renderC, i: renderI, k: renderK, w: renderW, q: renderQ};
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('act', x === b));
  document.querySelectorAll('.pan').forEach(p => p.classList.toggle('act', p.id === 'pan-' + b.dataset.p));
  RENDER[b.dataset.p]();
});
$('#btnTema').onclick = () => { const r = document.documentElement; const osc = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = osc ? 'light' : 'dark'; try { localStorage.setItem('germen-tema', r.dataset.theme); } catch (e) {}
  RENDER[document.querySelector('.tab.act').dataset.p](); };
try { const t = localStorage.getItem('germen-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
const an = G.anual, tot = an.reduce((s, r) => s + r.primeros_clinicos, 0);
$('#hdrSub').textContent = `Red GERMEN · ${G.instituciones.length} instituciones activas · 2016–2025 · ${G.guia}`;
$('#heroK').innerHTML = [[f0(tot), 'primeros aislamientos'], [G.instituciones.length, 'instituciones activas'], ['10', 'años · CLSI 2025']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
$('#pie').innerHTML = `Datos agregados y anonimizados de la red GERMEN (WHONET), actualizados ${G.generado}. Primer aislamiento por paciente, especie y año (CLSI M39), sin cultivos de tamizaje. CIM de sistemas automatizados; los halos de disco no se representan. Cada institución recibe su letra de forma privada.`;
initS(); initD(); initT(); initC(); initI(); initW(); renderS();
// enlace directo a una pestana: index.html#k (carbapenemasas), #w (tratamiento empirico)...
// #i/A/kpn abre "Mi institucion" con la institucion A y K. pneumoniae; #s/cim abre el espectro de CIM
const [h0, h1, h2] = location.hash.slice(1).split('/');
if (h0 === 'i' && h1 && G.instituciones.some(r => r.letra === h1)) { $('#iInst').value = h1; if (h2 && ORG[h2]) $('#iOrg').value = h2; }
if (h0 === 's' && h1 === 'cim') $('#sVista button[data-v="cim"]').click();
const b0 = document.querySelector(`.tab[data-p="${h0}"]`); if (b0) b0.click();
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => history.replaceState(null, '', '#' + b.dataset.p)));
