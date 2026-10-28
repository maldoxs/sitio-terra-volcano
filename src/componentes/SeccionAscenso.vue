<!-- ============================================================================
     EL ASCENSO — la pieza firma del sitio.

     Una banda alta fija su escenario con `position:sticky`, y el progreso del
     scroll dentro de esa banda (0→1) maneja TODO desde una sola función
     `pintar(p)`: el trazo de la ruta, el escalador sobre ella, el altímetro,
     los tres colores del cielo, las estrellas y la fumarola.

     Es una función pura del progreso. Para depurarla, llama `pintar(0.42)` y
     ves ese instante exacto congelado, sin tener que buscarlo scrolleando.

     Por qué sticky y no un pin con librería: lo resuelve el compositor del
     navegador, sin JavaScript por frame y sin tocar el layout. Un pin hecho a
     mano cambia la altura del documento y pelea con el scroll del trackpad.
     ========================================================================= -->
<script setup>
import { ref, shallowRef, onMounted } from 'vue';
import { onScroll, quieto, limita01 } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();

const seccion = ref(null);
const ruta    = ref(null);
const escalador = ref(null);
const cielo   = ref(null);
const estrellas = ref(null);

const altitud = ref(0);
const opFumarola = ref(0);
const opEstrellas = ref(1);
const anchoVara = ref('0%');
const hito = shallowRef(null);

/* Las cotas salen de datos/agencia.json y llevan `altitudesConfirmadas:false`:
   provienen de fuentes de terceros, no de la agencia. El PROTOCOLO pide
   marcarlas hasta que Richard las valide. */
const RUTA_DATOS = agencia.rutaVillarrica;
const BASE = RUTA_DATOS.base;
const CUMBRE = RUTA_DATOS.cumbre;

/* La posicion de cada hito se CALCULA desde su altitud. No hay umbrales
   afinados a mano: si manana se corrige una cota, el hito se mueve solo.
   Efecto secundario deseado: el ritmo queda irregular porque el cerro lo es.
   Entre el centro de esqui y el fin del andarivel hay un salto grande, y
   entre la falsa cumbre y el crater casi nada. */
const HITOS = RUTA_DATOS.hitos.map((h) => ({
  id: h.id,
  altitud: h.altitud,
  p: (h.altitud - BASE) / (CUMBRE - BASE),
}));

/* CONAF no lleva marca sobre el trazo: es el control ANTES de empezar a
   caminar, no un punto del ascenso. Ademas queda a 50 m del centro de esqui,
   que sobre 1.447 m de desnivel son 3,5% del recorrido: las dos marcas se
   pisarian. Su texto si aparece, como primer hito. */
const MARCABLES = HITOS.filter((h) => h.id !== 'conaf');

/* La ruta: once vértices generados contra la silueta del volcán. Todos caen
   dentro de la ladera con 24px de holgura y cada tramo gana altura.
   Se parametrizó por ALTURA, no por distancia: así «subir siempre» queda
   garantizado por el método en vez de ser algo que haya que comprobar. */
const D_RUTA = 'M210 506 L295 472 L348 439 L375 405 L375 372 L397 338 L420 304 L458 271 L485 237 L496 204 L500 166';

/* Campo de estrellas determinista (sin Math.random): dos cargas se ven igual,
   así una captura de pantalla es comparable entre ejecuciones. */
let semilla = 7;
const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
const puntosEstrella = Array.from({ length: 70 }, (_, i) => ({
  i, cx: `${(rnd() * 100).toFixed(2)}%`, cy: `${(rnd() * 62).toFixed(2)}%`,
  r: +(rnd() * 1.3 + 0.4).toFixed(2), o: +(rnd() * 0.6 + 0.25).toFixed(2),
}));

/* Paletas del cielo: noche → azul de amanecer → dorado de cumbre. */
const CIELOS = [
  [[11, 18, 32], [27, 36, 52], [43, 42, 46]],
  [[24, 34, 61], [58, 70, 96], [120, 96, 84]],
  [[58, 52, 74], [150, 104, 78], [232, 179, 60]],
];
const mez = (a, b, k) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;

let LARGO = 0;
let idxHito = -1;

