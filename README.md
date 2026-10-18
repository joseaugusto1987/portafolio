# Portafolio HIPERNOVA con editor admin + Google Sheets

Prueba de concepto. El sitio es tu `portafolio.html` (mismo diseño, mismas rutas) más un editor oculto estilo Substack. El contenido vive en un Google Sheet.

```
 Visitante ──GET──▶  Apps Script (Web app)  ──lee──▶  Google Sheet  (Projects · Principles · Experience · Pages · Config)
 Tú (admin) ─POST─▶  Apps Script  ──valida contraseña + token──▶  escribe en el Sheet
        ▲
   index.html (estático: GitHub Pages / Netlify / Cloudflare Pages / tu hosting)
```

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | El sitio + admin, un solo archivo. Ábrelo ya: funciona en **modo demo** (guarda en tu navegador). |
| `database/hipernova-portafolio-db.xlsx` | Los 47 casos actuales + textos de Home/Approach/About/Thinking, listos para importar como Google Sheet. |
| `apps-script/Code.gs` | API que conecta el sitio con el Sheet y protege la escritura con contraseña. |
| `build.py`, `src/`, `source/` | Para regenerar `index.html` desde tu HTML original si cambias el diseño. |

## Probarlo ahora (modo demo)

Abre `index.html` → haz clic **5 veces en el logo** → contraseña `hipernova`. Edita un caso, **Save**, y navega el sitio. (Si lo abres como archivo, usa mejor un servidor local: `python3 -m http.server`.)

## Conectarlo a Google Sheets (≈10 min)

1. **Sheet.** En Google Drive: *Nuevo → Subir archivo* → `hipernova-portafolio-db.xlsx` → ábrelo → *Archivo → Guardar como hoja de cálculo de Google*.
2. **Apps Script.** En ese Sheet: *Extensiones → Apps Script*. Borra lo que haya, pega `apps-script/Code.gs`, guarda.
3. **Contraseña.** En Apps Script: ⚙ *Configuración del proyecto → Propiedades de la secuencia de comandos → Añadir* `ADMIN_PASSWORD` = la contraseña que quieras.
4. **Publicar.** *Implementar → Nueva implementación → Aplicación web* · Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier persona** → autoriza los permisos → copia la URL que termina en `/exec`.
5. **Conectar.** En `index.html` busca `window.HN_CONFIG` y pega la URL en `API_URL`. Sube `index.html` a tu hosting.

Cada vez que cambies `Code.gs`: *Implementar → Gestionar implementaciones → editar → Nueva versión* (la URL se mantiene).

## Cómo se usa el editor

- **Entrar:** 5 clics seguidos en el logo → contraseña. La sesión dura 6 h; queda un botón “Admin” abajo a la derecha.
- **Cases:** lista con ordenar (▲▼), destacar en Home (★), publicar/borrador, duplicar, borrar, ver en el sitio.
- **Editor de caso:** título y subtítulo grandes; barra con estilos predeterminados (Section, Subhead, Text, Quote, listas, negrita, cursiva, link, imagen, video). También: selecciona texto para el menú flotante, **+** en una línea vacía, y atajos `##` `###` `-` `1.` `>` + espacio.
- **Imágenes:** pega el enlace de Drive (*Compartir → Cualquier persona con el enlace*) o cualquier URL; se convierte solo. Videos: YouTube, Vimeo o Drive.
- **Site texts:** textos de Home, Approach (principios), About, Thinking y datos de contacto. Si llenas `email`, aparece el botón “Write to me”.
- **Save to Sheets** (o ⌘/Ctrl+S) escribe todo en el Sheet. También puedes editar el Sheet a mano: la columna `order` manda el orden, `status` = `draft` oculta un caso.

## Límites conocidos de la PoC

- **Seguridad:** los 5 clics solo esconden la puerta; la protección real es la contraseña validada en Apps Script (nunca está en el HTML). Apps Script tiene cuotas diarias; suficiente para un portafolio.
- **Guardado = sobrescribe todo.** Antes de cada guardado se deja una copia JSON en una pestaña oculta `Backup`; además el Sheet tiene historial de versiones nativo.
- **Una celda de Sheets admite 50 000 caracteres:** el caso más largo hoy usa ~9 000.
- **Carga:** el sitio pinta primero con caché local y luego refresca desde el Sheet (1–2 s). Para producción conviene que cada guardado también publique un `data.json` estático.
- **SEO/compartir:** el sitio usa rutas con `#`, igual que el original; los enlaces no tienen vista previa por caso.
- Las imágenes de Drive pueden limitarse si reciben mucho tráfico; para producción, un CDN o hosting de imágenes es más estable.
- Probado en navegador (modo demo, editor, guardado, borradores). **La conexión real con Apps Script no se pudo probar desde aquí**: requiere tu cuenta de Google.
