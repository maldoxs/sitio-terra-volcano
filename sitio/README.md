# sitio/ — el sitio público de Terra Volcano

Vue 3 con `<script setup>` (Composition API) + Vite. **Es lo único del
repositorio que se publica**: GitHub Pages sirve `sitio/dist`.

## Levantarlo

```bash
cd sitio
npm install
npm run dev        # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo con recarga en caliente |
| `npm run build` | compila a `dist/` |
| `npm run preview` | sirve `dist/` como lo verá el visitante |

## Cómo está armado

```
src/
├── App.vue                  el orden de las secciones
├── main.js                  monta la app y registra las directivas
├── estilos/base.css         tokens: colores, tipografías, --ease
├── i18n/textos.js           copy ES/EN. SOLO texto, cero datos
├── composables/
│   ├── useIdioma.js         t('clave') + interpolación desde agencia.json
│   └── useScrollRaf.js      UN rAF compartido por toda la página
├── directivas/
│   ├── revelar.js           v-revelar · v-revelar.grupo (cascada)
│   └── marcador.js          v-marcador (resaltado que sigue al scroll)
└── componentes/             un archivo por sección
```

## Las tres reglas que importan

**1. Los datos no se escriben acá.** Teléfono, cifras, precios y catálogo
vienen de [`../datos/agencia.json`](../datos/agencia.json). En `textos.js` se
escriben `{marcadores}` y `useIdioma` los rellena. Si ves un número escrito a
mano en un componente, es un error.

**2. Sin librerías de animación.** El movimiento se hace con CSS, SVG,
`IntersectionObserver` y `useScrollRaf`. Cada componente que reacciona al
scroll se suscribe ahí en vez de poner su propio listener: con cinco
componentes sueltos tendrías cinco `requestAnimationFrame` compitiendo.

**3. Una sola curva.** `--ease` en `base.css`, usada en todo. No agregar otras
sin discutirlo: es lo que hace que el sitio se sienta una pieza y no
componentes sueltos.

## La pieza central

`componentes/SeccionAscenso.vue`. Una banda de 360vh fija su escenario con
`position: sticky`, y el progreso del scroll dentro de esa banda (0→1) maneja
**todo** desde una sola función `pintar(p)`: el trazo de la ruta, el escalador
sobre ella, el altímetro, los colores del cielo, las estrellas y la fumarola.

Es una función pura del progreso. En desarrollo queda expuesta en la consola:

```js
pintarAscenso(0.42)   // congela ese instante exacto, sin scrollear a buscarlo
```

## Accesibilidad

`prefers-reduced-motion` apaga todo el movimiento, y la banda del ascenso
**colapsa a una pantalla** con la cumbre ya entregada: sin animación, no tiene
sentido hacer scrollear tres pantallas para llegar al mismo estado final.

El contenido nunca depende del JavaScript para ser visible: el estado oculto de
los reveals sólo aplica con la clase `js`, que pone `main.js`.

## `/villarrica/`

La landing del ascenso al Villarrica (scrub de video atado al scroll) vive en
`public/villarrica/` y se sirve tal cual en `/villarrica/`. Es estática, con su
propio motor en `public/media/js/scrub-engine.js`, y **no está portada a Vue**:
funciona, y reescribirla no agregaría nada hoy.
