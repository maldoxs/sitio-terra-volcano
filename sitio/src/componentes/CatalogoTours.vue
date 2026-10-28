<script setup>
/* Carrusel en profundidad: la tarjeta del frente a escala 1, las vecinas a
   .74, las de más allá invisibles. La posición relativa decide todo. */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { quieto } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();
const INTERVALO = 3000;

const tours = computed(() => agencia.catalogo.map((c) => ({
  id: c.id,
  nivel: c.nivel,
  nombre: t(`catalogo.tours.${c.id}.nombre`),
  meta: t(`catalogo.tours.${c.id}.meta`, {
    altitud: c.altitud?.toLocaleString('es-CL'),
    volcanes: c.volcanes?.join(', '),
  }),
})));

const raiz = ref(null);
const activo = ref(0);
let temporizador = 0;
let ioVisible = null;
let x0 = null;

const n = () => tours.value.length;

/** Distancia circular con signo: -2, -1, 0, 1, 2 respecto de la activa. */
function desfase(i) {
  let o = ((i - activo.value) % n() + n()) % n();
  if (o >= n() / 2) o -= n();
  return o;
}
function estilo(i) {
  const o = desfase(i), abs = Math.abs(o);
  const escala = abs === 0 ? 1 : abs === 1 ? 0.74 : 0.52;
  return {
    transform: `translateX(calc(-50% + ${o * 84}%)) translateY(${abs ? 8 : 0}%) scale(${escala})`,
    zIndex: 10 - abs,
    opacity: abs > 1 ? 0 : abs === 1 ? 0.62 : 1,
    filter: abs ? 'saturate(.75) brightness(.9)' : 'none',
    pointerEvents: abs > 1 ? 'none' : '',
  };
}

const ir = (i) => { activo.value = (i + n()) % n(); };
const parar = () => clearInterval(temporizador);
const reiniciar = () => { parar(); if (!quieto()) temporizador = setInterval(() => ir(activo.value + 1), INTERVALO); };
const tocar = (i) => { if (i !== activo.value) { ir(i); reiniciar(); } };

function alSoltar(e) {
  if (x0 === null) return;
  const dx = e.clientX - x0; x0 = null;
  if (Math.abs(dx) > 40) { ir(activo.value + (dx < 0 ? 1 : -1)); reiniciar(); }
}

onMounted(() => {
  // Sólo corre mientras se ve: un carrusel girando fuera de pantalla gasta
  // batería sin que nadie lo mire.
  ioVisible = new IntersectionObserver(([e]) => (e.isIntersecting ? reiniciar() : parar()));
  ioVisible.observe(raiz.value);
});
onUnmounted(() => { parar(); ioVisible?.disconnect(); });
</script>

<template>
  <section class="seccion" id="catalogo">
    <div class="wrap">
      <span class="cejilla" v-revelar>{{ t('catalogo.cejilla') }}</span>
      <h2 class="titulo" v-revelar>{{ t('catalogo.titulo') }}</h2>
      <p class="sub" v-revelar>{{ t('catalogo.sub') }}</p>

      <div ref="raiz" class="carrusel" aria-roledescription="carrusel"
           @pointerdown="x0 = $event.clientX" @pointerup="alSoltar">
        <figure v-for="(tour, i) in tours" :key="tour.id" class="tour"
                :class="`nivel-${tour.nivel}`" :style="estilo(i)"
                :aria-hidden="desfase(i) !== 0" @click="tocar(i)">
          <div class="tarjeta">
            <span class="nivel">{{ t('catalogo.niveles')[tour.nivel] }}</span>
            <h3>{{ tour.nombre }}</h3>
            <p class="meta">{{ tour.meta }}</p>
          </div>
        </figure>
        <div class="puntos" role="tablist">
          <button v-for="(tour, i) in tours" :key="tour.id" type="button" role="tab"
                  :aria-label="tour.nombre" :aria-selected="desfase(i) === 0"
                  @click="tocar(i)"></button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.carrusel{position:relative;height:clamp(330px,46vw,460px);margin-top:clamp(40px,6vw,64px)}
.tour{position:absolute;left:50%;top:0;width:clamp(230px,27vw,320px);margin:0;cursor:pointer;
  transition:transform .66s var(--ease),opacity .66s var(--ease),filter .66s var(--ease)}
.tarjeta{aspect-ratio:3/4;border-radius:4px;padding:24px;display:flex;flex-direction:column;
  justify-content:flex-end;color:var(--nieve);position:relative;overflow:hidden;
  background:linear-gradient(170deg,#1d2b24,#0f1613)}
.tarjeta::after{content:"";position:absolute;inset:0;
  background:radial-gradient(90% 60% at 50% 0%, rgba(232,179,60,.3), transparent 62%)}
.tarjeta > *{position:relative;z-index:1}
/* Un degradado por nivel de exigencia: verde accesible, lava alta montaña. */
.nivel-1 .tarjeta{background:linear-gradient(170deg,#1b3242,#0e1920)}
.nivel-2 .tarjeta{background:linear-gradient(170deg,#3d2e14,#17120a)}
.nivel-3 .tarjeta{background:linear-gradient(170deg,#3a2118,#14110F)}
h3{font-size:1.45rem;font-weight:700;line-height:1.1}
.meta{margin-top:9px;font-size:13px;color:rgba(242,237,230,.7)}
.nivel{align-self:flex-start;margin-bottom:auto;font:700 10px/1 var(--texto);
  letter-spacing:.14em;text-transform:uppercase;padding:7px 11px;border-radius:999px;
  background:rgba(242,237,230,.14);border:1px solid rgba(242,237,230,.22)}
.puntos{display:flex;gap:7px;justify-content:center;margin-top:30px}
.puntos button{width:30px;height:30px;padding:0;border:0;background:none;cursor:pointer;
  display:grid;place-items:center}
.puntos button::after{content:"";width:24px;height:2px;border-radius:99px;
  background:rgba(20,17,15,.2);transition:background-color .4s var(--ease)}
.puntos button[aria-selected="true"]::after{background:var(--lava)}
@media (prefers-reduced-motion:reduce){ .tour{transition:none} }
</style>