/* Donde cae cada hito SOBRE el trazo. Se calcula una vez al montar pidiendole
   el punto a la propia ruta, igual que el escalador: asi las marcas y el
   monito nunca se desalinean. */
const marcas = ref([]);
const pActual = ref(0);

function pintar(p) {
  p = limita01(p);

  // 1 · la ruta se dibuja
  ruta.value.style.strokeDashoffset = LARGO * (1 - p);

  // 2 · el escalador va SOBRE la ruta: la posición se la pedimos al propio
  //     trazo, no la calculamos. Por eso sigue los quiebres con exactitud.
  if (p > 0) {
    const pt = ruta.value.getPointAtLength(LARGO * p);
    escalador.value.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    escalador.value.setAttribute('opacity', String(limita01(p * 14)));
  } else {
    escalador.value.setAttribute('opacity', '0');
  }

  // 3 · altímetro
  altitud.value = Math.round(BASE + (CUMBRE - BASE) * p);

  // 4 · cielo: dos tramos interpolados
  const k = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
  const A = p < 0.5 ? CIELOS[0] : CIELOS[1];
  const B = p < 0.5 ? CIELOS[1] : CIELOS[2];
  const s = cielo.value.style;
  s.setProperty('--c1', mez(A[0], B[0], k));
  s.setProperty('--c2', mez(A[1], B[1], k));
  s.setProperty('--c3', mez(A[2], B[2], k));
  opEstrellas.value = limita01(1 - p * 2.1);

  // 5 · fumarola: sólo al llegar
  opFumarola.value = limita01((p - 0.86) / 0.14);

  // 6 · hitos: cambian al cruzar su altitud, no en cada frame
  let i = -1;
  for (let n = 0; n < HITOS.length; n++) if (p >= HITOS[n].p) i = n;
  if (i !== idxHito) {
    idxHito = i;
    const h = i < 0 ? null : HITOS[i];
    hito.value = h ? { ...t(`ascenso.hitos.${h.id}`), altitud: h.altitud } : null;
  }

  pActual.value = p;

  anchoVara.value = (p * 100).toFixed(1) + '%';
}
// expuesto para depurar desde la consola del navegador
if (import.meta.env.DEV) window.pintarAscenso = pintar;

onMounted(() => {
  LARGO = ruta.value.getTotalLength();
  ruta.value.style.strokeDasharray = `${LARGO} ${LARGO + 1}`;
  ruta.value.style.strokeDashoffset = LARGO;

  marcas.value = MARCABLES.map((h, i) => {
    const pt = ruta.value.getPointAtLength(LARGO * h.p);
    /* La etiqueta va a la derecha, que es ladera abierta: la ruta sube por el
       flanco izquierdo. La cumbre es la excepcion, ahi no queda cerro a la
       derecha y el nombre se pone arriba, centrado. */
    const esCumbre = i === MARCABLES.length - 1;
    return {
      ...h,
      x: +pt.x.toFixed(1), y: +pt.y.toFixed(1),
      lx: esCumbre ? +pt.x.toFixed(1) : +(pt.x + 15).toFixed(1),
      ly: esCumbre ? +(pt.y - 22).toFixed(1) : +(pt.y + 4.5).toFixed(1),
      anclaje: esCumbre ? 'middle' : 'start',
    };
  });
  // Sin scrub se entrega la cumbre: nadie scrollea tres pantallas de nada.
  if (quieto()) pintar(1);
});

onScroll(() => {
  if (quieto() || !seccion.value || !ruta.value) return;
  const r = seccion.value.getBoundingClientRect();
  const total = seccion.value.offsetHeight - innerHeight;
  pintar(total > 0 ? -r.top / total : 0);
});
</script>

