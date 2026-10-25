/* tablero.js — GERMEN · Tablero de vigilancia. Lee window.GERMEN (datos_germen.js,
   agregados y anonimizados). Todo se calcula en el navegador; no hay servidor. */
'use strict';
const G = window.GERMEN;
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
const MIN_N = 30;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const f1 = (x, d = 1) => x == null || isNaN(x) ? '–' : Number(x).toLocaleString('es-CO', {minimumFractionDigits: d, maximumFractionDigits: d});
const f0 = x => x == null ? '–' : Number(x).toLocaleString('es-CO');
const it = s => `<i>${s}</i>`;
function wilson(x, n, z = 1.96) {
  if (!n) return [NaN, NaN]; const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
}
const sem = p => p >= 90 ? css('--s-hi') : p >= 70 ? css('--s-md') : css('--s-lo');
const chipCls = p => p >= 90 ? 'c-hi' : p >= 70 ? 'c-md' : 'c-lo';
const opts = (sel, arr, val) => { sel.innerHTML = arr.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); if (val != null) sel.value = val; };
const charts = {};
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); return charts[id]; }
Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
function colores() { Chart.defaults.color = css('--tx2'); Chart.defaults.borderColor = css('--borde'); }

// ---- utilidades de datos -----------------------------------------------------------
const anios = [...new Set(Object.keys(G.s_red).map(k => k.split('.')[0]))].sort().reverse();
function abList(o) { const s = new Set(); for (const k in G.s_tend) { const p = k.split('.'); if (p[2] === o) s.add(p[3]); } return [...s]; }
function cell(obj, key) { const v = obj[key]; return v ? {S: v[0], I: v[1], R: v[2], n: v[0] + v[1] + v[2]} : null; }
const micMap = Object.fromEntries((G.mic || []).map(r => [r.k, r]));

// ---- placa de agar (SVG) ---------------------------------------------------------
function agar(items, size = 520) {
  const r0 = size / 2 - 10, k = items.length, c = size / 2;
  let sp = r0, pos = [];
  while (sp > 30 && k) {
    const pts = [], filas = Math.ceil(2 * r0 / (sp * .866)) + 2;
    for (let j = -filas; j <= filas; j++) for (let i = -filas; i <= filas; i++) {
      const x = (i + (j % 2 ? .5 : 0)) * sp, y = j * sp * .866;
      if (Math.hypot(x, y) <= r0 - sp / 2 - 4) pts.push([x, y]);
    }
    if (pts.length >= k) { pts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])); pos = pts.slice(0, k); break; }
    sp *= .97;
  }
  const maxh = sp * .96;
  let g = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Placa de agar con el porcentaje de sensibilidad por antibiótico">
  <defs><radialGradient id="ag" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${css('--agar1')}"/><stop offset="1" stop-color="${css('--agar2')}"/></radialGradient>
  <radialGradient id="ha" r="50%"><stop offset="0" stop-color="${css('--halo')}" stop-opacity=".95"/><stop offset=".85" stop-color="${css('--halo')}" stop-opacity=".7"/><stop offset="1" stop-color="${css('--halo')}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="${c}" cy="${c}" r="${r0 + 6}" fill="none" stroke="${css('--germen')}" stroke-width="2.5"/><circle cx="${c}" cy="${c}" r="${r0}" fill="url(#ag)"/>`;
  items.forEach(([lab, p], i) => {
    const [x, y] = pos[i], hr = Math.max(16, maxh / 2 * p / 100), col = sem(p);
    g += `<g transform="translate(${c + x},${c + y})"><title>${AB[lab] || lab}: ${f1(p)} %</title><circle r="${hr}" fill="url(#ha)" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>
      <circle r="14" fill="#fff" stroke="#16292b" stroke-opacity=".25"/><text y="4" text-anchor="middle" class="agar-ab">${lab}</text>
      <text y="-21" text-anchor="middle" class="agar-p" fill="${col}">${p >= 99 && p < 100 ? f1(p) : Math.round(p)}%</text></g>`;
  });
  return g + '</svg>';
}

