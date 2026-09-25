/* anonimizar.js — Seudonimización de datos del paciente en archivos WHONET, en el navegador.
   Documento de identidad → código HMAC-SHA-256 con clave institucional (determinista: el mismo
   documento da siempre el mismo código, así que se conserva el primer aislamiento por paciente;
   irreversible sin la clave). Nombres, apellidos y contacto → vacío. Texto libre → barrido de
   nombres y documentos del propio archivo. Luego, verificación de residuos en el archivo de salida. */
'use strict';

const Anonimizar = (() => {
  const VERSION = 'GERMEN-SEUD-v1';
  const CLAVE_LS = 'germen.clave.v1';

  /* ---------- Clave institucional ---------- */
  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function sha256Hex(data) { return hex(await crypto.subtle.digest('SHA-256', data)); }

  function claveGuardada() { try { return JSON.parse(localStorage.getItem(CLAVE_LS)); } catch (e) { return null; } }
  async function huella(clave) { return (await sha256Hex(deb64(clave.clave))).slice(0, 8).toUpperCase(); }
  async function crearClave(institucion) {
    const c = { v: 1, tipo: 'clave-seudonimizacion-germen', institucion: (institucion || '').trim().toUpperCase(),
      creada: new Date().toISOString(), clave: b64(crypto.getRandomValues(new Uint8Array(32))) };
    localStorage.setItem(CLAVE_LS, JSON.stringify(c)); return c;
  }
  function importarClave(texto) {
    const c = JSON.parse(texto);
    if (c.tipo !== 'clave-seudonimizacion-germen' || !c.clave || deb64(c.clave).length !== 32) throw new Error('El archivo no es una clave de seudonimización GERMEN válida.');
    localStorage.setItem(CLAVE_LS, JSON.stringify(c)); return c;
  }
  function borrarClave() { localStorage.removeItem(CLAVE_LS); }

  /* ---------- Detección de columnas sensibles ---------- */
  const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const REGLAS = [
    { accion: 'seudonimizar', etiqueta: 'Documento o identificador del paciente',
      re: /^(PATIENT_?ID|PAT_?ID|ID_?PACIENTE|CODIGO[ _]IDENTIFICACION|IDENTIFICACION|DOCUMENTO|NUM(ERO)?_?DOC(UMENTO)?|NRO_?DOC(UMENTO)?|CEDULA|CC|HISTORIA(_CLINICA)?|NUM_?HC|HC|MRN)$/ },
    { accion: 'vaciar', etiqueta: 'Nombre o apellido', re: /(^|_)(FIRST|LAST|MIDDLE|FULL)?_?NAME$|NOMBRE|APELLIDO|^PACIENTE$/ },
    { accion: 'vaciar', etiqueta: 'Dato de contacto', re: /DIRECC|ADDRESS|TELEF|PHONE|CELULAR|MOVIL|E_?MAIL|CORREO|BARRIO/ },
    { accion: 'conservar', etiqueta: 'Fecha de nacimiento', re: /^(DATE_?BIRTH|BIRTH_?DATE|FECHA_?NAC(IMIENTO)?|F_?NAC)$/ },
    { accion: 'barrido', etiqueta: 'Texto libre', re: /COMMENT|COMENTARIO|OBSERV|NOTA/ },
  ];
  function detectar(campos) {
    const out = [];
    campos.forEach(c => {
      const u = sinTildes(c.toUpperCase()).trim();
      if (/^TIPO_?DOC/.test(u)) return;                                   // el tipo de documento no identifica
      const r = REGLAS.find(x => x.re.test(u));
      if (r) out.push({ campo: c, accion: r.accion, motivo: r.etiqueta });
    });
    return out;
  }

  /* ---------- Transformaciones ---------- */
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';                        // Crockford (sin I, L, O, U)
  function base32(bytes, n) { let bits = 0, val = 0, s = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5 && s.length < n) { s += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } return s; }
  const normalizarId = v => sinTildes(String(v)).toUpperCase().replace(/[^A-Z0-9]/g, '');

  async function crearSeudonimizador(clave) {
    const k = await crypto.subtle.importKey('raw', deb64(clave.clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cache = new Map(); const enc = new TextEncoder();
    return async function (valor) {
      const n = normalizarId(valor);
      if (!n) return '';
      if (cache.has(n)) return cache.get(n);
      const firma = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('GERMEN|v1|' + n)));
      const s = 'G' + base32(firma, 11);
      cache.set(n, s); return s;
    };
  }
  function soloAnio(v) { const f = Calidad.fecha8(v); return f && f !== 'X' ? f.slice(0, 4) + '0101' : ''; }

  const tokNorm = s => sinTildes(String(s)).toUpperCase();
  function construirBarrido(registros, planCols) {
    const nombres = new Set(), completos = new Set(), ids = new Map();
    planCols.forEach(p => {
      registros.forEach(r => {
        const v = r[p.campo]; if (!v) return;
        if (p.accion === 'vaciar' && /Nombre/.test(p.motivo)) {
          tokNorm(v).split(/[^A-Z]+/).forEach(t => { if (t.length >= 3) nombres.add(t); });
          const c = tokNorm(v).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); if (c.includes(' ') && c.length >= 7) completos.add(c);
        }
        if (p.accion === 'seudonimizar') { const n = normalizarId(v); if (n.length >= 5) ids.set(n, v); }
      });
    });
    return { nombres, completos, ids };
  }
  async function barrer(texto, barrido, seud, contador) {
    let s = String(texto);
    // documentos (secuencias alfanuméricas de 5+ caracteres que coinciden con un ID del archivo)
    const partes = s.split(/([A-Za-z0-9.\-]{5,})/);
    for (let i = 1; i < partes.length; i += 2) { const n = normalizarId(partes[i]); if (barrido.ids.has(n)) { partes[i] = await seud(n); contador.ids++; } }
    s = partes.join('');
    // nombres: palabras completas que coinciden con nombres o apellidos del archivo
    s = s.replace(/[A-Za-zÀ-ÿ]{3,}/g, w => { if (barrido.nombres.has(tokNorm(w))) { contador.nombres++; return '***'; } return w; });
    return s;
  }

  /* Calcula el nuevo valor de cada celda afectada. Devuelve {cambios: Map(campo -> array de valores), stats}. */
  async function transformar(datos, plan, clave, progreso) {
    const seud = await crearSeudonimizador(clave);
    const activos = plan.filter(p => p.accion !== 'conservar');
    const barrido = construirBarrido(datos.registros, activos);
    const contador = { ids: 0, nombres: 0 };
    const cambios = new Map(); const unicos = new Set();
    const N = datos.registros.length;
    for (const p of activos) cambios.set(p.campo, new Array(N));
    for (let i = 0; i < N; i++) {
      const r = datos.registros[i];
      for (const p of activos) {
        const v = r[p.campo]; let nv;
        if (v === undefined || v === '') nv = undefined;
        else if (p.accion === 'vaciar') nv = '';
        else if (p.accion === 'seudonimizar') { nv = await seud(v); unicos.add(nv); }
        else if (p.accion === 'anio') nv = soloAnio(v);
        else if (p.accion === 'barrido') nv = await barrer(v, barrido, seud, contador);
        cambios.get(p.campo)[i] = nv;
      }
      if (progreso && i % 2000 === 0) { progreso(i / N); await new Promise(res => setTimeout(res)); }
    }
    return { cambios, stats: { seudonimos: unicos.size, reemplazosTexto: contador, barrido } };
  }

  /* ---------- Verificación de residuos ---------- */
  function verificarResiduos(datos, plan, cambios, barrido) {
    const transformadas = new Set(plan.filter(p => p.accion !== 'conservar').map(p => p.campo));
    const ids = [...barrido.ids.keys()].filter(x => x.length >= 6);
    const idSet = new Set(ids);
    const hallazgos = {};
    datos.registros.forEach((r, i) => {
      for (const c of datos.campos) {
        let v = r[c]; if (!v) continue;
        if (transformadas.has(c)) { v = cambios.get(c)[i]; if (!v) continue; }
        const n = normalizarId(v);
        const tokens = String(v).split(/[^A-Za-z0-9]+/).map(normalizarId);
        const hayId = idSet.has(n) || tokens.some(t => t.length >= 6 && idSet.has(t));
        let hayNombre = false;
        if (!transformadas.has(c) && barrido.completos.size && /[A-Za-zÀ-ÿ]{3,}\s+[A-Za-zÀ-ÿ]{3,}/.test(v)) {
          const w = tokNorm(v).replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
          for (let a = 0; a < w.length && !hayNombre; a++) for (let b = a + 2; b <= Math.min(w.length, a + 4); b++) if (barrido.completos.has(w.slice(a, b).join(' '))) { hayNombre = true; break; }
        }
        if (hayId || hayNombre) { hallazgos[c] = (hallazgos[c] || 0) + 1; }
      }
    });
    return Object.entries(hallazgos).map(([campo, n]) => ({ campo, n }));
  }

  /* ---------- Escritura en el formato original ---------- */
  const enc1252 = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); u[i] = c < 256 ? c : 63; } return u; };

  function escribirDBF(datos, cambios) {
    const f = datos.fuente, out = new Uint8Array(f.buf.slice(0));
    const porNombre = new Map(f.campos.map(c => [c.nm, c]));
    const avisos = [];
    for (const [campo, vals] of cambios) {
      const def = porNombre.get(campo); if (!def) continue;
      if (vals.some(v => v && v.length > def.len)) avisos.push(`La columna ${campo} mide ${def.len} caracteres: los valores más largos se recortaron.`);
      vals.forEach((v, i) => {
        if (v === undefined) return;
        const pos = f.posiciones[i] + def.dO;
        const bytes = enc1252(String(v).slice(0, def.len).padEnd(def.len, ' '));
        out.set(bytes, pos);
      });
    }
    return { bytes: out, ext: 'dbf', mime: 'application/octet-stream', avisos };
  }

  function escribirTexto(datos, cambios) {
    const f = datos.fuente, filas = f.filas.map(x => x.slice());
    const cab = filas[0].map(h => String(h).trim());
    for (const [campo, vals] of cambios) {
      const j = datos.campos.indexOf(campo); if (j < 0) continue;
      vals.forEach((v, i) => { if (v !== undefined && filas[i + 1]) filas[i + 1][j] = v; });
    }
    const q = x => { x = x == null ? '' : String(x); return /["\r\n]/.test(x) || x.includes(f.sep) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const texto = [cab, ...filas.slice(1)].map(fl => fl.map(q).join(f.sep)).join('\r\n') + '\r\n';
    const bytes = f.codificacion === 'utf-8' ? new TextEncoder().encode(texto) : enc1252(texto);
    const ext = datos.nombre.toLowerCase().split('.').pop();
    return { bytes, ext, mime: 'text/plain', avisos: [] };
  }

  function escribirExcel(datos, cambios) {
    const f = datos.fuente, ws = f.wb.Sheets[f.hoja];
    const rango = XLSX.utils.decode_range(ws['!ref']);
    const r0 = rango.s.r;
    // cabecera: si venía en una sola celda, se reparte en una celda por variable
    if (f.cabeceraEnA1) {
      datos.campos.forEach((c, j) => { if (!/^\(sin nombre/.test(c)) ws[XLSX.utils.encode_cell({ r: r0, c: rango.s.c + j })] = { t: 's', v: c }; });
      rango.e.c = Math.max(rango.e.c, rango.s.c + datos.campos.length - 1); ws['!ref'] = XLSX.utils.encode_range(rango);
    }
    // filas de datos: sheet_to_json omitió filas vacías; se mapean por posición real
    const filasReales = [];
    for (let r = r0 + 1; r <= rango.e.r; r++) {
      let vacia = true;
      for (let c = rango.s.c; c <= rango.e.c && vacia; c++) { const cel = ws[XLSX.utils.encode_cell({ r, c })]; if (cel && String(cel.v ?? '').trim() !== '') vacia = false; }
      if (!vacia) filasReales.push(r);
    }
    for (const [campo, vals] of cambios) {
      const j = datos.campos.indexOf(campo); if (j < 0) continue;
      vals.forEach((v, i) => {
        if (v === undefined) return;
        const ref = XLSX.utils.encode_cell({ r: filasReales[i], c: rango.s.c + j });
        if (v === '') delete ws[ref]; else ws[ref] = { t: 's', v };
      });
    }
    const bytes = new Uint8Array(XLSX.write(f.wb, { bookType: 'xlsx', type: 'array' }));
    return { bytes, ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      avisos: /\.xls$/i.test(datos.nombre) ? ['El archivo .xls se guardó como .xlsx para no perder filas.'] : [] };
  }

  function escribirSQLite(datos, cambios) {
    const f = datos.fuente, db = f.db, t = f.tabla.replace(/"/g, '""');
    db.exec('PRAGMA secure_delete = ON');                                // sobrescribe el contenido borrado
    db.exec('BEGIN');
    for (const [campo, vals] of cambios) {
      const st = db.prepare(`UPDATE "${t}" SET "${campo.replace(/"/g, '""')}" = ? WHERE rowid = ?`);
      vals.forEach((v, i) => { if (v !== undefined) st.run([v === '' ? null : v, f.rowids[i]]); });
      st.free();
    }
    db.exec('COMMIT');
    try { db.exec('VACUUM'); } catch (e) { /* sin VACUUM quedan páginas libres con datos antiguos */ }
    return { bytes: db.export(), ext: datos.nombre.toLowerCase().split('.').pop(), mime: 'application/octet-stream', avisos: [] };
  }

  function escribir(datos, cambios) {
    const t = datos.fuente.tipo;
    if (t === 'dbf') return escribirDBF(datos, cambios);
    if (t === 'texto') return escribirTexto(datos, cambios);
    if (t === 'excel') return escribirExcel(datos, cambios);
    if (t === 'sqlite') return escribirSQLite(datos, cambios);
    throw new Error('Formato de salida no soportado.');
  }

  return { VERSION, claveGuardada, crearClave, importarClave, borrarClave, huella, detectar, transformar, verificarResiduos, escribir, sha256Hex };
})();
