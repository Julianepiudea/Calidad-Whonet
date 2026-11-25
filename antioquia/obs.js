/* obs.js — Observatorio RAM Antioquia (LDSP – SSSPSA · Universidad de Antioquia · powered by red GERMEN).
   Lee window.OBS (datos_obs.js): agregados anonimizados de WHONET 2020–2025 y resultados del análisis
   multinivel. Todo se calcula en el navegador; no hay servidor. Diseño y funciones base del Observatorio GERMEN. */
'use strict';
const O = window.OBS;
const $ = s => document.querySelector(s);
const AB = {AMP: 'Ampicilina', SAM: 'Ampicilina/sulbactam', AMC: 'Amoxicilina/clavulánico', TZP: 'Piperacilina/tazobactam', CZO: 'Cefazolina', CXM: 'Cefuroxima',
  CRO: 'Ceftriaxona', CTX: 'Cefotaxima', MFX: 'Moxifloxacina', NOR: 'Norfloxacina', TOB: 'Tobramicina', CHL: 'Cloranfenicol', TEC: 'Teicoplanina', MNO: 'Minociclina', FDC: 'Cefiderocol', CZT: 'Ceftolozano/tazobactam', CAZ: 'Ceftazidima', FEP: 'Cefepima', FOX: 'Cefoxitina', ATM: 'Aztreonam', ETP: 'Ertapenem', IPM: 'Imipenem', MEM: 'Meropenem',
  CZA: 'Ceftazidima/avibactam', CIP: 'Ciprofloxacina', LVX: 'Levofloxacina', SXT: 'Trimetoprim/sulfa', GEN: 'Gentamicina', AMK: 'Amikacina',
  NIT: 'Nitrofurantoína', FOS: 'Fosfomicina', TGC: 'Tigeciclina', COL: 'Colistina', OXA: 'Oxacilina', PEN: 'Penicilina', VAN: 'Vancomicina',
  LNZ: 'Linezolid', DAP: 'Daptomicina', ERY: 'Eritromicina', CLI: 'Clindamicina', TCY: 'Tetraciclina', RIF: 'Rifampicina'};
const FEN = {eco_c3g: 'E. coli · C3G', eco_cip: 'E. coli · ciprofloxacina', eco_sxt: 'E. coli · TMP/SMX', kpn_c3g: 'K. pneumoniae · C3G',
  kpn_cip: 'K. pneumoniae · ciprofloxacina', kpn_carb: 'K. pneumoniae · carbapenémicos', sau_sarm: 'S. aureus · SARM', pae_carb: 'P. aeruginosa · carbapenémicos'};
const FEN_INST = {eco_c3g: 'E. coli resistente a C3G', eco_cip: 'E. coli resistente a ciprofloxacina', eco_sxt: 'E. coli resistente a TMP/SMX', kpn_c3g: 'K. pneumoniae resistente a C3G',
  kpn_carb: 'K. pneumoniae resistente a carbapenémicos', pae_carb: 'P. aeruginosa resistente a carbapenémicos', sau_sarm: 'S. aureus resistente a oxacilina (SARM)',
  aba_carb: 'A. baumannii resistente a carbapenémicos', efm_van: 'E. faecium resistente a vancomicina'};
const ORDF = Object.keys(FEN), MIN_N = 30, YRS = [2020, 2021, 2022, 2023, 2024, 2025];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const f1 = (x, d = 1) => x == null || isNaN(x) ? '–' : Number(x).toLocaleString('es-CO', {minimumFractionDigits: d, maximumFractionDigits: d});
const f0 = x => x == null ? '–' : Number(x).toLocaleString('es-CO');
const sg = (x, d = 2) => (x > 0 ? '+' : '') + f1(x, d);
const it = s => `<i>${s}</i>`;
const esp = n => it(n);
const csvAttr = filas => `data-csv="${encodeURIComponent(JSON.stringify(filas))}"`;
function wilson(x, n, z = 1.96) { if (!n) return [NaN, NaN]; const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100]; }
const sem = p => p >= 90 ? css('--s-hi') : p >= 70 ? css('--s-md') : css('--s-lo');
const chipCls = p => p >= 90 ? 'c-hi' : p >= 70 ? 'c-md' : 'c-lo';
const opts = (sel, arr, val) => { sel.innerHTML = arr.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); if (val != null && arr.some(a => String(a[0]) === String(val))) sel.value = val; };
const charts = {};
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); return charts[id]; }
Chart.defaults.font.family = "'Instrument Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
function colores() { Chart.defaults.color = css('--tx2'); Chart.defaults.borderColor = css('--borde'); }
const segV = id => $(id).dataset.v;
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  $(id).dataset.v = b.dataset.v; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(); }); }
const colTend = (lo, hi) => lo > 0 ? css('--er') : hi < 0 ? css('--ok') : css('--tx3');

// ---- descompactar tablas --------------------------------------------------------------
function filas(t) { const k = Object.keys(t), col = c => t[c].d ? t[c].i.map(i => t[c].d[i]) : t[c], C = {}; k.forEach(c => C[c] = col(c));
  const n = C[k[0]].length, out = new Array(n); for (let i = 0; i < n; i++) { const r = {}; k.forEach(c => r[c] = C[c][i]); out[i] = r; } return out; }
const PERF = new Map(); filas(O.perfil).forEach(r => PERF.set([r.s, r.y, r.m, r.e, r.a, r.t].join('|'), r));
const ESPS = [...new Set(filas(O.perfil).map(r => r.e))];
const SUBS = ['Antioquia', ...[...new Set(O.red.subregion)].sort((a, b) => a.localeCompare(b, 'es'))];
const CIMD = {}; filas(O.cim).forEach(r => { const k = `${r.e}|${r.a}|${r.t}`; (CIMD[k] = CIMD[k] || {})[r.p] = (CIMD[k][r.p] || 0) + r.N; });
const CAT = {}; filas(O.cimcat).forEach(r => { (CAT[`${r.e}|${r.a}`] = CAT[`${r.e}|${r.a}`] || {})[r.p] = r.c; });
const INST = filas(O.inst), CONS = filas(O.consumo), ESPC = filas(O.especies);
const RED = []; for (let i = 0; i < O.red.subregion.length; i++) RED.push({s: O.red.subregion[i], t: O.red.anio[i], ni: O.red.instituciones[i], n: O.red.aislamientos[i]});
const M = O.mod;
// celda del perfil sumando síndromes si y = '*'
function celda(s, y, m, e, a, t) {
  const ys = y === '*' ? ['ITU', 'ITS', 'IRB'] : [y]; let n = 0, R = 0, I = 0;
  ys.forEach(yy => { const r = PERF.get([s, yy, m, e, a, t].join('|')); if (r) { n += r.n; R += r.R; I += r.I; } });
  return n ? {n, R, I, S: n - R - I} : null;
}
const abDe = e => [...new Set(filas(O.perfil).filter(r => r.e === e).map(r => r.a))];
const ABDE = {}; ESPS.forEach(e => ABDE[e] = new Set());
filas(O.perfil).forEach(r => ABDE[r.e].add(r.a));
const dilLab = p => { const v = Math.pow(2, p); return v >= 1 ? String(v) : ({0.5: '0,5', 0.25: '0,25', 0.125: '0,12', 0.0625: '0,06', 0.03125: '0,03', 0.015625: '0,015'})[v] || v.toFixed(3); };

