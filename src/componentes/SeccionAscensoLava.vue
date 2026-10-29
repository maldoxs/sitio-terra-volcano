<!-- ============================================================================
     EL ASCENSO, VERSIÓN LAVA.

     Réplica de la pieza de `Desktop/andres/sitio-TerraVolcano-`, traída a este
     stack. Vive DEBAJO de `SeccionAscenso.vue` para poder compararlas lado a
     lado e ir moviéndola; las dos pueden existir a la vez porque ninguna toca
     a la otra.

     Qué cambia respecto del original y por qué:

     - El original usa GSAP con ScrollTrigger (`scrub` + `pin`). Acá el pin es
       `position:sticky` y el scrub es el mismo `p = -rect.top / (alto - vh)`
       de la otra pieza, sobre el `requestAnimationFrame` compartido.
     - El original anima el ambiente con tweens `repeat:-1` de GSAP. Acá eso
       son `@keyframes` de CSS, que es lo que corresponde: humo, brasas, brillo
       del cráter, nieve y pulso del escalador NO dependen del scroll. Un
       volcán humea exista o no un visitante mirándolo.
     - El original separa el texto en caracteres con SplitText, que es un
       plugin. Acá los bloques entran enteros con la curva única del sitio.
     - Los datos salen de `datos/agencia.json` y los textos de i18n, como todo
       el resto del sitio. El original los lleva en su propio diccionario.

     La geometría del cono, la nieve, el cráter y el sendero son las del
     original, copiadas tal cual para que la comparación sea de verdad.
     ========================================================================= -->
<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue';
import { onScroll, quieto, limita01 } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();

const seccion = ref(null);
const escena  = ref(null);
const trazo   = ref(null);
/* El halo grueso y el trazo nitido son el MISMO camino dibujado dos veces, asi
   que se les escribe el mismo recorte. Van por ref y no por querySelectorAll:
   buscar en el DOM sesenta veces por segundo es lo que no hay que hacer. */
const halo    = ref(null);
const escalador  = ref(null);
const camara  = ref(null);
/* Las tres capas del paralaje. Cada una con su propio envoltorio: el grupo de
   la camara ya lleva un `transform` de atributo, y un `transform` de CSS sobre
   el mismo elemento lo pisaria. */
const parCerro = ref(null);
const parFondo = ref(null);
const parNieve = ref(null);

/* Tiempos del guion, en fracción de la banda: subida y llegada con la reserva.

   El original tiene un tercer tiempo, el clavado dentro del cráter, que escala
   el dibujo treinta veces y entrega el negro de adentro a la sección
   siguiente. Acá no está: se probó y se sacó. En este sitio lo que viene
   después es el catálogo, con fondo claro, así que el clavado no encadenaba
   con nada y quedaba como una caída dentro del cerro que no lleva a ninguna
   parte. Sin él la banda tampoco necesita las 5,5 pantallas del original. */
const SUBE_DESDE = 0.03;
const SUBE_HASTA = 0.70;
const LLEGADA    = 0.78;

/* Centro del cráter: la cámara empuja hacia acá mientras se sube. */
const CRATER = [1080, 303];

/* El sendero del original, once vértices en el espacio interior del dibujo. */
const D_RUTA =
  'M300 770 L520 702 L382 640 L560 576 L440 516 L592 456 L482 402 L612 346 L532 296 L622 248 L598 204';

const RUTA_DATOS = agencia.rutaVillarrica;
const BASE = RUTA_DATOS.base;
const CUMBRE = RUTA_DATOS.cumbre;

/* Igual que en la otra pieza: la posición de cada hito se CALCULA desde su
   altitud, no se afina a mano. Si mañana se corrige una cota, el hito se mueve
   solo. CONAF queda fuera de las marcas por lo mismo de siempre: es el control
   previo a caminar y cae encima del centro de esquí. */
