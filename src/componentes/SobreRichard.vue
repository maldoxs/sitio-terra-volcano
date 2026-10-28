<script setup>
import { useIdioma } from '../composables/useIdioma.js';
const { t } = useIdioma();
</script>

<template>
  <section class="seccion" id="richard">
    <div class="wrap richard">
      <!-- Sin fotografía: ninguna imagen del repositorio tiene licencia
           resuelta (ver LICENCIAS-PENDIENTES.md). El espacio queda reservado
           y lo dice en voz alta en vez de poner una foto ajena. -->
      <figure class="retrato" v-revelar="'izq'">
        <figcaption>{{ t('richard.foto') }}</figcaption>
      </figure>
      <div v-revelar="'der'">
        <span class="cejilla">{{ t('richard.cejilla') }}</span>
        <h2 class="titulo">{{ t('richard.titulo') }}</h2>
        <p class="sub">{{ t('richard.p1') }}</p>
        <ul class="credenciales">
          <li v-for="(c, i) in t('richard.credenciales')" :key="i">{{ c }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.richard{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);
  gap:clamp(34px,6vw,70px);align-items:center}
.retrato{aspect-ratio:4/5;border-radius:4px;position:relative;overflow:hidden;margin:0;
  background:linear-gradient(165deg,var(--araucaria),#16261f)}
.retrato::after{content:"";position:absolute;inset:0;
  background:radial-gradient(80% 55% at 50% 12%, rgba(232,179,60,.26), transparent 60%)}
figcaption{position:absolute;left:0;right:0;bottom:0;z-index:1;padding:20px;
  font-size:12.5px;color:rgba(242,237,230,.76);line-height:1.5;
  background:linear-gradient(transparent,rgba(0,0,0,.6))}
.credenciales{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:13px}
.credenciales li{padding-left:26px;position:relative;font-size:15.5px;line-height:1.5}
.credenciales li::before{content:"—";position:absolute;left:0;color:var(--lava);font-weight:700}
@media (max-width:900px){ .richard{grid-template-columns:1fr} }
</style>