// ---- ROSA DE SENSIBILIDAD (del Observatorio GERMEN) ------------------------------------
function arco(c, r0, r1, a0, a1) { const P = (r, a) => [c + r * Math.sin(a), c - r * Math.cos(a)], [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0), g = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${g} 0 ${x3},${y3}Z`; }
function rosa(items, {size = 520, centro = ''} = {}) {
  const c = size / 2, r0 = 58, r1 = size / 2 - 78, R = p => r0 + (r1 - r0) * Math.max(0, Math.min(100, p)) / 100, k = items.length, paso = 2 * Math.PI / k;
  const dl = [['Antibiótico', 'Código', '% sensible', 'IC 95 % inferior', 'IC 95 % superior', 'n'], ...items.map(r => [AB[r.ab] || r.ab, r.ab, f1(r.p), f1(r.li), f1(r.ls), r.n])];
  let g = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Perfil de sensibilidad" ${csvAttr(dl)}>`;
  [[100, '100 %', css('--borde2'), '3 5'], [90, '90', css('--s-hi'), ''], [70, '70', css('--s-md'), ''], [50, '50', css('--borde2'), '3 5']].forEach(([p, l, col, d]) => {
    g += `<circle cx="${c}" cy="${c}" r="${R(p)}" fill="none" stroke="${col}" stroke-opacity=".6" stroke-width="${d ? 1 : 1.6}" ${d ? `stroke-dasharray="${d}"` : ''}/><text x="${c + 4}" y="${c - R(p) + 12}" class="ax" fill="${col}">${l}</text>`; });
  g += `<circle cx="${c}" cy="${c}" r="${r0 - 4}" fill="${css('--sup')}" stroke="${css('--borde')}"/>`;
  items.forEach((r, i) => { const a0 = i * paso + .035, a1 = (i + 1) * paso - .035, am = (a0 + a1) / 2, col = sem(r.p);
    g += `<path class="petal" style="--d:${.05 + .045 * i}s;transform-origin:${c}px ${c}px" d="${arco(c, r0, R(r.p), a0, a1)}" fill="${col}" fill-opacity=".88"><title>${AB[r.ab] || r.ab}: ${f1(r.p)} % sensible (IC 95 % ${f1(r.li)}–${f1(r.ls)}), n = ${f0(r.n)}</title></path>`;
    if (!isNaN(r.li)) g += `<line x1="${c + R(r.li) * Math.sin(am)}" y1="${c - R(r.li) * Math.cos(am)}" x2="${c + R(r.ls) * Math.sin(am)}" y2="${c - R(r.ls) * Math.cos(am)}" stroke="${css('--ink')}" stroke-width="1.6" opacity=".75"/>`;
    const lr = r1 + 30, tx = c + lr * Math.sin(am), ty = c - lr * Math.cos(am), an = Math.abs(Math.sin(am)) < .3 ? 'middle' : Math.sin(am) > 0 ? 'start' : 'end';
    g += `<text x="${tx}" y="${ty - 2}" text-anchor="${an}" class="rosa-ab">${r.ab}</text><text x="${tx}" y="${ty + 14}" text-anchor="${an}" class="rosa-p" fill="${col}">${r.p >= 99 && r.p < 100 ? f1(r.p) : Math.round(r.p)}%</text>`; });
  return g + `<text x="${c}" y="${c + 5}" text-anchor="middle" class="rosa-c">${centro}</text></svg>`;
}
const leyRosa = () => `<div class="leg"><span><i style="background:${css('--s-hi')}"></i>≥ 90 % sensible</span><span><i style="background:${css('--s-md')}"></i>70–89 %</span><span><i style="background:${css('--s-lo')}"></i>&lt; 70 %</span><span><i style="background:${css('--ink')};width:3px;height:14px"></i>IC 95 %</span></div>`;
function espectro(fs, {w = 640, rh = 34, labW = 140, derW = 74} = {}) {
  const all = []; fs.forEach(f => { const t = Object.values(f.dist).reduce((s, c) => s + c, 0) || 1; for (const p in f.dist) if (f.dist[p] / t >= .003) all.push(+p); });
  if (!all.length) return '<div class="vacio">Sin resultados de CIM para esta combinación.</div>';
  const pmin = Math.max(-7, Math.min(...all)), pmax = Math.min(10, Math.max(...all)), nc = pmax - pmin + 1, cw = (w - labW - derW) / nc, top = 26, h = top + rh * fs.length + 6;
  const BG = {S: css('--cS'), I: css('--cI'), SDD: css('--cI'), R: css('--cR')}, FG = {S: css('--s-hi'), I: css('--s-md'), SDD: css('--s-md'), R: css('--s-lo')};
  const dl = [['Fila', 'CIM (µg/mL)', 'n', '%', 'Categoría CLSI 2025']];
  fs.forEach(f => { const t = Object.values(f.dist).reduce((s, c) => s + c, 0) || 1; Object.keys(f.dist).map(Number).sort((a, b) => a - b).forEach(p => dl.push([f.lab, dilLab(p), f.dist[p], f1(100 * f.dist[p] / t), (f.cat || {})[p] || ''])); });
  let g = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Distribución de CIM" ${csvAttr(dl)}>`;
  for (let j = 0; j < nc; j++) g += `<text x="${labW + (j + .5) * cw}" y="16" text-anchor="middle" class="ax">${dilLab(pmin + j)}</text>`;
  g += `<text x="${w - derW + 8}" y="16" class="ax">n · CIM50/90</text>`;
  fs.forEach((f, i) => { const y = top + i * rh, tot = Object.values(f.dist).reduce((s, c) => s + c, 0) || 1, mx = Math.max(...Object.values(f.dist)) / tot;
    g += `<text x="${labW - 8}" y="${y + rh / 2 + 4}" text-anchor="end" class="bl">${f.lab}</text>`; let prev = null;
    for (let j = 0; j < nc; j++) { const p = pmin + j, ct = (f.cat || {})[p] || 'NI', x = labW + j * cw;
      g += `<rect x="${x + .5}" y="${y + 2}" width="${cw - 1}" height="${rh - 4}" fill="${BG[ct] || css('--sup2')}"/>`;
      if (prev === 'S' && ct !== 'S') g += `<line x1="${x}" x2="${x}" y1="${y - 1}" y2="${y + rh + 1}" stroke="${css('--ink')}" stroke-width="2.2"/>`; prev = ct; }
    let cum = 0, q50 = null, q90 = null;
    Object.keys(f.dist).map(Number).sort((a, b) => a - b).forEach(p => { const fr = f.dist[p] / tot; cum += fr; if (q50 == null && cum >= .5) q50 = p; if (q90 == null && cum >= .9) q90 = p;
      if (p < pmin || p > pmax) return; const j = p - pmin, x = labW + j * cw, bh = (rh - 9) * fr / mx, ct = (f.cat || {})[p] || 'NI';
      g += `<rect class="col" style="--d:${.02 * j + .03 * i}s" x="${x + cw * .2}" y="${y + rh - 4 - bh}" width="${cw * .6}" height="${bh}" rx="1.5" fill="${FG[ct] || css('--tx3')}"><title>CIM ${dilLab(p)} µg/mL: ${f1(100 * fr)} % (${f0(f.dist[p])})</title></rect>`;
      if (fr >= .06 && rh >= 30) g += `<text x="${x + cw / 2}" y="${y + rh - 7 - bh}" text-anchor="middle" class="cel">${Math.round(100 * fr)}</text>`; });
    g += `<text x="${w - derW + 8}" y="${y + rh / 2 - 1}" class="bl" style="font-family:var(--f-mono)">${f0(tot)}</text><text x="${w - derW + 8}" y="${y + rh / 2 + 12}" class="ax">${q50 != null ? dilLab(q50) : '–'} · ${q90 != null ? dilLab(q90) : '–'}</text>`; });
  return g + '</svg>';
}
const leyCim = () => `<div class="leg"><span><i style="background:${css('--cS')};border:1px solid ${css('--s-hi')}"></i>dilución sensible</span><span><i style="background:${css('--cI')};border:1px solid ${css('--s-md')}"></i>intermedia/SDD</span><span><i style="background:${css('--cR')};border:1px solid ${css('--s-lo')}"></i>resistente</span><span><i style="background:${css('--ink')};width:3px;height:14px"></i>punto de corte S (CLSI 2025)</span></div>`;