const HITOS = RUTA_DATOS.hitos.map((h) => ({
  id: h.id,
  altitud: h.altitud,
  p: (h.altitud - BASE) / (CUMBRE - BASE),
}));
/* A diferencia de la otra pieza, acá el paso de texto y la marca sobre el
   sendero son lo MISMO: cada numero del panel es el numero que se ve en el
   cerro. Por eso CONAF queda fuera de las dos listas y no solo de las marcas:
   un panel «04» apuntando a una marca «03» es peor que perder ese texto. */
const PASOS = HITOS.filter((h) => h.id !== 'conaf').map((h, i) => ({ ...h, n: i + 1 }));

/* Campo determinista, sin Math.random: dos cargas se ven igual y las capturas
   del arnés son comparables entre ejecuciones. */
let semilla = 11;
const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };

/* Nieve cayendo. El original la deja correr siempre; acá además se apaga
   cuando la sección no está a la vista, que es trabajo de compositor regalado. */
const COPOS = Array.from({ length: 40 }, (_, i) => ({
  i,
  cx: (i * 397) % 1600,
  cy: (i * 233) % 900,
  r: +(1.5 + (i % 3) * 0.8).toFixed(1),
  dur: 14 + (i % 5) * 3,
  deriva: (i % 2 ? 1 : -1) * 40,
  retardo: -((i * 0.37) % 1) * (14 + (i % 5) * 3),
}));

/* Brasas que saltan del cráter. El original las aleatoriza en cada repetición
   con `repeatRefresh`; sin librería cada brasa lleva su propia trayectoria
   fija, sorteada una vez con la semilla. A catorce brasas desfasadas no se
   nota que cada una repite la suya. */
const BRASAS = Array.from({ length: 14 }, (_, i) => ({
  i,
  r: i % 3 ? 3 : 4.5,
  color: i % 2 ? 'var(--chispa)' : 'var(--fuego)',
  x0: +(rnd() * 120 - 60).toFixed(0),
  x1: +(rnd() * 280 - 140).toFixed(0),
  y1: +(-150 - rnd() * 130).toFixed(0),
  esc: +(0.6 + rnd() * 0.8).toFixed(2),
  dur: +(1.4 + rnd() * 1.4).toFixed(2),
  retardo: +(i * 0.22).toFixed(2),
}));

const HUMO = [0, 1, 2, 3, 4].map((i) => ({ i, cx: i * 6 - 12, deriva: 70 + i * 14, retardo: i * 1.2 }));

const altitud = ref(0);
const marcas = ref([]);
const hito = shallowRef(null);
const iHito = ref(-1);
const enLlegada = ref(false);
const opBandera = ref(0);
const opEstallido = ref(0);
const escEstallido = ref(0);
const visible = ref(false);

let LARGO = 0;
let idx = -1;

function pintar(p) {
  p = limita01(p);

  // 1 · la subida, entre SUBE_DESDE y SUBE_HASTA
  const avance = limita01((p - SUBE_DESDE) / (SUBE_HASTA - SUBE_DESDE));

  const recorte = LARGO * (1 - avance);
  trazo.value.style.strokeDashoffset = recorte;
  halo.value.style.strokeDashoffset = recorte;

  if (avance > 0) {
    const pt = trazo.value.getPointAtLength(LARGO * avance);
    escalador.value.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    escalador.value.setAttribute('opacity', '1');
  } else {
    escalador.value.setAttribute('opacity', '0');
  }

  // 2 · altímetro
  altitud.value = Math.round(BASE + (CUMBRE - BASE) * avance);

  // 3 · el hito actual, que manda el texto de la izquierda
  let n = 0;
  for (let k = 0; k < PASOS.length; k++) if (avance >= PASOS[k].p) n = k;
  if (n !== idx) {
    idx = n;
    iHito.value = n;
    const h = PASOS[n];
    hito.value = { ...t(`ascenso.hitos.${h.id}`), altitud: h.altitud, n: h.n };
  }

  /* 4 · la cámara empuja hacia el cráter mientras se sube. Es un `transform`
     sobre un grupo y nada más: el original lo hace con `svgOrigin`, acá se
     escribe la traslación a mano. */
  const [cx, cy] = CRATER;
  const escala = 1 + 0.1 * avance;
  camara.value.setAttribute('transform', `translate(${cx} ${cy}) scale(${escala.toFixed(3)}) translate(${-cx} ${-cy})`);

  // 5 · la bandera y el estallido se ganan al tocar la cumbre
  const llegado = limita01((p - SUBE_HASTA) / 0.03);
  opBandera.value = llegado;
  escEstallido.value = llegado * 6;
  opEstallido.value = 0.9 * (1 - llegado);

  // 6 · el bloque de reserva, que se queda hasta el final de la banda
  enLlegada.value = p >= LLEGADA - 0.01;
}

