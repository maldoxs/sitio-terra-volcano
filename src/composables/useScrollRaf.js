/* ============================================================================
   UN SOLO requestAnimationFrame para toda la página.
   ----------------------------------------------------------------------------
   Cada componente que necesita reaccionar al scroll se suscribe acá en vez de
   poner su propio addEventListener. Con cinco componentes sueltos tendrías
   cinco listeners y cinco rAF compitiendo; con esto hay uno, y los callbacks
   corren en orden dentro del mismo frame.

   Uso dentro de un componente:
       import { onScroll } from '@/composables/useScrollRaf';
       onScroll(() => { ... });      // se da de baja solo al desmontar
   ========================================================================== */
import { onMounted, onUnmounted } from 'vue';

const suscritos = new Set();
let instalado = false;
let pendiente = false;

function pasada() {
  pendiente = false;
  for (const fn of suscritos) fn();
}

function alScroll() {
  if (!pendiente) { pendiente = true; requestAnimationFrame(pasada); }
}

function instalar() {
  if (instalado) return;
  instalado = true;
  addEventListener('scroll', alScroll, { passive: true });
  addEventListener('resize', pasada);
}

/** Registra `fn` para que corra en cada frame con scroll. Se limpia al desmontar. */
export function onScroll(fn) {
  onMounted(() => {
    instalar();
    suscritos.add(fn);
    fn();                       // primera pasada: deja el estado correcto al montar
  });
  onUnmounted(() => { suscritos.delete(fn); });
}

/** Fuerza una pasada manual (por ejemplo al cambiar de idioma y repintar). */
export function repasar() { pasada(); }

export const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const limita01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