// ---- forest plot genérico (SVG) ----------------------------------------------------------
function forest(rows, {w = 760, rowh = 30, labW = 230, valW = 150, min = .5, max = 2, log = true, ref = 1, ticks = null, fmt = r => `${f1(r.e, 2)} (${f1(r.lo, 2)}–${f1(r.hi, 2)})`, tit = ''} = {}) {
  const h = 34 + rows.length * rowh + 26, X0 = labW, X1 = w - valW, F = v => log ? Math.log(v) : v;
  const sx = v => X0 + (F(Math.min(Math.max(v, min), max)) - F(min)) / (F(max) - F(min)) * (X1 - X0);
  const dl = [['Fila', 'Estimación', 'IC inferior', 'IC superior'], ...rows.filter(r => r.e != null).map(r => [r.l + (r.s ? ' ' + r.s : ''), f1(r.e, 3), f1(r.lo, 3), f1(r.hi, 3)])];
  let g = `<svg class="forest" viewBox="0 0 ${w} ${h}" ${csvAttr(dl)}>`;
  (ticks || (log ? [.5, 1, 2] : [])).forEach(t => g += `<line x1="${sx(t)}" x2="${sx(t)}" y1="22" y2="${h - 22}" stroke="${css('--borde')}"/><text x="${sx(t)}" y="${h - 6}" text-anchor="middle" class="ax">${f1(t, t < 1 && log ? 2 : t % 1 ? 1 : 0)}</text>`);
  g += `<line x1="${sx(ref)}" x2="${sx(ref)}" y1="18" y2="${h - 22}" stroke="${css('--tx')}" stroke-dasharray="4 4" opacity=".6"/>`;
  if (tit) g += `<text x="${(X0 + X1) / 2}" y="12" text-anchor="middle" class="ax">${tit}</text>`;
  rows.forEach((r, i) => { const y = 34 + i * rowh; if (r.l) g += `<text x="${X0 - 10}" y="${y + 4}" text-anchor="end"${r.b ? ' style="font-weight:600"' : ''}>${r.l}</text>`;
    if (r.s) g += `<text x="${X0 - 10}" y="${y + 4}" text-anchor="end" class="ax">${r.s}</text>`;
    if (r.e == null) return; const c = r.c || css('--germen');
    g += `<line x1="${sx(r.lo)}" x2="${sx(r.hi)}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<circle cx="${sx(r.e)}" cy="${y}" r="6" fill="${r.hollow ? css('--sup') : c}" stroke="${c}" stroke-width="2.5"><title>${r.l || ''} ${r.s || ''}: ${fmt(r)}</title></circle>`;
    g += `<text x="${X1 + 12}" y="${y + 4}" class="ax">${fmt(r)}</text>`; });
  return g + '</svg>';
}
const spark = (v, col, w = 220, h = 46) => { const mn = Math.min(...v), mx = Math.max(...v), r = (mx - mn) || 1;
  const pts = v.map((x, i) => `${4 + i * (w - 8) / (v.length - 1)},${h - 6 - (x - mn) / r * (h - 14)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>${v.map((x, i) => `<circle cx="${4 + i * (w - 8) / (v.length - 1)}" cy="${h - 6 - (x - mn) / r * (h - 14)}" r="2.6" fill="${col}"/>`).join('')}</svg>`; };

// ======================================================================= RESUMEN
function renderR() {
  colores();
  const tot = RED.reduce((s, r) => s + r.n, 0), ninst = new Set(INST.map(r => r.letra)).size;
  $('#rStats').innerHTML = [[f0(tot), 'primeros aislamientos (orina, sangre y respiratorias)'], [ninst, 'instituciones que reportaron'], ['10', 'subregiones · 15 municipios sede'], ['8', 'fenotipos trazadores modelados']]
    .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('#rTraz').innerHTML = ORDF.map(k => { const m = M[k], [pp, lo, hi] = m.pp, col = colTend(lo, hi), cl = lo > 0 ? 'up' : hi < 0 ? 'dn' : 'nz';
    return `<div class="tz" data-k="${k}"><h3>${FEN[k].replace(/^([A-Z]\. \w+)/, '<i>$1</i>')}</h3><div class="pv"><b>${f1(m.p25)} %</b><span>en 2025 · ${f1(m.p20)} % en 2020</span></div>
      <div class="pp ${cl}">${sg(pp)} pp/año <span class="mu">(${f1(lo, 2)} a ${f1(hi, 2)})</span></div>${spark(m.gc, col)}</div>`; }).join('');
  $('#rTraz').querySelectorAll('.tz').forEach(d => d.onclick = () => { $('#tFen').value = d.dataset.k; document.querySelector('.tab[data-p="t"]').click(); });
  const subs = [...new Set(RED.map(r => r.s))].sort((a, b) => RED.filter(r => r.s === b).reduce((s, r) => s + r.n, 0) - RED.filter(r => r.s === a).reduce((s, r) => s + r.n, 0));
  const pal = ['#026937', '#8fc1eb', '#d69a2d', '#c2462e', '#7a8c8f', '#01451f', '#b98ac9', '#6fbf73', '#e0b86a', '#5f6f9e'];
  $('#rRedSub').textContent = 'Primeros aislamientos por año y subregión (base jerárquica). Medellín concentra cerca de dos tercios; solo cinco subregiones aportan los seis años.';
  chart('rRed', {type: 'bar', data: {labels: YRS, datasets: subs.map((s, i) => ({label: s, data: YRS.map(y => (RED.find(r => r.s === s && r.t === y) || {}).n || 0), backgroundColor: pal[i % pal.length]}))},
    options: {maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {boxWidth: 12}}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f0(c.raw)} aislamientos, ${f0((RED.find(r => r.s === c.dataset.label && r.t === +c.label) || {}).ni)} instituciones`}}},
      scales: {x: {stacked: true}, y: {stacked: true, title: {display: true, text: 'Primeros aislamientos'}}}}});
  const kc = M.kpn_carb, pa = M.pae_carb, sa = M.sau_sarm;
  $('#rClaves').innerHTML = [
    [`${sg(sa.pp[0])} pp/año`, `SARM es el que más sube en carga absoluta (${f1(sa.p20)} → ${f1(sa.p25)} %); ${it('E. coli')} TMP/SMX el que más baja (${sg(M.eco_sxt.pp[0])} pp/año).`],
    [`MOR ${f1(kc.mor, 2)}`, `En ${it('K. pneumoniae')} resistente a carbapenémicos, entre dos instituciones al azar las odds casi se duplican; en ${it('E. coli')} la diferencia es sobre todo de pacientes.`],
    [`OR ${f1(pa.cw[0], 2)}`, `Más carbapenémicos, más resistencia de ${it('P. aeruginosa')} dentro de la misma institución (por 10 DDD/100 días-cama); en ${it('K. pneumoniae')} la señal es entre instituciones (OR ${f1(kc.cb[0], 2)}).`],
    ['σ ≈ 0', 'Con el nivel institución-año, las instituciones no cambian a ritmos distintos; las subregiones y los síndromes tampoco difieren de forma establecida.']]
    .map(([n, t]) => `<div class="clave"><b class="n">${n}</b><p>${t}</p></div>`).join('') + '<p class="nota">Asociaciones, no efectos causales. Detalle en «Análisis multinivel».</p>';
}

// ======================================================================= SUSCEPTIBILIDAD
let sAb = null;
function initS() {
  const yrs = [...YRS].reverse();
  opts($('#sOrg'), ESPS.map(e => [e, e]), 'Escherichia coli'); opts($('#sSub2'), SUBS.map(s => [s, s]), 'Antioquia'); opts($('#sAnio'), yrs.map(y => [y, y]), 2025);
  ['#sOrg', '#sSub2', '#sAnio'].forEach(s => $(s).onchange = () => { if (s === '#sOrg') sAb = null; renderS(); });
  ['#sSin', '#sAmb', '#sVista'].forEach(s => seg(s, renderS));
}
function filasS() { const e = $('#sOrg').value, s = $('#sSub2').value, t = +$('#sAnio').value, y = segV('#sSin'), m = segV('#sAmb');
  return [...ABDE[e]].map(a => { const c = celda(s, y, m, e, a, t); if (!c || c.n < MIN_N) return null; const [li, ls] = wilson(c.S, c.n); return {ab: a, ...c, p: 100 * c.S / c.n, li, ls}; }).filter(Boolean); }
function renderS() {
  const e = $('#sOrg').value, t = $('#sAnio').value, rows = filasS(), nmax = rows.reduce((m, r) => Math.max(m, r.n), 0);
  $('#sTit').innerHTML = esp(e); $('#sSub').textContent = `${$('#sSub2').value} · ${$('#sSin .on').textContent} · ${$('#sAmb .on').textContent} · ${t} · hasta ${f0(nmax)} aislamientos`;
  if (segV('#sVista') === 'rosa') { $('#sViz').innerHTML = rows.length ? rosa(rows, {size: 540, centro: t}) : '<div class="vacio">Sin combinaciones con n ≥ 30 en este estrato.</div>';
    $('#sLeg').innerHTML = leyRosa(); $('#sNota').textContent = 'Cada pétalo es un antibiótico; su largo es el % sensible (0 en el anillo interior, 100 en el exterior). Pase el cursor para ver n e IC.'; }
  else { const fs = rows.map(r => ({lab: r.ab, dist: CIMD[`${e}|${r.ab}|${t}`] || {}, cat: CAT[`${e}|${r.ab}`] || {}})).filter(f => Object.keys(f.dist).length);
    $('#sViz').innerHTML = espectro(fs, {w: 640, rh: Math.min(36, Math.max(24, Math.floor(480 / Math.max(1, fs.length))))});
    $('#sLeg').innerHTML = leyCim(); $('#sNota').textContent = 'Distribución de CIM (µg/mL) del año en Antioquia, todas las muestras y ámbitos (los filtros de subregión, muestra y ámbito no aplican aquí). El color de fondo es la categoría CLSI 2025 más frecuente en cada dilución.'; }
  $('#sTb').innerHTML = [...rows].sort((x, y) => y.p - x.p).map(r => `<tr data-ab="${r.ab}" style="cursor:pointer"${r.ab === sAb ? ' class="sel-row"' : ''}><td>${AB[r.ab] || r.ab}</td><td><span class="chip ${chipCls(r.p)}">${f1(r.p)}</span></td><td class="mu">${f1(r.li)}–${f1(r.ls)}</td>
    <td><div class="barra-s"><span style="width:${r.p}%;background:${sem(r.p)}"></span><em style="left:90%"></em></div></td><td>${f0(r.n)}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin datos suficientes</td></tr>';
  $('#sTb').querySelectorAll('tr[data-ab]').forEach(tr => tr.onclick = () => { sAb = tr.dataset.ab; renderS(); });
  if (!sAb || !rows.some(r => r.ab === sAb)) sAb = (rows.find(r => ['MEM', 'CRO', 'VAN', 'OXA', 'CIP'].includes(r.ab)) || rows[0] || {}).ab;
  if (!sAb) { $('#sDeriva').innerHTML = ''; return; }
  const fs = YRS.map(y => ({lab: String(y), dist: CIMD[`${e}|${sAb}|${y}`] || {}, cat: CAT[`${e}|${sAb}`] || {}})).filter(f => Object.values(f.dist).reduce((s, c) => s + c, 0) >= MIN_N);
  $('#sDeriva').innerHTML = `<div class="kick">Seis años de CIM</div><h2>${esp(e)} · ${AB[sAb] || sAb}: ¿se mueve la distribución o crece la cola?</h2>
    <p class="sub">Una fila por año (Antioquia, todas las muestras). Si la resistencia crece por una población nueva aparece una segunda joroba; si hay deriva, toda la distribución se corre a la derecha.</p>
    <div class="viz" style="margin-top:10px">${espectro(fs, {w: 1180, rh: 34, labW: 70, derW: 100})}</div>${leyCim()}`;
}

// ======================================================================= TENDENCIAS
function initT() {
  opts($('#tFen'), ORDF.map(k => [k, FEN[k]]), 'sau_sarm'); $('#tFen').onchange = renderT;
  opts($('#tOrg'), ESPS.map(e => [e, e]), 'Escherichia coli'); opts($('#tSubr'), SUBS.map(s => [s, s]), 'Antioquia');
  const abs = () => { const a = [...ABDE[$('#tOrg').value]], d = ['CIP', 'SXT', 'CRO', 'MEM', 'OXA', 'VAN', 'AMK'].filter(x => a.includes(x));
    ['#tA1', '#tA2', '#tA3'].forEach((s, i) => opts($(s), [['', '—'], ...a.map(x => [x, AB[x] || x])], d[i] || '')); };
  $('#tOrg').onchange = () => { abs(); renderT(); }; $('#tSubr').onchange = renderT; ['#tA1', '#tA2', '#tA3'].forEach(s => $(s).onchange = renderT); seg('#tSin', renderT); abs();
}
function renderT() {
  colores(); const k = $('#tFen').value, m = M[k], [pp, lo, hi] = m.pp, col = colTend(lo, hi);
  chart('tAj', {type: 'line', data: {labels: YRS, datasets: [
    {label: 'IC superior', data: m.cat.map(c => c[2]), borderWidth: 0, pointRadius: 0, fill: false},
    {label: 'IC 95 % año categórico', data: m.cat.map(c => c[1]), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: col + '26'},
    {label: '% por año (modelo)', data: m.cat.map(c => c[0]), borderWidth: 0, pointRadius: 6, pointBackgroundColor: css('--tx'), showLine: false},
    {label: 'Tendencia (g-computación)', data: m.gc, borderColor: col, borderWidth: 4, pointRadius: 0, tension: .2},
    {label: '% crudo', data: m.crudo, borderColor: css('--tx3'), borderDash: [4, 4], borderWidth: 1.5, pointRadius: 2}]},
    options: {maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {filter: l => !l.text.startsWith('IC sup'), boxWidth: 12}}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} %`}}},
      scales: {y: {title: {display: true, text: '% resistente'}}}}});
  const sub = m.sub.map(r => [r.subregion, r.inst, r.pp_anio, r.lo, r.hi]);
  $('#tAjTx').innerHTML = `<div class="kick">${FEN[k]}</div><h2 style="font-size:26px">${sg(pp)} pp/año</h2><p class="sub">IC 95 % ${f1(lo, 2)} a ${f1(hi, 2)} · odds ${sg(m.odds[0], 1)} % por año (${f1(m.odds[1], 1)} a ${f1(m.odds[2], 1)})</p>
    <p style="margin:10px 0">${f1(m.p20)} % en 2020 → ${f1(m.p25)} % en 2025, a composición constante. ${f0(m.n)} aislamientos, ${m.inst} instituciones, ${m.ia} institución-año.</p>
    <div class="tw"><table><thead><tr><th>Subregión</th><th>Inst.</th><th>pp/año (IC 95 %)</th></tr></thead><tbody>${sub.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td style="color:${colTend(r[3], r[4])}">${sg(r[2])} (${f1(r[3], 2)} a ${f1(r[4], 2)})</td></tr>`).join('')}</tbody></table></div>
    <p class="nota">¿Difiere la tendencia entre subregiones? Bootstrap paramétrico p = ${f1(m.p_pb, 3)}. Con 3–4 instituciones en Bello y Oriente la precisión es baja; un IC estrecho en Medellín es precisión, no diferencia.</p>`;
  const e = $('#tOrg').value, s = $('#tSubr').value, y = segV('#tSin'), abs = ['#tA1', '#tA2', '#tA3'].map(x => $(x).value).filter(Boolean), pal = [css('--s-lo'), css('--germen'), css('--s-md')];
  $('#tSub').innerHTML = `${esp(e)} · ${s} · ${$('#tSin .on').textContent} · % resistente con IC 95 %`;
  const ds = []; abs.forEach((a, i) => { const c = YRS.map(t => celda(s, y, 'Todos', e, a, t)), p = c.map(x => x && x.n >= MIN_N ? 100 * x.R / x.n : null), w = c.map(x => x && x.n >= MIN_N ? wilson(x.R, x.n) : [null, null]);
    ds.push({label: '_s', data: w.map(x => x[1]), borderWidth: 0, pointRadius: 0}, {label: '_i', data: w.map(x => x[0]), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: pal[i] + '22'},
      {label: AB[a] || a, data: p, borderColor: pal[i], backgroundColor: pal[i], borderWidth: 3, pointRadius: 4, spanGaps: true, n: c.map(x => x ? x.n : 0)}); });
  chart('tCh', {type: 'line', data: {labels: YRS, datasets: ds}, options: {maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {filter: l => !l.text.startsWith('_'), boxWidth: 12}},
    tooltip: {filter: c => !c.dataset.label.startsWith('_'), callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} % R (n = ${f0(c.dataset.n[c.dataIndex])})`}}}, scales: {y: {min: 0, title: {display: true, text: '% resistente'}}}}});
}

// ======================================================================= MICROORGANISMOS
function initM() { opts($('#mAnio'), [['*', '2020–2025'], ...[...YRS].reverse().map(y => [y, y])], 2025); $('#mAnio').onchange = renderM; seg('#mSin', renderM); seg('#mAmb', renderM); }
function renderM() {
  colores(); const t = $('#mAnio').value, y = segV('#mSin'), m = segV('#mAmb'), agg = {}, gram = {};
  ESPC.forEach(r => { if ((t !== '*' && r.t !== +t) || (y !== '*' && r.y !== y) || (m !== '*' && r.m !== m)) return; agg[r.e] = (agg[r.e] || 0) + r.n; gram[r.e] = r.g; });
  const tot = Object.values(agg).reduce((s, v) => s + v, 0), top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15);
  $('#mTit').textContent = 'Microorganismos más frecuentes'; $('#mSub').textContent = `${t === '*' ? '2020–2025' : t} · ${$('#mSin .on').textContent} · ${$('#mAmb .on').textContent} · ${f0(tot)} primeros aislamientos`;
  chart('mCh', {type: 'bar', data: {labels: top.map(x => x[0]), datasets: [{data: top.map(x => 100 * x[1] / tot), backgroundColor: top.map(x => gram[x[0]] === 'Negativo' ? '#c2462e' : '#026937')}]},
    options: {indexAxis: 'y', maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${f1(c.raw)} % (${f0(top[c.dataIndex][1])})`}}},
      scales: {x: {title: {display: true, text: '% de los aislamientos'}}, y: {ticks: {font: {style: 'italic'}}}}}});
  $('#mTb').innerHTML = top.map(([e, n]) => `<tr><td>${esp(e)}</td><td>${f0(n)}</td><td>${f1(100 * n / tot)}</td></tr>`).join('');
}