<template>
  <section ref="seccion" class="ascenso" id="ascenso" :aria-label="t('ascenso.etiqueta')">
    <div class="pista">
      <div class="fijo">
        <div ref="cielo" class="cielo"></div>
        <svg ref="estrellas" class="estrellas" :style="{ opacity: opEstrellas }" aria-hidden="true">
          <circle v-for="e in puntosEstrella" :key="e.i" :cx="e.cx" :cy="e.cy" :r="e.r"
                  fill="#F2EDE6" :opacity="e.o" />
        </svg>

        <svg class="escena" viewBox="0 0 1000 620" aria-hidden="true">
          <path fill="#0d1117" d="M0 620V548l150-36 180-108 100-152 70-102 70 102 100 152 180 108 150 36v72z"/>
          <path fill="#F2EDE6" opacity=".92" d="M432 248L500 150l68 98-32 14-36-16-34 17z"/>
          <ellipse cx="500" cy="153" rx="15" ry="5.5" fill="#0d1117" opacity=".85"/>
          <path class="ruta-fantasma" :d="D_RUTA"/>
          <path ref="ruta" class="ruta" :d="D_RUTA"/>

          <!-- Una marca por hito, sobre el propio trazo. Se enciende al pasarla:
               el recorrido deja huella en vez de limitarse a avanzar. -->
          <g class="marcas">
            <g v-for="m in marcas" :key="m.id" :class="{ pasada: pActual >= m.p }">
              <circle :cx="m.x" :cy="m.y" r="5.5"/>
              <!-- El nombre queda escrito sobre el cerro al pasarlo, como en
                   un topo de ruta. El contorno oscuro bajo el texto lo hace
                   legible igual sobre la roca negra que sobre la nieve. -->
              <text :x="m.lx" :y="m.ly" :text-anchor="m.anclaje">{{ t(`ascenso.hitos.${m.id}`).titulo }}</text>
            </g>
          </g>

          <!-- EL GUIA.
               A escala real sobre un volcan de 1000 unidades una persona seria
               invisible, asi que va sobrescalado: lo que se lee a esta
               distancia es la silueta, no el detalle.
               El grupo se posiciona con getPointAtLength y la figura se dibuja
               con los PIES en el origen, de modo que PISA el trazo en vez de
               flotar sobre el. -->
          <g ref="escalador" opacity="0">
            <ellipse rx="24" ry="8" cy="2" fill="var(--obsidiana)" opacity=".4"/>
            <g class="guia" transform="translate(0 2)">
              <!-- piolet, clavado adelante en la pendiente -->
              <path d="M11 -30 L13.5 -5" stroke="#F2EDE6" stroke-width="1.8"
                    stroke-linecap="round" opacity=".8"/>
              <path d="M11 -30 L15.5 -27.5" stroke="#F2EDE6" stroke-width="1.8"
                    stroke-linecap="round" opacity=".8"/>
              <!-- piernas, en paso -->
              <path d="M-2.5 -12 L-5.5 0" stroke="var(--lava)" stroke-width="4.2"
                    stroke-linecap="round"/>
              <path d="M2.5 -12 L6 -1.5" stroke="var(--lava)" stroke-width="4.2"
                    stroke-linecap="round"/>
              <!-- mochila -->
              <path d="M-9 -29 h4.5 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 H-9 z"
                    fill="var(--azufre)"/>
              <!-- torso -->
              <path d="M-5 -30 h7 a3.4 3.4 0 0 1 3.4 3.4 v10 a3.4 3.4 0 0 1 -3.4 3.4 h-7 z"
                    fill="var(--lava)"/>
              <!-- brazo que sostiene el piolet -->
              <path d="M3 -26 L11.5 -22" stroke="var(--lava)" stroke-width="3.6"
                    stroke-linecap="round"/>
              <!-- cabeza y gorro -->
              <circle cx="-0.5" cy="-34" r="4.6" fill="var(--lava)"/>
              <path d="M-5.1 -34.8 a4.6 4.6 0 0 1 9.2 0 z" fill="var(--azufre)"/>
            </g>
          </g>
          <g :opacity="opFumarola">
            <circle cx="500" cy="150" r="32" fill="var(--azufre)" opacity=".2"/>
            <circle cx="500" cy="150" r="13" fill="var(--azufre)" opacity=".5"/>
          </g>
        </svg>

        <div class="hud">
          <span class="hud__et">{{ t('ascenso.etiqueta') }}</span>
          <span class="hud__alt">{{ altitud.toLocaleString('es-CL') }}<small>m</small></span>
          <span class="hud__hito">
            <template v-if="hito">
              <b>{{ hito.titulo }}<i>{{ hito.altitud.toLocaleString('es-CL') }} m</i></b>
              <span>{{ hito.texto }}</span>
            </template>
          </span>
        </div>
        <div class="vara"><i :style="{ width: anchoVara }"></i></div>
      </div>
    </div>
  </section>
