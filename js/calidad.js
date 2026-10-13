/* calidad.js — Criterios de calidad de un archivo WHONET antes del envío al ente territorial.
   Criterio 0 (integridad del archivo) se agregó a partir del levantamiento de las bases LDSP 2020–2025:
   truncamiento en el límite de filas de Excel, columnas con datos sin nombre, cabecera en una sola
   celda y filas duplicadas. Criterios 1–12: herramienta original de diagnóstico WHONET.
   Criterio 11 (envíos al LDSP/INS) actualizado en la v1.1.0 a los criterios del INS de noviembre de 2024
   y a los códigos oficiales de organismos de WHONET (js/organismos.js). */
'use strict';

const Calidad = (() => {
  const STERILE = new Set(['sa','ce','li','lp','la','lpe','lb','lsy','lcs','lba','pun','bo','lca','lpi','lsi']);
  // Muestras que el INS recibe en la vigilancia de rutina: sitio estéril, orina por sonda o punción,
  // respiratoria baja (traqueal solo con circuito cerrado) y tejidos o heridas de ISO.
  const INVASORA = new Set([...STERILE, 'oc', 'tq', 'bq', 'rp', 'bi', 'bx', 'te', 'hu', 'ab', 'dr', 'he']);
  // Códigos que la versión anterior usaba con otro significado del que tienen en WHONET
  // (cau = Clostridium absonum, cga = Cryptococcus gastricus, acb = Actinobacillus). Se siguen
  // captando para no perder aislamientos cargados con ellos, y el criterio 9 avisa.
  const ALIAS = { CAURIS: ['cau'], LEV: ['cau'], CRY: ['cga'], ACI: ['acb'] };
  const CODIGO_AJENO = { cau: ['Clostridium absonum', 'crs (Candida auris)'], cga: ['Cryptococcus gastricus', 'cgt (Cryptococcus gattii)'], acb: ['Actinobacillus sp.', 'ac- (Acinetobacter sp.) o abx'] };
  const VALID_SPEC = new Set(['sa','ce','or','oc','se','lp','li','la','tq','he','pu','es','ga','lcs','lba','lb','bo','lpe','pun','as','lsi','lca','lpi','mc','mv','ur','bi','na','ot','sd','cu','ep','co','bq','ly','sk','ts','ub','uc','ud','bp','ft','rp','mf','te','hu','ab','ao','dr','re','ca','cc','cf','rt','tr','di','bx','ie','pe']);
  const WRONG_ORGS = { 'ac-': { c: 'aba', n: 'Acinetobacter baumannii' }, 'rao': { c: 'kor', n: 'Raoultella ornithinolytica' }, 'entcpx': { c: 'en-', n: 'Enterobacter cloacae complex' } };
  const INVALID_WARDS = new Set(['hcup', 'ped_1/2adu', 'ped1/2adu']);
  const LIMITES_FILAS = new Set([65535, 65536, 1048575, 1048576]);

  /* ---- utilidades ---- */
  const g = (r, ...ks) => { for (const k of ks) { const v = r[k]; if (v !== undefined && v !== '') return v; } return ''; };

  /* Resultados de sensibilidad. WHONET guarda la CIM en _NM/_NE/_MI/_ET (µg/mL) y el halo en _ND##/_KB (mm):
     se leen por separado para no comparar nunca un halo con un punto de corte de CIM. */
  const numero = v => {
    const m = String(v).trim().replace(',', '.').replace('≤', '<=').replace('≥', '>=').match(/^(<=|>=|<|>|=)?\s*(\d+(?:\.\d+)?)/);
    return m ? { op: m[1] || '', n: parseFloat(m[2]) } : null;
  };
  const letra = v => { const u = String(v).trim().toUpperCase(); return ['S', 'I', 'R', 'SDD', 'NS'].includes(u) ? u : ''; };
  function resultado(r, ab) {
    const x = { cim: null, halo: null, interp: '' };
    const leer = (v, campo) => { if (v === undefined || v === '') return; const l = letra(v); if (l) { x.interp = x.interp || l; return; } if (x[campo] === null) x[campo] = numero(v); };
    for (const suf of ['_NM', '_NE', '_MI', '_ET', '']) leer(r[ab + suf], 'cim');
    for (const k in r) if (k.startsWith(ab + '_ND') || k === ab + '_KB') leer(r[k], 'halo');
    return x;
  }
  // Cualquier valor cuenta como resultado (incluidos tamizajes como «NEG» o «POS»).
  const tiene = (r, ab) => ['_NM', '_NE', '_MI', '_ET', ''].some(s => String(r[ab + s] ?? '').trim()) || Object.keys(r).some(k => (k.startsWith(ab + '_ND') || k === ab + '_KB') && String(r[k] ?? '').trim());
  const cimIgual = (r, ab, v) => { const c = resultado(r, ab).cim; return !!c && (c.op === '' || c.op === '=') && c.n === v; };
  /* Devuelve el resultado como texto si alcanza el punto de corte (CIM ≥ cimMin, halo ≤ haloMax o
     interpretación incluida en `letras`); si no, ''. Una CIM «≤x» o «<x» nunca cuenta como resistente,
     y «>x» equivale a la dilución siguiente (2x). */
  function alcanza(r, ab, cimMin, haloMax, letras = 'RI') {
    const x = resultado(r, ab);
    if (x.cim && x.cim.op[0] !== '<' && (x.cim.op === '>' ? 2 * x.cim.n : x.cim.n) >= cimMin) return `${ab} ${x.cim.op}${x.cim.n}`;
    if (x.halo && haloMax != null && x.halo.op[0] !== '>' && x.halo.n <= haloMax) return `${ab} ${x.halo.n} mm`;
    if (x.interp.length === 1 && letras.includes(x.interp)) return `${ab} ${x.interp}`;
    return '';
  }
  const positivo = v => /^(\+|pos|positivo|positive)$/i.test(String(v).trim());
  const ID_CAMPOS = ['PATIENT_ID', 'PAT_ID', 'CODIGO IDENTIFICACION', 'CODIGO_IDENTIFICACION', 'DOCUMENTO', 'IDENTIFICACION'];
  const pid = r => g(r, ...ID_CAMPOS) || '?';
  const specOf = r => (g(r, 'SPEC_TYPE', 'SPEC_CODE') || '').toLowerCase().trim();
  const orgFull = r => (g(r, 'ORGANISM') || '').toLowerCase().trim();
  const orgOf = r => orgFull(r).slice(0, 3);
  const en = (grupo, r) => Organismos.en(grupo, orgOf(r)) || (ALIAS[grupo] || []).includes(orgOf(r));
  const orgNombre = r => Organismos.nombre(orgOf(r)) || orgOf(r).toUpperCase();
  const wardOf = r => (g(r, 'WARD') || '').toLowerCase().trim();
  const wtOf = r => (g(r, 'WARD_TYPE') || '').toLowerCase().trim();
  const esUrgencias = r => /^urg/.test(wardOf(r)) || ['emr', 'eme', 'urg'].includes(wtOf(r));
  const esAmbulatorio = r => /^(amb|cext|c\.? ?ext|consulta|out|opd)/.test(wardOf(r)) || ['out', 'amb', 'opd'].includes(wtOf(r));
  const nameOf = r => [g(r, 'LAST_NAME'), g(r, 'FIRST_NAME')].filter(Boolean).join(', ');
  const isICU = w => w.startsWith('uci') || w === 'icu';
  const isPedW = w => (w.includes('ped') && !w.includes('adulto')) || w.includes('neon') || ['ucipe', 'ucipn', 'ucine', 'urg pe'].includes(w);
  const isAduW = w => ['uci ad', 'uciad', 'hosp', 'adu', 'urgmix', 'urg ad'].includes(w) || w.includes('adulto');

  /* Fecha a AAAAMMDD desde: AAAAMMDD, dd/mm/aaaa, aaaa-mm-dd, serial de Excel. */
  function fecha8(v) {
    if (!v) return '';
    const s = String(v).trim();
    let m;
    if (/^\d{8}$/.test(s)) return s;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + m[2] + m[3];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0');
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const n = Math.floor(parseFloat(s));
      if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5); return d.toISOString().slice(0, 10).replace(/-/g, ''); }
    }
    return 'X';
  }
  const fmtF = f => f && f.length === 8 ? f.slice(6, 8) + '/' + f.slice(4, 6) + '/' + f.slice(0, 4) : '';
  const hoy8 = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

  function analizar(datos) {
    const campos = datos.campos;
    // registros con claves en mayúscula (los nombres de campo WHONET no distinguen mayúsculas)
    const records = datos.registros.map(r => { const o = {}; for (const k in r) o[k.toUpperCase()] = r[k]; return o; });
    const fset = new Set(campos.map(f => f.toUpperCase()));
    const abFields = [...fset].filter(f => /_(NM|MI|KB|ET|ND\d*|NE)$/.test(f));
    const H = [], E = [], REV = [];
    const ids = arr => [...new Set(arr)].filter(x => x && x !== '?').slice(0, 6);
    const add = (nivel, grupo, criterio, detalle, pac = []) => H.push({ nivel, grupo, criterio, detalle, ids: ids(pac) });
    const ok = (gr, c, d) => add('ok', gr, c, d);
    const wn = (gr, c, d, p) => add('warn', gr, c, d, p || []);
    const er = (gr, c, d, p) => add('error', gr, c, d, p || []);
    const rev = (c, d, p) => REV.push({ criterio: c, detalle: d, ids: ids(p || []).slice(0, 8) });
    /* Aislamiento con criterio de envío. `restringe` = 'bac' o 'lev' cuando el INS solo lo recibe de muestra
       invasora y fuera de consulta externa/ambulatorio (y de urgencias, en bacterias). Lo que no cumple
       se lista igual, con el motivo en `avisos`, para que el microbiólogo decida. */
    const lim = new Date(); lim.setMonth(lim.getMonth() - 2);
    const lim8 = lim.toISOString().slice(0, 10).replace(/-/g, '');
    const addE = (r, crit, prueba, dest, restringe) => {
      const avisos = [], f = fecha8(g(r, 'SPEC_DATE'));
      if (restringe && !INVASORA.has(specOf(r))) avisos.push('Muestra no invasora: el INS solo la recibe de sitio estéril, orina por sonda o punción, o secreción traqueal con circuito cerrado.');
      if (restringe && (esAmbulatorio(r) || (restringe === 'bac' && esUrgencias(r)))) avisos.push('Servicio ambulatorio, consulta externa' + (restringe === 'bac' ? ' o urgencias' : '') + ': fuera de los criterios del INS.');
      if (f && f !== 'X' && f < lim8) avisos.push('Muestra tomada hace más de 2 meses: el INS no la recibe.');
      E.push({ id: pid(r), nombre: nameOf(r), orgC: orgOf(r), orgN: orgNombre(r), muestra: specOf(r), servicio: wardOf(r), fecha: fmtF(f), criterio: crit, prueba, destino: dest, avisos });
    };
    const n = records.length;
    const upgd = [...new Set(records.map(r => g(r, 'LABORATORY', 'INST_ID', 'INSTITUT')).filter(Boolean))].join(', ') || '(no detectado)';
    const f8 = records.map(r => fecha8(g(r, 'SPEC_DATE')));
    const validas = f8.filter(f => f && f !== 'X').sort();
    const periodo = validas.length ? fmtF(validas[0]) + ' – ' + fmtF(validas[validas.length - 1]) : '';

    /* 0. Integridad del archivo */
    const G0 = '0. Integridad del archivo';
    const hojas = datos.filasHoja || [n];
    const enLimite = hojas.filter(h => LIMITES_FILAS.has(h) || LIMITES_FILAS.has(h - 1));
    if (enLimite.length || LIMITES_FILAS.has(n)) er(G0, 'Posible truncamiento por límite de filas de Excel', `El archivo tiene exactamente ${enLimite[0] || n} filas, el máximo que admite ${(enLimite[0] || n) > 70000 ? 'una hoja .xlsx' : 'el formato .xls'}. Las filas sobrantes se pierden al guardar: vuelva a exportar desde WHONET como texto delimitado o .xlsx, o divida el período.`);
    else ok(G0, 'Sin truncamiento', `${n.toLocaleString('es-CO')} registros; ninguna hoja alcanza el límite de filas de Excel.`);
    if (/\.xls$/i.test(datos.nombre)) wn(G0, 'Formato .xls (Excel 97-2003)', 'El formato .xls admite como máximo 65.536 filas. Para envíos mensuales grandes use texto delimitado, .xlsx o el archivo nativo de WHONET.');
    const sinNombre = datos.columnasSinNombre || [];
    if (sinNombre.length) er(G0, 'Columnas con datos sin nombre', `${sinNombre.length} columna(s) tienen resultados pero no tienen nombre en la cabecera (${sinNombre.slice(0, 6).join('; ')}${sinNombre.length > 6 ? '…' : ''}). Sin el nombre no se sabe a qué antibiótico corresponden.`);
    else ok(G0, 'Cabecera completa', 'Todas las columnas con datos tienen nombre.');
    if (datos.meta && datos.meta.cabeceraEnA1) wn(G0, 'Cabecera en una sola celda', 'Los nombres de las variables están en la celda A1 separados por "|": el archivo se generó pegando texto en Excel. Se leyó correctamente, pero conviene exportar directamente desde WHONET.');
    const vistos = new Map(); let dupExact = 0; const dupIds = [];
    datos.registros.forEach(r => { const k = JSON.stringify(r); if (vistos.has(k)) { dupExact++; dupIds.push(pid(records[vistos.get(k)])); } else vistos.set(k, vistos.size); });
    if (dupExact) er(G0, 'Filas duplicadas exactas', `${dupExact} fila(s) idénticas a otra (${(100 * dupExact / n).toFixed(1)} %). Suele indicar que un período se cargó dos veces.`, dupIds);
    else ok(G0, 'Sin filas duplicadas', 'No hay filas idénticas.');

    /* 1. Estructura */
    ok('1. Estructura', 'Archivo leído', `${datos.formato}: ${n.toLocaleString('es-CO')} registros, ${campos.length} columnas${periodo ? ', periodo ' + periodo : ''}.`);

    /* 2. Fecha de muestra */
    const noDate = records.filter((r, i) => !f8[i]);
    if (noDate.length) er('2. Fecha de muestra', 'SPEC_DATE vacío', `${noDate.length} registro(s) sin fecha de muestra.`, noDate.map(pid));
    else ok('2. Fecha de muestra', 'SPEC_DATE completo', 'Todos los registros tienen fecha de muestra.');
    const badFmt = records.filter((r, i) => f8[i] === 'X');
    if (badFmt.length) wn('2. Fecha de muestra', 'Formato de fecha no reconocido', `${badFmt.length} registro(s) con fecha en formato no reconocido.`, badFmt.map(pid));
    const hoy = hoy8();
    const fut = records.filter((r, i) => f8[i] && f8[i] !== 'X' && f8[i] > hoy);
    if (fut.length) er('2. Fecha de muestra', 'Fecha de muestra futura', `${fut.length} registro(s) con fecha de muestra posterior a hoy.`, fut.map(pid));

    /* 3. Variables */
    const flagCols = campos.filter(f => ['SEROTIPO', 'SEROTIPE', 'DIAGNOSTI', 'X_INF', 'CLASIF'].some(k => f.toUpperCase().includes(k)));
    if (flagCols.length) wn('3. Variables', 'Columnas no estandarizadas', 'Columnas fuera del estándar nacional: ' + flagCols.join(', ') + '.');
    else ok('3. Variables', 'Columnas WHONET estándar', 'Solo columnas estandarizadas por el INS.');

    /* 4. Sigla UPGD */
    const noLab = records.filter(r => !g(r, 'LABORATORY', 'INST_ID', 'LAB_ID', 'INSTITUT'));
    if (noLab.length) er('4. Sigla UPGD', 'LABORATORY vacío', `${noLab.length} registro(s) sin código de UPGD.`, noLab.map(pid));
    else ok('4. Sigla UPGD', 'Código UPGD', 'UPGD presente: ' + upgd + '.');

    /* 5. Campos demográficos */
    let c5 = true;
    [['FIRST_NAME', 'Nombre'], ['LAST_NAME', 'Apellido'], ['PATIENT_ID', 'ID paciente'], ['SEX', 'Sexo'], ['AGE', 'Edad'], ['WARD', 'Servicio'], ['DATE_BIRTH', 'Fecha de nacimiento']].forEach(([k, l]) => {
      if (!fset.has(k)) { wn('5. Campos completos', l + ' ausente', `La columna ${k} no existe en el archivo.`); c5 = false; return; }
      const m = records.filter(r => !g(r, k)); if (m.length) { wn('5. Campos completos', l + ' vacío', `${m.length} registro(s) sin ${l.toLowerCase()}.`, m.map(pid)); c5 = false; }
    });
    if (c5) ok('5. Campos completos', 'Demografía completa', 'Campos demográficos presentes y diligenciados.');

    /* 6. Demografía */
    const edadAnios = r => { const a = String(g(r, 'AGE')).toLowerCase(); const x = parseFloat(a); if (isNaN(x)) return null; return a.endsWith('d') ? x / 365 : a.endsWith('m') ? x / 12 : x; };
    const badAge = records.filter(r => { const a = edadAnios(r); return a !== null && (a < 0 || a > 120); });
    if (badAge.length) wn('6. Demografía', 'Edad incoherente', `${badAge.length} con edad fuera de 0–120 años.`, badAge.map(pid)); else ok('6. Demografía', 'Edades coherentes', 'Edades dentro del rango esperado.');
    if (fset.has('DATE_BIRTH')) {
      const impB = records.filter((r, i) => { const b = fecha8(g(r, 'DATE_BIRTH')); return b && b !== 'X' && f8[i] && f8[i] !== 'X' && b > f8[i]; });
      if (impB.length) er('6. Demografía', 'Nacimiento posterior a la muestra', `${impB.length} con fecha de nacimiento posterior a la fecha de muestra.`, impB.map(pid)); else ok('6. Demografía', 'Fechas de nacimiento', 'Fechas de nacimiento coherentes.');
    }

    /* 7. Localización */
    const noWard = records.filter(r => !wardOf(r)); if (noWard.length) wn('7. Localización', 'WARD vacío', `${noWard.length} sin servicio (WARD).`, noWard.map(pid)); else ok('7. Localización', 'WARD', 'Servicio presente en todos los registros.');
    const invWard = records.filter(r => INVALID_WARDS.has(wardOf(r))); if (invWard.length) er('7. Localización', 'Localización fuera del diccionario', `${invWard.length} con localización no estandarizada (p. ej. HCUP, ped_1/2adu). Corregir en WHONET.`, invWard.map(pid));
    const pedEnAdu = records.filter(r => { const a = edadAnios(r); return (isPedW(wardOf(r)) || isPedW(wtOf(r))) && a !== null && a > 18; }); if (pedEnAdu.length) er('7. Localización', 'Adulto en servicio pediátrico', `${pedEnAdu.length} con edad >18 años en servicio pediátrico.`, pedEnAdu.map(pid));
    const aduEnPed = records.filter(r => { const a = edadAnios(r); return (isAduW(wardOf(r)) || wtOf(r) === 'adu') && a !== null && a <= 14; }); if (aduEnPed.length) er('7. Localización', 'Paciente pediátrico en servicio de adultos', `${aduEnPed.length} con edad ≤14 años en servicio de adultos.`, aduEnPed.map(pid));
    const neoAdu = records.filter(r => { const pt = g(r, 'PAT_TYPE').toLowerCase(); const a = edadAnios(r); return (pt === 'new' || (a !== null && a < 0.1)) && ['uci ad', 'uciad'].includes(wardOf(r)); }); if (neoAdu.length) er('7. Localización', 'Neonato en UCI de adultos', `${neoAdu.length} neonato(s) en UCI de adultos.`, neoAdu.map(pid));

    /* 8. Muestras */
    const noSpec = records.filter(r => !specOf(r)); if (noSpec.length) er('8. Muestras', 'SPEC_TYPE vacío', `${noSpec.length} sin código de muestra.`, noSpec.map(pid)); else ok('8. Muestras', 'SPEC_TYPE', 'Código de muestra presente en todos los registros.');
    const invSpec = records.filter(r => { const s = specOf(r); return s && !VALID_SPEC.has(s); }); if (invSpec.length) wn('8. Muestras', 'Código de muestra fuera del diccionario', `${invSpec.length} con SPEC_TYPE no reconocido. Ej.: ${[...new Set(invSpec.map(specOf))].slice(0, 5).join(', ')}.`, invSpec.map(pid));
    const iad = r => g(r, 'X_IAD', 'X_ISO').toLowerCase();
    const navSe = records.filter(r => iad(r).includes('nav') && specOf(r) === 'se'); if (navSe.length) er('8. Muestras', 'NAV con muestra "se"', `${navSe.length} evento(s) NAV con muestra "se" (secreción). Usar tq, rp o lba.`, navSe.map(pid));
    const istuOr = records.filter(r => isICU(wardOf(r)) && specOf(r) === 'or'); if (istuOr.length) er('8. Muestras', 'ISTU-AC en UCI con "or"', `${istuOr.length} en UCI con orina "or" (micción). ISTU-AC debe usar "oc" (catéter).`, istuOr.map(pid));

    /* 9. Organismos */
    const noOrg = records.filter(r => !orgFull(r)); if (noOrg.length) er('9. Organismos', 'ORGANISM vacío', `${noOrg.length} sin microorganismo.`, noOrg.map(pid)); else ok('9. Organismos', 'ORGANISM', 'Microorganismo presente en todos los registros.');
    const wrongOrg = records.filter(r => WRONG_ORGS[orgFull(r)]); if (wrongOrg.length) er('9. Organismos', 'Siglas incorrectas', `${wrongOrg.length} con sigla incorrecta: ${[...new Set(wrongOrg.map(r => { const w = WRONG_ORGS[orgFull(r)]; return '"' + orgFull(r) + '" → "' + w.c + '" (' + w.n + ')'; }))].join('; ')}.`, wrongOrg.map(pid));
    const eclR = records.filter(r => orgFull(r) === 'ecl'); if (eclR.length) wn('9. Organismos', 'Sigla "ecl": verificar', `${eclR.length} con "ecl". En Colombia se usa "en-" para Enterobacter cloacae complex.`, eclR.map(pid));
    if (fset.has('X_GEN_CARB')) { const pG = records.filter(r => g(r, 'X_GEN_CARB').toLowerCase() === 'p'); if (pG.length) er('9. Organismos', 'X_GEN_CARB = "p"', `${pG.length} con gen de carbapenemasa = "p". Debe indicarse el gen (KPC, NDM, OXA-48, VIM, IMP).`, pG.map(pid)); }
    if (fset.has('LOCAL_ORG')) { const nL = records.filter(r => g(r, 'ORGANISM') && !g(r, 'LOCAL_ORG')); if (nL.length) wn('9. Organismos', 'LOCAL_ORG vacío', `${nL.length} con ORGANISM pero sin LOCAL_ORG.`, nL.map(pid)); }
    Object.entries(CODIGO_AJENO).forEach(([c, [es, usar]]) => { const x = records.filter(r => orgOf(r) === c); if (x.length) wn('9. Organismos', `Código "${c}": verificar`, `${x.length} con "${c}", que en WHONET es ${es}. Si corresponde a otro organismo, use ${usar}. Mientras tanto se evalúa como ese organismo para no perder envíos.`, x.map(pid)); });

    /* 10. Antibióticos */
    if (!abFields.length) wn('10. Antibióticos', 'Sin campos de sensibilidad', 'No se detectaron columnas de resultados (_NM, _ND, _NE). Verifique el formato.');
    else {
      ok('10. Antibióticos', 'Campos de sensibilidad', `${abFields.length} columnas de resultados: ${abFields.slice(0, 6).map(f => f.replace(/_(NM|ND\d*|NE|MI|KB|ET)$/, '')).join(', ')}…`);
      const bB = records.filter(r => { const b = g(r, 'ESBL', 'BLEE').toUpperCase(); return ['+', 'POSITIVO', 'POS'].includes(b) && (en('STA', r) || en('ENT', r) || en('LEV', r) || en('CRY', r)); });
      if (bB.length) er('10. Antibióticos', 'BLEE en organismo que no aplica', `${bB.length} BLEE positivo en Staphylococcus, Enterococcus u hongo.`, bB.map(pid));
      const nAB = records.filter(r => !abFields.some(f => r[f] && r[f].trim() && r[f].trim() !== '-'));
      if (nAB.length) wn('10. Antibióticos', 'Sin antibiograma', `${nAB.length} sin ningún resultado de sensibilidad.`, nAB.map(pid));
    }

    /* 11. Sensibilidad y alertas.
       Criterios de envío del INS: «Criterios para el envío de aislamientos bacterianos y levaduras del género
       Candida spp. recuperados en IAAS» (Grupo de Microbiología, 1 nov 2024), que adopta CLSI M100 ED35 y M27M44S.
       Puntos de corte: CIM en µg/mL y halo en mm (CLSI M100). Todo envío pasa por el LDSP:
       «LDSP» = el LDSP confirma y remite al INS la muestra aleatoria mensual; «LDSP → INS» = el INS confirma todos. */
    const G11 = '11. Sensibilidad';
    const LDSP = 'LDSP', INS = 'LDSP → INS', INMEDIATO = 'LDSP → INS (inmediato)';
    const conTexto = (lista, f) => lista.map(r => [r, f(r)]).filter(x => x[1]);

    const staphR = records.filter(r => en('STA', r));
    if (staphR.length) {
      const noFOX = staphR.filter(r => !tiene(r, 'FOX')); if (noFOX.length) er(G11, 'Staphylococcus sin cefoxitina (FOX)', `${noFOX.length}/${staphR.length} Staphylococcus sin FOX, obligatorio para SARM.`, noFOX.map(pid)); else ok(G11, 'FOX en Staphylococcus', `Los ${staphR.length} Staphylococcus tienen FOX.`);
      const nV = staphR.filter(r => !tiene(r, 'VAN')); if (nV.length) wn(G11, 'Staphylococcus sin vancomicina', `${nV.length} sin VAN.`, nV.map(pid));
      const nL = staphR.filter(r => !tiene(r, 'LNZ')); if (nL.length) wn(G11, 'Staphylococcus sin linezolid', `${nL.length} sin LNZ.`, nL.map(pid));
      // Vancomicina I/R: S. aureus CIM ≥ 4, estafilococos coagulasa negativos CIM ≥ 8 (sin punto de corte por disco). Cualquier muestra y servicio.
      const vIR = conTexto(staphR, r => alcanza(r, 'VAN', en('SAU', r) ? 4 : 8, null));
      if (vIR.length) { er(G11, 'Staphylococcus con vancomicina I/R', `${vIR.length} Staphylococcus con vancomicina intermedia o resistente: enviar al LDSP para remisión al INS (cualquier muestra y servicio).`, vIR.map(x => pid(x[0]))); vIR.forEach(([r, t]) => addE(r, `Vancomicina I/R (${t})`, 'Confirmar CIM de vancomicina por microdilución o gradiente; el INS confirma y detecta el gen', INS)); }
      const lR = conTexto(staphR, r => alcanza(r, 'LNZ', 8, 20, 'R'));
      if (lR.length) { er(G11, 'Staphylococcus con linezolid R', `${lR.length} Staphylococcus resistentes a linezolid: enviar al LDSP para remisión al INS.`, lR.map(x => pid(x[0]))); lR.forEach(([r, t]) => addE(r, `Linezolid R (${t})`, 'Confirmar CIM de linezolid por microdilución; el INS detecta el gen', INS, 'bac')); }
      const l4 = staphR.filter(r => cimIgual(r, 'LNZ', 4)); if (l4.length) rev('Staphylococcus LNZ = 4', `${l4.length} con LNZ = 4 (zona límite). Clasificar por especie.`, l4.map(pid));
      if (!vIR.length && !lR.length) ok(G11, 'Staphylococcus: perfiles críticos', `Sin vancomicina I/R ni linezolid R en ${staphR.length} aislamientos.`);
    }

    const enteroR = records.filter(r => en('ENT', r));
    if (enteroR.length) {
      const nV = enteroR.filter(r => !tiene(r, 'VAN')); if (nV.length) wn(G11, 'Enterococcus sin vancomicina', `${nV.length} sin VAN.`, nV.map(pid));
      const nL = enteroR.filter(r => !tiene(r, 'LNZ')); if (nL.length) wn(G11, 'Enterococcus sin linezolid', `${nL.length} sin LNZ.`, nL.map(pid));
      // Vancomicina R (CIM ≥ 32, halo ≤ 14), sin las especies con resistencia intrínseca (E. gallinarum, E. casseliflavus, E. flavescens).
      const vR = conTexto(enteroR.filter(r => !en('ENT_VAN_INTR', r)), r => alcanza(r, 'VAN', 32, 14, 'R'));
      if (vR.length) {
        er(G11, 'Enterococcus resistente a vancomicina', `${vR.length} con vancomicina R. E. faecium: al INS solo el primer aislamiento de la institución o los de un brote; las demás especies, todas.`, vR.map(x => pid(x[0])));
        vR.forEach(([r, t]) => orgOf(r) === 'efm'
          ? addE(r, `Vancomicina R (${t}). E. faecium: al INS solo si es el primer aislamiento de la institución o parte de un brote`, 'Confirmación en el LDSP; si es primer aislamiento o brote, el INS confirma y detecta vanA/vanB', LDSP, 'bac')
          : addE(r, `Vancomicina R (${t})`, 'Confirmación en el LDSP; el INS confirma y detecta vanA/vanB', INS, 'bac'));
      }
      const vI = enteroR.filter(r => !en('ENT_VAN_INTR', r) && !alcanza(r, 'VAN', 32, 14, 'R') && alcanza(r, 'VAN', 8, 16, 'I')); if (vI.length) rev('Enterococcus con vancomicina intermedia', `${vI.length} con vancomicina 8–16 µg/mL o halo 15–16 mm. Confirmar la CIM: si resulta resistente, cumple criterio de envío.`, vI.map(pid));
      // Linezolid intermedio o resistente: CIM ≥ 4, halo ≤ 22.
      const lIR = conTexto(enteroR, r => alcanza(r, 'LNZ', 4, 22));
      if (lIR.length) { er(G11, 'Enterococcus con linezolid I/R', `${lIR.length} con linezolid intermedio o resistente: enviar al LDSP para remisión al INS.`, lIR.map(x => pid(x[0]))); lIR.forEach(([r, t]) => addE(r, `Linezolid I/R (${t})`, 'Confirmar CIM de linezolid; el INS detecta el gen', INS, 'bac')); }
      const aR = conTexto(enteroR.filter(r => orgOf(r) === 'efa'), r => alcanza(r, 'AMP', 16, 16, 'R'));
      if (aR.length) { er(G11, 'E. faecalis resistente a ampicilina', `${aR.length} con ampicilina R: enviar al LDSP para remisión al INS.`, aR.map(x => pid(x[0]))); aR.forEach(([r, t]) => addE(r, `Ampicilina R (${t})`, 'Confirmar especie y CIM de ampicilina', INS, 'bac')); }
      if (!vR.length && !lIR.length && !aR.length) ok(G11, 'Enterococcus: perfiles críticos', 'Sin vancomicina R, linezolid I/R ni E. faecalis resistente a ampicilina.');
    }

    // Gramnegativos de la vigilancia del INS: Enterobacterales, Acinetobacter spp. y Pseudomonas spp.
    const gnR = records.filter(r => en('EBC', r) || en('ACI', r) || en('PSE', r));
    if (gnR.length) {
      const carbaRI = r => {
        if (en('EBC', r)) {
          // Proteus, Providencia y Morganella: imipenem I/R no basta, se exige ertapenem y/o meropenem I/R.
          const base = [alcanza(r, 'MEM', 2, 22), alcanza(r, 'ETP', 1, 21)].concat(en('PROTEEAE', r) ? [] : [alcanza(r, 'IPM', 2, 22), alcanza(r, 'DOR', 2, 22)]).filter(Boolean);
          return (base.length && en('PROTEEAE', r) ? base.concat([alcanza(r, 'IPM', 2, 22)].filter(Boolean)) : base).join(', ');
        }
        const aci = en('ACI', r);
        return [alcanza(r, 'MEM', 4, aci ? 17 : 18), alcanza(r, 'IPM', 4, aci ? 21 : 18), alcanza(r, 'DOR', 4, aci ? null : 18)].filter(Boolean).join(', ');
      };
      const czaR = r => (en('EBC', r) || en('PSE', r)) ? alcanza(r, 'CZA', 16, 20, 'R') : '';
      const genes = r => g(r, 'X_GEN_CARB').toUpperCase();
      const soloMBL = r => { const gn = genes(r); return (/NDM|VIM|IMP/.test(gn) && !/KPC|OXA/.test(gn)) || (positivo(g(r, 'X_EDTA')) && !positivo(g(r, 'X_APB')) && !/KPC|OXA/.test(gn)); };

      const cR = conTexto(gnR, carbaRI);
      if (cR.length) {
        er(G11, 'Gramnegativos con carbapenémico I/R', `${cR.length} gramnegativo(s) con carbapenémico intermedio o resistente: enviar al LDSP.`, cR.map(x => pid(x[0])));
        cR.forEach(([r, abs]) => {
          const conf = g(r, 'X_CARBA_NP', 'X_CARB_NP', 'X_EDTA', 'X_APB', 'X_GEN_CARB', 'CARBAPENEM');
          let crit = `Carbapenémico I/R (${abs})` + (conf ? '; confirmatoria: ' + conf : ''), dest = LDSP;
          let prueba = 'Tamizaje con EDTA/SMA y APB en el LDSP; el LDSP confirma el 10 % y el INS el 20 % mensual';
          const cza = czaR(r);
          if (en('EBC', r) && positivo(g(r, 'X_EDTA')) && positivo(g(r, 'X_APB'))) { crit += '; EDTA y APB positivos: coproductor serina + MBL'; dest = INS; prueba = 'Los coproductores van todos al LDSP y al INS'; }
          else if (en('EBC', r) && cza && !soloMBL(r)) { crit += `; ${cza}: posible coproducción KPC + MBL, KPC mutante u OXA con CZA R`; dest = INS; prueba = 'Descartar coproducción (EDTA, APB, aztreonam) y confirmar CZA por otro método; enviar al INS'; }
          addE(r, crit, prueba, dest, 'bac');
        });
      } else ok(G11, 'Gramnegativos: carbapenémicos', `Sin carbapenémicos I/R en ${gnR.length} aislamientos.`);

      // Ceftazidima-avibactam R con carbapenémicos sensibles (flujograma 9 del INS: cefalosporinasa o KPC mutante).
      const czaS = conTexto(gnR.filter(r => en('EBC', r) && !carbaRI(r)), czaR);
      if (czaS.length) { er(G11, 'Ceftazidima-avibactam R con carbapenémicos sensibles', `${czaS.length} Enterobacterales: vigilancia intensificada del INS (cefalosporinasa o KPC mutante).`, czaS.map(x => pid(x[0]))); czaS.forEach(([r, t]) => addE(r, `Ceftazidima-avibactam R (${t}) con carbapenémicos sensibles: posible cefalosporinasa (PAC, CMY) o KPC mutante`, 'Confirmar CZA por otro método o lote; PCR o inmunocromatografía para KPC si está disponible', INS, 'bac')); }

      // Colistina CIM ≥ 4 (no hay punto de corte por disco). Cualquier muestra y servicio.
      // Excluye Salmonella, Shigella y las especies con resistencia intrínseca (Proteus, Providencia, Morganella, S. marcescens, B. cepacia, Hafnia).
      const colR = conTexto(gnR.filter(r => !en('SAL_SHI', r) && !en('COL_INTR', r)), r => alcanza(r, 'COL', 4, null, 'R') || alcanza(r, 'POL', 4, null, 'R'));
      if (colR.length) { er(G11, 'Resistencia a colistina', `${colR.length} con colistina ≥ 4 µg/mL: enviar al LDSP para remisión al INS (cualquier muestra y servicio).`, colR.map(x => pid(x[0]))); colR.forEach(([r, t]) => addE(r, `Colistina R (${t})`, 'Confirmar CIM de colistina por microdilución en el LDSP; el INS detecta genes mcr', INS)); }
      else ok(G11, 'Gramnegativos: colistina', 'Sin resistencia a colistina en las especies vigiladas.');

      const m4 = gnR.filter(r => cimIgual(r, 'MEM', 4) && !en('EBC', r)); if (m4.length) rev('Meropenem = 4 en no fermentador', `${m4.length} Pseudomonas o Acinetobacter con MEM = 4 (intermedio). Confirmar antes del envío.`, m4.map(pid));
      const cS = gnR.filter(r => positivo(g(r, 'CARBAPENEM')) && !g(r, 'X_CARBA_NP', 'X_CARB_NP', 'X_EDTA', 'X_APB', 'X_GEN_CARB')); if (cS.length) wn(G11, 'Carbapenemasa sin confirmar', `${cS.length} CARBAPENEM positivo sin prueba confirmatoria (EDTA, APB, Carba NP).`, cS.map(pid));
      const bE = gnR.filter(r => ['+', 'POSITIVO', 'POS'].includes(g(r, 'ESBL', 'BLEE').toUpperCase()) && STERILE.has(specOf(r))); if (bE.length) { wn(G11, 'BLEE en muestra estéril', `${bE.length} BLEE+ en muestra estéril: revisar envío.`, bE.map(pid)); bE.forEach(r => addE(r, 'BLEE+ en muestra estéril (' + specOf(r) + ')', 'Confirmar BLEE fenotípicamente', LDSP)); }
    }

    // Panresistencia: solo se puede reconocer cuando el archivo trae la interpretación (S/I/R) de cada antibiótico.
    const abBase = [...new Set(abFields.map(f => f.replace(/_(NM|MI|KB|ET|ND\d*|NE)$/, '')))];
    const pan = records.filter(r => { const it = abBase.map(ab => resultado(r, ab).interp).filter(Boolean); return it.length >= 6 && it.every(x => x === 'R'); });
    if (pan.length) { er(G11, 'Aislamientos panresistentes', `${pan.length} resistentes a todos los antibióticos probados: enviar al INS.`, pan.map(pid)); pan.forEach(r => addE(r, 'Resistente a todos los antibióticos probados', 'Confirmación en el LDSP y el INS', INS)); }

    const spE = records.filter(r => orgOf(r) === 'spn' && STERILE.has(specOf(r))); if (spE.length) { wn(G11, 'S. pneumoniae en muestra estéril', `${spE.length} en muestra estéril: envío al LDSP.`, spE.map(pid)); spE.forEach(r => addE(r, 'Muestra estéril (' + specOf(r) + ')', 'Sensibilidad completa; serotipificación', LDSP)); }

    const levR = records.filter(r => en('LEV', r) || en('CRY', r) || /auris/i.test(g(r, 'LOCAL_ORG')));
    if (levR.length) {
      const cau = levR.filter(r => en('CAURIS', r) || /auris/i.test(g(r, 'LOCAL_ORG')));
      if (cau.length) { er(G11, 'Candida auris', `${cau.length} C. auris: enviar al LDSP para remisión al INS.`, cau.map(pid)); cau.forEach(r => addE(r, 'Candida auris', 'Identificación por MALDI-TOF o PCR y antifungigrama; el INS confirma especie y sensibilidad', INMEDIATO, 'lev')); }
      // Identificaciones que pueden ser C. auris (flujograma 14): hospitalizado con hemocultivo o líquido estéril, o UCI con muestra invasora.
      const sosp = levR.filter(r => en('SOSPECHA_CAURIS', r) && !cau.includes(r) && (STERILE.has(specOf(r)) || (isICU(wardOf(r)) && INVASORA.has(specOf(r)))));
      if (sosp.length) { wn(G11, 'Levaduras que pueden ser C. auris', `${sosp.length} identificadas como especies que los sistemas automatizados confunden con C. auris: enviar para confirmación.`, sosp.map(pid)); sosp.forEach(r => addE(r, 'Posible C. auris mal identificada (flujograma 14 del INS)', 'Confirmar por MALDI-TOF, secuenciación o PCR específica', INS, 'lev')); }
      const cpa = levR.filter(r => orgOf(r) === 'cpa' && STERILE.has(specOf(r))); if (cpa.length) rev('C. parapsilosis en muestra estéril', `${cpa.length} C. parapsilosis. Si se identificó con MicroScan, enviar para descartar C. auris (flujograma 14 del INS).`, cpa.map(pid));
      // Perfiles inusuales del anexo 8 del INS (CIM en µg/mL; en C. krusei el fluconazol es resistencia intrínseca).
      const ANEXO8 = { cal: { AMB: 2, CAS: 1, ANI: 1, FLU: 8, VOR: 1 }, cgl: { AMB: 2, CAS: 0.5, ANI: 0.5, FLU: 64 }, cgu: { AMB: 2, CAS: 8, ANI: 8, FLU: 8 }, ckr: { AMB: 2, CAS: 1, ANI: 1, VOR: 2 }, cpa: { AMB: 1, CAS: 8, ANI: 8, FLU: 8, VOR: 1 }, ctr: { AMB: 2, CAS: 1, ANI: 1, FLU: 8, VOR: 1 } };
      const inus = conTexto(levR.filter(r => ANEXO8[orgOf(r)]), r => Object.entries(ANEXO8[orgOf(r)]).map(([ab, c]) => alcanza(r, ab, c, null, 'R') || (ab === 'FLU' ? alcanza(r, 'FCZ', c, null, 'R') : '')).filter(Boolean).join(', '));
      if (inus.length) { wn(G11, 'Candida con perfil inusual', `${inus.length} con sensibilidad antifúngica inusual (anexo 8 del INS): enviar con el antifungigrama.`, inus.map(x => pid(x[0]))); inus.forEach(([r, t]) => addE(r, `Perfil antifúngico inusual (${t})`, 'Adjuntar el antifungigrama que evidencia la resistencia', INS, 'lev')); }
      const f4 = levR.filter(r => ['cal', 'ctr', 'cpa'].includes(orgOf(r)) && (cimIgual(r, 'FLU', 4) || cimIgual(r, 'FCZ', 4))); if (f4.length) rev('Candida fluconazol = 4', `${f4.length} C. albicans, C. tropicalis o C. parapsilosis con FLU = 4 (sensible dependiente de la dosis).`, f4.map(pid));
      const cry = levR.filter(r => en('CRY', r));
      if (cry.length) { wn(G11, 'Cryptococcus spp.', `${cry.length} Cryptococcus: enviar al LDSP para remisión al INS (vigilancia de criptococosis, fuera del documento de IAAS).`, cry.map(pid)); cry.forEach(r => addE(r, 'Cryptococcus spp. (vigilancia de criptococosis)', 'Identificación confirmada; CIM de fluconazol', INS)); }
      if (!cau.length && !sosp.length && !inus.length && !cry.length) ok(G11, 'Hongos: perfiles críticos', 'Sin C. auris, levaduras sospechosas, perfiles inusuales ni Cryptococcus.');
    }

    // Otros programas de vigilancia por laboratorio del INS (fuera del documento de IAAS).
    const sty = records.filter(r => en('TYPHI', r)); if (sty.length) { wn(G11, 'Salmonella Typhi', `${sty.length} S. Typhi: envío al INS.`, sty.map(pid)); sty.forEach(r => addE(r, 'Salmonella Typhi', 'Antibiograma completo; serotipificación', INS)); }
    const shi = records.filter(r => en('SHI', r) || g(r, 'LOCAL_ORG').toLowerCase().includes('shig')); if (shi.length) { wn(G11, 'Shigella spp.', `${shi.length} Shigella: envío al INS.`, shi.map(pid)); shi.forEach(r => addE(r, 'Shigella spp.', 'Antibiograma completo; serotipificación', INS)); }
    const nme = records.filter(r => orgOf(r) === 'nme'); if (nme.length) { er(G11, 'Neisseria meningitidis', `${nme.length} N. meningitidis: envío inmediato al INS.`, nme.map(pid)); nme.forEach(r => addE(r, 'Neisseria meningitidis', 'Antibiograma; serogrupo; PCR', INMEDIATO)); }
    const hinE = records.filter(r => orgOf(r) === 'hin' && STERILE.has(specOf(r))); if (hinE.length) { wn(G11, 'H. influenzae en muestra estéril', `${hinE.length} en muestra estéril: envío al INS.`, hinE.map(pid)); hinE.forEach(r => addE(r, 'Muestra estéril', 'Betalactamasa; CIM ampicilina', INS)); }

    // Un aislamiento por paciente: se marcan los aislamientos distintos (otra fecha o muestra) del mismo paciente y organismo.
    const primero = new Map();
    E.forEach(e => { const k = e.id + '|' + e.orgC, a = e.fecha + '|' + e.muestra; if (e.id === '?') return; if (!primero.has(k)) primero.set(k, a); else if (primero.get(k) !== a) e.avisos.push('Otro aislamiento del mismo paciente y organismo ya está en la lista: el INS recibe uno solo por paciente.'); });

    /* 12. Coherencia e integridad */
    let c12 = true;
    const km = new Map();
    records.forEach((r, i) => { const k = [pid(r), f8[i], orgFull(r), specOf(r)].join('|'); if (!km.has(k)) km.set(k, []); km.get(k).push(i); });
    const frag = [...km.values()].filter(ix => ix.length > 1);
    if (frag.length) { er('12. Coherencia e integridad', 'Antibiogramas fragmentados o repetidos', `${frag.length} combinación(es) paciente + fecha + muestra + organismo con más de un registro. Verifique si el antibiograma quedó dividido en varias filas.`, frag.flat().map(i => pid(records[i]))); c12 = false; }
    const navT = records.filter(r => iad(r).includes('nav') && !['tq', 'bq', 'lba', 'rp', 'as'].includes(specOf(r))); if (navT.length) { wn('12. Coherencia e integridad', 'NAV sin muestra respiratoria baja', `${navT.length} NAV con muestra incompatible. Usar tq, rp, bq o lba.`, navT.map(pid)); c12 = false; }
    if (c12) ok('12. Coherencia e integridad', 'Sin fragmentación', 'Sin antibiogramas fragmentados ni incoherencias muestra-evento.');

    const nE = H.filter(h => h.nivel === 'error').length, nW = H.filter(h => h.nivel === 'warn').length, nO = H.filter(h => h.nivel === 'ok').length;
    const conclusion = nE ? 'NO_CUMPLE' : nW ? 'NOVEDADES' : 'CUMPLE';
    const texto = nE ? `Se requieren ajustes: ${nE} criterio(s) no cumple(n).` + (E.length ? ` Además hay ${E.length} aislamiento(s) con criterio de envío al LDSP/INS.` : '')
      : nW ? `${nW} novedad(es) para revisar antes del envío.` : 'El archivo cumple todos los criterios y está listo para seudonimizar y enviar.';
    return { upgd, periodo, total: n, formato: datos.formato, resumen: { ok: nO, novedad: nW, error: nE, conclusion, texto }, hallazgos: H, envio: E, revision: REV };
  }

  return { analizar, fecha8 };
})();