/* Saltar a un hito: se despeja de la misma cuenta del progreso, invertida por
   el tramo de subida. Por eso cae donde dice su altitud y no en un número
   afinado a mano. */
function irAlHito(h) {
  if (!seccion.value) return;
  const arriba = seccion.value.getBoundingClientRect().top + scrollY;
  const recorrido = seccion.value.offsetHeight - innerHeight;
  const pDestino = SUBE_DESDE + h.p * (SUBE_HASTA - SUBE_DESDE);
  scrollTo({ top: arriba + recorrido * pDestino, behavior: quieto() ? 'auto' : 'smooth' });
}

/* ----------------------------------------------------------------------------
   TEXTO LETRA POR LETRA.

   El original parte los titulos con SplitText, que es un plugin de GSAP. Acá
   se parten en el template: una palabra por `span` para que la linea siga
   cortando donde debe, y una letra por `span` dentro. El escalonado es un
   `animation-delay` calculado desde el indice, no una propiedad `stagger`.

   El titulo entero va en `aria-label` y las letras ocultas al lector de
   pantalla: una palabra partida en letras sueltas se deletrea.
   -------------------------------------------------------------------------- */
function enLetras(texto) {
  let k = 0;
  return String(texto).split(' ').map((palabra, w) => ({
    w,
    letras: [...palabra].map((c) => ({ c, k: k++ })),
  }));
}
const letrasPaso = computed(() => (hito.value ? enLetras(hito.value.titulo) : []));
const letrasT1 = computed(() => enLetras(t('hero.t1')));
const letrasT2 = computed(() => enLetras(t('hero.t2')));

if (import.meta.env.DEV) window.pintarLava = pintar;

/* El ambiente corre siempre, pero no cuando la sección está fuera de pantalla:
   cincuenta y nueve elementos animándose en una sección que nadie mira es
   trabajo de compositor tirado a la basura. */
let observador = null;
let soltarPuntero = null;

onMounted(() => {
  LARGO = trazo.value.getTotalLength();
  for (const el of [trazo.value, halo.value]) {
    el.style.strokeDasharray = `${LARGO} ${LARGO + 1}`;
    el.style.strokeDashoffset = LARGO;
  }

  marcas.value = PASOS.map((h) => {
    const pt = trazo.value.getPointAtLength(LARGO * h.p);
    return {
      ...h,
      x: +pt.x.toFixed(1), y: +pt.y.toFixed(1),
      /* Alternadas a lado y lado como en el original: el sendero zigzaguea y
         un número siempre al mismo lado se le monta encima en los quiebres. */
      lx: h.n % 2 ? 20 : -20,
      anclaje: h.n % 2 ? 'start' : 'end',
    };
  });

  observador = new IntersectionObserver(([e]) => { visible.value = e.isIntersecting; });
  observador.observe(seccion.value);

  /* PARALAJE. Tres capas que derivan con el puntero, cada una con su amplitud:
     la cordillera al reves que el cerro, y la nevada mas que las dos, que es
     lo que da la sensacion de estar delante.

     El original lo resuelve con `gsap.quickTo`, que interpola hacia el destino
     con su propia curva. Acá el retardo lo pone una transicion de CSS: cada
     movimiento del puntero reescribe el destino y la transicion vuelve a
     salir, que es exactamente el mismo comportamiento sin libreria.

     Solo con puntero fino: en una pantalla tactil no hay puntero que seguir, y
     el `pointermove` del dedo daria saltos. */
  if (!quieto() && matchMedia('(pointer: fine)').matches) {
    const capas = [
      { el: parFondo, x: -30, y: -12 },
      { el: parCerro, x: 16,  y: 8 },
      { el: parNieve, x: 45,  y: 20 },
    ];
    let pedido = false;
    let nx = 0, ny = 0;
    const aplicar = () => {
      pedido = false;
      for (const c of capas) {
        c.el.value.style.transform = `translate(${(nx * c.x).toFixed(1)}px, ${(ny * c.y).toFixed(1)}px)`;
      }
    };
    const mover = (e) => {
      nx = e.clientX / innerWidth - 0.5;
      ny = e.clientY / innerHeight - 0.5;
      if (!pedido) { pedido = true; requestAnimationFrame(aplicar); }
    };
    addEventListener('pointermove', mover, { passive: true });
    soltarPuntero = () => removeEventListener('pointermove', mover);
  }

  // Sin scrub se entrega la cumbre: nadie scrollea pantallas vacías.
  if (quieto()) pintar(1);
});