// ======================================================================= INSTITUCIONES
function qnorm(p) { const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924], b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857],
  c = [-.00778489400243029, -.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878], d = [.00778469570904146, .32246712907004, 2.445134137143, 3.75440866190742], q = Math.min(p, 1 - p);
  if (q > .02425) { const r = p - .5, s = r * r; return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1); }
  const r = Math.sqrt(-2 * Math.log(q)), x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); return p < .5 ? x : -x; }
const Z95 = qnorm(.975), Z998 = qnorm(.999);
const senal = (r, p0) => { const z = (r.pct / 100 - p0) / Math.sqrt(p0 * (1 - p0) / r.n); return z > Z998 ? 2 : z > Z95 ? 1 : z < -Z998 ? -2 : z < -Z95 ? -1 : 0; };
const SEN_TXT = {2: 'Por encima (99,8 %)', 1: 'Por encima (95 %)', 0: 'Dentro de lo esperado', '-1': 'Por debajo (95 %)', '-2': 'Por debajo (99,8 %)'};
function initC() { opts($('#cInd'), Object.entries(FEN_INST), 'kpn_carb'); opts($('#cYo'), [['', '— ninguna —'], ...[...new Set(INST.map(r => r.letra))].sort().map(l => [l, 'Institución ' + l])]);
  $('#cInd').onchange = renderC; $('#cYo').onchange = renderC; seg('#cPer', renderC); }
