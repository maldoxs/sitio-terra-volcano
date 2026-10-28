<script setup>
import { ref } from 'vue';
import { onScroll } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, idioma, cambiar, agencia } = useIdioma();
const pegado = ref(false);
onScroll(() => { pegado.value = scrollY > 40; });
</script>

<template>
  <nav class="nav" :class="{ pegado }">
    <a class="marca" href="#top">Terra<em>·</em>Volcano</a>
    <div class="enlaces">
      <a class="ln" href="#catalogo">{{ t('nav.tours') }}</a>
      <a class="ln" href="#precio">{{ t('nav.precio') }}</a>
      <a class="ln" href="#richard">{{ t('nav.quienes') }}</a>
    </div>
    <div class="idioma">
      <button v-for="l in ['es','en']" :key="l" type="button"
              :aria-pressed="idioma === l" @click="cambiar(l)">{{ l.toUpperCase() }}</button>
    </div>
    <a class="btn btn--lava" :href="agencia.contacto.whatsappUrl">{{ t('nav.cta') }}</a>
  </nav>
</template>

<style scoped>
.nav{position:fixed;inset:0 0 auto;z-index:50;display:flex;align-items:center;gap:28px;
  padding:18px var(--gutter);
  transition:background-color .5s var(--ease),box-shadow .5s var(--ease),padding .5s var(--ease)}
.nav.pegado{background:rgba(242,237,230,.88);backdrop-filter:blur(14px);
  box-shadow:0 1px 0 rgba(20,17,15,.1);padding-top:12px;padding-bottom:12px}
.marca{font:800 17px/1 var(--display);letter-spacing:-.02em;text-decoration:none;margin-right:auto}
.marca em{font-style:normal;color:var(--lava)}
.enlaces{display:flex;gap:22px}
.ln{text-decoration:none;font:500 14px/1 var(--texto);padding-bottom:4px;
  background-image:linear-gradient(var(--lava),var(--lava));
  background-repeat:no-repeat;background-position:0 100%;background-size:0 1.5px;
  transition:background-size .45s var(--ease)}
.ln:hover{background-size:100% 1.5px}
.idioma{display:flex;gap:2px;background:rgba(20,17,15,.07);border-radius:999px;padding:3px}
.idioma button{border:0;background:transparent;color:var(--tinta-suave);cursor:pointer;
  font:700 11px/1 var(--texto);letter-spacing:.08em;padding:7px 10px;border-radius:999px;
  transition:background-color .35s var(--ease),color .35s var(--ease)}
.idioma button[aria-pressed="true"]{background:var(--obsidiana);color:var(--nieve)}
.nav :deep(.btn){padding:11px 18px}
@media (max-width:900px){ .enlaces{display:none} }
</style>