</template>


<style scoped>
.ascenso{position:relative;background:var(--obsidiana)}
.pista{height:560vh}
.fijo{position:sticky;top:0;height:100svh;overflow:hidden}
.cielo{position:absolute;inset:0;z-index:0;
  background:linear-gradient(176deg,var(--c1,#0b1220) 0%,var(--c2,#1b2434) 54%,var(--c3,#2b2a2e) 100%)}
.estrellas{position:absolute;inset:0;z-index:1;width:100%;height:100%}
.escena{position:absolute;left:0;right:0;bottom:0;z-index:2;width:100%;height:auto}

.ruta{fill:none;stroke:var(--lava);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.ruta-fantasma{fill:none;stroke:rgba(242,237,230,.17);stroke-width:5;
  stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 11}

/* Marcas de los hitos. Apagadas son parte del camino por recorrer; encendidas
   son huella. La transicion usa la curva unica del sitio. */
/* Sin pasar: solo contorno. Rellenarlas de oscuro las convertia en agujeros
   negros cuando caen sobre la nieve de la cumbre. */
.marcas circle{
  fill:transparent;stroke:rgba(242,237,230,.45);stroke-width:2.5;
  transition:fill .5s var(--ease),stroke .5s var(--ease),r .5s var(--ease);
}
.marcas .pasada circle{fill:var(--azufre);stroke:var(--azufre);r:7}

/* El nombre aparece al pasar el hito y se queda. `paint-order:stroke` dibuja
   el contorno DEBAJO del relleno, asi el texto se lee sobre roca negra y
   sobre nieve blanca sin cambiar de color. */
.marcas text{
  font:700 13px/1 var(--texto);letter-spacing:.1em;text-transform:uppercase;
  fill:var(--nieve);stroke:var(--obsidiana);stroke-width:3.4;
  paint-order:stroke fill;
  opacity:0;transform:translateX(-5px);
  transition:opacity .55s var(--ease),transform .55s var(--ease);
}
.marcas .pasada text{opacity:1;transform:none}

@media (prefers-reduced-motion:reduce){
  .marcas circle,.marcas text{transition:none}
}


.hud{position:absolute;z-index:3;left:var(--gutter);top:clamp(84px,14vh,130px);
  color:var(--nieve);pointer-events:none}
.hud__et{display:block;font:700 10px/1 var(--texto);letter-spacing:.2em;
  text-transform:uppercase;color:rgba(242,237,230,.5);margin-bottom:12px}
.hud__alt{font:800 clamp(2.8rem,8vw,5.2rem)/1 var(--display);letter-spacing:-.05em;
  font-variant-numeric:tabular-nums;display:block}
.hud__alt small{font-size:.32em;font-weight:700;letter-spacing:.04em;
  margin-left:.18em;color:var(--azufre)}
.hud__hito{display:block;margin-top:16px;min-height:2.6em;
  font:500 15px/1.4 var(--texto);color:rgba(242,237,230,.8);max-width:22ch}
.hud__hito b{display:flex;align-items:baseline;gap:.7em;flex-wrap:wrap;
  font:700 12px/1 var(--texto);letter-spacing:.14em;
  text-transform:uppercase;color:var(--azufre);margin-bottom:7px}
/* La cota del hito, discreta: acompana al nombre sin competir con el altimetro */
.hud__hito b i{font-style:normal;font-weight:700;letter-spacing:.04em;
  color:rgba(242,237,230,.45);font-variant-numeric:tabular-nums}

.vara{position:absolute;z-index:3;left:var(--gutter);right:var(--gutter);bottom:36px;
  height:2px;background:rgba(242,237,230,.16)}
.vara i{display:block;height:100%;background:var(--lava)}

@media (max-width:760px){
  .pista{height:460vh}
  .hud{top:auto;bottom:70px}
  .hud__hito{max-width:16ch}
}
/* Sin scrub la banda deja de ser alta: si no hay animación, no tiene sentido
   hacer scrollear tres pantallas para llegar al mismo estado final. */
@media (prefers-reduced-motion:reduce){
  .pista{height:auto}
  .fijo{position:relative;height:auto;padding:clamp(80px,12vh,130px) 0 0}
  .escena{position:relative}
}
</style>
