<script setup>
/* El orden de las secciones ES el argumento de venta:
   quién somos → por qué creernos → qué se siente subir → qué vendemos →
   cuánto cuesta y por qué directo → quién te lleva → escríbele. */
import BarraNav from './componentes/BarraNav.vue';
import SeccionHero from './componentes/SeccionHero.vue';
import BandaCifras from './componentes/BandaCifras.vue';
import SeccionAscenso from './componentes/SeccionAscenso.vue';
import SeccionAscensoLava from './componentes/SeccionAscensoLava.vue';
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
    <!-- Replica de la pieza de Andres, traida a este stack. Va DEBAJO de la
         actual a proposito: estan las dos para poder compararlas scrolleando
         una despues de la otra mientras se decide con cual se queda el sitio. -->
    <SeccionAscensoLava />
    <CatalogoTours />
    <ComparacionPrecio />
    <SobreRichard />
    <LlamadoFinal />
  </main>
  <PieSitio />
</template>
