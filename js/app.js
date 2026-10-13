/* app.js — Interfaz de GERMEN · Calidad WHONET (PWA). */
'use strict';

const APP_VERSION = '1.1.0';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString('es-CO');

const S = {
  vista: 'calidad', archivo: null, datos: null, res: null, tab: 'resumen', error: null, cargando: false,
  clave: Anonimizar.claveGuardada(), huella: '', plan: null, prog: 0, salida: null, seudError: null, forzar: false,
};

/* ---------- Pasos ---------- */
function pintarPasos() {
  const hecho1 = !!S.res, hecho2 = !!S.salida;
  const p = (id, n, t, extra = '') => `<button class="paso ${S.vista === id ? 'act' : ''} ${extra}" data-v="${id}" type="button"><span class="num">${n}</span>${t}</button>`;
  $('#pasos').innerHTML =
    p('calidad', hecho1 ? '✓' : '1', 'Verificar calidad', hecho1 ? 'hecho' : '') +
    p('seud', hecho2 ? '✓' : '2', 'Seudonimizar y preparar envío', hecho2 ? 'hecho' : '') +
    p('clave', '🔑', 'Clave institucional', 'sec') + p('ayuda', '?', 'Cómo funciona', 'sec');
  document.querySelectorAll('.paso').forEach(b => b.onclick = () => { S.vista = b.dataset.v; render(); });
}

function render() {
  pintarPasos();
  const v = { calidad: vCalidad, seud: vSeud, clave: vClave, ayuda: vAyuda }[S.vista];
  $('#app').innerHTML = v() + `<p class="pie">GERMEN · Calidad WHONET v${APP_VERSION} · Los archivos no salen de este equipo.</p>`;
  enlazar();
}

/* ---------- Carga de archivo ---------- */
const SVG_ESCUDO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
function vCarga(titulo, texto) {
  return `<div class="drop" id="dz" role="button" tabindex="0" aria-label="Seleccionar archivo WHONET">
      <img class="ico" src="icons/favicon-64.png" alt="">
      <h2>${titulo}</h2><p>${texto}</p>
      <div class="fmts"><span class="fmt">SQLite (WHONET 2022+)</span><span class="fmt">DBF / SIR</span><span class="fmt">CSV · TXT · TSV</span><span class="fmt">XLSX · XLS</span></div>
    </div>
    <div class="garantia">${SVG_ESCUDO}<div><b>El archivo no se sube a ningún servidor.</b> La lectura, la verificación y la seudonimización se hacen en este navegador; la aplicación funciona incluso sin internet.</div></div>
    ${S.cargando ? '<div class="alerta in">Leyendo el archivo…</div>' : ''}
    ${S.error ? `<div class="alerta er">${esc(S.error)}</div>` : ''}`;
}

async function cargar(archivo) {
  S.error = null; S.cargando = true; S.archivo = archivo; S.res = null; S.salida = null; S.plan = null; S.forzar = false; render();
  try {
    S.datos = await Lectores.leer(archivo);
    if (!S.datos.registros.length) throw new Error('No se encontraron registros en el archivo.');
    S.res = Calidad.analizar(S.datos);
    S.plan = Anonimizar.detectar(S.datos.campos);
    S.tab = 'resumen';
  } catch (e) { S.error = 'No fue posible leer el archivo: ' + e.message; S.datos = null; S.archivo = null; }
  S.cargando = false; render();
}

