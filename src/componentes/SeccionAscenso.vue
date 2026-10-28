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
const opLuna = ref(1);
const opNubes = ref(0);
const opSol = ref(0);
/* Las araucarias no aparecen ni desaparecen: estan siempre. Lo que cambia es
   su color, de silueta negra contra el cielo nocturno a verde encendido al
   amanecer. Es el arbol de la Araucania y da el nombre al token de la paleta. */
const tonoAraucaria = ref('rgb(30,38,50)');
/* La nieve tampoco es blanca de noche: a esa hora es un gris azulado y solo
   al amanecer se acerca al hueso de la paleta. Una nieve blanca constante
   contra un cielo que cambia es lo que hace que una escena se vea pegada. */
const tonoNieve = ref('rgb(74,88,112)');
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

/* Araucarias al pie del cerro. Posicion y escala fijas: un bosque aleatorio
   cambiaria entre cargas y haria incomparables las capturas del arnes. */
const araucarias = [
  { x:  78, e: 1.15 }, { x: 140, e: 0.85 }, { x: 196, e: 1.0 },
  { x: 812, e: 0.95 }, { x: 876, e: 1.2 },  { x: 934, e: 0.8 },
];

/* Campo de estrellas determinista (sin Math.random): dos cargas se ven igual,
   así una captura de pantalla es comparable entre ejecuciones. */
let semilla = 7;
const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
const puntosEstrella = Array.from({ length: 70 }, (_, i) => ({
  i, cx: `${(rnd() * 100).toFixed(2)}%`, cy: `${(rnd() * 62).toFixed(2)}%`,
  r: +(rnd() * 1.3 + 0.4).toFixed(2), o: +(rnd() * 0.6 + 0.25).toFixed(2),
}));

/* Paletas del cielo: noche → azul previo al alba → amanecer.
   Cada fila son las TRES paradas del gradiente, de arriba hacia el horizonte.

   La version anterior terminaba en gris-violeta arriba y dorado abajo, y el
   punto medio del degradado daba un cafe sucio. Un amanecer real no pasa por
   el cafe: el cielo alto se abre a azul mientras el horizonte se enciende, y
   entre medio aparece el durazno. Por eso la fila del dia sube el azul arriba
   en vez de apagarlo. */