function renderC() {
  colores(); const f = $('#cInd').value, yo = $('#cYo').value, y0 = +segV('#cPer'), agg = {};
  INST.forEach(r => { if (r.f !== f || r.anio < y0 || r.anio > y0 + 2) return; const a = agg[r.letra] = agg[r.letra] || {n: 0, R: 0}; a.n += r.n; a.R += r.R; });
  const pts = Object.entries(agg).filter(([, v]) => v.n >= MIN_N).map(([l, v]) => ({letra: l, n: v.n, pct: 100 * v.R / v.n}));
  const N = pts.reduce((s, r) => s + r.n, 0), p0 = pts.reduce((s, r) => s + r.pct * r.n / 100, 0) / (N || 1);
  $('#cKick').textContent = `${y0}–${y0 + 2}`; $('#cSub').innerHTML = `${FEN_INST[f]} · red ${f1(100 * p0)} % · ${pts.length} instituciones con n ≥ 30`;
  if (!pts.length) { $('#cTb').innerHTML = ''; return; }
  const nmax = Math.max(...pts.map(r => r.n)) * 1.08, lim = z => { const o = []; for (let i = 1; i <= 80; i++) { const n = Math.max(10, nmax * i / 80); o.push({x: n, y: Math.max(0, Math.min(100, 100 * (p0 + z * Math.sqrt(p0 * (1 - p0) / n))))}); } return o; };
  chart('cCh', {type: 'scatter', data: {datasets: [
    {label: 'Instituciones', data: pts.map(r => ({x: r.n, y: r.pct, l: r.letra})), pointRadius: pts.map(r => r.letra === yo ? 11 : 7),
      backgroundColor: pts.map(r => r.letra === yo ? '#c2462e' : senal(r, p0) >= 2 ? '#d69a2d' : css('--tx3')), pointStyle: pts.map(r => r.letra === yo ? 'rectRot' : 'circle')},
    {type: 'line', label: 'Red', data: [{x: 0, y: 100 * p0}, {x: nmax, y: 100 * p0}], borderColor: css('--germen'), borderWidth: 2.5, pointRadius: 0},
    ...[[Z95, [6, 5]], [Z998, []]].flatMap(([z, dash]) => [1, -1].map(s => ({type: 'line', label: '_l', data: lim(s * z), borderColor: css('--borde2'), borderDash: dash, borderWidth: 1.5, pointRadius: 0, tension: .3})))]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {filter: c => c.datasetIndex === 0, callbacks: {label: c => `Institución ${c.raw.l}: ${f1(c.raw.y)} % (n=${f0(c.raw.x)})`}}},
      scales: {x: {title: {display: true, text: `Aislamientos evaluados ${y0}–${y0 + 2}`}, min: 0}, y: {title: {display: true, text: '% resistente'}, min: 0}}}});
  $('#cTb').innerHTML = [...pts].sort((a, b) => b.pct - a.pct).map(r => `<tr${r.letra === yo ? ' class="sel-row" style="font-weight:700"' : ''}><td>Institución ${r.letra}</td><td>${f0(r.n)}</td><td>${f1(r.pct)}</td><td class="mu">${SEN_TXT[senal(r, p0)]}</td></tr>`).join('');
  const k = M[f]; if (!k) { $('#cTray').innerHTML = '<div class="vacio">Trayectorias disponibles para los ocho fenotipos del análisis multinivel.</div>'; $('#cTraySub').textContent = ''; return; }
  const est = [...k.etapas].sort((a, b) => a.b - b.b), pc = v => 100 * (Math.exp(v) - 1);
  const rows = est.map(r => ({l: 'Institución ' + r.l, e: pc(r.b), lo: pc(r.b - 1.96 * r.se), hi: pc(r.b + 1.96 * r.se), c: r.l === yo ? '#c2462e' : css('--germen'), blup: r.blup != null ? pc(r.blup) : null}));
  $('#cTraySub').innerHTML = `${FEN_INST[f]} · ${est.length} instituciones · τ dos etapas ${f1(k.tau2e[0], 3)} (IC ${f1(k.tau2e[1], 3)}–${f1(k.tau2e[2], 3)}) · σ del modelo con institución-año ${f1(k.sigma[0], 3)} (IC ${f1(k.sigma[1], 3)}–${f1(k.sigma[2], 3)})`;
  let svg = forest(rows, {w: 1180, rowh: 22, labW: 170, valW: 150, min: -40, max: 40, log: false, ref: 0, ticks: [-40, -20, 0, 20, 40], fmt: r => `${sg(r.e, 1)} %`, tit: 'Cambio anual de las odds de cada institución (%)'});
  const X0 = 170, X1 = 1180 - 150, sx = v => X0 + (Math.min(Math.max(v, -40), 40) + 40) / 80 * (X1 - X0), [o, ol, oh] = k.odds;
  svg = svg.replace('</svg>', `<rect x="${sx(ol)}" y="20" width="${sx(oh) - sx(ol)}" height="${34 + rows.length * 22 - 20}" fill="${css('--germen')}" opacity=".10"/>` + rows.map((r, i) => r.blup == null ? '' : `<path d="M${sx(r.blup)},${34 + i * 22 - 6} l6,6 l-6,6 l-6,-6z" fill="${css('--s-md')}"/>`).join('') + '</svg>');
  $('#cTray').innerHTML = svg;
}