// ---- SUSCEPTIBILIDAD -------------------------------------------------------------
function initS() {
  opts($('#sAnio'), anios.map(a => [a, a]), anios[0]);
  opts($('#sOrg'), Object.entries(ORG).map(([k, v]) => [k, v]), 'eco');
  ['#sAnio', '#sGrupo', '#sMu', '#sOrg', '#sRef'].forEach(s => $(s).onchange = renderS);
}
function renderS() {
  const a = $('#sAnio').value, g = $('#sGrupo').value, m = $('#sMu').value, o = $('#sOrg').value, ref = +$('#sRef').value;
  const rows = abList(o).map(ab => { const c = cell(G.s_red, [a, g, m, o, ab].join('.')); return c && {ab, ...c, p: 100 * c.S / c.n}; })
    .filter(r => r && r.n >= MIN_N).sort((x, y) => y.p - x.p);
  const nmax = rows.reduce((m, r) => Math.max(m, r.n), 0);
  $('#sTit').innerHTML = it(ORG[o]); $('#sSub').textContent = `${$('#sGrupo').selectedOptions[0].text} · ${$('#sMu').selectedOptions[0].text} · ${a} · hasta ${f0(nmax)} aislamientos`;
  $('#sAgar').innerHTML = rows.length ? agar(rows.map(r => [r.ab, r.p])) : '<div class="vacio">Sin combinaciones con n ≥ 30 en este estrato.</div>';
  $('#sTb').innerHTML = rows.map(r => { const [li, ls] = wilson(r.S, r.n); const mc = micMap[`${o}.${r.ab}`];
    return `<tr><td>${AB[r.ab] || r.ab}</td><td><span class="chip ${chipCls(r.p)}">${f1(r.p)}</span></td><td class="mu">${f1(li)}–${f1(ls)}</td>
    <td><div class="barra-s"><span style="width:${r.p}%;background:${sem(r.p)}"></span><em style="left:${ref}%"></em></div></td><td>${f0(r.n)}</td>
    <td>${mc ? mc.m50 : '–'}</td><td>${mc ? mc.m90 : '–'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="vacio">Sin datos suficientes</td></tr>';
}

// ---- DISTRIBUCION ------------------------------------------------------------------
function initD() { opts($('#dAnio'), anios.map(a => [a, a]), anios[0]); ['#dAnio', '#dGrupo', '#dMu'].forEach(s => $(s).onchange = renderD); }
function renderD() {
  const k = [$('#dAnio').value, $('#dGrupo').value, $('#dMu').value].join('.');
  const r = G.dist.filter(d => d.k === k).sort((a, b) => b.n - a.n); const tot = r.reduce((s, d) => s + d.n, 0);
  $('#dTit').textContent = `Microorganismos — ${$('#dAnio').value}`; $('#dSub').textContent = `${$('#dGrupo').selectedOptions[0].text} · ${$('#dMu').selectedOptions[0].text} · ${f0(tot)} aislamientos (25 más frecuentes)`;
  const top = r.slice(0, 15); colores();
  chart('dCh', {type: 'bar', data: {labels: top.map(d => d.e), datasets: [{data: top.map(d => 100 * d.n / tot),
    backgroundColor: top.map(d => d.g === 'n' ? '#c2462e' : d.g === 'p' ? css('--germen') : '#8fc1eb'), borderRadius: 4}]},
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
  $('#tOrg').onchange = setAbs; ['#tGrupo', '#tA1', '#tA2', '#tA3', '#tCoh'].forEach(s => $(s).onchange = renderT); setAbs();
  $('#tInd').innerHTML = G.indicadores.map(r => `<tr><td>${r.indicador.replace(/^([A-Z]\. [a-z]+|S\. aureus|P\. aeruginosa|A\. baumannii|E\. faecium)/, m => `<i>${m}</i>`)}</td>
    <td>${f1(r.pct_2016_2018)}</td><td>${f1(r.pct_2023_2025)}</td><td>${f1(r.pct_2025)}</td>
    <td>${r.OR_anual ? `${f1(r.OR_anual, 2)} <span class="mu">(${f1(r.OR_li, 2)}–${f1(r.OR_ls, 2)})</span>` : '–'}</td>
    <td>${r.OR_anual_estable ? `${f1(r.OR_anual_estable, 2)} <span class="mu">(${f1(r.ORe_li, 2)}–${f1(r.ORe_ls, 2)})</span>` : '–'}</td><td>${f1(r.MOR_2023_2025, 2)}</td></tr>`).join('');
}
function renderT() {
  const o = $('#tOrg').value, g = $('#tGrupo').value, src = $('#tCoh').value === 'est' ? G.s_tend_est : G.s_tend;
  const yrs = [...new Set(Object.keys(G.s_tend).map(k => k.split('.')[0]))].sort();
  const ds = []; colores();
  ['#tA1', '#tA2', '#tA3'].forEach((s, i) => { const ab = $(s).value; if (!ab) return;
    const pts = yrs.map(y => { const c = cell(src, [y, g, o, ab].join('.')); if (!c || c.n < MIN_N) return null; const [li, ls] = wilson(c.S, c.n); return {y: 100 * c.S / c.n, li, ls, n: c.n}; });
    ds.push({label: AB[ab] || ab, data: pts.map(p => p && p.y), borderColor: PALS[i], backgroundColor: PALS[i], tension: .25, spanGaps: true, pointRadius: 4, _p: pts});
    ds.push({label: '_li', data: pts.map(p => p && p.li), borderWidth: 0, pointRadius: 0, fill: false, spanGaps: true});
    ds.push({label: '_ls', data: pts.map(p => p && p.ls), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: PALS[i] + '22', spanGaps: true}); });
  $('#tSub').innerHTML = `${it(ORG[o])} · ${$('#tGrupo').selectedOptions[0].text} · ${$('#tCoh').selectedOptions[0].text} · % sensible (puntos con n ≥ 30)`;
  chart('tCh', {type: 'line', data: {labels: yrs, datasets: ds}, options: {maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
    plugins: {legend: {labels: {filter: l => !l.text.startsWith('_')}}, tooltip: {filter: c => !c.dataset.label.startsWith('_'),
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
function renderC() {
  const id = $('#cInd').value, yo = $('#cYo').value, pts = G.embudo.filter(r => r.id === id);
  if (!pts.length) return; const p0 = pts[0].red / 100, nmax = Math.max(...pts.map(r => r.n)) * 1.08;
  const lim = z => { const out = []; for (let i = 1; i <= 80; i++) { const n = Math.max(10, nmax * i / 80); out.push({x: n, y: Math.max(0, Math.min(100, 100 * (p0 + z * Math.sqrt(p0 * (1 - p0) / n))))}); } return out; };
  const z95 = qnorm(.975), z998 = qnorm(.999); colores();
  const señal = r => { const se = Math.sqrt(p0 * (1 - p0) / r.n), z = (r.pct / 100 - p0) / se; return z > z998 ? 'Por encima (99,8 %)' : z > z95 ? 'Por encima (95 %)' : z < -z998 ? 'Por debajo (99,8 %)' : z < -z95 ? 'Por debajo (95 %)' : 'Dentro de lo esperado'; };
  $('#cSub').innerHTML = `${$('#cInd').selectedOptions[0].text} · red ${f1(pts[0].red)} %`;
  chart('cCh', {type: 'scatter', data: {datasets: [
    {label: 'Instituciones', data: pts.map(r => ({x: r.n, y: r.pct, l: r.letra})), pointRadius: pts.map(r => r.letra === yo ? 10 : 6),
      backgroundColor: pts.map(r => r.letra === yo ? '#c2462e' : css('--tx3')), pointStyle: pts.map(r => r.letra === yo ? 'rectRot' : 'circle')},
    {type: 'line', label: 'Red', data: [{x: 0, y: 100 * p0}, {x: nmax, y: 100 * p0}], borderColor: css('--germen'), borderWidth: 2, pointRadius: 0},
    ...[[z95, [6, 5]], [z998, []]].flatMap(([z, dash]) => [1, -1].map(s => ({type: 'line', label: '_l', data: lim(s * z), borderColor: css('--borde2'), borderDash: dash, borderWidth: 1.5, pointRadius: 0, tension: .3})))]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}, tooltip: {filter: c => c.datasetIndex === 0, callbacks: {label: c => `Institución ${c.raw.l}: ${f1(c.raw.y)} % (n=${f0(c.raw.x)})`}}},
      scales: {x: {title: {display: true, text: 'Aislamientos evaluados 2023–2025'}, min: 0}, y: {title: {display: true, text: '% resistente'}, min: 0}}}});
  $('#cTb').innerHTML = [...pts].sort((a, b) => b.pct - a.pct).map(r => `<tr${r.letra === yo ? ' style="font-weight:700"' : ''}><td>Institución ${r.letra}</td><td>${f0(r.n)}</td><td>${f1(r.pct)}</td><td class="mu">${señal(r)}</td></tr>`).join('');
}

// ---- MI INSTITUCION ------------------------------------------------------------
function initI() {
  opts($('#iInst'), [['', '— seleccionar —'], ...G.instituciones.map(r => [r.letra, r.codigo])]);
  opts($('#iOrg'), Object.entries(ORG), 'eco'); ['#iInst', '#iOrg', '#iPer'].forEach(s => $(s).onchange = renderI);
}
function renderI() {
  const L = $('#iInst').value, o = $('#iOrg').value, per = $('#iPer').value;
  if (!L) { $('#iBox').innerHTML = '<div class="tarjeta vacio">Seleccione su institución para ver su perfil frente al resto de la red.</div>'; return; }
  const red = {}; for (const k in G.s_inst) { const [l, p, g, oo, ab] = k.split('.'); if (p !== per || g !== 'adulto' || oo !== o) continue; const v = G.s_inst[k];
    red[ab] = red[ab] || {S: 0, n: 0, inst: null}; red[ab].S += v[0]; red[ab].n += v[0] + v[1] + v[2]; if (l === L) red[ab].inst = {S: v[0], n: v[0] + v[1] + v[2]}; }
  const rows = Object.entries(red).filter(([, r]) => r.inst && r.inst.n >= 10).map(([ab, r]) => ({ab, pi: 100 * r.inst.S / r.inst.n, ni: r.inst.n,
    pr: 100 * (r.S - r.inst.S) / Math.max(1, r.n - r.inst.n), ci: wilson(r.inst.S, r.inst.n)})).sort((a, b) => a.pi - b.pi);
  const ind = G.embudo.filter(r => r.letra === L);
  $('#iBox').innerHTML = `<div class="g2"><div class="tarjeta"><h2>${it(ORG[o])} — Institución ${L} frente al resto de la red</h2><p class="sub">Adultos · ${per} · %S (IC 95 %)</p>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>Antibiótico</th><th>Institución</th><th>IC 95 %</th><th>Resto de la red</th><th>Diferencia</th><th>n</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${AB[r.ab] || r.ab}</td><td><span class="chip ${chipCls(r.pi)}">${f1(r.pi)}</span></td><td class="mu">${f1(r.ci[0])}–${f1(r.ci[1])}</td><td>${f1(r.pr)}</td>
      <td style="color:${r.pi - r.pr < -5 ? 'var(--er)' : r.pi - r.pr > 5 ? 'var(--ok)' : 'inherit'}">${r.pi - r.pr > 0 ? '+' : ''}${f1(r.pi - r.pr)}</td><td>${f0(r.ni)}${r.ni < MIN_N ? ' <span class="mu">(n&lt;30)</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin datos</td></tr>'}
    </tbody></table></div><p class="nota">Diferencia en puntos porcentuales frente al conjunto de las demás instituciones. Con n &lt; 30 la estimación es inestable (M39).</p></div>
    <div class="tarjeta"><h2>Señales en los indicadores 2023–2025</h2><div class="tw" style="margin-top:10px"><table><thead><tr><th>Indicador</th><th>n</th><th>Institución</th><th>Red</th></tr></thead><tbody>
    ${ind.map(r => { const g = G.indicadores.find(x => x.id === r.id); return `<tr><td>${g ? g.indicador : r.id}</td><td>${f0(r.n)}</td><td>${f1(r.pct)}</td><td>${f1(r.red)}</td></tr>`; }).join('')}
    </tbody></table></div><p class="nota">El gráfico de embudo de cada indicador está en la pestaña «Comparar» (seleccione su institución en «Resaltar»).</p></div></div>`;
}

// ---- CARBAPENEMASAS ---------------------------------------------------------------
function renderK() {
  colores(); const ca = G.carb_anio; const tipos = Object.keys(ca[0]).filter(k => k !== 'anio');
  const cols = {'Serincarbapenemasa (KPC)': css('--germen'), 'Metalobetalactamasa (MBL)': '#c2462e', 'KPC + MBL': '#d69a2d', 'OXA-48-like': '#6b5ca5', 'No tipificada': '#b9c6c8'};
  const u = ca[ca.length - 1]; const tot = tipos.reduce((s, t) => s + (u[t] || 0), 0);
  const tasa = G.carb_tasa; const t25 = tasa.find(r => r.anio === 2025) || {}, t16 = tasa.find(r => r.anio === 2018) || {};
  $('#kStats').innerHTML = [[f0(tot), `casos en ${u.anio}`], [f0(u['Serincarbapenemasa (KPC)'] || 0), 'KPC (serincarbapenemasa)'],
    [f0((u['Metalobetalactamasa (MBL)'] || 0) + (u['KPC + MBL'] || 0)), 'con MBL (NDM/VIM), sola o con KPC'], [f1(t25.x1000, 1), 'casos clínicos por 1.000 BGN (2025)']]
    .map(([n, l]) => `<div class="stat"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div>`).join('');
  chart('kCh1', {type: 'bar', data: {labels: ca.map(r => r.anio), datasets: tipos.map(t => ({label: t, data: ca.map(r => r[t] || 0), backgroundColor: cols[t] || '#999'}))},
    options: {maintainAspectRatio: false, scales: {x: {stacked: true}, y: {stacked: true}}, plugins: {legend: {position: 'bottom'}}}});
  chart('kCh2', {type: 'line', data: {labels: tasa.map(r => r.anio), datasets: [{label: 'por 1.000 BGN', data: tasa.map(r => r.x1000), borderColor: css('--germen'), backgroundColor: css('--germen'), tension: .25}]},
    options: {maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {y: {min: 0}}}});
  const e = G.carb_especie_2025; const ks = Object.keys(e[0] || {}).filter(k => k !== 'especie_rep');
  $('#kEsp').innerHTML = `<table><thead><tr><th>Especie</th>${ks.map(k => `<th>${k.replace(' (', '<br>(')}</th>`).join('')}</tr></thead><tbody>${e.slice(0, 10).map(r => `<tr><td><i>${r.especie_rep}</i></td>${ks.map(k => `<td>${r[k] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rs = G.carb_rescate; const tt = [...new Set(rs.map(r => r.tipo_carb_simple))]; const abs = [...new Set(rs.map(r => r.ab))];
  $('#kRes').innerHTML = `<table><thead><tr><th>Antibiótico</th>${tt.map(t => `<th>${t.split(' (')[0]}</th>`).join('')}</tr></thead><tbody>${abs.map(a => `<tr><td>${AB[a] || a}</td>${tt.map(t => { const r = rs.find(x => x.ab === a && x.tipo_carb_simple === t); return `<td>${r ? `<span class="chip ${chipCls(r.pct_S)}">${f1(r.pct_S)}</span> <span class="mu">${r.n}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}

// ---- WISCA -------------------------------------------------------------------------
function initW() { const s = [...new Set(G.wisca.map(r => r.sindrome))]; opts($('#wSin'), s.map(x => [x, x]), s[0]); $('#wSin').onchange = renderW; }
const ES = t => t.replace('Cefepime', 'Cefepima').replace('Trimetoprima/sulfamethoxazole', 'Trimetoprim/sulfametoxazol').replace(/\bVancomycin\b/, 'Vancomicina').replace(/\bAmikacin\b/, 'Amikacina');
function renderW() {
  const s = $('#wSin').value, r = G.wisca.filter(x => x.sindrome === s).map(x => ({...x, esquema: ES(x.esquema)})).sort((a, b) => b.cobertura - a.cobertura); colores();
  $('#wSub').textContent = `${s} · ${f0(r[0] && r[0].n_aislamientos)} aislamientos 2023–2025`;
  chart('wCh', {type: 'bar', data: {labels: r.map(x => x.esquema), datasets: [{data: r.map(x => x.cobertura), backgroundColor: r.map(x => sem(x.cobertura)), borderRadius: 4}]},
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
  $('#qTb').innerHTML = q.map(r => `<tr><td>${r.letra}</td><td>${f0(r.registros)}</td>${['pct_con_antibiograma', 'pct_resultados_interpretables', 'pct_sin_servicio', 'pct_sin_edad', 'pct_muestra_otras', 'pct_cons_sangre', 'carb_prueba_en_CRE'].map(k => celda(r, k)).join('')}</tr>`).join('');
}

// ---- arranque ------------------------------------------------------------------
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('act', x === b));
  document.querySelectorAll('.pan').forEach(p => p.classList.toggle('act', p.id === 'pan-' + b.dataset.p));
  ({s: renderS, d: renderD, t: renderT, c: renderC, i: renderI, k: renderK, w: renderW, q: renderQ})[b.dataset.p]();
});
$('#btnTema').onclick = () => { const r = document.documentElement; const osc = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = osc ? 'light' : 'dark'; try { localStorage.setItem('germen-tema', r.dataset.theme); } catch (e) {}
  const act = document.querySelector('.tab.act').dataset.p; ({s: renderS, d: renderD, t: renderT, c: renderC, i: renderI, k: renderK, w: renderW, q: renderQ})[act](); };
try { const t = localStorage.getItem('germen-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
$('#hdrSub').textContent = `Red GERMEN · ${G.instituciones.length} instituciones activas · 2016–2025 · ${G.guia}`;
$('#pie').innerHTML = `Datos agregados y anonimizados de la red GERMEN (WHONET), actualizados ${G.generado}. Primer aislamiento por paciente, especie y año (CLSI M39), sin cultivos de tamizaje. Cada institución recibe su letra de forma privada.`;
initS(); initD(); initT(); initC(); initI(); initW(); renderS();
// enlace directo a una pestana: index.html#k (carbapenemasas), #w (tratamiento empirico)...
const h0 = location.hash.slice(1); const b0 = document.querySelector(`.tab[data-p="${h0}"]`); if (b0) b0.click();
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => history.replaceState(null, '', '#' + b.dataset.p)));