const CIELOS = [
  [[ 10,  16,  30], [ 20,  28,  46], [ 32,  36,  50]],   // noche cerrada
  [[ 28,  42,  76], [ 86,  82, 110], [160, 104,  88]],   // azul previo al alba
  [[ 74, 116, 170], [220, 150, 112], [242, 188,  98]],   // amanecer
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

  /* Cada elemento del ambiente es una curva mas sobre el mismo numero. Eso es
     lo que permite agregarlos sin tocar nada de lo que ya estaba. */
  opLuna.value  = limita01(1 - p * 2.6);            // se pone antes que las estrellas
  opNubes.value = limita01((p - 0.42) / 0.33);      // llegan con la luz
  opSol.value   = limita01((p - 0.62) / 0.28);      // ultimo en salir
  /* De noche NO son negras: contra un cerro casi negro desaparecerian. Van un
     punto mas claras, lo justo para leerse como siluetas. */
  tonoAraucaria.value = mez([30, 38, 50], [47, 93, 74], limita01(p * 1.5));
  tonoNieve.value = mez([74, 88, 112], [242, 237, 230], limita01(p * 1.3));

  // 5 · fumarola: se gana al llegar al borde del crater
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

  marcas.value = MARCABLES.map((h) => {
    const pt = ruta.value.getPointAtLength(LARGO * h.p);
    /* La etiqueta va a la derecha, que es ladera abierta: la ruta sube por el
       flanco izquierdo. La cumbre es la excepcion, ahi no queda cerro a la
       derecha y el nombre se pone arriba, centrado. */
    /* Todas a la derecha, que es ladera abierta: la ruta sube por el flanco
       izquierdo. La cumbre tambien: encima esta el guia, y centrar ahi su
       nombre lo partia en dos. */
    return {
      ...h,
      x: +pt.x.toFixed(1), y: +pt.y.toFixed(1),
      lx: +(pt.x + 16).toFixed(1),
      ly: +(pt.y + 4.5).toFixed(1),
      anclaje: 'start',
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
          <!-- CIELO: luna, sol y nubes van detras del volcan. -->

          <!-- Luna menguante. El recorte es otra circunferencia desplazada:
               una menguante no es un gajo simetrico. -->
          <g :opacity="opLuna">
            <defs>
              <mask id="menguante">
                <circle cx="336" cy="84" r="26" fill="#fff"/>
                <circle cx="324" cy="76" r="24" fill="#000"/>
              </mask>
            </defs>
            <circle cx="336" cy="84" r="26" fill="#F2EDE6" mask="url(#menguante)" opacity=".92"/>
            <circle cx="336" cy="84" r="40" fill="#F2EDE6" opacity=".07"/>
          </g>

          <!-- Sol, bajo y al costado: es un amanecer, no un mediodia. -->
          <g :opacity="opSol">
            <circle cx="840" cy="236" r="78" fill="var(--azufre)" opacity=".13"/>
            <circle cx="840" cy="236" r="44" fill="var(--azufre)" opacity=".22"/>
            <circle cx="840" cy="236" r="25" fill="#FFE9B0"/>
          </g>

          <!-- Nubes: bandas horizontales, no algodones. A esta distancia y con
               el volcan de por medio, lo que se lee es el estrato. -->
          <g :opacity="opNubes" fill="#F2EDE6">
            <!-- Ninguna nube baja de y=170 por la izquierda: esa franja la ocupa
                 el panel de altitud y el texto del hito. -->
            <g opacity=".26">
              <rect x="300" y="104" width="210" height="13" rx="6.5"/>
              <rect x="360" y="124" width="130" height="10" rx="5"/>
            </g>
            <g opacity=".2">
              <rect x="640" y="150" width="250" height="12" rx="6"/>
              <rect x="700" y="170" width="150" height="9"  rx="4.5"/>
            </g>
            <g opacity=".15">
              <rect x="560" y="206" width="170" height="10" rx="5"/>
            </g>
          </g>

          <!-- EL CERRO.
               La silueta exterior no se toca: la ruta se genero contra ella y
               sus once vertices dependen de esas pendientes. Todo el detalle
               va por DENTRO. -->
          <path fill="#0d1117" d="M0 620V548l150-36 180-108 100-152 70-102 70 102 100 152 180 108 150 36v72z"/>

          <!-- Quebradas. Aristas finas que bajan de la cumbre, no cunas: una
               cuna ancha se lee como error de relleno, no como relieve. -->
          <g fill="#151c26">
            <path d="M500 152 L516 236 L540 330 L556 420 L540 356 L512 254 L503 182 z"/>
            <path d="M500 152 L488 230 L468 320 L450 404 L466 338 L492 240 L498 180 z" opacity=".75"/>
            <path d="M500 152 L530 262 L566 392 L548 348 L516 232 z" opacity=".45"/>
          </g>

          <!-- NIEVE. El borde inferior baja por las quebradas y se retira en
               las aristas, con amplitudes distintas: un zigzag de dientes
               iguales es lo que mas delata un dibujo. -->
          <path :fill="tonoNieve" opacity=".95"
                d="M392 310 L500 150 L608 310
                   Q598 288 584 312
                   Q568 340 554 304
                   Q538 320 524 296
                   Q510 332 496 302
                   Q480 316 466 294
                   Q450 328 436 300
                   Q420 314 406 298
                   Q398 306 392 310 Z"/>

          <!-- Espolones de roca asomando entre la nieve. Poligonos irregulares,
               no rombos: la simetria los convertia en adorno geometrico.
               No son decoracion, el hito «espolones» cae en esta zona. -->
          <g fill="#0d1117" opacity=".8">
            <path d="M524 206 L536 214 L541 228 L530 234 L519 222 z"/>
            <path d="M471 236 L484 241 L487 256 L474 259 L466 247 z"/>
            <path d="M549 252 L561 259 L558 272 L545 270 L542 260 z"/>
            <path d="M497 188 L506 193 L504 203 L494 201 z"/>
            <path d="M440 288 L452 294 L449 305 L437 301 z"/>
            <path d="M568 296 L579 303 L574 313 L564 307 z"/>
          </g>

          <!-- Crater: el Villarrica es un cono TRUNCADO, no una punta. -->
          <ellipse cx="500" cy="152" rx="17" ry="6" fill="#0d1117" opacity=".9"/>
          <path d="M483 152 a17 6 0 0 0 34 0" fill="none"
                stroke="#0d1117" stroke-width="2.5" opacity=".6"/>

          <!-- ARAUCARIAS. El arbol de la Araucania, y el token que da nombre
               a su color en la paleta. Tronco recto y copa en candelabro: a
               esta distancia es la silueta lo que las identifica.
               No aparecen ni desaparecen, estan siempre; lo que cambia es el
               tono, de negro contra el cielo nocturno a verde al amanecer. -->
          <g :fill="tonoAraucaria">
            <g v-for="a in araucarias" :key="a.x"
               :transform="`translate(${a.x} 596) scale(${a.e})`">
              <rect x="-2.2" y="-46" width="4.4" height="46"/>
              <path d="M-21 -46 L0 -52 L21 -46 L12 -43 L0 -47 L-12 -43 Z"/>
              <path d="M-17 -56 L0 -61 L17 -56 L10 -53 L0 -56.5 L-10 -53 Z"/>
              <path d="M-12 -65 L0 -70 L12 -65 L7 -62 L0 -65 L-7 -62 Z"/>
              <path d="M-7 -73 L0 -78 L7 -73 L0 -75 Z"/>
            </g>
          </g>

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

          <defs>
            <radialGradient id="sombraGuia">
              <stop offset="0%"   stop-color="#000" stop-opacity=".5"/>
              <stop offset="100%" stop-color="#000" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <!-- EL GUIA.
               A escala real sobre un volcan de 1000 unidades una persona seria
               invisible, asi que va sobrescalado: lo que se lee a esta
               distancia es la silueta, no el detalle.
               El grupo se posiciona con getPointAtLength y la figura se dibuja
               con los PIES en el origen, de modo que PISA el trazo en vez de
               flotar sobre el. -->
          <g ref="escalador" class="guia-grupo" opacity="0">
            <!-- La sombra es un degradado radial, no una elipse solida: sobre
                 la nieve de la cumbre una elipse opaca se leia como mancha. -->
            <ellipse rx="26" ry="9" cy="3" fill="url(#sombraGuia)"/>
            <g class="guia" transform="translate(0 2) scale(1.3)">
              <!-- Pictograma de montanista: inclinado hacia adelante, mochila
                   alta y dos bastones, uno clavado adelante y otro quedandose
                   atras. La inclinacion es lo que distingue a alguien que SUBE
                   de alguien parado, y a esta distancia es lo unico que se lee.
                   Dibujado con los pies en y=0, asi la figura PISA el trazo
                   cuando el grupo se posiciona con getPointAtLength. -->

              <!-- bastones, por detras del cuerpo -->
              <path d="M13.5 -21.5 L18.5 -1" stroke="#E6DFD2" stroke-width="1.6"
                    stroke-linecap="round" opacity=".9"/>
              <path d="M-2.5 -20.5 L-11 -1" stroke="#E6DFD2" stroke-width="1.6"
                    stroke-linecap="round" opacity=".7"/>

              <!-- pierna de atras, empujando -->
              <path d="M-0.5 -14.5 L-5 -7.5 L-8.5 -0.8" fill="none" stroke="var(--guia)"
                    stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
              <!-- brazo de atras, hacia el baston que queda detras -->
              <path d="M3 -28.5 L0 -24 L-2.5 -20.5" fill="none" stroke="var(--guia)"
                    stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- mochila: bulto rectangular de esquinas blandas, no un globo -->
              <path d="M-6.8 -29.5 a3.4 3.4 0 0 1 3.2 -3.2 L2 -32 L3.5 -17.8
                       L-3.2 -17 a3.4 3.4 0 0 1 -3.6 -3.1 Z" fill="var(--azufre)"/>
              <!-- correa de la mochila cruzando el pecho -->
              <path d="M1.5 -30.5 L4.5 -19.5" stroke="var(--azufre)" stroke-width="1.5"
                    stroke-linecap="round" opacity=".9"/>

              <!-- torso, mas angosto que la version anterior -->
              <path d="M2.2 -31.5 L7.6 -29.8 L3.6 -15 L-1.4 -16.4 Z" fill="var(--guia)"/>

              <!-- pierna de adelante, cargando el paso -->
              <path d="M2.4 -15.5 L6.8 -8.5 L9.5 -0.8" fill="none" stroke="var(--guia)"
                    stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
              <!-- brazo de adelante, al baston clavado -->
              <path d="M6.6 -28.8 L10.4 -25 L13.5 -21.5" fill="none" stroke="var(--guia)"
                    stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- cabeza, adelantada del hombro: va mirando la cuesta -->
              <circle cx="9.2" cy="-33.4" r="3.6" fill="var(--guia)"/>
              <!-- gorro: casquete que sigue la curva, no una tapa plana -->
              <path d="M5.7 -34.2 a3.6 3.6 0 0 1 7 -0.9 Z" fill="var(--azufre)"/>
            </g>
          </g>
          <!-- FUMAROLA. Columna que sale del crater y se desarma con el
               viento, en vez de dos circulos. El brillo de la boca queda
               debajo del penacho para que se lea como fuente de la columna. -->
          <g :opacity="opFumarola" class="fumarola">
            <circle cx="500" cy="150" r="19" fill="var(--azufre)" opacity=".22"/>
            <circle cx="500" cy="150" r="8"  fill="#FFE9B0" opacity=".55"/>
            <g fill="#F2EDE6">
              <ellipse cx="502" cy="132" rx="13" ry="10" opacity=".5"/>
              <ellipse cx="509" cy="110" rx="18" ry="13" opacity=".42"/>
              <ellipse cx="521" cy="86"  rx="24" ry="16" opacity=".32"/>
              <ellipse cx="539" cy="60"  rx="31" ry="19" opacity=".22"/>
              <ellipse cx="563" cy="34"  rx="38" ry="22" opacity=".13"/>
            </g>
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

/* El guia lleva su propio color, distinto al de la ruta. Si los dos son lava,
   la figura se funde con el trazo que esta recorriendo y deja de leerse como
   alguien sobre un camino. Una variable para cambiarlo de un solo lugar. */
.ascenso{--guia:var(--lago)}

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
