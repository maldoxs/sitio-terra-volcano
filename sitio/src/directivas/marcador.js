/* ============================================================================
   v-marcador — resaltado cuyo ancho sigue la posición del scroll.
   ----------------------------------------------------------------------------
       <span class="marca-texto" v-marcador>en 2 días</span>

   No se dispara de golpe al cruzar un umbral: el ancho ES el progreso. El
   tramo va de «el elemento al 86% del viewport» a «al 56%».
   ========================================================================== */
import { limita01 } from '../composables/useScrollRaf.js';

const ARRANQUE = 0.86;   // fracción del viewport donde empieza a pintar
const TRAMO    = 0.30;   // cuánto viewport dura el barrido

const marcas = new Set();
let instalado = false;
let pendiente = false;

function pasada() {
  pendiente = false;
  const vh = innerHeight;
  for (const el of marcas) {
    const r = el.getBoundingClientRect();
    const p = limita01((vh * ARRANQUE - r.top) / (vh * TRAMO));
    el.style.backgroundSize = (p * 100).toFixed(2) + '% 100%';
  }
}
function alScroll() { if (!pendiente) { pendiente = true; requestAnimationFrame(pasada); } }

export default {
  mounted(el) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.backgroundSize = '100% 100%';
      return;
    }
    marcas.add(el);
    if (!instalado) {
      instalado = true;
      addEventListener('scroll', alScroll, { passive: true });
      addEventListener('resize', pasada);
    }
    pasada();
  },
  unmounted(el) { marcas.delete(el); },
};