// ======================================================================= ANÁLISIS MULTINIVEL
function initA() { seg('#aVista', renderA); }
function renderA() {
  const v = segV('#aVista'), box = $('#aBox'), F = ORDF;
  const card = (kick, h, sub, body, nota = '') => `<div class="tarjeta"><div class="kick">${kick}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}<div class="viz" style="margin-top:10px">${body}</div>${nota ? `<p class="nota">${nota}</p>` : ''}</div>`;
  if (v === 'het') {
    const tb = `<div class="tw"><table class="met-tbl"><thead><tr><th>Fenotipo</th><th>VPC latente</th><th>VPC simulación</th><th>MOR</th><th>PCV pacientes</th><th>MOR ajustado</th><th>Estable entre años</th><th>AUC sin → con institución</th></tr></thead><tbody>${F.map(k => { const m = M[k];
      return `<tr><td>${FEN[k]}</td><td>${f1(m.vpc)} %</td><td>${f1(m.vpc_sim)} %</td><td><b>${f1(m.mor, 2)}</b></td><td>${f1(m.pcv, 0)} %</td><td>${f1(m.mor2, 2)}</td><td>${f1(100 * m.estable_m0, 0)} %</td><td>${f1(m.auc[0], 3)} → ${f1(m.auc[1], 3)}</td></tr>`; }).join('')}</tbody></table></div>`;
    const bars = forest(F.map(k => ({l: FEN[k], e: M[k].mor, lo: M[k].mor, hi: M[k].mor2 < M[k].mor ? M[k].mor : M[k].mor, c: M[k].mor > 1.5 ? css('--s-lo') : css('--germen')})), {w: 760, labW: 250, min: 1, max: 2.2, log: false, ref: 1, ticks: [1, 1.2, 1.4, 1.6, 1.8, 2], fmt: r => `MOR ${f1(r.e, 2)}`});
    box.innerHTML = `<div class="g2">${card('Variación entre instituciones', '¿Cuánto pesa la institución?', 'Odds ratio mediana (MOR) del modelo nulo: cambio mediano de las odds al mover el mismo aislamiento entre dos instituciones al azar.', bars,
      'MOR 1 = las instituciones no difieren; MOR 2 = las odds se duplican. Un VPC de 2 % parece pequeño, pero con cientos de aislamientos por institución el efecto de diseño es grande.')}
      ${card('Lectura', 'Composición, contexto y heterogeneidad', '', `<p>En ${it('E. coli')} la composición de pacientes explica del ${f1(M.eco_sxt.pcv, 0)} al ${f1(M.eco_cip.pcv, 0)} % de la varianza entre instituciones: la diferencia es sobre todo de a quién atienden. En ${it('K. pneumoniae')} y ${it('P. aeruginosa')} resistentes a carbapenémicos la institución pesa por sí misma y de forma estable entre años.</p><p style="margin-top:10px">Conocer la institución discrimina poco a los pacientes (la ganancia de AUC es pequeña): sus promedios difieren, pero dentro de cada una domina la variación individual. Implica <b>política universal en ${it('E. coli')}</b> y <b>focalizada por institución en carbapenémicos</b>.</p>`)}</div>
      ${card('Métricas contextuales', 'VPC, MOR, PCV y exactitud discriminatoria', 'M0 nulo y M1 con edad, sexo, servicio, síndrome, tiempo y pandemia; todas las subregiones.', tb, 'VPC latente = τ²/(τ² + π²/3); por simulación: método de Goldstein. PCV de M0 a M1: parte de la varianza entre instituciones que es composición de pacientes (puede ser negativa en un logit). Estable = τ²inst/(τ²inst + τ²inst:año).')}`;
  } else if (v === 'cons') {
    const rows = []; F.forEach(k => { const m = M[k]; rows.push({l: FEN[k], e: m.cw[0], lo: m.cw[1], hi: m.cw[2], c: css('--s-md')}, {l: '', s: 'between', e: m.cb[0], lo: m.cb[1], hi: m.cb[2], c: css('--germen')}); });
    box.innerHTML = `<div class="g37">${card('Consumo de antibióticos (C2)', 'Within y between', 'OR por 10 DDD/100 días-cama ocupados de la familia del trazador. Ocre: within (año frente a la media de la propia institución). Verde: between (instituciones con distinto nivel medio).',
      forest(rows, {w: 820, rowh: 24, labW: 250, min: .4, max: 8, ticks: [.5, 1, 2, 4, 8]}), 'Modelo con institución e institución-año, ajustado por composición, naturaleza, complejidad, ocupación y camas.')}
      ${card('Lectura', 'Más carbapenémicos, más resistencia', '', `<p><b>${it('P. aeruginosa')}:</b> OR within ${f1(M.pae_carb.cw[0], 2)} (${f1(M.pae_carb.cw[1], 2)}–${f1(M.pae_carb.cw[2], 2)}); razón de prevalencias marginal ${f1(M.pae_carb.rp, 2)}. Los años de más consumo son los de más resistencia, comparando la institución consigo misma.</p>
      <p style="margin-top:10px"><b>${it('K. pneumoniae')}:</b> la señal es between (OR ${f1(M.kpn_carb.cb[0], 2)}), sin within: compatible con un fenómeno de red y de clon (carbapenemasas, traslados de pacientes).</p>
      <p style="margin-top:10px" class="nota">No es causal: en el mismo año, más resistencia también produce más tratamiento con carbapenémicos. El within protege de la confusión fija de la institución, no de la causalidad inversa.</p>`)}</div>`;
  } else if (v === 'sub') {
    const rows = []; F.forEach(k => { rows.push({l: FEN[k], b: true}); M[k].sub.forEach(r => rows.push({l: '', s: `${r.subregion} (${r.inst})`, e: r.pp_anio, lo: r.lo, hi: r.hi, c: colTend(r.lo, r.hi)})); });
    box.innerHTML = card('Tendencia por subregión (T3)', '¿La tendencia difiere entre subregiones?', `Cambio anual en puntos porcentuales por subregión (entre paréntesis, instituciones). Prueba global con bootstrap paramétrico: ${F.map(k => `${FEN[k]} p = ${f1(M[k].p_pb, 3)}`).join(' · ')}.`,
      forest(rows, {w: 1180, rowh: 19, labW: 300, valW: 240, min: -4, max: 4, log: false, ref: 0, ticks: [-4, -2, 0, 2, 4], fmt: r => `${sg(r.e)} pp (${f1(r.lo, 2)} a ${f1(r.hi, 2)})`}),
      'Solo E. coli TMP/SMX queda en el límite (p = 0,050) y baja en todas las subregiones. El análisis subregional es descriptivo; una diferencia territorial puede ser composición (derivación, alta complejidad).');
  } else if (v === 'sin') {
    const C = {ITU: '#d69a2d', ITS: '#c2462e', IRB: '#026937'};
    const pan = F.map(k => { const s = O.sin[k] || {}, all = []; ['ITU', 'ITS', 'IRB'].forEach(y => s[y] && all.push(...s[y].serie)); if (!all.length) return '';
      const w = 280, h = 170, mn = Math.min(...all) * .9, mx = Math.max(...all) * 1.08, sx = i => 30 + i * (w - 40) / 5, sy = v => h - 20 - (v - mn) / (mx - mn) * (h - 50);
      let g = `<svg viewBox="0 0 ${w} ${h}" style="width:100%"><text x="0" y="14" style="font:600 13px var(--f-body);fill:var(--tx)">${FEN[k]}</text><text x="0" y="30" class="ax" style="font:11px var(--f-mono);fill:var(--tx3)">Q p ${f1(s.Q[1], 3)} · Holm ${f1(s.Q[2], 2)}</text>`;
      ['ITU', 'ITS', 'IRB'].forEach(y => { if (!s[y]) return; g += `<polyline points="${s[y].serie.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')}" fill="none" stroke="${C[y]}" stroke-width="${s[y].papel === 'principal' ? 3.5 : 2}" ${s[y].papel === 'principal' ? '' : 'stroke-dasharray="5 4"'}><title>${y}: ${sg(s[y].pp[0])} pp/año</title></polyline>`;
        g += `<text x="${w - 4}" y="${sy(s[y].serie[5]) + 4}" text-anchor="end" style="font:600 10px var(--f-mono);fill:${C[y]}">${y} ${sg(s[y].pp[0])}</text>`; });
      return `<div>${g}<text x="30" y="${h - 4}" style="font:10px var(--f-mono);fill:var(--tx3)">2020</text><text x="${w - 30}" y="${h - 4}" style="font:10px var(--f-mono);fill:var(--tx3)">2025</text></svg></div>`; }).join('');
    box.innerHTML = card('Base por síndrome', 'Trayectorias por síndrome: ninguna diferencia sobrevive a Holm', 'Orina (ITU), sangre (ITS) y respiratorias (IRB), cada una con su modelo. Línea gruesa: síndrome principal del fenotipo; discontinua: secundario. Cifra: pp/año.',
      `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px">${pan}</div>`, 'Q de Cochran sobre las tres pendientes y corrección de Holm sobre las 8 pruebas (familia confirmatoria). «No sobrevive» no significa «iguales»: las pendientes por síndrome son vigilancia descriptiva.');
  } else if (v === 'int') {
    const rows = []; F.forEach(k => { const a = O.int.filter(r => r.k === k && r.i === 'IPM x comunitario'); a.forEach(r => rows.push({l: r.m.startsWith('M4s') ? '' : FEN[k], s: r.m.startsWith('M4s') ? 'con pendiente' : '', e: r.or[0], lo: r.or[1], hi: r.or[2], c: r.m.startsWith('M4s') ? css('--germen') : css('--tx3'), hollow: !r.m.startsWith('M4s')})); });
    const rows2 = F.map(k => { const r = O.int.find(x => x.k === k && x.i === 'consumo within x UCI' && x.m.startsWith('C4s')); return r ? {l: FEN[k], e: r.or[0], lo: r.or[1], hi: r.or[2], c: css('--s-md')} : null; }).filter(Boolean);
    box.innerHTML = `<div class="g2">${card('Interacción entre niveles', 'Pobreza municipal × origen comunitario', 'Razón de OR por 10 puntos de IPM (○ solo intercepto, ● con pendiente aleatoria de comunitario).', forest(rows, {w: 700, rowh: 22, labW: 240, min: .6, max: 1.5, ticks: [.7, .85, 1, 1.2, 1.4]}), 'Exploratorio. En E. coli la razón de OR se mantiene entre 1,04 y 1,10 sin Medellín y en baja y mediana complejidad: la derivación no la explica. SARM va en dirección inversa.')}
      ${card('Interacción entre niveles', 'Consumo within × UCI', 'Razón de OR con pendiente aleatoria de UCI.', forest(rows2, {w: 700, rowh: 30, labW: 240, min: .1, max: 12, ticks: [.25, .5, 1, 2, 4, 8]}), 'Con la pendiente aleatoria del término de nivel 1, el error estándar de la interacción deja de subestimarse (Heisig y Schaeffer, 2019).')}</div>`;
  } else {
    const rows = []; F.forEach(k => { const m = M[k]; rows.push({l: FEN[k], s: '', e: m.odds[0], lo: m.odds[1], hi: m.odds[2], c: css('--tx')}); m.sens.forEach(([n, e]) => { if (/spline/.test(n)) return; rows.push({l: '', s: n.split(' ').slice(0, 3).join(' '), e: e[0], lo: e[1], hi: e[2], c: css('--germen'), hollow: true}); });
      if (m.bayes) rows.push({l: '', s: '★ bayesiano', e: m.bayes[0], lo: m.bayes[1], hi: m.bayes[2], c: css('--s-md')}); });
    const dh = forest(F.map(k => ({l: FEN[k], e: M[k].disp[1], lo: Math.min(M[k].disp[0], M[k].disp[1]), hi: Math.max(M[k].disp[0], M[k].disp[1]), c: css('--germen')})), {w: 640, labW: 240, min: .9, max: 1.3, log: false, ref: 1, ticks: [.9, 1, 1.1, 1.2, 1.3], fmt: r => `${f1(r.hi === r.e ? r.lo : r.hi, 2)} → ${f1(r.e, 2)}`});
    box.innerHTML = `<div class="g2">${card('Sensibilidad', 'La tendencia resiste', 'Cambio anual de las odds (%): T1 principal, S1 cohorte cerrada, S2 todas las subregiones, S4 escalón de 2022 y ★ estimación bayesiana (MCMC).', forest(rows, {w: 700, rowh: 18, labW: 300, min: -16, max: 12, log: false, ref: 0, ticks: [-15, -10, -5, 0, 5, 10], fmt: r => `${sg(r.e, 1)} %`}))}
      ${card('Diagnóstico (DHARMa)', 'Residuos agregados por institución-año', 'Estadístico de dispersión sin → con el término institución-año (1 = sin sobredispersión).', dh, 'K. pneumoniae carbapenémicos pasó de 1,22 a 1,06. El término se mantuvo por diseño, no por la prueba.')}</div>`;
  }
}

