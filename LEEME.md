# GERMEN · Calidad WHONET (PWA)

Aplicación web instalable para que las instituciones de la red verifiquen la calidad de su archivo WHONET y lo seudonimicen antes de enviarlo al ente territorial. Todo el procesamiento ocurre en el navegador: ningún archivo se sube a un servidor, y después de la primera visita funciona sin internet.

## Publicación

Una PWA solo se puede instalar si se sirve por HTTPS (o desde `localhost`). Si se abre el `index.html` con doble clic funciona, pero no se instala ni queda disponible sin conexión.

La opción más simple es GitHub Pages:

1. Crear un repositorio y subir el contenido de esta carpeta, **sin la carpeta `pruebas/`**.
2. En *Settings → Pages*, publicar la rama principal.
3. Compartir el enlace `https://<usuario>.github.io/<repositorio>/`. En Chrome o Edge aparece el botón «Instalar app».

También sirve cualquier servidor web institucional con HTTPS: se copian los archivos tal cual, sin compilar nada.

Prueba local: `py -m http.server 8765` en esta carpeta y abrir `http://localhost:8765`.

## Actualizaciones

Al cambiar cualquier archivo, suba la versión en `sw.js` (`CACHE = 'germen-whonet-vX.Y.Z'`) y en `js/app.js` (`APP_VERSION`). Así los equipos que ya instalaron la app descargan la nueva versión.

## Estructura

| Archivo | Función |
|---|---|
| `js/lectores.js` | Lee SQLite (WHONET 2022+), DBF/SIR, CSV/TXT/TSV y XLSX/XLS, incluida la cabecera en una sola celda separada por «\|». |
| `js/calidad.js` | Criterio 0 (integridad del archivo) y criterios 1–12 de la herramienta original de diagnóstico. |
| `js/anonimizar.js` | Clave institucional, detección de columnas sensibles, seudonimización HMAC-SHA-256, limpieza de texto libre, verificación de residuos y escritura en el formato original. |
| `js/app.js` | Interfaz, instalación y service worker. |
| `vendor/` | SheetJS 0.18.5 y sql.js 1.10.3, incluidos para funcionar sin conexión. |
| `pruebas/` | Generador de archivos sintéticos y prueba de extremo a extremo (`node pruebas/prueba_node.js`). No publicar. |

## Seudonimización

- El documento de identidad se normaliza (mayúsculas, solo letras y números) y se reemplaza por `G` + 11 caracteres de HMAC-SHA-256(clave, documento). El mismo documento produce el mismo código en todos los envíos de la institución, así que se conserva la regla de primer aislamiento por paciente. Sin la clave, el código no se puede revertir, ni siquiera por fuerza bruta sobre los números de cédula.
- Cada institución crea su clave **una vez** y la respalda. La clave no se envía nunca; la constancia incluye su huella (8 caracteres) para comprobar que todos los envíos usan la misma.
- Los nombres, los apellidos y los datos de contacto se vacían. En los comentarios, los nombres del propio archivo se reemplazan por `***` y los documentos por su código.
- Después de escribir el archivo, la aplicación busca en todas las columnas cualquier documento o nombre completo del original y lo informa antes de la descarga.