onUnmounted(() => {
  observador?.disconnect();
  soltarPuntero?.();
});

onScroll(() => {
  if (quieto() || !seccion.value || !trazo.value) return;
  const r = seccion.value.getBoundingClientRect();
  const total = seccion.value.offsetHeight - innerHeight;
  pintar(total > 0 ? -r.top / total : 0);
});
</script>

<template>
  <section ref="seccion" id="ascenso-lava" class="lava"
           :class="{ vivo: visible }" :aria-label="t('ascenso.etiqueta')">
    <div class="pista">
      <div class="fijo">
        <svg ref="escena" class="escena" viewBox="0 0 1600 900"
             preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="lv-cielo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#14100e"/>
              <stop offset="1" stop-color="#2a1d17"/>
            </linearGradient>
            <linearGradient id="lv-cono" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#3b302a"/>
              <stop offset="1" stop-color="#1b1512"/>
            </linearGradient>
            <!-- La nieve con degradado LATERAL, no vertical: es lo que le da
                 el volumen que un relleno plano no tiene. -->
            <linearGradient id="lv-nieve" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0"   stop-color="#f3efe8"/>
              <stop offset="0.6" stop-color="#d9d2c8"/>
              <stop offset="1"   stop-color="#a9a097"/>
            </linearGradient>
            <radialGradient id="lv-lava" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0"   stop-color="var(--chispa)"/>
              <stop offset="0.6" stop-color="var(--fuego)"/>
              <stop offset="1"   stop-color="var(--fuego)" stop-opacity="0"/>
            </radialGradient>
            <!-- Los dos desenfoques son la mitad del efecto. El de 14 hace la
                 boca encendida; el de 6, bajo un trazo grueso, es lo que hace
                 que el sendero EMITA luz en vez de estar pintado de naranjo. -->
            <filter id="lv-difuso" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="14"/>
            </filter>
            <filter id="lv-halo" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6"/>
            </filter>
          </defs>

          <rect width="1600" height="900" fill="url(#lv-cielo)"/>

          <!-- Cordillera de fondo. Da escala: sin algo detrás, el cono no
               tiene con qué compararse. -->
          <g ref="parFondo" class="capa">
            <path class="cordillera"
                d="M-60 960 L-60 600 L120 560 L230 600 L340 520 L450 575 L560 545 L640 600
                   L1360 600 L1430 540 L1500 575 L1660 530 L1660 960 Z" fill="#241e1a"/>
          </g>

          <g ref="parCerro" class="capa"><g ref="camara">
            <!-- El volcán va dibujado en un espacio de 1200x800 y corrido a la
                 derecha, para que el texto se siente a su izquierda. -->
            <g transform="translate(480 100)">
              <g transform="translate(600 185)">
                <circle v-for="h in HUMO" :key="h.i" class="humo" r="34" :cx="h.cx"
                        fill="#8d837a" opacity=".25"
                        :style="{ '--deriva': h.deriva + 'px', animationDelay: h.retardo + 's' }"/>
              </g>

              <ellipse class="brillo" cx="600" cy="195" rx="140" ry="40"
                       fill="url(#lv-lava)" filter="url(#lv-difuso)" opacity=".9"/>

              <g transform="translate(600 200)">
                <circle v-for="b in BRASAS" :key="b.i" class="brasa" :r="b.r" :fill="b.color"
                        opacity="0"
                        :style="{
                          '--x0': b.x0 + 'px', '--x1': b.x1 + 'px', '--y1': b.y1 + 'px',
                          '--esc': b.esc,
                          animationDuration: b.dur + 's', animationDelay: b.retardo + 's',
                        }"/>
              </g>

              <!-- EL CERRO. Geometría del original tal cual: flancos rectos y
                   las curvas sólo en el borde del cráter. Lo que lo hace leerse
                   no es la silueta, es el degradado. -->
              <path d="M20 820 L470 212 Q520 186 560 193 L640 193 Q680 186 730 212 L1180 820 Z"
                    fill="url(#lv-cono)"/>
              <path d="M300 452 L470 212 Q520 186 560 193 L640 193 Q680 186 730 212 L900 452
                       L860 436 L810 466 L752 428 L700 462 L640 430 L572 468 L512 426
                       L452 462 L392 430 L340 460 Z" fill="url(#lv-nieve)"/>
              <!-- La boca: oscura por dentro, con la lava asomando. -->
              <path d="M470 212 Q520 186 560 193 L640 193 Q680 186 730 212 Q600 228 470 212 Z"
                    fill="#14100e"/>
              <ellipse cx="600" cy="205" rx="70" ry="6" fill="var(--fuego)" opacity=".8"/>

              <!-- EL SENDERO, en tres capas sobre el mismo trazo: el camino por
                   recorrer punteado, el halo grueso desenfocado, y encima el
                   trazo nítido. -->
              <!-- El original lo deja blanco al 30%, que sobre su nieve es
                   invisible: el tramo que falta desaparece justo donde mas
                   importa. Va en el gris calido del humo, que se lee contra la
                   nieve y contra la roca negra por igual. -->
              <path class="fantasma" :d="D_RUTA" fill="none" stroke="#8d837a"
                    stroke-opacity=".75" stroke-width="3.5" stroke-dasharray="2 10"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <path ref="halo" class="avance" :d="D_RUTA" fill="none" stroke="var(--fuego)"
                    stroke-opacity=".55" stroke-width="16" stroke-linecap="round"
                    stroke-linejoin="round" filter="url(#lv-halo)"/>
              <path ref="trazo" class="avance" :d="D_RUTA" fill="none" stroke="var(--fuego)"
                    stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

              <g class="marcas">
                <g v-for="m in marcas" :key="m.id"
                   :class="{ pasada: PASOS[iHito] && PASOS[iHito].altitud >= m.altitud }"
                   :transform="`translate(${m.x} ${m.y})`"
                   role="button" tabindex="0"
                   :aria-label="`${t(`ascenso.hitos.${m.id}`).titulo}, ${m.altitud} m`"
                   @click="irAlHito(m)"
                   @keydown.enter.prevent="irAlHito(m)"
                   @keydown.space.prevent="irAlHito(m)">
                  <circle class="blanco" r="26" fill="transparent"/>
                  <circle r="10" fill="#14100e" stroke="#f3efe8" stroke-width="3"/>
                  <text :x="m.lx" y="6" :text-anchor="m.anclaje">{{ String(m.n).padStart(2, '0') }}</text>
                </g>
              </g>

              <circle class="estallido" cx="598" cy="204" r="20" fill="none"
                      stroke="var(--chispa)" stroke-width="3"
                      :opacity="opEstallido"
                      :transform="`translate(598 204) scale(${(escEstallido || 0.001).toFixed(2)}) translate(-598 -204)`"/>
              <!-- El izado va dentro del propio atributo `transform` y no por
                   estilo: un `transform` de CSS sobre un elemento SVG PISA al
                   atributo, y la bandera se iba al origen del dibujo, que es
                   la esquina superior izquierda. Escalar en Y sobre el origen
                   del grupo la despliega desde su base, que es donde se clava. -->
              <g class="bandera" :transform="`translate(598 204) scale(1 ${opBandera || 0.001})`"
                 :opacity="opBandera">
                <line x1="0" y1="0" x2="0" y2="-50" stroke="#f3efe8" stroke-width="3"/>
                <path d="M0 -50 L34 -41 L0 -30 Z" fill="var(--fuego)"/>
              </g>

              <g ref="escalador" class="escalador" opacity="0">
                <circle class="pulso" r="12" fill="none" stroke="var(--chispa)" stroke-width="3"/>
                <circle r="20" fill="var(--fuego)" opacity=".3"/>
                <circle r="9" fill="var(--chispa)" stroke="#14100e" stroke-width="2"/>
              </g>
            </g>
          </g></g>

          <g ref="parNieve" class="capa nevada" fill="#f3efe8" opacity=".55">
            <circle v-for="c in COPOS" :key="c.i" class="copo" :cx="c.cx" :cy="c.cy" :r="c.r"
                    :style="{
                      '--cy': c.cy + 'px', '--deriva': c.deriva + 'px',
                      animationDuration: c.dur + 's', animationDelay: c.retardo + 's',
                    }"/>
          </g>
        </svg>

        <div class="texto">
          <div v-if="hito && !enLlegada" :key="hito.titulo" class="paso">
            <span class="paso__n" aria-hidden="true">{{ String(hito.n).padStart(2, '0') }}</span>
            <p class="paso__cota">{{ String(hito.n).padStart(2, '0') }} · {{ hito.altitud.toLocaleString('es-CL') }} m</p>
            <h2 class="paso__titulo" :aria-label="hito.titulo">
              <span v-for="pal in letrasPaso" :key="pal.w" class="palabra" aria-hidden="true">
                <span v-for="l in pal.letras" :key="l.k" class="letra"
                      :style="{ animationDelay: (l.k * 0.018).toFixed(3) + 's' }">{{ l.c }}</span>
              </span>
            </h2>
            <p class="paso__cuerpo">{{ hito.texto }}</p>
          </div>

          <div v-if="enLlegada" class="llegada">
            <span class="cejilla">{{ t('hero.cejilla') }}</span>
            <h2 class="llegada__titulo" :aria-label="`${t('hero.t1')} ${t('hero.t2')}`">
              <span v-for="pal in letrasT1" :key="'a' + pal.w" class="palabra" aria-hidden="true">
                <span v-for="l in pal.letras" :key="l.k" class="letra"
                      :style="{ animationDelay: (l.k * 0.016).toFixed(3) + 's' }">{{ l.c }}</span>
              </span>
              <em>
                <span v-for="pal in letrasT2" :key="'b' + pal.w" class="palabra" aria-hidden="true">
                  <span v-for="l in pal.letras" :key="l.k" class="letra"
                        :style="{ animationDelay: (0.22 + l.k * 0.016).toFixed(3) + 's' }">{{ l.c }}</span>
                </span>
              </em>
            </h2>
            <p class="llegada__bajada">{{ t('hero.bajada') }}</p>
            <div class="llegada__botones">
              <a class="btn btn--lava" :href="agencia.contacto.whatsappUrl">{{ t('hero.cta1') }}</a>
              <a class="btn btn--linea" href="#catalogo">{{ t('hero.cta2') }}</a>
            </div>
          </div>
        </div>

        <p class="altimetro">
          {{ t('ascenso.etiqueta') }}<br>
          <span>{{ altitud.toLocaleString('es-CL') }}</span> m
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Un solo lugar para los dos naranjos de la pieza. El original usa un naranjo
   más encendido que el `--lava` del sitio; dejarlo acá hace que probar uno u
   otro sea cambiar una línea. */
