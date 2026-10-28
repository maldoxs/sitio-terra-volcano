# Terra Volcano — sitio público

Sitio de [Terra Volcano](https://terravolcano.com), agencia de expediciones en
Pucón. Vue 3 con `<script setup>` (Composition API) + Vite, **sin librerías de
animación**.

> La documentación del proyecto (análisis del negocio, memoria, el sistema de
> registro de pasajeros) vive en un repositorio **privado** aparte. Acá está
> sólo lo que hace funcionar el sitio.

---

## Clonar y levantar

```bash
git clone https://github.com/maldoxs/sitio-terra-volcano.git
cd sitio-terra-volcano
npm install
npm run dev
```

Se abre en `http://localhost:5173`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | desarrollo, con recarga en caliente |
| `npm run build` | compila a `dist/` |
| `npm run preview` | sirve `dist/` como lo verá el visitante |
| `npm run verificar` | compila, levanta y mide el sitio con un navegador real |

**Requiere Node 20 o superior.** Verifícalo con `node -v`.

---

## Verificar antes de subir

```bash
npm run verificar
```

Compila el sitio, lo sirve, lo recorre con un navegador real y comprueba
diecisiete cosas. Devuelve código 1 si algo falla, así que también sirve en CI.

```
HOME                  secciones, clase js, datos desde agencia.json,
                      lang coherente con el contenido
REVEALS               que todos disparen al recorrer la página
ASCENSO               pista de scroll suficiente, progreso monótono,
                      altímetro ascendente, escalador sobre el trazo
RENDIMIENTO           fps durante la pieza, cero errores de consola
/villarrica/          responde y sin imágenes rotas
MOVIMIENTO REDUCIDO   la banda colapsa, entrega la cumbre, nada oculto
```

**Por qué existe.** Una animación puede verse perfecta en una captura y estar
rota. Estos controles cazaron seis defectos que ningún linter detecta: tres
vértices de la ruta cayendo fuera del volcán, un efecto que nacía cumplido por
falta de pista de scroll, el `<html lang>` en desacuerdo con el contenido, y
rutas rotas tras mover carpetas.

Si tocas la animación, córrelo antes de hacer push. Y si agregas un
comportamiento que importe, agrégale su control: el arnés también sirve de
documentación viva de lo que la pieza tiene que cumplir.

La primera vez puede pedirte descargar el navegador:

```bash
npx playwright install chromium
```

---

## Trabajo diario con git

### Antes de empezar, siempre

```bash
git pull
```

Trae lo que subieron los demás. Hacerlo primero evita conflictos; hacerlo al
final los garantiza.

### Subir tus cambios

```bash
git status                     # qué cambiaste
git add .                      # marcar todo para subir
git commit -m "Qué hiciste"    # guardar con un mensaje
git push                       # subir a GitHub
```

El mensaje del commit explica **por qué**, no qué archivo tocaste. `git log`
sirve para que alguien entienda una decisión seis meses después.

### Trabajar sin pisarse con otros

```bash
git checkout -b mi-cambio      # crear una rama y moverse a ella
# ... trabajas, haces commits ...
git push -u origin mi-cambio   # subir la rama
```

Después se abre un Pull Request en GitHub para que alguien lo revise antes de
que entre a `main`.

### Si algo sale mal

```bash
git status                     # primero: entender dónde estás
git checkout -- archivo.vue    # descartar cambios de UN archivo
git stash                      # guardar todo a un lado, dejar limpio
git stash pop                  # recuperar lo guardado
```

Nunca borres la carpeta y vuelvas a clonar: `git status` casi siempre te dice
qué pasa.

---

## Cómo está armado

```
src/                      la aplicación Vue
  componentes/              un archivo por sección
  composables/              useIdioma, useScrollRaf
  directivas/               v-revelar, v-marcador
  estilos/base.css          tokens: colores, tipografías, --ease
  i18n/textos.js            copy ES/EN. SOLO texto, cero datos
public/
  media/                    videos, fotos y el motor de la landing
  villarrica/               la landing del Villarrica, en /villarrica/
datos/agencia.json        LA FUENTE ÚNICA DE VERDAD de los datos
herramientas/             los scripts que generan el material del sitio
.github/workflows/        el despliegue a GitHub Pages
```

### Las tres reglas

**1. Los datos no se escriben en los componentes.** Teléfono, cifras, precios y
catálogo salen de [`datos/agencia.json`](datos/agencia.json). En `textos.js` se
escriben `{marcadores}` y `useIdioma` los rellena. Si ves un número escrito a
mano en un `.vue`, es un error: cámbialo en el JSON.

**2. Sin librerías de animación.** El movimiento se hace con CSS, SVG,
`IntersectionObserver` y un único `requestAnimationFrame` compartido
(`useScrollRaf`). Antes de agregar una dependencia, hay que justificar qué hace
que no se pueda hacer así.

**3. Una sola curva de aceleración.** `--ease` en `base.css`, usada en todo. Es
lo que hace que el sitio se sienta una pieza y no componentes sueltos.

---

## La pieza central

`src/componentes/SeccionAscenso.vue` — **el ascenso al Villarrica atado
al scroll**. Una banda de 360vh fija su escenario con `position: sticky`, y el
progreso del scroll dentro de esa banda (0→1) maneja todo desde una sola
función `pintar(p)`: el trazo de la ruta, el escalador sobre ella con
`getPointAtLength`, el altímetro, los colores del cielo, las estrellas y la
fumarola del cráter.

Referencia técnica completa, con los parámetros literales, la fórmula de la
ruta y los dos intentos que fallaron: [`docs/motor-ascenso.md`](docs/motor-ascenso.md).
Leerla antes de modificar la animación.

Es una función pura del progreso. En desarrollo queda expuesta en la consola
del navegador:

```js
pintarAscenso(0.42)   // congela ese instante exacto, sin scrollear a buscarlo
```

## Accesibilidad

`prefers-reduced-motion` apaga todo el movimiento, y la banda del ascenso
colapsa a una pantalla con la cumbre ya entregada. El contenido nunca depende
del JavaScript para ser visible.

---

## Regenerar los videos

Los cuatro `.mp4` del vuelo salen de fotografías con movimiento de cámara
aplicado con ffmpeg. **Cero AI.**

```bash
python3 herramientas/escenas.py          # regenera el contenido bilingüe
python3 herramientas/generar_clips.py    # regenera los .mp4 desde las fotos
```

`escenas.py` es la fuente del contenido de la landing: **nunca edites su salida**
(`public/media/js/contenido.js`) — edita el script y vuelve a correrlo.

---

## ⚠️ Antes de publicar el sitio

**Ninguna de las fotografías de este repositorio es de Terra Volcano.** Llegaron
como referencia visual para construir y evaluar el sitio, **no para
publicarlo**. Afecta a las 6 imágenes de `herramientas/referencias/`, a los 4
videos generados desde ellas y a las fotos de `public/media/`.

El home en Vue está limpio: no tiene ni una fotografía, todo es SVG. La landing
`/villarrica/` sí las usa.

El detalle completo y los pasos para resolverlo están en
`LICENCIAS-PENDIENTES.md`, en el repositorio privado de documentación.