// ======================================================================= CONSUMO
function renderX() {
  colores(); const L = [...new Set(CONS.map(r => r.letra))].sort(), med = YRS.map(y => { const v = CONS.filter(r => r.anio === y && r.ddd != null).map(r => r.ddd).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; });
  chart('xCh', {type: 'line', data: {labels: YRS, datasets: [...L.map(l => ({label: 'Institución ' + l, data: YRS.map(y => (CONS.find(r => r.letra === l && r.anio === y) || {}).ddd ?? null), borderColor: css('--borde2'), borderWidth: 1.2, pointRadius: 0, spanGaps: true})),
    {label: 'Mediana de la red', data: med, borderColor: css('--germen'), borderWidth: 4, pointRadius: 4}]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)} DDD/100 días-cama`}}}, scales: {y: {type: 'logarithmic', title: {display: true, text: 'DDD/100 días-cama ocupados (escala log)'}}}}});
  $('#xTx').innerHTML = `<p>Cada institución tiene un nivel medio de consumo (<b>between</b>) y años por encima o por debajo de ese nivel (<b>within</b>).</p>
    <p style="margin-top:10px"><b>Within</b> compara a la institución consigo misma: no lo confunden su complejidad, su población ni su cultura de prescripción. <b>Between</b> compara instituciones y sí es vulnerable a esa confusión.</p>
    <p style="margin-top:10px">En el análisis, el within de carbapenémicos se asoció con la resistencia de ${it('P. aeruginosa')} (OR ${f1(M.pae_carb.cw[0], 2)} por 10 DDD/100 días-cama); el between, con la de ${it('K. pneumoniae')} (OR ${f1(M.kpn_carb.cb[0], 2)}).</p>
    <p style="margin-top:10px">Abajo, cada institución puede ver su propio between (su promedio frente al de las demás) y su within (cada año frente a su promedio).</p>
    <p class="nota" style="margin-top:12px">Se excluyeron 9 institución-año con menos de 6 meses reportados o días-cama inverosímiles. Consumo global de amplio espectro; los modelos usan la familia de cada trazador.</p>`;
  renderXYo();
}

function renderXYo() {
  const L = [...new Set(CONS.filter(r => r.ddd != null).map(r => r.letra))].sort(), sel = $('#xYo');
  if (!sel.options.length) { sel.innerHTML = L.map(l => `<option>${l}</option>`).join(''); sel.onchange = renderXYo; }
  const yo = sel.value, v = l => CONS.filter(r => r.letra === l && r.ddd != null), media = l => { const x = v(l); return x.reduce((a, r) => a + r.ddd, 0) / x.length; };
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y), i = (b.length - 1) * p, k = Math.floor(i); return b.length ? b[k] + (b[Math.min(k + 1, b.length - 1)] - b[k]) * (i - k) : null; };
  const anio = y => CONS.filter(r => r.anio === y && r.ddd != null).map(r => r.ddd), mio = YRS.map(y => (v(yo).find(r => r.anio === y) || {}).ddd ?? null);
  chart('xYoCh', {type: 'line', data: {labels: YRS, datasets: [
    {label: 'P25–P75 de la red', data: YRS.map(y => q(anio(y), .75)), borderColor: 'transparent', backgroundColor: css('--germen-cla'), fill: '+1', pointRadius: 0},
    {label: 'P25', data: YRS.map(y => q(anio(y), .25)), borderColor: 'transparent', pointRadius: 0},
    {label: 'Mediana de la red', data: YRS.map(y => q(anio(y), .5)), borderColor: css('--tx3'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0},
    {label: 'Institución ' + yo, data: mio, borderColor: css('--germen'), backgroundColor: css('--germen'), borderWidth: 3.5, pointRadius: 5, spanGaps: true}]},
    options: {maintainAspectRatio: false, plugins: {filler: {drawTime: 'beforeDatasetsDraw'}, legend: {labels: {filter: i => i.text !== 'P25'}}, tooltip: {filter: i => i.dataset.label !== 'P25', callbacks: {label: c => `${c.dataset.label}: ${f1(c.raw)}`}}}, scales: {y: {beginAtZero: true, title: {display: true, text: 'DDD/100 días-cama'}}}}});
  const M_ = L.map(l => ({l, m: media(l)})).sort((a, b) => a.m - b.m), mr = M_.reduce((a, r) => a + r.m, 0) / M_.length, pos = M_.findIndex(r => r.l === yo) + 1, mm = media(yo);
  chart('xBeCh', {type: 'bar', data: {labels: M_.map(r => r.l), datasets: [{data: M_.map(r => r.m), backgroundColor: M_.map(r => r.l === yo ? css('--germen') : css('--borde2'))}]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {title: c => 'Institución ' + c[0].label, label: c => `Promedio: ${f1(c.raw)} DDD/100 días-cama`}}}, scales: {x: {ticks: {autoSkip: false, font: {size: 9}}}, y: {beginAtZero: true, title: {display: true, text: 'Promedio 2020–2025'}}}}});
  const dev = mio.map(x => x == null ? null : x - mm);
  chart('xWiCh', {type: 'bar', data: {labels: YRS, datasets: [{data: dev, backgroundColor: dev.map(x => x > 0 ? css('--er') : css('--ok'))}]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${sg(c.raw, 1)} frente a su promedio`}}}, scales: {y: {title: {display: true, text: 'Desviación within'}}}}});
  const ult = v(yo).sort((a, b) => b.anio - a.anio)[0];
  $('#xStats').innerHTML = [[f1(mm), 'promedio institucional (between)'], [`${pos} de ${M_.length}`, 'posición en la red, de menor a mayor'], [sg(mm - mr, 1), 'diferencia con el promedio de la red'], [ult ? `${f1(ult.ddd)} (${ult.anio})` : '—', 'último año reportado']].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('#xYoNota').textContent = `Promedio de la red (promedio de los promedios institucionales): ${f1(mr)} DDD/100 días-cama. Between = promedio de la institución menos el de la red; within = consumo del año menos el promedio de la institución; son las dos variables del modelo de presión antibiótica. La red es heterogénea en complejidad: una posición alta no indica por sí sola uso inadecuado.`;
}

