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
import { ref, shallowRef, computed, onMounted } from 'vue';
import { onScroll, quieto, limita01 } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();

const seccion = ref(null);
const ruta    = ref(null);
const escalador = ref(null);
/* La cordada. El guia va adelante y tres clientes detras, desfasados sobre el
   mismo trazo: es la ratio 1:3 mostrada en vez de explicada, que es el
   diferenciador de la agencia y hoy solo vivia en el texto. */
const cordada = ref([]);
/* Separacion calibrada contra el largo del trazo: con desfases de 0.022 las
   cuatro figuras se encimaban y la cordada se leia como una mancha. Cada
   una figura mide unas 22 unidades del viewBox y el trazo entero 479, asi que
   hacen falta al menos 0.07 entre una y otra para que no se toquen. Quedan
   estiradas sobre la cuesta, que es como va una cordada de verdad. */
const DESFASES = [0.085, 0.155, 0.225];
const cielo   = ref(null);
const estrellas = ref(null);

const altitud = ref(0);
const opFumarola = ref(0);
const opColumna = ref(0);
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
/* La bruma del pie del cerro toma la hora del dia como todo lo demas: azul
   apagado de noche, durazno al amanecer. Una bruma de color fijo contra un
   cielo que cambia es lo que delata una capa pegada encima. */
const tonoBruma = ref('rgb(44,56,78)');
const anchoVara = ref('0%');
/* Fase del paso, de 0 a 1. Como todo lo demas, es funcion del progreso: el
   guia no camina con un reloj propio sino con el scroll. Si el visitante se
   detiene, la figura se queda con el pie en el aire, y eso es correcto: la
   pieza no tiene vida propia, la pone quien scrollea. */
const PASOS = 42;                       // zancadas en todo el ascenso
const fase = ref(0);
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
   garantizado por el método en vez de ser algo que haya que comprobar.
   Regenerada al curvar los flancos: el perfil cóncavo mueve la ladera hasta
   32 unidades hacia el eje a media altura, y los vértices viejos quedaban
   fuera del cerro. El techo de la holgura es proporcional al ancho que queda
   hasta el eje de la cumbre, así el sendero converge solo al cráter en vez de
   cruzarse al flanco derecho. */
const D_RUTA = 'M224.9 506 L284.9 472 L326 439 L350.9 405 L364.8 372 L380.1 338 L406.6 304 L440.7 271 L481.1 237 L487 204 L500 166';

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

/* Las piernas en funcion de la fase, en oposicion: cuando una va adelante la
   otra queda atras, desfasadas media zancada. El tobillo no baja de y=0
   porque ahi esta el suelo. */
const AMPLITUD = 5.2;
const avanceDelantero = computed(() => Math.sin(fase.value * Math.PI * 2) * AMPLITUD);
const avanceTrasero   = computed(() => Math.sin(fase.value * Math.PI * 2 + Math.PI) * AMPLITUD);
const piernaDelantera = computed(() => {
  const a = avanceDelantero.value;
  return `M2.4 -15.5 L${(6.8 + a * 0.45).toFixed(1)} ${(-8.5 + Math.abs(a) * 0.18).toFixed(1)} L${(9.5 + a).toFixed(1)} -0.8`;
});
const piernaTrasera = computed(() => {
  const a = avanceTrasero.value;
  return `M-0.5 -14.5 L${(-5 + a * 0.45).toFixed(1)} ${(-7.5 + Math.abs(a) * 0.18).toFixed(1)} L${(-8.5 + a).toFixed(1)} -0.8`;
});
/* Las botas van donde termina cada pierna. Se dibujan aparte y no como punta
   del mismo trazo porque son de otro color: a esta escala, el pie oscuro bajo
   la pierna clara es lo que separa a alguien calzado de un palo. */
const botaDelantera = computed(() => `translate(${(9.5 + avanceDelantero.value).toFixed(1)} -0.9)`);
const botaTrasera   = computed(() => `translate(${(-8.5 + avanceTrasero.value).toFixed(1)} -0.9)`);
/* Balanceo: el cuerpo sube un poco cuando una pierna pasa por su punto mas
   alto. Es lo que separa caminar de deslizarse. */
