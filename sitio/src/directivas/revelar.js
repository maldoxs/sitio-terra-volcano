/* ============================================================================
   v-revelar — entrada al viewport, con cascada opcional.
   ----------------------------------------------------------------------------
       <p v-revelar>…</p>                     entra desde abajo
       <div v-revelar="'izq'">…</div>         entra desde la izquierda
       <div v-revelar.grupo>…</div>           sus hijos [data-revelar] en cascada

   Un solo IntersectionObserver para toda la página. Se deja de observar al
   revelar: un elemento que vuelve a animarse al subir distrae en vez de lucir.
   ========================================================================== */
const TOPE_CASCADA = 0.36;   // segundos: una lista larga no puede hacer esperar
const PASO_CASCADA = 0.09;

let io = null;
const grupos = new WeakSet();

function mostrar(el, retardo = 0) {
  el.style.setProperty('--retardo', retardo + 's');
  el.classList.add('visible');
  el.addEventListener('transitionend', () => el.classList.add('listo'), { once: true });
}

function observador() {
  if (io) return io;
  io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      if (grupos.has(e.target)) {
        e.target.querySelectorAll('[data-revelar]').forEach((hijo, i) => {
          mostrar(hijo, Math.min(i * PASO_CASCADA, TOPE_CASCADA));
        });
      } else {
        mostrar(e.target, 0);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
  return io;
}

export default {
  mounted(el, binding) {
    const esGrupo = !!binding.modifiers.grupo;
    if (!esGrupo) el.dataset.revelar = binding.value || '';

    // Sin JS activo o con movimiento reducido no hay nada que ocultar.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)) {
      if (esGrupo) el.querySelectorAll('[data-revelar]').forEach((h) => mostrar(h));
      else mostrar(el);
      return;
    }
    if (esGrupo) grupos.add(el);
    observador().observe(el);
  },
  unmounted(el) { io?.unobserve(el); },
};