// ======================================================================= METODOLOGÍA Y CALIDAD
function renderQ() {
  const pasos = [[675427, 'Registros WHONET 2020–2025'], [662998, 'Sin duplicados ni dobles cargas'], [642303, 'Bacterias'], [637979, 'Sin tamización ni ambiente'], [636899, 'Con identificador de paciente'], [410946, 'Orina, sangre y respiratorias'], [324928, 'Base jerárquica (paciente, especie, año)']];
  $('#qFlujo').innerHTML = `<div class="kick">Flujo de selección</div><h2>De 675.427 registros a la base analítica</h2>${pasos.map(([n, t]) => `<div class="paso"><div class="v">${f0(n)}</div><div><div class="b" style="width:${Math.max(12, 100 * n / 675427)}%"></div><div class="mu" style="font-size:13px">${t}</div></div></div>`).join('')}
    <p class="nota">Primero se filtra y después se deduplica, para que una muestra excluida nunca desplace a una válida. Base por síndrome (paciente, especie, año y síndrome): 338.649 aislamientos, usada para el antibiograma acumulado de esta página y los análisis por síndrome.</p>`;
  $('#qDef').innerHTML = `<div class="kick">Definiciones</div><h2>Cómo se lee cada número</h2><dl class="def">
    <dt>Primer aislamiento</dt><dd>Uno por paciente, especie y año (y tipo de muestra en el antibiograma), CLSI M39. El paciente se sigue con un seudónimo HMAC-SHA-256.</dd>
    <dt>Interpretación</dt><dd>Toda CIM reinterpretada con CLSI 2025 en los seis años; intermedio y SDD cuentan como no sensibles.</dd>
    <dt>Ámbito</dt><dd>Comunitario = ambulatorio y urgencias; hospitalización; UCI. Es una aproximación: WHONET no registra el origen de la infección.</dd>
    <dt>Muestra</dt><dd>ITU, ITS e IRB son estratos por tipo de muestra (orina, sangre, respiratoria baja), no diagnósticos clínicos.</dd>
    <dt>Estandarizado</dt><dd>% predicho por g-computación para la red observada con la mezcla de pacientes de 2020–2025 fija; IC por bootstrap de instituciones.</dd>
    <dt>Instituciones</dt><dd>Cada institución es una letra asignada al azar; la correspondencia la custodia el LDSP.</dd></dl>`;
  $('#qLim').innerHTML = `<div class="kick">Limitaciones</div><h2>Lo que estos datos no pueden decir</h2><dl class="def">
    <dt>Verificación</dt><dd>La resistencia se mide entre quienes se cultivan, no entre quienes se infectan; la propensión a cultivar difiere entre instituciones y años.</dd>
    <dt>Información clínica</dt><dd>Sin comorbilidad, exposición previa ni residencia: las asociaciones no son causales.</dd>
    <dt>Territorio</dt><dd>Los indicadores municipales se asignan por el municipio sede de la institución; con 15 municipios, el bloque territorial es exploratorio.</dd>
    <dt>Red cambiante</dt><dd>De 33 a 61 instituciones: las tendencias se estiman dentro de las instituciones y se verifican en la cohorte cerrada.</dd>
    <dt>Celdas pequeñas</dt><dd>Con n &lt; 30 no se muestra el porcentaje (CLSI M39).</dd></dl>`;
  $('#qCita').innerHTML = `<div class="kick">Créditos</div><h2>Quiénes y cómo citar</h2><p><b>Laboratorio Departamental de Salud Pública</b> — Secretaría Seccional de Salud y Protección Social de Antioquia (custodio de los datos). <b>Universidad de Antioquia</b> — Doctorado en Epidemiología (análisis multinivel: Julián Camilo Galvis Ayala; Astrid Vanessa Cienfuegos Gallet, Escuela de Microbiología). <b>Powered by red GERMEN</b>.</p>
    <p class="nota" style="margin-top:12px">Cita sugerida: Observatorio RAM Antioquia. Laboratorio Departamental de Salud Pública – SSSPSA, Universidad de Antioquia, red GERMEN. Vigilancia por laboratorio WHONET 2020–2025, interpretación CLSI 2025. Datos agregados y anonimizados, actualizados el ${O.generado}.</p>`;
}

// ---- arranque ----------------------------------------------------------------------------
const RENDER = {r: renderR, s: renderS, t: renderT, m: renderM, c: renderC, a: renderA, x: renderX, q: renderQ};
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('act', x === b));
  document.querySelectorAll('.pan').forEach(p => p.classList.toggle('act', p.id === 'pan-' + b.dataset.p));
  RENDER[b.dataset.p](); history.replaceState(null, '', '#' + b.dataset.p); });
$('#btnTema').onclick = () => { const r = document.documentElement, osc = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = osc ? 'light' : 'dark'; try { localStorage.setItem('obs-ram-tema', r.dataset.theme); } catch (e) {} RENDER[document.querySelector('.tab.act').dataset.p](); };
try { const t = localStorage.getItem('obs-ram-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
$('#heroK').innerHTML = [[f0(RED.reduce((s, r) => s + r.n, 0)), 'primeros aislamientos'], ['10', 'subregiones'], ['2020–2025', 'CLSI 2025']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
$('#pie').innerHTML = `Observatorio RAM Antioquia · Laboratorio Departamental de Salud Pública – SSSPSA · Universidad de Antioquia · powered by red GERMEN. Datos agregados y anonimizados de WHONET 2020–2025, actualizados el ${O.generado}. Primer aislamiento por paciente, especie y año (CLSI M39), sin tamización; CIM de sistemas automatizados reinterpretadas con CLSI 2025.`;
initS(); initT(); initM(); initC(); initA(); renderR();
// enlaces directos: #t, #c, #a/cons (vista del análisis), #s/cim (espectro de CIM)
const [h0, h1] = location.hash.slice(1).split('/'), b0 = document.querySelector(`.tab[data-p="${h0}"]`);
if (h0 === 'a' && h1) { const sb = document.querySelector(`#aVista button[data-v="${h1}"]`); if (sb) sb.click(); }
if (h0 === 's' && h1 === 'cim') document.querySelector('#sVista button[data-v="cim"]').click();
if (b0) b0.click();