const balanceo = computed(() => -Math.abs(Math.cos(fase.value * Math.PI * 2)) * 0.8);

/* EL PENACHO. Cinco bocanadas que crecen y se desarman con el viento. La
   deriva es funcion del progreso, igual que el paso del guia: sin reloj
   propio. Cada bocanada va con su propio desfase y con amplitud creciente,
   asi la columna se ondula en vez de desplazarse entera como un bloque. */
const BOCANADAS = [
  { x: 502, y: 132, rx: 13, ry: 10, o: 0.50 },
  { x: 509, y: 110, rx: 18, ry: 13, o: 0.42 },
  { x: 521, y:  86, rx: 24, ry: 16, o: 0.32 },
  { x: 539, y:  60, rx: 31, ry: 19, o: 0.22 },
  { x: 563, y:  34, rx: 38, ry: 22, o: 0.13 },
];
const CICLOS_VIENTO = 16;           // ondulaciones a lo largo de todo el ascenso
const penacho = computed(() => BOCANADAS.map((b, i) => {
  const t = pActual.value * CICLOS_VIENTO * Math.PI * 2 - i * 1.1;
  const amp = 3 + i * 3.2;          // arriba el viento manda mas que abajo
  return {
    i,
    cx: +(b.x + Math.sin(t) * amp).toFixed(1),
    cy: +(b.y + Math.cos(t) * amp * 0.22).toFixed(1),
    rx: +(b.rx * (1 + Math.sin(t + 0.7) * 0.07)).toFixed(1),
    ry: b.ry,
    o: b.o,
  };
}));

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

  /* Los clientes van sobre el mismo trazo, detras del guia. Se les pide el
     punto a la ruta igual que a el, asi nunca se despegan del camino. */
  cordada.value = DESFASES.map((d) => {
    const q = p - d;
    if (q <= 0) return null;
    const pt = ruta.value.getPointAtLength(LARGO * q);
    return { x: +pt.x.toFixed(1), y: +pt.y.toFixed(1), o: limita01(q * 14) };
  }).filter(Boolean);

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
  tonoBruma.value = mez([44, 56, 78], [229, 186, 150], limita01(p * 1.2));

  // 5 · fumarola: la boca encendida se gana al llegar al borde del crater
  opFumarola.value = limita01((p - 0.86) / 0.14);
  /* La columna, en cambio, se ve desde mucho antes y apenas insinuada: el
     Villarrica humea todo el dia y un volcan que recien empieza a fumar al
     llegar arriba se lee como un premio, no como un cerro activo. Al llegar
     manda opFumarola y el penacho se abre del todo. */
  opColumna.value = Math.max(opFumarola.value, limita01((p - 0.28) / 0.22) * 0.3);

  // 6 · hitos: cambian al cruzar su altitud, no en cada frame
  let i = -1;
  for (let n = 0; n < HITOS.length; n++) if (p >= HITOS[n].p) i = n;
  if (i !== idxHito) {
    idxHito = i;
    const h = i < 0 ? null : HITOS[i];
    hito.value = h ? { ...t(`ascenso.hitos.${h.id}`), altitud: h.altitud } : null;
  }

  pActual.value = p;
  fase.value = (p * PASOS) % 1;

  anchoVara.value = (p * 100).toFixed(1) + '%';
}
/* Saltar a un hito. La posicion se despeja de la misma cuenta con que se
   calcula el progreso: p = -rect.top / (alto - viewport). Por eso un hito
   siempre cae donde su altitud dice, sin numeros afinados a mano. */
