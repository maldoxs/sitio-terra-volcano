<script setup>
/* El orden de las secciones ES el argumento de venta:
   quién somos → por qué creernos → qué se siente subir → qué vendemos →
   cuánto cuesta y por qué directo → quién te lleva → escríbele. */
import BarraNav from './componentes/BarraNav.vue';
import SeccionHero from './componentes/SeccionHero.vue';
import BandaCifras from './componentes/BandaCifras.vue';
import SeccionAscenso from './componentes/SeccionAscenso.vue';
import CatalogoTours from './componentes/CatalogoTours.vue';
import ComparacionPrecio from './componentes/ComparacionPrecio.vue';
import SobreRichard from './componentes/SobreRichard.vue';
import LlamadoFinal from './componentes/LlamadoFinal.vue';
import PieSitio from './componentes/PieSitio.vue';
</script>

<template>
  <BarraNav />
  <main>
    <SeccionHero />
    <BandaCifras />
    <SeccionAscenso />
    <CatalogoTours />
    <ComparacionPrecio />
    <SobreRichard />
    <LlamadoFinal />
  </main>
  <PieSitio />
</template>
