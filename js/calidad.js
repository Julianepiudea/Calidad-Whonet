/* calidad.js — Criterios de calidad de un archivo WHONET antes del envío al ente territorial.
   Criterio 0 (integridad del archivo) se agregó a partir del levantamiento de las bases LDSP 2020–2025:
   truncamiento en el límite de filas de Excel, columnas con datos sin nombre, cabecera en una sola
   celda y filas duplicadas. Criterios 1–12: herramienta original de diagnóstico WHONET. */
'use strict';

const Calidad = (() => {
  const STAPH = new Set(['sau','sep','sap','sho','slu','sca','sch','sha','sci','seq','she','sco','ssi','ssp','shi','swa','ssim']);
  const ENTERO = new Set(['efa','efc','efm','eca','ega','ech','emu','eas','ecf','ela']);
  const GN = new Set(['kpn','kox','eco','pae','aba','abx','acb','acl','acr','ent','ecl','ecr','ser','pmi','pvu','pst','pro','pmu','mor','mmo','sma','ral','bur','ahi','ahy','eni','cit','cko','cse','cbu','pan','koz','hin','kor','ehm','en-','em-','cfr','cda']);
  const FUNGI = new Set(['cau','cal','ctr','cgla','cpa','cdu','ckr','cgl','ctro','cfa','csa','cgu','csp','cne','cga','cla','hca','asp','afe','afum','afla']);
  const STERILE = new Set(['sa','ce','li','lp','la','lpe','lb','lsy','lcs','lba','pun','bo','lca','lpi','lsi']);
  const VALID_SPEC = new Set(['sa','ce','or','oc','se','lp','li','la','tq','he','pu','es','ga','lcs','lba','lb','bo','lpe','pun','as','lsi','lca','lpi','mc','mv','ur','bi','na','ot','sd','cu','ep','co','bq','ly','sk','ts','ub','uc','ud','bp','ft','rp','mf','te','hu','ab','ao','dr','re','ca','cc','cf','rt','tr','di','bx','ie','pe']);
  const WRONG_ORGS = { 'ac-': { c: 'aba', n: 'Acinetobacter baumannii' }, 'rao': { c: 'kor', n: 'Raoultella ornithinolytica' }, 'entcpx': { c: 'en-', n: 'Enterobacter cloacae complex' } };
  const INVALID_WARDS = new Set(['hcup', 'ped_1/2adu', 'ped1/2adu']);
  const MO = { kpn:'Klebsiella pneumoniae',kox:'Klebsiella oxytoca',eco:'Escherichia coli',pae:'Pseudomonas aeruginosa',aba:'Acinetobacter baumannii',abx:'Acinetobacter baumannii complex',acb:'Acinetobacter spp.',ent:'Enterobacter spp.',ecl:'Enterobacter cloacae','en-':'Enterobacter cloacae complex',ehm:'Enterobacter hormaechei',ser:'Serratia spp.',sma:'Serratia marcescens',pmi:'Proteus mirabilis',mor:'Morganella morganii',mmo:'Morganella morganii',sau:'Staphylococcus aureus',sep:'Staphylococcus epidermidis',sap:'Staphylococcus spp.',sho:'Staphylococcus hominis',efa:'Enterococcus faecalis',efc:'Enterococcus faecium',efm:'Enterococcus faecium',spn:'Streptococcus pneumoniae',cau:'Candida auris',cal:'Candida albicans',cgl:'Candida glabrata',ctr:'Candida tropicalis',cgla:'Candida glabrata',cne:'Cryptococcus neoformans',cga:'Cryptococcus gattii',sty:'Salmonella Typhi',sal:'Salmonella spp.',shi:'Shigella spp.',nme:'Neisseria meningitidis',hin:'Haemophilus influenzae',kor:'Raoultella ornithinolytica' };
  const LIMITES_FILAS = new Set([65535, 65536, 1048575, 1048576]);

  /* ---- utilidades ---- */
  const g = (r, ...ks) => { for (const k of ks) { const v = r[k]; if (v !== undefined && v !== '') return v; } return ''; };
  const nmv = (r, ab) => { for (const s of [ab + '_NM', ab, ab + '_MI', ab + '_ET', ab + '_KB', ab + '_ND30', ab + '_ND10']) { const v = g(r, s); if (v) return v; } return ''; };
  const micN = v => { if (!v) return null; const n = parseFloat(String(v).replace(',', '.').replace(/[<>=\s]/g, '')); return isNaN(n) ? null : n; };
  const isR = (v, rT) => { if (!v) return false; if (v.trim().toUpperCase() === 'R') return true; const n = micN(v); return n !== null && n >= rT; };
  const isRI = (v, iT) => { if (!v) return false; const u = v.trim().toUpperCase(); if (u === 'R' || u === 'I') return true; const n = micN(v); return n !== null && n >= iT; };
  const ID_CAMPOS = ['PATIENT_ID', 'PAT_ID', 'CODIGO IDENTIFICACION', 'CODIGO_IDENTIFICACION', 'DOCUMENTO', 'IDENTIFICACION'];
  const pid = r => g(r, ...ID_CAMPOS) || '?';
  const specOf = r => (g(r, 'SPEC_TYPE', 'SPEC_CODE') || '').toLowerCase().trim();
  const orgFull = r => (g(r, 'ORGANISM') || '').toLowerCase().trim();
  const orgOf = r => orgFull(r).slice(0, 3);
  const wardOf = r => (g(r, 'WARD') || '').toLowerCase().trim();
  const wtOf = r => (g(r, 'WARD_TYPE') || '').toLowerCase().trim();
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
    const addE = (r, oC, oN, crit, prueba, dest) => E.push({ id: pid(r), nombre: nameOf(r), orgC: oC || orgOf(r), orgN: oN || MO[orgOf(r)] || orgOf(r), muestra: specOf(r), servicio: wardOf(r), fecha: fmtF(fecha8(g(r, 'SPEC_DATE'))), criterio: crit, prueba, destino: dest });
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

    /* 10. Antibióticos */
    if (!abFields.length) wn('10. Antibióticos', 'Sin campos de sensibilidad', 'No se detectaron columnas de resultados (_NM, _ND, _NE). Verifique el formato.');
    else {
      ok('10. Antibióticos', 'Campos de sensibilidad', `${abFields.length} columnas de resultados: ${abFields.slice(0, 6).map(f => f.replace(/_(NM|ND\d*|NE|MI|KB|ET)$/, '')).join(', ')}…`);
      const bB = records.filter(r => { const b = g(r, 'ESBL', 'BLEE').toUpperCase(); return ['+', 'POSITIVO', 'POS'].includes(b) && (STAPH.has(orgOf(r)) || ENTERO.has(orgOf(r)) || FUNGI.has(orgOf(r))); });
      if (bB.length) er('10. Antibióticos', 'BLEE en organismo que no aplica', `${bB.length} BLEE positivo en Staphylococcus, Enterococcus u hongo.`, bB.map(pid));
      const nAB = records.filter(r => !abFields.some(f => r[f] && r[f].trim() && r[f].trim() !== '-'));
      if (nAB.length) wn('10. Antibióticos', 'Sin antibiograma', `${nAB.length} sin ningún resultado de sensibilidad.`, nAB.map(pid));
    }

    /* 11. Sensibilidad y alertas */
    const G11 = '11. Sensibilidad';
    const staphR = records.filter(r => STAPH.has(orgOf(r)));
    if (staphR.length) {
      const noFOX = staphR.filter(r => !nmv(r, 'FOX')); if (noFOX.length) er(G11, 'Staphylococcus sin cefoxitina (FOX)', `${noFOX.length}/${staphR.length} Staphylococcus sin FOX, obligatorio para SARM.`, noFOX.map(pid)); else ok(G11, 'FOX en Staphylococcus', `Los ${staphR.length} Staphylococcus tienen FOX.`);
      const nV = staphR.filter(r => !nmv(r, 'VAN')); if (nV.length) wn(G11, 'Staphylococcus sin vancomicina', `${nV.length} sin VAN.`, nV.map(pid));
      const nL = staphR.filter(r => !nmv(r, 'LNZ')); if (nL.length) wn(G11, 'Staphylococcus sin linezolid', `${nL.length} sin LNZ.`, nL.map(pid));
      const vIR = staphR.filter(r => isRI(nmv(r, 'VAN'), 4)); if (vIR.length) { er(G11, 'VISA/VRSA', `${vIR.length} Staphylococcus VAN I/R: envío urgente al INS.`, vIR.map(pid)); vIR.forEach(r => addE(r, '', MO[orgOf(r)] || 'Staphylococcus sp.', 'VAN CIM=' + nmv(r, 'VAN') + ' (VISA/VRSA)', 'CIM vancomicina (E-test/microdilución)', 'INS URGENTE')); }
      const lIR = staphR.filter(r => isRI(nmv(r, 'LNZ'), 8)); if (lIR.length) { er(G11, 'Staphylococcus LNZ I/R', `${lIR.length} LNZ I/R: envío urgente al INS.`, lIR.map(pid)); lIR.forEach(r => addE(r, '', MO[orgOf(r)] || 'Staphylococcus sp.', 'LNZ CIM=' + nmv(r, 'LNZ') + ' (I/R)', 'CIM linezolid (microdilución)', 'INS URGENTE')); }
      const l4 = staphR.filter(r => micN(nmv(r, 'LNZ')) === 4); if (l4.length) rev('Staphylococcus LNZ = 4', `${l4.length} con LNZ = 4 (zona límite). Clasificar por especie.`, l4.map(pid));
      if (!vIR.length && !lIR.length) ok(G11, 'Staphylococcus: perfiles críticos', `Sin VISA/VRSA ni LNZ-R en ${staphR.length} aislamientos.`);
    }
    const enteroR = records.filter(r => ENTERO.has(orgOf(r)));
    if (enteroR.length) {
      const nV = enteroR.filter(r => !nmv(r, 'VAN')); if (nV.length) wn(G11, 'Enterococcus sin vancomicina', `${nV.length} sin VAN.`, nV.map(pid));
      const nL = enteroR.filter(r => !nmv(r, 'LNZ')); if (nL.length) wn(G11, 'Enterococcus sin linezolid', `${nL.length} sin LNZ.`, nL.map(pid));
      const vR = enteroR.filter(r => isR(nmv(r, 'VAN'), 32)); if (vR.length) { er(G11, 'Enterococcus resistente a vancomicina', `${vR.length} VAN-R: envío urgente al INS.`, vR.map(pid)); vR.forEach(r => addE(r, '', MO[orgOf(r)] || 'Enterococcus sp.', 'VAN-R (CIM=' + nmv(r, 'VAN') + ')', 'CIM vancomicina; vanA/vanB', 'INS URGENTE')); }
      const lIR = enteroR.filter(r => isRI(nmv(r, 'LNZ'), 8)); if (lIR.length) { er(G11, 'Enterococcus LNZ I/R', `${lIR.length} LNZ I/R: envío urgente al INS.`, lIR.map(pid)); lIR.forEach(r => addE(r, '', MO[orgOf(r)] || 'Enterococcus sp.', 'LNZ CIM=' + nmv(r, 'LNZ'), 'CIM linezolid', 'INS URGENTE')); }
      const eAMP = enteroR.filter(r => orgOf(r) === 'efa' && isR(nmv(r, 'AMP'), 16)); if (eAMP.length) { er(G11, 'E. faecalis resistente a ampicilina', `${eAMP.length} AMP-R: envío al INS.`, eAMP.map(pid)); eAMP.forEach(r => addE(r, 'efa', 'Enterococcus faecalis', 'AMP-R (CIM=' + nmv(r, 'AMP') + ')', 'CIM ampicilina; confirmar especie', 'INS')); }
      if (!vR.length && !lIR.length && !eAMP.length) ok(G11, 'Enterococcus: perfiles críticos', 'Sin VRE, LNZ-R ni E. faecalis AMP-R.');
    }
    const gnR = records.filter(r => GN.has(orgOf(r)) || GN.has(orgFull(r)));
    if (gnR.length) {
      const noFerm = o => ['pae', 'aba', 'abx', 'acb', 'acl'].includes(o);
      const cR = gnR.filter(r => { const iT = noFerm(orgOf(r)) ? 4 : 2; return isRI(nmv(r, 'MEM'), iT) || isRI(nmv(r, 'IPM'), iT) || isRI(nmv(r, 'ETP'), 1) || isRI(nmv(r, 'DOR'), iT); });
      if (cR.length) { er(G11, 'Gramnegativos con carbapenémico R/I', `${cR.length} gramnegativo(s) R/I: envío al LDSP.`, cR.map(pid)); cR.forEach(r => { const o = orgOf(r), iT = noFerm(o) ? 4 : 2; const abs = ['MEM', 'IPM', 'ETP', 'DOR'].filter(ab => isRI(nmv(r, ab), ab === 'ETP' ? 1 : iT)).join('/'); const conf = g(r, 'X_CARBA_NP', 'X_CARB_NP', 'X_EDTA', 'X_APB', 'X_GEN_CARB', 'CARBAPENEM'); addE(r, '', MO[o] || o.toUpperCase(), 'Carbapenémico R/I (' + abs + ')' + (conf ? '; confirmatoria: ' + conf : ''), 'Carba NP / EDTA / APB / genotipificación', 'LDSP'); }); }
      else ok(G11, 'Gramnegativos: carbapenémicos', `Sin resistencia a carbapenémicos en ${gnR.length} aislamientos.`);
      const m4 = gnR.filter(r => micN(nmv(r, 'MEM')) === 4); if (m4.length) rev('Meropenem = 4: verificar', `${m4.length} gramnegativo(s) con MEM = 4 (zona límite). Clasificar por especie.`, m4.map(pid));
      const cS = gnR.filter(r => ['+', 'positivo'].includes(g(r, 'CARBAPENEM').toLowerCase()) && !g(r, 'X_CARBA_NP', 'X_CARB_NP', 'X_EDTA', 'X_APB', 'X_GEN_CARB')); if (cS.length) wn(G11, 'Carbapenemasa sin confirmar', `${cS.length} CARBAPENEM positivo sin prueba confirmatoria (EDTA, APB, Carba NP).`, cS.map(pid));
      const bE = gnR.filter(r => ['+', 'POSITIVO', 'POS'].includes(g(r, 'ESBL', 'BLEE').toUpperCase()) && STERILE.has(specOf(r))); if (bE.length) { wn(G11, 'BLEE en muestra estéril', `${bE.length} BLEE+ en muestra estéril: revisar envío.`, bE.map(pid)); bE.forEach(r => addE(r, '', MO[orgOf(r)] || orgOf(r).toUpperCase(), 'BLEE+ en muestra estéril (' + specOf(r) + ')', 'Confirmar BLEE fenotípicamente', 'LDSP')); }
    }
    const spE = records.filter(r => orgOf(r) === 'spn' && STERILE.has(specOf(r))); if (spE.length) { wn(G11, 'S. pneumoniae en muestra estéril', `${spE.length} en muestra estéril: envío al LDSP.`, spE.map(pid)); spE.forEach(r => addE(r, 'spn', 'Streptococcus pneumoniae', 'Muestra estéril (' + specOf(r) + ')', 'Sensibilidad completa; serotipificación', 'LDSP')); }
    const fungiR = records.filter(r => FUNGI.has(orgOf(r)));
    if (fungiR.length) {
      const cau = fungiR.filter(r => orgOf(r) === 'cau'); if (cau.length) { er(G11, 'Candida auris', `${cau.length} C. auris: envío urgente al INS.`, cau.map(pid)); cau.forEach(r => addE(r, 'cau', 'Candida auris', 'Envío obligatorio', 'MALDI-TOF/PCR; CIM fluconazol, equinocandinas y anfotericina', 'INS URGENTE')); }
      const cry = fungiR.filter(r => ['cne', 'cga'].includes(orgOf(r))); if (cry.length) { er(G11, 'Cryptococcus spp.', `${cry.length} Cryptococcus: envío urgente al INS.`, cry.map(pid)); cry.forEach(r => addE(r, '', MO[orgOf(r)] || 'Cryptococcus spp.', 'Envío obligatorio', 'Identificación confirmada; CIM fluconazol', 'INS URGENTE')); }
      const fR = fungiR.filter(r => !['cau', 'cne', 'cga'].includes(orgOf(r)) && isR(nmv(r, 'FLU') || nmv(r, 'FCZ'), 8)); if (fR.length) { wn(G11, 'Candida con FLU ≥ 8', `${fR.length} Candida con fluconazol ≥ 8: verificar criterios del INS.`, fR.map(pid)); fR.forEach(r => addE(r, '', MO[orgOf(r)] || 'Candida spp.', 'FLU CIM=' + (nmv(r, 'FLU') || nmv(r, 'FCZ')), 'CIM fluconazol y equinocandinas', 'INS')); }
      const f4 = fungiR.filter(r => micN(nmv(r, 'FLU') || nmv(r, 'FCZ')) === 4); if (f4.length) rev('Candida fluconazol = 4', `${f4.length} con FLU = 4 (zona límite). Clasificar por especie.`, f4.map(pid));
      if (!cau.length && !cry.length && !fR.length) ok(G11, 'Hongos: perfiles críticos', 'Sin C. auris, Cryptococcus ni Candida resistente a fluconazol.');
    }
    const sty = records.filter(r => orgOf(r) === 'sty'); if (sty.length) { wn(G11, 'Salmonella Typhi', `${sty.length} S. Typhi: envío al INS.`, sty.map(pid)); sty.forEach(r => addE(r, 'sty', 'Salmonella Typhi', 'Envío obligatorio', 'Antibiograma completo; serotipificación', 'INS')); }
    const shi = records.filter(r => orgOf(r) === 'shi' || g(r, 'LOCAL_ORG').toLowerCase().includes('shig')); if (shi.length) { wn(G11, 'Shigella spp.', `${shi.length} Shigella: envío al INS.`, shi.map(pid)); shi.forEach(r => addE(r, 'shi', 'Shigella spp.', 'Envío obligatorio', 'Antibiograma completo; serotipificación', 'INS')); }
    const nme = records.filter(r => orgOf(r) === 'nme'); if (nme.length) { er(G11, 'Neisseria meningitidis', `${nme.length} N. meningitidis: envío urgente al INS.`, nme.map(pid)); nme.forEach(r => addE(r, 'nme', 'Neisseria meningitidis', 'Envío obligatorio', 'Antibiograma; serogrupo; PCR', 'INS URGENTE')); }
    const hinE = records.filter(r => orgOf(r) === 'hin' && STERILE.has(specOf(r))); if (hinE.length) { wn(G11, 'H. influenzae en muestra estéril', `${hinE.length} en muestra estéril: envío al INS.`, hinE.map(pid)); hinE.forEach(r => addE(r, 'hin', 'Haemophilus influenzae', 'Muestra estéril', 'Betalactamasa; CIM ampicilina', 'INS')); }

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