function irAlHito(hito) {
  if (!seccion.value) return;
  const arriba = seccion.value.getBoundingClientRect().top + scrollY;
  const recorrido = seccion.value.offsetHeight - innerHeight;
  scrollTo({
    top: arriba + recorrido * hito.p,
    behavior: quieto() ? 'auto' : 'smooth',
  });
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
               Perfil CONCAVO, no una polilinea de flancos rectos: empinado
               junto al crater y abriendose hacia la base. Esa curvatura es lo
               que hace que se lea como estratovolcan y no como un cono
               generico, y es lo que distingue al Villarrica de un triangulo.

               La curva es x = 500 - (182u + 168u^2.3), con u la fraccion de
               altura entre el crater y el pie. El termino lineal fija el
               angulo del cono arriba; el de potencia hace el ensanche de
               abajo. Sin el lineal la cumbre sale como aguja vertical.

               El cono es TRUNCADO de verdad: la curva se corta en y=150
               justo donde mide 17 unidades de media boca, que es el rx de la
               elipse del crater. Antes terminaba en punta y la elipse quedaba
               flotando por encima del vertice, como un aro.

               Van tres Bezier cubicas con las tangentes de la propia curva en
               los extremos: el error maximo del ajuste es 0,03 unidades, que
               a esta escala es una centesima de pixel.

               La falda (del pie a y=548) no se toco: ahi estan las araucarias
               y moverla las habria dejado dentro del cerro. -->
          <defs>
            <!-- La luz viene del sol, que esta arriba a la derecha. El flanco
                 derecho recibe y el izquierdo queda en sombra: un relleno
                 plano deja el cono como una silueta recortada, sin volumen. -->
            <linearGradient id="ladera" x1="1" y1="0.1" x2="0.05" y2="0.95">
              <stop offset="0%"   stop-color="#1b2431"/>
              <stop offset="46%"  stop-color="#101722"/>
              <stop offset="100%" stop-color="#070a0f"/>
            </linearGradient>
            <!-- El filo no se enciende parejo de arriba a abajo: se apaga al
                 entrar en la bruma del pie. Un trazo de grosor constante y
                 color plano se lee como contorno dibujado, no como luz. -->
            <linearGradient id="filoLuz" gradientUnits="userSpaceOnUse"
                            x1="0" y1="150" x2="0" y2="470">
              <stop offset="0%"   stop-color="var(--azufre)"/>
              <stop offset="52%"  stop-color="var(--azufre)" stop-opacity=".55"/>
              <stop offset="100%" stop-color="var(--azufre)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path fill="url(#ladera)" d="M0 620V548L150 512C203.4 474.7 250.1 437.3 290.7 400C338 356.7 377 313.3 409.3 270C439.1 230 463 190 483 150L517 150C537 190 560.9 230 590.7 270C623 313.3 662 356.7 709.3 400C749.9 437.3 796.6 474.7 850 512L1000 548V620Z"/>

          <!-- Filo encendido del flanco derecho. Es la MISMA curva de la
               silueta, trazada en vez de rellenada, y crece con el sol: el
               borde se enciende cuando el sol sale, no antes. -->
          <path class="filo" :opacity="opSol * 0.6" fill="none"
                stroke="url(#filoLuz)" stroke-width="2.2" stroke-linecap="round"
                d="M517 150C537 190 560.9 230 590.7 270C623 313.3 662 356.7 709.3 400C749.9 437.3 796.6 474.7 850 512"/>

          <!-- Quebradas. Aristas finas que bajan de la cumbre, no cunas: una
               cuna ancha se lee como error de relleno, no como relieve. -->
          <g fill="#151c26">
            <path d="M500 152 L516 236 L540 330 L556 420 L540 356 L512 254 L503 182 z"/>
            <path d="M500 152 L488 230 L468 320 L450 404 L466 338 L492 240 L498 180 z" opacity=".75"/>
            <path d="M500 152 L530 262 L566 392 L548 348 L516 232 z" opacity=".45"/>
          </g>

          <!-- NIEVE. El borde inferior baja por las quebradas y se retira en
               las aristas, con amplitudes distintas: un zigzag de dientes
               iguales es lo que mas delata un dibujo.
               Los dos bordes de arriba siguen la MISMA curva del cono con un
               retranqueo de 6 unidades, que se cierra al acercarse al crater:
               con los bordes rectos de antes la nieve se asomaba por fuera de
               la silueta curva, y con un retranqueo fijo los dos bordes se
               cruzaban en la cumbre, donde el cono mide dos unidades. -->
          <path :fill="tonoNieve" opacity=".95"
                d="M383.6 312
                   C403.2 286.7 420.8 263.3 436.6 240
                   C456.8 210 472.3 180 487.3 150
                   L512.8 150
                   C527.7 180 543.2 210 563.4 240
                   C579.2 263.3 596.8 286.7 616.4 310
                   Q605.9 332 595.3 312 Q584.7 298 574.1 305
                   Q563.5 326 552.9 312 Q542.3 304 531.8 305
                   Q521.2 340 510.6 312 Q500 300 489.4 305
                   Q478.8 330 468.2 312 Q457.7 306 447.1 305
                   Q436.5 336 425.9 312 Q415.3 302 404.7 305
                   Q394.1 324 383.6 312 Z"/>

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

          <!-- BRUMA del pie del cerro. Separa la montana del suelo y le da
               escala: sin ella el cono se apoya en una linea dura y se lee
               cerca. Va delante del cerro y detras de las araucarias, que es
               donde esta de verdad. -->
          <defs>
            <linearGradient id="bruma" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  :stop-color="tonoBruma" stop-opacity="0"/>
              <stop offset="58%" :stop-color="tonoBruma" stop-opacity=".34"/>
              <stop offset="100%" :stop-color="tonoBruma" stop-opacity=".6"/>
            </linearGradient>
          </defs>
          <rect x="0" y="424" width="1000" height="196" fill="url(#bruma)"/>

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
            <g v-for="m in marcas" :key="m.id"
               :class="{ pasada: pActual >= m.p }"
               role="button" tabindex="0"
               :aria-label="`${t(`ascenso.hitos.${m.id}`).titulo}, ${m.altitud} m`"
               @click="irAlHito(m)"
               @keydown.enter.prevent="irAlHito(m)"
               @keydown.space.prevent="irAlHito(m)">
              <!-- Area de click generosa e invisible: un circulo de 5,5 unidades
                   es un blanco de 8 px en pantalla, imposible de apuntar. -->
              <circle :cx="m.x" :cy="m.y" r="17" fill="transparent" class="blanco"/>
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

          <!-- LOS TRES CLIENTES. Silueta simplificada y en tono apagado: el
               guia tiene que seguir siendo el que se lee. Van delante en el
               codigo y detras en el dibujo. -->
          <g class="cordada">
            <g v-for="(c, i) in cordada" :key="i"
               :transform="`translate(${c.x} ${c.y})`" :opacity="c.o * 0.82">
              <g transform="translate(0 2) scale(0.82)">
                <path d="M9.5 -19 L13.5 -1" stroke="var(--cliente-pack)" stroke-width="1.4"
                      stroke-linecap="round" opacity=".9"/>
                <path d="M-1 -13.5 L-5 -7 L-8 -0.8" fill="none" stroke="var(--cliente)"
                      stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M-6 -27 a3 3 0 0 1 2.8 -2.8 L1 -29 L2.4 -16.5
                         L-2.6 -15.8 a3 3 0 0 1 -3.2 -2.7 Z" fill="var(--cliente-pack)"/>
                <path d="M1.6 -28.5 L6.6 -27 L3.2 -13.8 L-0.9 -15 Z" fill="var(--cliente)"/>
                <path d="M2.2 -14.2 L6 -8 L8.4 -0.8" fill="none" stroke="var(--cliente)"
                      stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5.4 -26 L8 -22.5 L9.5 -19" fill="none" stroke="var(--cliente)"
                      stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="8.2" cy="-30" r="3.2" fill="var(--cliente)"/>
              </g>
            </g>
          </g>

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
            <g class="guia" :transform="`translate(0 ${(2 + balanceo).toFixed(2)}) scale(1.3)`">
              <!-- Pictograma de montanista: inclinado hacia adelante, mochila
                   alta y dos bastones, uno clavado adelante y otro quedandose
                   atras. La inclinacion es lo que distingue a alguien que SUBE
                   de alguien parado, y a esta distancia es lo unico que se lee.
                   Dibujado con los pies en y=0, asi la figura PISA el trazo
                   cuando el grupo se posiciona con getPointAtLength. -->

              <!-- Un solo baston, el clavado adelante. El trasero salia por
                   detras de la mochila y se leia como una linea suelta.
                   En azufre, igual que mochila y gorro: deja a la figura con
                   dos colores en vez de tres, y el equipo se lee como un
                   conjunto en lugar de piezas sueltas. -->
              <path d="M13.5 -21.5 L18.5 -1" stroke="var(--azufre)" stroke-width="1.7"
                    stroke-linecap="round"/>

              <!-- pierna de atras, empujando -->
              <path :d="piernaTrasera" fill="none" stroke="var(--guia)"
                    stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
              <!-- brazo de atras, colgando con el impulso del paso -->
              <path d="M3 -28.5 L0.5 -23.5 L-1.5 -19" fill="none" stroke="var(--guia)"
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
              <path :d="piernaDelantera" fill="none" stroke="var(--guia)"
                    stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
              <!-- brazo de adelante, al baston clavado -->
              <path d="M6.6 -28.8 L10.4 -25 L13.5 -21.5" fill="none" stroke="var(--guia)"
                    stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- guante en la mano que empuna el baston: un punto claro en
                   el extremo del brazo, que es donde el ojo busca la mano -->
              <circle cx="13.2" cy="-21.9" r="1.4" fill="var(--nieve)" opacity=".85"/>

              <!-- cabeza, adelantada del hombro: va mirando la cuesta -->
              <circle cx="9.2" cy="-33.4" r="3.6" fill="var(--guia)"/>
              <!-- gorro: casquete que sigue la curva, no una tapa plana -->
              <path d="M5.7 -34.2 a3.6 3.6 0 0 1 7 -0.9 Z" fill="var(--azufre)"/>
              <!-- pompon: lo que termina de decir que es gorro de lana y no
                   casco. Va en nieve, que es el unico tercer tono que la
                   figura se permite, y mide menos que la cabeza. -->
              <circle cx="9.3" cy="-37.3" r="1.3" fill="var(--nieve)"/>

              <!-- BOTAS. Van al final para quedar sobre la pierna, y en tono
                   oscuro propio: el pie oscuro bajo la pierna clara es lo que
                   separa a alguien calzado de un palo. -->
              <g fill="var(--bota)">
                <path :transform="botaTrasera"   d="M-2.6 -1.9 h4.4 a1 1 0 0 1 1 1 v1.9 h-6.4 a1 1 0 0 1 1 -2.9 z"/>
                <path :transform="botaDelantera" d="M-2.2 -1.9 h4 a1 1 0 0 1 1 1 l.6 1.9 h-6.6 a1 1 0 0 1 1 -2.9 z"/>
              </g>
            </g>
          </g>
          <!-- FUMAROLA. Columna que sale del crater y se desarma con el
               viento, en vez de dos circulos. El brillo de la boca queda
               debajo del penacho para que se lea como fuente de la columna. -->
          <g class="fumarola">
            <!-- La boca encendida sigue siendo el premio de llegar al borde. -->
            <g :opacity="opFumarola">
              <circle cx="500" cy="150" r="19" fill="var(--azufre)" opacity=".22"/>
              <circle cx="500" cy="150" r="8"  fill="#FFE9B0" opacity=".55"/>
            </g>
            <!-- La columna se mueve con el scroll: la deriva de cada bocanada
                 sale de `p`, no de un reloj. Si el visitante se detiene, el
                 humo se queda donde esta, igual que el pie del guia. -->
            <g fill="#F2EDE6" :opacity="opColumna">
              <ellipse v-for="b in penacho" :key="b.i"
                       :cx="b.cx" :cy="b.cy" :rx="b.rx" :ry="b.ry" :opacity="b.o"/>
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
/* El guia lleva --lago; los clientes un tono apagado que los deja presentes
   sin competir. Tres figuras del mismo color que el guia convertirian la
   cordada en una mancha. */
/* La bota es el unico tono oscuro de la figura: tiene que leerse como pie
   apoyado sobre la nieve y sobre la roca negra por igual. */
.ascenso{--guia:var(--lago); --cliente:#96a6bd; --cliente-pack:#b09a78; --bota:#243041}

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

/* Son botones: tienen que verse pulsables y responder al teclado. */
.marcas g{cursor:pointer}
.marcas g:hover circle:not(.blanco),
.marcas g:focus-visible circle:not(.blanco){stroke:var(--azufre);r:8}
.marcas g:hover text,
.marcas g:focus-visible text{opacity:1;transform:none}
.marcas g:focus{outline:none}
.marcas g:focus-visible .blanco{
  stroke:var(--nieve);stroke-width:1.5;stroke-dasharray:3 3;fill:none;
}

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
