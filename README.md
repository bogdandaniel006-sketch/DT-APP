# Lámina — mesa de dibujo técnico

Abre un PDF de ejercicios y construye encima con regla, compás, escuadra y cartabón digitales.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de producción en dist/
```

## Herramientas

| Tecla | Herramienta | Uso |
|---|---|---|
| V | Seleccionar | clic, Shift+clic, arrastrar en vacío para seleccionar varios; arrastrar para mover (también a otra hoja); tiradores para extremos de segmentos, radio de circunferencias e inicio/final/radio de arcos |
| . | Punto | clic: punto con nombre automático (A, B, C… o la letra impresa junto al punto en el PDF). Clic sobre un punto: renombrarlo (A', O', P1…) |
| L | Línea | clic → clic (o arrastrar). Dos clics en el mismo sitio crean un punto. Shift bloquea en pasos de 15° |
| P | Perpendicular | recta → punto |
| R | Paralela | recta → punto |
| C | Compás | centro → radio. «Tomar medida» copia una distancia AB como radio fijo |
| A | Arco | centro → inicio → gira hasta el final |
| E / T | Escuadra / Cartabón | mover, girar (⟳), escalar (⤡), voltear (F) y trazar arrastrando sobre un borde. Al acercarlo al otro instrumento o a una línea se **apoya** y **desliza** por ella; al girar se alinea con ellas. Alt: mover libremente |
| M | Medir | distancia A→B (`AB = 42,35 mm`) y, pulsando M otra vez, ángulo A→B→C (`∠ABC = 37,5°`) |
| Supr | Borrar | borra la selección, o activa el borrador |

## Precisión

- **Detección del PDF**: al abrirlo se analiza cada página una vez (puntos marcados con cruz o punto, extremos, líneas, circunferencias, arcos, intersecciones y las letras de los puntos). En PDF vectoriales se leen las coordenadas exactas del documento; en PDF escaneados se detectan líneas y circunferencias sobre la imagen. El PDF original no se modifica.
- **Enganche** (imán de la barra superior): *Preciso*, *Normal* o *Libre*. Prioridad: punto, intersección, extremo, centro, punto medio, línea, circunferencia. El indicador dice qué se ha enganchado («Intersección · PDF», «A»…).
- **Nombrar puntos del PDF**: con Seleccionar, clic sobre un punto o intersección detectados → «Nombrar punto».
- **Lupa** (Z): lupa ×4 que sigue al cursor.
- **Capas**: Auxiliares y Medidas se pueden ocultar sin borrarlas.

Todas las páginas del PDF están sobre la mesa, una debajo de otra; los instrumentos pueden usarse en cualquiera.

Ctrl+Z / Ctrl+Shift+Z deshacer/rehacer · rueda para desplazar la hoja (Shift: de lado) · Ctrl + rueda o pellizco para zoom · Espacio o botón central + arrastrar para mover ·
Z lupa · Ctrl+0 ajustar página · Ctrl+1 100 % · RePág/AvPág ir a la hoja anterior/siguiente · Esc cancelar.

## Arquitectura

```
src/
  geometry/   motor geométrico puro (distancias, intersecciones, snapping, ángulos, instrumentos)
  tools/      cada herramienta es una pequeña máquina de estados sin React
  state/      stores (documento con historial, estado de la app) y acciones
  canvas/     renderizado: PDF (pdf.js) como fondo, trazos en SVG, overlays a tamaño de pantalla
  components/ interfaz: barra superior, herramientas, barra contextual, capas
  pdf/        sesión pdf.js, detección de geometría (detect/) y exportación (PDF vectorial con pdf-lib, PNG)
  hooks/      teclado y autoguardado
```

Las coordenadas internas son puntos PDF de la página (1/72 in), así que las medidas en mm
corresponden al papel real y el dibujo queda alineado con el PDF a cualquier zoom.
El trabajo se guarda solo: el dibujo de cada PDF en `localStorage` y el último PDF en IndexedDB.

## Servidor propio delante de Cloudflare (días de LaLiga)

En días de partido de LaLiga las operadoras españolas bloquean IPs compartidas de Cloudflare y la
web deja de cargar. Por eso `danidemiguel.com` apunta a un VPS con IP propia (IONOS, `31.70.173.233`,
el mismo que da servicio a crowntacos.es) que pasa cada visita al Worker en su dirección interna,
`https://danidemiguel.aldanidaniel12.workers.dev`. La web sigue entera en Cloudflare: Worker, D1 y secretos.

- **Caddy** (proxy inverso y certificado HTTPS automático): el bloque está en [`proxy/Caddyfile`](proxy/Caddyfile)
  y va añadido al final de `/etc/caddy/Caddyfile`, sin tocar los bloques de crowntacos.es.
- **Clave del proxy**: la misma en dos sitios, nunca en el repositorio.
  - VPS: `/etc/systemd/system/caddy.service.d/proxy.conf` → `Environment=PROXY_KEY_DANI=…`
  - Cloudflare: secreto `PROXY_KEY` del Worker (`npx wrangler secret put PROXY_KEY`)
  - Copia local: `C:\Users\dbent\.ssh\danydemiguel_proxy_key.txt`
- **IP del visitante**: por el proxy Cloudflare ve la IP del VPS. Caddy manda la real en `X-Client-IP`
  junto a `X-Proxy-Key`; el Worker solo la cree si la clave coincide (`worker/limites.js`), y si no usa
  `CF-Connecting-IP`. Sirve para los límites por minuto y el bloqueo de intentos del panel.
- **Dirección pública**: la variable `PUBLIC_URL` (`wrangler.jsonc`) se usa en las redirecciones, porque
  por el proxy `request.url` es la del Worker.
- **DNS** (Cloudflare → danidemiguel.com → DNS): registros `A` para `@` y `www` con `31.70.173.233`
  y la nube **gris** (DNS only), sin registros `AAAA`. Los «Custom Domains» del Worker están quitados.

Cambiar la configuración de Caddy, siempre con copia y con `reload` (nunca `restart`, que cortaría crowntacos.es):

```bash
cp /etc/caddy/Caddyfile /root/proxy/Caddyfile.antes-cambio
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl daemon-reload && systemctl reload caddy
```

### Volver atrás (sin el VPS)

1. En Cloudflare, Workers & Pages → `danidemiguel` → Settings → Domains & Routes: volver a añadir
   `danidemiguel.com` y `www.danidemiguel.com` como Custom Domains. Cloudflare borra o pide borrar los
   registros `A` del VPS y crea los suyos, con la nube naranja.
2. En el VPS, quitar los bloques `danidemiguel.com` y `www.danidemiguel.com` de `/etc/caddy/Caddyfile`
   (o restaurar `/root/proxy/Caddyfile.antes-dani`), validar y `systemctl reload caddy`.
3. Opcional: borrar la línea `PROXY_KEY_DANI` de `proxy.conf` y el secreto `PROXY_KEY` del Worker.
