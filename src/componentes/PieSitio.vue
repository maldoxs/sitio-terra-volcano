<script setup>
import { useIdioma } from '../composables/useIdioma.js';
const { t } = useIdioma();
</script>

<template>
  <footer>
    <div>{{ t('pie.dir') }}</div>
    <div>{{ t('pie.nota') }}</div>
  </footer>
</template>

<style scoped>
footer{padding:40px var(--gutter) 60px;text-align:center;font-size:13px;
  color:var(--tinta-suave);line-height:1.8}
</style>
