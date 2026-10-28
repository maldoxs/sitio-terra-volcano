<script setup>
/* Cuenta desde 0 hasta el valor cuando entra en pantalla. Reutilizable: no
   sabe nada de la banda de cifras ni de la agencia. */
import { ref, onMounted, onUnmounted } from 'vue';
import { quieto, limita01 } from '../composables/useScrollRaf.js';

const props = defineProps({
  valor:     { type: Number, default: null },
  texto:     { type: String, default: null },   // cifras que no son números ("1:3")
  decimales: { type: Number, default: 0 },
  prefijo:   { type: String, default: '' },
  separador: { type: Boolean, default: true },  // miles: 2.847 sí, año 2015 no
});

const el = ref(null);
const mostrado = ref(props.texto ?? '0');
let io = null;

const formatear = (v) => {
  const n = props.separador
    ? v.toLocaleString('es-CL', { minimumFractionDigits: props.decimales, maximumFractionDigits: props.decimales })
    : v.toFixed(props.decimales);
  return props.prefijo + n;
};

onMounted(() => {
  if (props.texto != null) return;
  if (quieto() || !('IntersectionObserver' in window)) { mostrado.value = formatear(props.valor); return; }

  io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now(), DUR = 1100;
    const paso = (now) => {
      const k = limita01((now - t0) / DUR);
      mostrado.value = formatear(props.valor * (1 - Math.pow(1 - k, 3)));  // easeOutCubic
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }, { threshold: 0.6 });
  io.observe(el.value);
});
onUnmounted(() => io?.disconnect());
</script>

<template><b ref="el">{{ mostrado }}</b></template>