.lava{
  --fuego:#FF5B1A;
  --chispa:#FFB547;
  position:relative;background:#14100e;color:var(--nieve);
}
.pista{height:470vh}
.fijo{position:sticky;top:0;height:100svh;overflow:hidden}
.escena{position:absolute;inset:0;width:100%;height:100%}

/* Sin `vector-effect:non-scaling-stroke`. Lo llevaba para que el grosor no
   creciera con el empuje de la cámara, y a cambio rompía el dibujado: con ese
   modo el `stroke-dasharray` se mide en PIXELES de pantalla y no en unidades
   del dibujo, mientras el camino se estira con la escala. La raya quedaba más
   corta que el camino y el sendero se cortaba cerca del 70%, siempre antes de
   llegar a la cumbre. El empuje es de un 10%: el grosor aguanta. */

/* --- las marcas, que son botones --- */
.marcas g{cursor:pointer}
.marcas text{
  font:700 20px/1 var(--texto);fill:var(--nieve);
  stroke:#14100e;stroke-width:3.4;paint-order:stroke fill;
}
.marcas circle:not(.blanco){transition:fill .45s var(--ease),stroke .45s var(--ease)}
.marcas .pasada circle:not(.blanco){fill:var(--fuego);stroke:var(--fuego)}
.marcas g:focus{outline:none}
.marcas g:focus-visible .blanco{
  stroke:var(--nieve);stroke-width:1.5;stroke-dasharray:3 3;fill:none;
}


