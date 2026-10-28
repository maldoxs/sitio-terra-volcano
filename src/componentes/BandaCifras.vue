<script setup>
/* Las cifras salen de datos/agencia.json. No están escritas en el template:
   si Richard corrige una reseña, se corrige en el JSON y acá se refleja. */
import ContadorCifra from './ContadorCifra.vue';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();
const r = agencia.reputacion;

const cifras = [
  { valor: r.googleEstrellas, decimales: 1, clave: 'cifras.google' },
  { valor: r.googleOpiniones, decimales: 0, clave: 'cifras.opiniones' },
  { valor: r.tripadvisorPuesto, decimales: 0, prefijo: '#', clave: 'cifras.tripadvisor' },
  { texto: agencia.operacion.ratioGuia, clave: 'cifras.ratio' },
  { valor: agencia.identidad.fundacion, decimales: 0, separador: false, clave: 'cifras.desde' },
];
</script>

<template>
  <section class="cifras">
    <div class="wrap" v-revelar.grupo>
      <div v-for="c in cifras" :key="c.clave" class="cifra" data-revelar="zoom">
        <ContadorCifra v-bind="c" />
        <span>{{ t(c.clave) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cifras{background:var(--obsidiana);color:var(--nieve)}
.wrap{padding:clamp(54px,8vw,84px) var(--gutter);
  display:grid;gap:34px;grid-template-columns:repeat(auto-fit,minmax(168px,1fr))}
.cifra :deep(b){display:block;font:800 clamp(2.4rem,5.4vw,3.6rem)/1 var(--display);
  letter-spacing:-.04em;color:var(--azufre);font-variant-numeric:tabular-nums}
.cifra span{display:block;margin-top:10px;font-size:14px;color:rgba(242,237,230,.68);line-height:1.5}
</style>
