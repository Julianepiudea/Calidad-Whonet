/* lectores.js — Lectura de archivos WHONET en el navegador (sin enviar datos a ningún servidor).
   Formatos: DBF/SIR (WHONET 5.6), CSV/TXT/TSV (exportaciones y BacLink), XLSX/XLS (Excel) y
   SQLite (WHONET 2022+). Cada lector devuelve una estructura común:
   { formato, nombre, campos[], registros[{campo: valor}], filasHoja, meta, fuente }
   `fuente` guarda lo necesario para escribir el archivo seudonimizado en el mismo formato. */
'use strict';

const Lectores = (() => {
  const dec1252 = new TextDecoder('windows-1252');

  function decodificarTexto(buf) {
    try { return { texto: new TextDecoder('utf-8', { fatal: true }).decode(buf), codificacion: 'utf-8' }; }
    catch (e) { return { texto: dec1252.decode(buf), codificacion: 'windows-1252' }; }
  }

  /* ---------- DBF / SIR (dBase III) ---------- */
  function leerDBF(buf, nombre) {
    const b = new Uint8Array(buf), v = new DataView(buf);
    const nReg = v.getUint32(4, true), hS = v.getUint16(8, true), rS = v.getUint16(10, true);
    const campos = [];
    let off = 32, dO = 1;
    while (off < hS - 1 && b[off] !== 0x0D && off + 32 <= buf.byteLength) {
      let nm = '';
      for (let i = 0; i < 11 && b[off + i] !== 0; i++) nm += String.fromCharCode(b[off + i]);
      nm = nm.trim();
      const tipo = String.fromCharCode(b[off + 11]), len = b[off + 16];
      if (nm && len > 0) campos.push({ nm, tipo, dO, len });
      dO += len; off += 32;
    }
    const registros = [], posiciones = [];
    let borrados = 0;
    for (let i = 0; i < nReg; i++) {
      const rOff = hS + i * rS;
      if (rOff + rS > buf.byteLength) break;
      if (b[rOff] === 0x2A) { borrados++; continue; }            // registro marcado como borrado
      const r = {};
      for (const f of campos) {
        const val = dec1252.decode(b.subarray(rOff + f.dO, rOff + f.dO + f.len)).trim();
        if (val && val !== '-') r[f.nm] = val;
      }
      registros.push(r); posiciones.push(rOff);
    }
    return { formato: 'DBF', nombre, campos: campos.map(f => f.nm), registros, filasHoja: [registros.length],
      meta: { declarados: nReg, borrados, codificacion: 'windows-1252' },
      fuente: { tipo: 'dbf', buf, campos, posiciones } };
  }

  /* ---------- Texto delimitado ---------- */
  function detectarSeparador(linea) {
    const cand = ['\t', '|', ';', ','];
    let mejor = ',', max = 0;
    for (const s of cand) { const n = linea.split(s).length - 1; if (n > max) { max = n; mejor = s; } }
    return mejor;
  }
  function parsearDelimitado(texto, sep) {
    const filas = []; let fila = [], campo = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; }
        else campo += c;
      } else if (c === '"' && campo === '') q = true;
      else if (c === sep) { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); campo = '';
        if (fila.length > 1 || fila[0] !== '') filas.push(fila);
        fila = [];
      } else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }
  function leerTexto(buf, nombre) {
    const { texto, codificacion } = decodificarTexto(buf);
    const limpio = texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
    const primera = limpio.slice(0, limpio.search(/\r?\n/) === -1 ? limpio.length : limpio.search(/\r?\n/));
    const sep = detectarSeparador(primera);
    const filas = parsearDelimitado(limpio, sep);
    if (filas.length < 2) throw new Error('El archivo no tiene filas de datos.');
    return desdeMatriz(filas, { formato: 'Texto', nombre, meta: { separador: sep, codificacion },
      fuente: { tipo: 'texto', sep, codificacion, filas } });
  }

  /* Convierte una matriz [cabecera, ...filas] en registros; conserva columnas sin nombre. */
  function desdeMatriz(filas, extra) {
    const cab = filas[0].map(h => String(h ?? '').trim());
    const ancho = filas.reduce((m, f) => Math.max(m, f.length), 0);
    const campos = [];
    for (let j = 0; j < ancho; j++) campos.push(cab[j] ? cab[j] : `(sin nombre, col. ${letraCol(j)})`);
    const registros = filas.slice(1).map(f => {
      const r = {};
      for (let j = 0; j < ancho; j++) { const v = f[j]; if (v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-') r[campos[j]] = String(v).trim(); }
      return r;
    });
    return Object.assign({ campos, registros, filasHoja: [registros.length],
      columnasSinNombre: campos.filter((c, j) => !cab[j] && registros.some(r => r[c] !== undefined)) }, extra);
  }
  function letraCol(n) { let s = ''; n += 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

  /* ---------- Excel ---------- */
  function leerExcel(buf, nombre) {
    if (typeof XLSX === 'undefined') throw new Error('No se cargó el lector de Excel.');
    const wb = XLSX.read(buf, { type: 'array', raw: true, cellDates: false });
    const hojaNom = wb.SheetNames.find(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, range: 0 }).length > 1) || wb.SheetNames[0];
    const ws = wb.Sheets[hojaNom];
    let filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
    let cabeceraEnA1 = false;
    // Cabecera en una sola celda separada por "|" (texto pegado en Excel)
    if (filas.length && filas[0].filter(x => String(x).trim()).length === 1 && String(filas[0][0]).includes('|')) {
      filas[0] = String(filas[0][0]).split('|'); cabeceraEnA1 = true;
    }
    const filasHoja = wb.SheetNames.map(n => wb.Sheets[n]['!ref'] ? XLSX.utils.decode_range(wb.Sheets[n]['!ref']).e.r + 1 : 0);
    const out = desdeMatriz(filas, { formato: /\.xls$/i.test(nombre) ? 'Excel 97-2003 (.xls)' : 'Excel (.xlsx)', nombre,
      meta: { hoja: hojaNom, hojas: wb.SheetNames.length, cabeceraEnA1 },
      fuente: { tipo: 'excel', wb, hoja: hojaNom, cabeceraEnA1 } });
    out.filasHoja = filasHoja;
    return out;
  }

  /* ---------- SQLite (WHONET 2022+) ---------- */
  let sqlPromesa = null;
  function cargarSQL() {
    if (!sqlPromesa) sqlPromesa = initSqlJs({ locateFile: f => 'vendor/' + f });
    return sqlPromesa;
  }
  async function leerSQLite(buf, nombre) {
    const SQL = await cargarSQL();
    const db = new SQL.Database(new Uint8Array(buf));
    const tablas = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(v => v[0]) || [];
    let mejor = null;
    for (const t of tablas) {
      const cols = db.exec(`PRAGMA table_info("${t.replace(/"/g, '""')}")`)[0]?.values.map(v => v[1]) || [];
      if (!cols.some(c => /^ORGANISM$/i.test(c))) continue;
      const n = db.exec(`SELECT COUNT(*) FROM "${t.replace(/"/g, '""')}"`)[0].values[0][0];
      if (!mejor || n > mejor.n) mejor = { t, cols, n };
    }
    if (!mejor) throw new Error('No se encontró una tabla de aislamientos (con columna ORGANISM) en la base SQLite.');
    const res = db.exec(`SELECT rowid AS __rowid, * FROM "${mejor.t.replace(/"/g, '""')}"`)[0];
    const campos = res.columns.slice(1), rowids = [];
    const registros = res.values.map(v => {
      rowids.push(v[0]); const r = {};
      campos.forEach((c, j) => { const x = v[j + 1]; if (x !== null && String(x).trim() !== '' && String(x).trim() !== '-') r[c] = String(x).trim(); });
      return r;
    });
    return { formato: 'SQLite (WHONET)', nombre, campos, registros, filasHoja: [registros.length],
      meta: { tabla: mejor.t, tablas: tablas.length }, fuente: { tipo: 'sqlite', db, tabla: mejor.t, rowids } };
  }

  async function leer(archivo) {
    const buf = await archivo.arrayBuffer();
    const ext = archivo.name.toLowerCase().split('.').pop();
    const cab = new Uint8Array(buf.slice(0, 16));
    const esSQLite = String.fromCharCode(...cab).startsWith('SQLite format 3');
    if (esSQLite || ['sqlite', 'db', 'sqlite3'].includes(ext)) return leerSQLite(buf, archivo.name);
    if (['dbf', 'sir'].includes(ext)) return leerDBF(buf, archivo.name);
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) return leerExcel(buf, archivo.name);
    if (['csv', 'txt', 'tsv'].includes(ext)) return leerTexto(buf, archivo.name);
    throw new Error('Formato no reconocido: .' + ext);
  }

  return { leer, letraCol, parsearDelimitado };
})();
