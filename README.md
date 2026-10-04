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