/* ---------- Paso 1: calidad ---------- */
function vCalidad() {
  if (!S.res) return vCarga('Arrastre aquí el archivo WHONET del mes', 'o haga clic para seleccionarlo. Se revisan 13 grupos de criterios antes del envío.');
  const d = S.res, r = d.resumen;
  const cc = r.conclusion === 'NO_CUMPLE' ? 'er' : r.conclusion === 'NOVEDADES' ? 'wn' : 'ok';
  const ci = r.conclusion === 'NO_CUMPLE' ? '✗' : r.conclusion === 'NOVEDADES' ? '!' : '✓';
  const tab = (id, t, n, cls) => `<button class="tab ${S.tab === id ? 'act' : ''}" data-t="${id}" type="button">${t}${n ? `<span class="cnt ${cls}">${n}</span>` : ''}</button>`;
  return `<div class="tarjeta fbar">
      <div><div class="nm">${esc(S.archivo.name)}</div>
      <div class="mt">${esc(d.formato)} · ${num(d.total)} registros · UPGD ${esc(d.upgd)}${d.periodo ? ' · ' + esc(d.periodo) : ''}</div></div>
      <div class="acc"><button class="btn peq" id="btnImp" type="button">Imprimir informe</button><button class="btn peq" id="btnNuevo" type="button">Otro archivo</button>
      <button class="btn peq prim" id="btnSeguir" type="button">Continuar a seudonimizar →</button></div>
    </div>
    <div class="solo-print"><h2>Informe de calidad WHONET · ${esc(S.archivo.name)}</h2><p class="sub">Generado el ${new Date().toLocaleString('es-CO')} con GERMEN · Calidad WHONET v${APP_VERSION}</p></div>
    <div class="stats">
      <div class="stat s-ok"><div class="stat-n">${r.ok}</div><div class="stat-l">Criterios que cumplen</div></div>
      <div class="stat s-wn"><div class="stat-n">${r.novedad}</div><div class="stat-l">Con novedad</div></div>
      <div class="stat s-er"><div class="stat-n">${r.error}</div><div class="stat-l">No cumplen</div></div>
      <div class="stat s-en"><div class="stat-n">${d.envio.length}</div><div class="stat-l">Aislamientos para envío</div></div>
      <div class="stat s-rv"><div class="stat-n">${d.revision.length}</div><div class="stat-l">CIM en zona límite</div></div>
    </div>
    <div class="concl ${cc}"><span class="ic">${ci}</span><div><b>Conclusión:</b> ${esc(r.texto)}</div></div>
    <div class="tabs no-print">${tab('resumen', 'Alertas críticas', r.error, 'er')}${tab('hallazgos', 'Todos los criterios')}${tab('envio', 'Envío LDSP/INS', d.envio.length, 'en')}${tab('revision', 'Para revisar', d.revision.length, 'rv')}</div>
    <div>${contenidoTab()}</div>`;
}
function tarjetaHallazgo(h) {
  const ic = { ok: '✓', warn: '!', error: '✗' }[h.nivel], et = { ok: 'Cumple', warn: 'Novedad', error: 'No cumple' }[h.nivel];
  return `<div class="fd ${h.nivel}"><div class="fd-ic">${ic}</div><div class="fd-bd"><div class="fd-t">${esc(h.criterio)}</div><div class="fd-d">${esc(h.detalle)}</div>
    ${h.ids.length ? `<div class="fd-ids">ID: ${h.ids.map(esc).join(' · ')}</div>` : ''}</div><span class="etq ${h.nivel}">${et}</span></div>`;
}
function contenidoTab() {
  const d = S.res;
  const todos = S.tab === 'hallazgos' || window.matchMedia('print').matches;
  if (S.tab === 'resumen') {
    const e = d.hallazgos.filter(h => h.nivel === 'error');
    return e.length ? e.map(tarjetaHallazgo).join('') : '<div class="vacio">Sin alertas críticas.</div>';
  }
  if (todos) { const gr = [...new Set(d.hallazgos.map(h => h.grupo))]; return gr.map(g => `<div class="grp">${esc(g)}</div>` + d.hallazgos.filter(h => h.grupo === g).map(tarjetaHallazgo).join('')).join(''); }
  if (S.tab === 'envio') {
    if (!d.envio.length) return '<div class="vacio">Ningún aislamiento cumple criterios de envío al LDSP/INS.</div>';
    return `<div class="alerta wn"><b>${d.envio.length}</b> aislamiento(s) con criterio de envío según los criterios del INS (noviembre de 2024). Todo envío pasa por el LDSP: «LDSP» = el LDSP confirma y remite al INS la muestra aleatoria mensual; «LDSP → INS» = el INS confirma todos. Las filas con ⚠ no cumplen algún requisito del INS (tipo de muestra, servicio, fecha o un aislamiento por paciente) y probablemente serán rechazadas.</div>
      <div class="tw"><table><thead><tr><th>ID</th><th>Nombre</th><th>Organismo</th><th>Muestra</th><th>Servicio</th><th>Fecha</th><th>Criterio</th><th>Prueba requerida</th><th>Destino</th></tr></thead><tbody>
      ${d.envio.map(s => `<tr><td><span class="mono">${esc(s.id)}</span></td><td>${esc(s.nombre) || '—'}</td><td><span class="mono">${esc(s.orgC)}</span><br><span class="nota">${esc(s.orgN)}</span></td><td><span class="mono">${esc(s.muestra) || '—'}</span></td><td>${esc(s.servicio) || '—'}</td><td>${esc(s.fecha) || '—'}</td><td>${esc(s.criterio)}${s.avisos.map(a => `<br><span class="nota aviso">⚠ ${esc(a)}</span>`).join('')}</td><td class="sub">${esc(s.prueba)}</td><td><span class="dst ${s.destino.includes('inmediato') ? 'urg' : s.destino.includes('INS') ? 'ins' : 'ldsp'}">${esc(s.destino)}</span></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (S.tab === 'revision') {
    if (!d.revision.length) return '<div class="vacio">Sin resultados que requieran revisión.</div>';
    return '<div class="alerta in">Resultados en zona límite o identificaciones que el microbiólogo debe revisar: según lo que confirme, pueden cumplir criterio de envío.</div>' +
      d.revision.map(v => `<div class="fd rv"><div class="fd-ic">?</div><div class="fd-bd"><div class="fd-t">${esc(v.criterio)}</div><div class="fd-d">${esc(v.detalle)}</div>${v.ids.length ? `<div class="fd-ids">ID: ${v.ids.map(esc).join(' · ')}</div>` : ''}</div><span class="etq rv">Revisar</span></div>`).join('');
  }
  return '';
}

/* ---------- Paso 2: seudonimización ---------- */
const ACCIONES = [['conservar', 'Conservar'], ['vaciar', 'Vaciar'], ['seudonimizar', 'Seudonimizar'], ['anio', 'Solo año'], ['barrido', 'Limpiar texto']];
function vSeud() {
  if (!S.datos) return vCarga('Seleccione el archivo WHONET que va a enviar', 'Si ya lo verificó en el paso 1, se usa ese mismo archivo. Se detectarán los campos con datos del paciente.');
  if (!S.clave) return `<div class="tarjeta"><h2>Primero, la clave institucional</h2>
      <p class="sub">Los documentos de identidad se reemplazan por un código que se calcula con una clave propia de su institución. Así, el mismo paciente recibe el mismo código mes a mes y nadie fuera de la institución puede revertirlo.</p>
      <div style="margin-top:12px"><button class="btn prim" data-ir="clave" type="button">Configurar la clave</button></div></div>`;
  if (S.salida) return vSalida();
  const r = S.res.resumen;
  const bloqueo = r.conclusion === 'NO_CUMPLE' && !S.forzar;
  const cols = S.plan;
  const opciones = S.datos.campos.filter(c => !cols.some(p => p.campo === c)).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  return `<div class="tarjeta fbar"><div><div class="nm">${esc(S.archivo.name)}</div><div class="mt">${num(S.datos.registros.length)} registros · Calidad: ${r.conclusion === 'CUMPLE' ? 'cumple' : r.conclusion === 'NOVEDADES' ? r.novedad + ' novedad(es)' : r.error + ' criterio(s) no cumple(n)'}</div></div>
      <div class="acc"><button class="btn peq" data-ir="calidad" type="button">Ver calidad</button><button class="btn peq" id="btnNuevo" type="button">Otro archivo</button></div></div>
    ${bloqueo ? `<div class="alerta er"><b>El archivo tiene ${r.error} criterio(s) de calidad que no cumple(n).</b> Lo recomendable es corregirlos en WHONET, volver a exportar y verificar de nuevo antes de seudonimizar. <button class="btn peq" id="btnForzar" type="button" style="margin-left:8px">Seudonimizar de todas formas</button></div>` : ''}
    <div class="tarjeta ${bloqueo ? 'oculto' : ''}">
      <h2>Campos con datos del paciente</h2>
      <p class="sub">Revise la acción de cada columna. Se detectaron automáticamente por su nombre; puede agregar otras.</p>
      <div class="tw" style="margin-top:12px"><table><thead><tr><th>Columna</th><th>Tipo de dato</th><th>Ejemplo en el archivo</th><th>Acción</th></tr></thead><tbody>
      ${cols.length ? cols.map((p, i) => `<tr><td><span class="mono">${esc(p.campo)}</span></td><td>${esc(p.motivo)}</td><td class="sub">${esc(ejemplo(p.campo))}</td><td><span class="chips">${ACCIONES.map(([a, t]) => `<button type="button" class="${p.accion === a ? 'on' : ''}" data-i="${i}" data-a="${a}">${t}</button>`).join('')}</span></td></tr>`).join('')
        : '<tr><td colspan="4" class="sub">No se detectaron columnas con datos personales. Si el archivo las tiene con otro nombre, agréguelas abajo.</td></tr>'}
      </tbody></table></div>
      <div class="fila" style="margin-top:10px"><label class="campo">Agregar otra columna<select id="selOtra"><option value="">Seleccione…</option>${opciones}</select></label><button class="btn peq" id="btnAgregar" type="button">Agregar</button></div>
      <h3>Qué hace cada acción</h3>
      <p class="nota"><b>Seudonimizar:</b> reemplaza el valor por un código de 12 caracteres (p. ej. G7K2QX9M4TRA), igual para el mismo documento en todos los envíos. <b>Vaciar:</b> deja la celda en blanco. <b>Solo año:</b> conserva el año de una fecha (AAAA0101). <b>Limpiar texto:</b> en campos de texto libre, reemplaza por *** los nombres y por su código los documentos del propio archivo.</p>
      <div class="fila" style="margin-top:14px"><button class="btn prim" id="btnSeud" type="button" ${S.prog > 0 && S.prog < 1 ? 'disabled' : ''}>Seudonimizar el archivo</button><span class="nota">Clave activa: <span class="huella" style="font-size:12px">${esc(S.huella)}</span></span></div>
      ${S.prog > 0 && S.prog < 1 ? `<div class="progreso"><div style="width:${Math.round(S.prog * 100)}%"></div></div>` : ''}
      ${S.seudError ? `<div class="alerta er">${esc(S.seudError)}</div>` : ''}
    </div>`;
}
function ejemplo(campo) {
  const v = S.datos.registros.find(r => r[campo])?.[campo] || '';
  if (!v) return '(vacío)';
  return v.length <= 2 ? v : v.slice(0, 2) + '•'.repeat(Math.min(6, v.length - 2));      // se enmascara en pantalla
}

async function seudonimizar() {
  S.seudError = null; S.prog = 0.01; render();
  try {
    const t0 = performance.now();
    // Se relee el archivo: los escritores de Excel y SQLite modifican la estructura en memoria,
    // y "Ajustar y repetir" debe partir siempre del original.
    S.datos = await Lectores.leer(S.archivo);
    const { cambios, stats } = await Anonimizar.transformar(S.datos, S.plan, S.clave, p => { S.prog = Math.max(0.01, p * 0.85); const b = document.querySelector('.progreso div'); if (b) b.style.width = Math.round(S.prog * 100) + '%'; });
    const residuos = Anonimizar.verificarResiduos(S.datos, S.plan, cambios, stats.barrido);
    const out = Anonimizar.escribir(S.datos, cambios);
    const base = S.archivo.name.replace(/\.[^.]+$/, '');
    const nombre = `${base}_seudonimizado.${out.ext}`;
    const hashSalida = await Anonimizar.sha256Hex(out.bytes);
    const hashEntrada = await Anonimizar.sha256Hex(await S.archivo.arrayBuffer());
    S.salida = { nombre, bytes: out.bytes, mime: out.mime, avisos: out.avisos, stats, residuos, hashSalida, hashEntrada, seg: ((performance.now() - t0) / 1000).toFixed(1), fecha: new Date() };
    S.prog = 1;
  } catch (e) { S.seudError = 'No fue posible seudonimizar: ' + e.message; S.prog = 0; }
  render();
}

function vSalida() {
  const o = S.salida, st = o.stats, r = S.res.resumen;
  const nIds = S.plan.filter(p => p.accion === 'seudonimizar').length, nVac = S.plan.filter(p => p.accion === 'vaciar').length;
  return `<div class="tarjeta">
      <h2>Paquete listo para enviar</h2>
      <p class="sub">Descargue los dos archivos y envíelos por el canal habitual al ente territorial.</p>
      ${o.residuos.length ? `<div class="alerta er"><b>Atención:</b> la verificación encontró posibles datos del paciente en ${o.residuos.map(x => `${esc(x.campo)} (${num(x.n)} celdas)`).join(', ')}. Agregue esas columnas en el paso anterior y vuelva a seudonimizar.</div>`
        : '<div class="alerta ok"><b>Verificación superada:</b> no quedan documentos de identidad ni nombres completos del archivo original en ninguna columna.</div>'}
      <div class="lista-ok">
        <div>✓ <span><b>${num(S.datos.registros.length)}</b> registros procesados en ${o.seg} s.</span></div>
        <div>✓ <span><b>${nIds}</b> columna(s) de identificación seudonimizada(s): <b>${num(st.seudonimos)}</b> pacientes distintos.</span></div>
        <div>✓ <span><b>${nVac}</b> columna(s) de nombres o contacto vaciada(s).</span></div>
        ${st.reemplazosTexto.nombres + st.reemplazosTexto.ids ? `<div>✓ <span>Texto libre: <b>${st.reemplazosTexto.nombres}</b> nombre(s) y <b>${st.reemplazosTexto.ids}</b> documento(s) reemplazados.</span></div>` : ''}
        <div>✓ <span>Calidad del archivo: <b>${r.conclusion === 'CUMPLE' ? 'cumple' : r.conclusion === 'NOVEDADES' ? 'con novedades' : 'no cumple'}</b>.</span></div>
      </div>
      ${o.avisos.map(a => `<div class="alerta wn">${esc(a)}</div>`).join('')}
      <div class="fila" style="margin-top:12px">
        <button class="btn prim" id="btnDescArch" type="button">Descargar archivo seudonimizado</button>
        <button class="btn" id="btnDescConst" type="button">Descargar constancia</button>
        <button class="btn" id="btnVolver" type="button">Ajustar y repetir</button>
      </div>
      <p class="nota" style="margin-top:10px">Archivo: <span class="mono">${esc(o.nombre)}</span> · Huella de la clave: <span class="mono">${esc(S.huella)}</span> · SHA-256: <span class="mono">${o.hashSalida.slice(0, 16)}…</span></p>
    </div>
    <div class="tarjeta"><h3 style="margin-top:0">Qué enviar y qué no</h3>
      <p class="sub">Envíe el archivo seudonimizado y la constancia. <b>Nunca envíe la clave institucional</b>: sin ella, el ente territorial no puede revertir los códigos, y ese es precisamente el objetivo. El archivo original con nombres y documentos se queda en la institución.</p></div>`;
}

function constancia() {
  const o = S.salida, d = S.res;
  const lineas = [
    'CONSTANCIA DE SEUDONIMIZACIÓN — GERMEN · Calidad WHONET',
    '='.repeat(58),
    `Fecha y hora:           ${o.fecha.toLocaleString('es-CO')}`,
    `Versión:                ${APP_VERSION} (${Anonimizar.VERSION})`,
    `Institución (clave):    ${S.clave.institucion || '(sin nombre)'}`,
    `Huella de la clave:     ${S.huella}`,
    '',
    `Archivo original:       ${S.archivo.name}`,
    `SHA-256 original:       ${o.hashEntrada}`,
    `Archivo enviado:        ${o.nombre}`,
    `SHA-256 enviado:        ${o.hashSalida}`,
    `Registros:              ${S.datos.registros.length}`,
    `UPGD:                   ${d.upgd}`,
    `Periodo de muestras:    ${d.periodo || '—'}`,
    '',
    'COLUMNAS TRATADAS',
    ...S.plan.map(p => `  ${p.campo.padEnd(24)} ${({ conservar: 'conservada', vaciar: 'vaciada', seudonimizar: 'seudonimizada (HMAC-SHA-256)', anio: 'reducida al año', barrido: 'texto libre limpiado' })[p.accion]}`),
    '',
    `Pacientes distintos:    ${o.stats.seudonimos}`,
    `Texto libre:            ${o.stats.reemplazosTexto.nombres} nombre(s), ${o.stats.reemplazosTexto.ids} documento(s) reemplazados`,
    `Verificación residual:  ${o.residuos.length ? 'CON HALLAZGOS en ' + o.residuos.map(x => x.campo + ' (' + x.n + ')').join(', ') : 'sin datos del paciente en el archivo enviado'}`,
    '',
    'CALIDAD DEL ARCHIVO',
    `Conclusión:             ${d.resumen.conclusion} — ${d.resumen.texto}`,
    `Criterios:              ${d.resumen.ok} cumplen · ${d.resumen.novedad} con novedad · ${d.resumen.error} no cumplen`,
    `Aislamientos para envío LDSP/INS: ${d.envio.length}`,
    ...d.hallazgos.filter(h => h.nivel !== 'ok').map(h => `  [${h.nivel === 'error' ? 'NO CUMPLE' : 'NOVEDAD'}] ${h.grupo} · ${h.criterio}: ${h.detalle}`),
    '',
    'El mismo documento produce siempre el mismo código con la misma clave. La clave no se envía;',
    'la huella permite al ente territorial verificar que todos los envíos de la institución usan la misma clave.',
  ];
  return lineas.join('\r\n');
}

/* ---------- Clave ---------- */
function vClave() {
  const c = S.clave;
  return `<div class="tarjeta"><h2>Clave institucional de seudonimización</h2>
    <p class="sub">La clave convierte cada documento de identidad en un código fijo. Debe ser <b>la misma</b> en todos los equipos y meses de su institución, y <b>no se comparte</b> con el ente territorial.</p>
    ${c ? `<div class="clave" style="margin-top:14px"><div><div class="nota">Huella (se incluye en cada constancia)</div><span class="huella">${esc(S.huella)}</span></div>
        <div><div class="nota">Institución</div><b>${esc(c.institucion || '—')}</b></div><div><div class="nota">Creada</div>${esc(new Date(c.creada).toLocaleDateString('es-CO'))}</div></div>
      <div class="fila" style="margin-top:14px"><button class="btn prim" id="btnRespaldo" type="button">Descargar respaldo de la clave</button><button class="btn" id="btnImportar" type="button">Importar otra clave</button><button class="btn" id="btnBorrar" type="button">Quitar de este equipo</button></div>
      <div class="alerta wn">Guarde el respaldo en un lugar seguro de la institución. Si se pierde la clave, los códigos de los envíos siguientes no coincidirán con los anteriores.</div>
      <div id="confBorrar"></div>`
    : `<div class="fila" style="margin-top:14px"><label class="campo">Sigla de la institución<input id="inSigla" maxlength="12" placeholder="p. ej. HSV" autocomplete="off"></label><button class="btn prim" id="btnCrear" type="button">Crear clave nueva</button><button class="btn" id="btnImportar" type="button">Importar clave existente</button></div>
      <p class="nota" style="margin-top:10px">Cree la clave <b>una sola vez</b> por institución. En los demás equipos, importe el respaldo en lugar de crear una nueva.</p>`}
    </div>`;
}

/* ---------- Ayuda ---------- */
function vAyuda() {
  return `<div class="tarjeta ayuda"><h2>Cómo funciona</h2>
    <h3>1. Verificar calidad</h3><p>La aplicación revisa el archivo WHONET contra 13 grupos de criterios: integridad del archivo (truncamiento por el límite de filas de Excel, columnas sin nombre, filas duplicadas), fechas, variables, UPGD, demografía, localización, muestras, organismos, antibióticos, alertas de resistencia con criterio de envío al LDSP/INS y coherencia de los antibiogramas. Corrija en WHONET lo que no cumple y vuelva a verificar.</p>
    <h3>2. Seudonimizar</h3><p>Los nombres, apellidos y datos de contacto se borran. El documento de identidad se reemplaza por un código calculado con HMAC-SHA-256 y la clave de la institución: el mismo paciente tiene siempre el mismo código, lo que permite contar el primer aislamiento por paciente, pero el código no se puede revertir sin la clave. Los comentarios se limpian de nombres y documentos del propio archivo. Al final, la aplicación busca en el archivo de salida cualquier rastro de los datos originales.</p>
    <h3>3. Enviar</h3><p>Se envían el archivo seudonimizado, en el mismo formato del original (los .xls se guardan como .xlsx para no perder filas), y la constancia, que registra las columnas tratadas, la huella de la clave, el resultado de calidad y la huella SHA-256 de ambos archivos.</p>
    <h3>Privacidad</h3><p>Nada se sube a internet: la aplicación descarga su propio código una vez y luego funciona sin conexión. Los archivos se leen en la memoria del navegador y se descartan al cerrar la página. La clave se guarda en este navegador; use el respaldo para llevarla a otro equipo.</p>
    <h3>Alcance</h3><p>La seudonimización reduce el riesgo, pero el archivo sigue siendo información de salud: fechas, edad, sexo e institución pueden combinarse. Compártalo solo por los canales institucionales.</p></div>`;
}

/* ---------- Eventos ---------- */
function descargar(nombre, bytes, mime) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function nuevo() { Object.assign(S, { archivo: null, datos: null, res: null, salida: null, plan: null, error: null, prog: 0, forzar: false }); render(); }

function enlazar() {
  const dz = $('#dz'), fi = $('#fi');
  if (dz) {
    dz.onclick = () => fi.click(); dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } };
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); }; dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) cargar(f); };
  }
  fi.onchange = e => { const f = e.target.files[0]; if (f) cargar(f); fi.value = ''; };
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.tab = b.dataset.t; render(); });
  document.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { S.vista = b.dataset.ir; render(); });
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('#btnNuevo', nuevo);
  on('#btnImp', () => { const t = S.tab; S.tab = 'hallazgos'; render(); setTimeout(() => { window.print(); S.tab = t; render(); }, 50); });
  on('#btnSeguir', () => { S.vista = 'seud'; render(); });
  on('#btnForzar', () => { S.forzar = true; render(); });
  on('#btnSeud', seudonimizar);
  on('#btnVolver', () => { S.salida = null; S.prog = 0; render(); });
  on('#btnDescArch', () => descargar(S.salida.nombre, S.salida.bytes, S.salida.mime));
  on('#btnDescConst', () => descargar(S.salida.nombre.replace(/\.[^.]+$/, '') + '_constancia.txt', new TextEncoder().encode('﻿' + constancia()), 'text/plain'));
  on('#btnAgregar', () => { const c = $('#selOtra').value; if (c) { S.plan.push({ campo: c, accion: 'vaciar', motivo: 'Agregada manualmente' }); render(); } });
  document.querySelectorAll('.chips button').forEach(b => b.onclick = () => { S.plan[+b.dataset.i].accion = b.dataset.a; render(); });
  on('#btnCrear', async () => { S.clave = await Anonimizar.crearClave($('#inSigla').value); S.huella = await Anonimizar.huella(S.clave); render(); });
  on('#btnImportar', () => $('#fiClave').click());
  on('#btnRespaldo', () => descargar(`clave_germen_${(S.clave.institucion || 'institucion').toLowerCase()}_${S.huella}.json`, new TextEncoder().encode(JSON.stringify(S.clave, null, 2)), 'application/json'));
  on('#btnBorrar', () => {
    $('#confBorrar').innerHTML = '<div class="alerta er">¿Quitar la clave de este equipo? Si no tiene respaldo, los códigos futuros no coincidirán con los anteriores. <button class="btn peq" id="btnBorrarSi" type="button">Sí, quitarla</button></div>';
    on('#btnBorrarSi', () => { Anonimizar.borrarClave(); S.clave = null; S.huella = ''; render(); });
  });
}
$('#fiClave').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { S.clave = Anonimizar.importarClave(await f.text()); S.huella = await Anonimizar.huella(S.clave); S.vista = 'clave'; render(); }
  catch (err) { S.vista = 'clave'; render(); $('#app').insertAdjacentHTML('afterbegin', `<div class="alerta er">${esc(err.message)}</div>`); }
};

/* ---------- PWA: instalación, conexión y service worker ---------- */
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; $('#btnInstalar').classList.remove('oculto'); });
$('#btnInstalar').onclick = async () => { if (!eventoInstalar) return; eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; $('#btnInstalar').classList.add('oculto'); };
function estadoRed() { const on = navigator.onLine; $('#estadoRed').classList.toggle('off', !on); $('#estadoTxt').textContent = on ? 'Procesamiento local' : 'Sin conexión · funciona igual'; }
window.addEventListener('online', estadoRed); window.addEventListener('offline', estadoRed); estadoRed();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

(async () => { if (S.clave) S.huella = await Anonimizar.huella(S.clave); render(); })();