/* --- el texto, encima del dibujo --- */
.texto{
  position:absolute;z-index:2;left:var(--gutter);top:50%;transform:translateY(-50%);
  max-width:min(34rem,46vw);
}
.paso__n{
  position:absolute;top:-10rem;left:-.6rem;z-index:-1;
  font:800 12rem/1 var(--display);
  color:transparent;-webkit-text-stroke:1.5px rgba(255,91,26,.3);
}
.paso__cota{font:500 .85rem/1 ui-monospace,monospace;color:var(--fuego);letter-spacing:.06em}
.paso__titulo{font-size:clamp(1.8rem,4.2vw,3rem);line-height:1.04;margin:.5rem 0 0}
.paso__cuerpo{margin-top:.9rem;color:#b9b0a6;font-size:1.05rem}
.llegada__titulo{font-size:clamp(2rem,5vw,3.4rem);line-height:1.02;margin:.4rem 0 0}
.llegada__titulo em{font-style:normal;color:var(--fuego)}
.llegada__bajada{margin-top:.9rem;color:#b9b0a6;font-size:1.05rem;max-width:40ch}
.llegada__botones{margin-top:1.6rem;display:flex;gap:.8rem;flex-wrap:wrap}

.altimetro{
  position:absolute;z-index:2;right:var(--gutter);bottom:36px;text-align:right;
  font:500 .72rem/1.4 ui-monospace,monospace;color:#b9b0a6;letter-spacing:.1em;
  text-transform:uppercase;
}
.altimetro span{display:inline-block;font-size:1.6rem;color:var(--nieve);
  font-variant-numeric:tabular-nums}

@media (max-width:900px){
  .texto{max-width:none;right:var(--gutter);top:auto;bottom:16vh;transform:none}
  .paso__n{display:none}
}

/* Las tres capas del paralaje. El retardo lo pone esta transición: cada
   movimiento del puntero reescribe el destino y la transición vuelve a salir,
   que es lo mismo que hace `gsap.quickTo` en el original. Fuera del puntero
   fino nadie les escribe nada y se quedan quietas. */
.capa{transition:transform 1.2s var(--ease)}

/* Los títulos entran letra por letra. Cada letra sube desde debajo del borde
   de su palabra, que va con `overflow:hidden`: sin esa máscara las letras
   aparecen flotando en vez de asomarse. El relleno de abajo es para que la
   máscara no corte las colas de la jota y la ge. */
.palabra{
  display:inline-block;overflow:hidden;vertical-align:bottom;
  padding-bottom:.14em;margin-bottom:-.14em;
}
.palabra:not(:last-child){margin-right:.26em}
.llegada__titulo em .palabra:first-child{margin-left:.26em}
/* Sin `will-change`. Lo llevaba, y con el titulo partido son decenas de
   elementos pidiendo capa propia de forma permanente para una animacion que
   dura medio segundo y ocurre una vez. El arnes lo midio: 54,8 fps con el,
   60 sin el. `will-change` es para lo que cambia TODO el rato. */
.letra{display:inline-block}

@media (prefers-reduced-motion:no-preference){
  .letra{animation:lv-letra .55s var(--ease) both}
  @keyframes lv-letra{from{transform:translateY(110%);opacity:0}to{transform:none;opacity:1}}
}

/* ============================================================================
   LA VIDA DEL VOLCÁN.

   Acá está la diferencia de fondo con la otra pieza: esto NO cuelga de `p`.
   El humo sube, las brasas saltan, la boca late y la nieve cae aunque el
   visitante no mueva nada, porque un volcán hace eso exista o no alguien
   mirándolo. Lo que sí cuelga del scroll es el ascenso: sendero, escalador,
   altímetro y cámara.

   Todo corre sólo mientras la sección está a la vista, y nada corre con
   movimiento reducido.
   ========================================================================== */
.humo,.brasa,.copo,.pulso,.brillo{animation-play-state:paused}
.lava.vivo .humo,
.lava.vivo .brasa,
.lava.vivo .copo,
.lava.vivo .pulso,
.lava.vivo .brillo{animation-play-state:running}

@media (prefers-reduced-motion:no-preference){
  .humo{
    animation:lv-humo 6s ease-out infinite;
    transform-box:fill-box;transform-origin:50% 50%;
  }
  @keyframes lv-humo{
    0%  {transform:translate(0,0) scale(.4);opacity:.55}
    100%{transform:translate(var(--deriva),-190px) scale(1.9);opacity:0}
  }

  .brasa{
    animation-name:lv-brasa;animation-timing-function:cubic-bezier(.33,1,.68,1);
    animation-iteration-count:infinite;
    transform-box:fill-box;transform-origin:50% 50%;
  }
  @keyframes lv-brasa{
    0%  {transform:translate(var(--x0),0) scale(var(--esc));opacity:1}
    100%{transform:translate(var(--x1),var(--y1)) scale(.2);opacity:0}
  }

  .copo{
    animation-name:lv-copo;animation-timing-function:linear;
    animation-iteration-count:infinite;
  }
  @keyframes lv-copo{
    0%  {transform:translate(0,calc(-1 * var(--cy) - 20px))}
    100%{transform:translate(var(--deriva),calc(920px - var(--cy)))}
  }

  .brillo{animation:lv-brillo 3.2s ease-in-out infinite alternate}
  @keyframes lv-brillo{from{opacity:.9}to{opacity:.5}}

  .pulso{
    animation:lv-pulso 1.4s cubic-bezier(.16,1,.3,1) infinite;
    transform-box:fill-box;transform-origin:50% 50%;
  }
  @keyframes lv-pulso{from{transform:scale(1);opacity:1}to{transform:scale(2.6);opacity:0}}

  .paso,.llegada{animation:lv-entra .5s var(--ease) both}
  @keyframes lv-entra{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
}

/* Sin scrub la banda deja de ser alta y se entrega la cumbre, igual que en la
   otra pieza: no tiene sentido hacer recorrer pantallas de nada. */
@media (prefers-reduced-motion:reduce){
  .pista{height:auto}
  .fijo{position:relative;height:auto;min-height:70svh}
  .texto{position:relative;top:auto;transform:none;padding:clamp(60px,10vh,110px) 0}
}
</style>
