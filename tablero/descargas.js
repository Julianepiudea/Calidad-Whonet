/* descargas.js — Observatorio GERMEN · descarga de cada tarjeta como imagen (PNG) o datos (CSV).
   Agrega una barra «Descargar» al pie de toda tarjeta que tenga un gráfico o una tabla.
   PNG: la tarjeta tal como se ve (título, gráfico, leyenda y notas) a alta resolución, con
   los filtros activos y la fuente al pie. CSV: separado por «;» con BOM, para que Excel en
   español lo abra con tildes y comas decimales. Todo ocurre en el navegador. */
'use strict';
(function () {
  const PAN = {s: 'susceptibilidad', d: 'distribucion', t: 'tendencias', c: 'comparar', i: 'mi-institucion', k: 'carbapenemasas', w: 'tratamiento-empirico', q: 'calidad'};
  const hoy = new Date(), FECHA = hoy.toLocaleDateString('es-CO'), ISO = hoy.toISOString().slice(0, 10);
  const FUENTE = `Fuente: Observatorio GERMEN, red GERMEN (WHONET 2016–2025), interpretación CLSI 2025. Datos agregados y anonimizados. Descargado el ${FECHA}.`;
  const limpia = s => (s || '').replace(/\s+/g, ' ').trim();
  const slug = s => limpia(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ---- metadatos de la tarjeta ---------------------------------------------------------
  const panelDe = card => { const p = card.closest('.pan'); return p ? p.id.slice(4) : ''; };
  const titulo = card => limpia((card.querySelector('h2') || card.querySelector('.kick') || {}).textContent) || 'grafico';
  function contexto(card) {
    const p = card.closest('.pan'); if (!p) return '';
    return [...p.querySelectorAll('.frow .f')].map(f => {
      const l = f.querySelector('label'), s = f.querySelector('select'), b = f.querySelector('.seg button.on');
      const v = s ? (s.options[s.selectedIndex] || {}).text : b ? b.textContent : '';
      return l && v && !v.startsWith('—') ? `${limpia(l.textContent)}: ${limpia(v)}` : '';
    }).filter(Boolean).join(' · ');
  }
  const nombre = (card, ext) => `GERMEN_${PAN[panelDe(card)] || 'red'}_${slug(titulo(card))}_${ISO}.${ext}`;
  function baja(nom, blob) {
    const a = document.createElement('a'); a.download = nom; a.href = URL.createObjectURL(blob);
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---- CSV -------------------------------------------------------------------------------
  const campo = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = filas => filas.map(r => r.map(campo).join(';')).join('\r\n');
  const num = x => x == null || isNaN(x) ? '' : Number(x).toLocaleString('es-CO', {maximumFractionDigits: 2, useGrouping: false});
  function textoCelda(td) {
    const ch = td.querySelector('.chip'), mu = td.querySelector('span.mu');
    if (ch && mu) return `${limpia(ch.textContent)} (n=${limpia(mu.textContent)})`;
    const c = td.cloneNode(true); c.querySelectorAll('br').forEach(b => b.replaceWith(' '));
    return limpia(c.textContent);
  }
  function filasTabla(t) {
    const m = [...t.rows].filter(tr => !tr.querySelector('.vacio')).map(tr => [...tr.cells].map(textoCelda));
    const nc = Math.max(0, ...m.map(r => r.length)), vivas = [...Array(nc).keys()].filter(j => m.some(r => r[j]));
    return m.map(r => vivas.map(j => r[j] || ''));
  }
  // Chart.js: series con etiquetas (barras, lineas) en formato ancho; dispersion en formato largo
  function filasChart(ch) {
    const ds = ch.data.datasets, ejes = ch.options.scales || {}, tx = (ejes.x && ejes.x.title && ejes.x.title.text) || '', ty = (ejes.y && ejes.y.title && ejes.y.title.text) || '';
    const real = i => { for (let j = i - 1; j >= 0; j--) if (!String(ds[j].label || '_').startsWith('_')) return ds[j].label;
      for (let j = i + 1; j < ds.length; j++) if (!String(ds[j].label || '_').startsWith('_')) return ds[j].label; return ''; };
    const nom = (d, i) => d.label === '_li' ? `${real(i)} · IC 95 % inferior` : d.label === '_ls' ? `${real(i)} · IC 95 % superior` : d.label || (ch.options.indexAxis === 'y' ? tx : ty) || 'Valor';
    if (ch.config.type === 'scatter') {
      const pts = ds.filter(d => d.type !== 'line' && !String(d.label || '').startsWith('_'));
      return [['Serie', 'Etiqueta', tx || 'x', ty || 'y'], ...pts.flatMap(d => d.data.map(p => [d.label || '', p.l != null ? 'Institución ' + p.l : '', num(p.x), num(p.y)]))];
    }
    const usa = ds.map((d, i) => [d, i]).filter(([d]) => !(d.label === '_l'));
    return [[ch.options.indexAxis === 'y' ? (ty || 'Categoría') : (tx || 'Categoría'), ...usa.map(([d, i]) => nom(d, i))],
      ...(ch.data.labels || []).map((l, k) => [Array.isArray(l) ? l.join(' ') : l, ...usa.map(([d]) => num(d.data[k]))])];
  }
  function datosCard(card) {
    const bloques = [], tablas = card.querySelectorAll('table'), svgs = card.querySelectorAll('[data-csv]'), cvs = card.querySelectorAll('canvas');
    if (tablas.length) tablas.forEach(t => bloques.push(['', filasTabla(t)]));
    else if (svgs.length) svgs.forEach(s => { try { bloques.push([s.dataset.csvTit || '', JSON.parse(decodeURIComponent(s.dataset.csv))]); } catch (e) {} });
    else cvs.forEach(c => { const ch = window.Chart && Chart.getChart(c); if (!ch) return;
      const t = cvs.length > 1 && c.parentElement.previousElementSibling ? limpia(c.parentElement.previousElementSibling.textContent) : '';
      bloques.push([t, filasChart(ch)]); });
    return bloques.filter(([, f]) => f.length > 1);
  }
  function bajaCSV(card) {
    const b = datosCard(card); if (!b.length) return aviso(card, 'Esta tarjeta no tiene datos para descargar.');
    const cab = [[`GERMEN · ${titulo(card)}`], ...(contexto(card) ? [[contexto(card)]] : []), [FUENTE], []];
    const cuerpo = b.flatMap(([t, f], i) => [...(i ? [[]] : []), ...(t ? [[t]] : []), ...f]);
    baja(nombre(card, 'csv'), new Blob(['﻿' + csv([...cab, ...cuerpo])], {type: 'text/csv;charset=utf-8'}));
  }

  // ---- PNG -------------------------------------------------------------------------------
  let fuentes = null; // CSS de fuentes incrustado una sola vez
  async function bajaPNG(card, btn) {
    if (!window.htmlToImage) return aviso(card, 'No se pudo cargar el generador de imágenes.');
    btn.disabled = true; const txt = btn.innerHTML; btn.textContent = 'Generando…';
    card.classList.add('dl-captura');
    const ctx = contexto(card), top = document.createElement('div'), pie = document.createElement('div');
    top.className = 'dl-ctx'; top.textContent = ctx; pie.className = 'dl-pie';
    pie.innerHTML = `<img src="../icons/logo_germen.png" alt=""><span>${FUENTE}</span>`;
    if (ctx) card.prepend(top); card.appendChild(pie);
    // graficos Chart.js a 3x para que no se vean borrosos en el informe
    const chs = [...card.querySelectorAll('canvas')].map(c => window.Chart && Chart.getChart(c)).filter(Boolean);
    chs.forEach(ch => { ch.options.devicePixelRatio = 3; ch.options.animation = false; ch.resize(); ch.update('none'); });
    try {
      if (fuentes == null) fuentes = await htmlToImage.getFontEmbedCSS(document.body).catch(() => '');
      await new Promise(r => setTimeout(r, 60));
      const blob = await htmlToImage.toBlob(card, {pixelRatio: 2.5, backgroundColor: cssv('--sup') || '#fff', fontEmbedCSS: fuentes || undefined, skipFonts: !fuentes,
        filter: n => !(n.classList && (n.classList.contains('dl-bar') || n.classList.contains('seg'))), style: {margin: '0', boxShadow: 'none'}});
      baja(nombre(card, 'png'), blob);
    } catch (e) { console.error(e); aviso(card, 'No se pudo generar la imagen en este navegador.'); }
    finally {
      top.remove(); pie.remove(); card.classList.remove('dl-captura');
      chs.forEach(ch => { ch.options.devicePixelRatio = undefined; ch.options.animation = undefined; ch.resize(); ch.update('none'); });
      btn.disabled = false; btn.innerHTML = txt;
    }
  }
  function aviso(card, m) { const b = card.querySelector('.dl-bar .dl-msg'); if (b) { b.textContent = m; setTimeout(() => b.textContent = '', 4000); } }

  // ---- barra en cada tarjeta ---------------------------------------------------------------
  const ICO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/></svg>';
  function equipa() {
    document.querySelectorAll('main .tarjeta:not(.vacio)').forEach(card => {
      if (card.querySelector(':scope > .dl-bar') || !card.querySelector('canvas, .viz svg, table')) return;
      const bar = document.createElement('div'); bar.className = 'dl-bar';
      bar.innerHTML = `<span class="dl-msg" role="status"></span><span class="dl-lab">Descargar</span>
        <button type="button" data-f="png" title="Imagen PNG de alta resolución, lista para informes y presentaciones">${ICO}Imagen</button>
        <button type="button" data-f="csv" title="Datos en CSV (se abre en Excel)">${ICO}Datos</button>`;
      bar.onclick = e => { const b = e.target.closest('button'); if (!b) return; b.dataset.f === 'png' ? bajaPNG(card, b) : bajaCSV(card); };
      card.appendChild(bar);
    });
  }
  let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; equipa(); }); })
    .observe(document.querySelector('main'), {childList: true, subtree: true});
  equipa();
})();
