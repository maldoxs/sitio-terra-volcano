<script setup>
import { useIdioma } from '../composables/useIdioma.js';
const { t, agencia } = useIdioma();
</script>

<template>
  <section class="cierre seccion" id="reservar">
    <div class="wrap">
      <span class="cejilla azufre" v-revelar>{{ t('cta.cejilla') }}</span>
      <h2 class="titulo" v-revelar>{{ t('cta.titulo') }}</h2>
      <p class="sub" v-revelar>{{ t('cta.sub') }}</p>
      <div class="acciones" v-revelar>
        <a class="btn btn--lava" :href="agencia.contacto.whatsappUrl">{{ t('cta.wa') }}</a>
        <a class="btn btn--linea" href="#catalogo">{{ t('cta.ver') }}</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cierre{background:linear-gradient(170deg,#1d1512,var(--obsidiana));color:var(--nieve);text-align:center}
.azufre{color:var(--azufre)}
.cierre :deep(.titulo){color:var(--nieve);margin:0 auto 20px;max-width:15ch}
.cierre :deep(.sub){color:rgba(242,237,230,.66);margin:0 auto 36px}
.acciones{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.cierre :deep(.btn--linea){border-color:rgba(242,237,230,.3);color:var(--nieve)}
.cierre :deep(.btn--linea:hover){background:var(--nieve);color:var(--obsidiana)}
</style>
