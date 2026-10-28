/* Entrada al scroll y micro-interacciones de las secciones de conversión.
   El vuelo del volcán tiene su propio motor; esto es solo para lo de abajo.

   POR QUÉ CSS Y NO MOTION
   -----------------------
   La tabla de decisión de la skill de Motion asigna a CSS justamente estos
   casos: "fade o slide al entrar" y "cambio simple de color, sombra u opacidad".
   Motion gana cuando hay gestos interrumpibles, springs con velocidad, drag o
   animación de layout — nada de eso ocurre acá. Se probó vendorizar Motion y se
   descartó: su build ESM reexporta de `framer-motion/dom`, un especificador que
   el navegador no resuelve sin bundler, y este proyecto no tiene ninguno.

   Resultado: cero dependencias, cero peticiones de red, y la animación corre en
   el compositor (solo `opacity` y `transform`). */
(function () {
  'use strict';

  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (quieto || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('anim');

  // Se revela una vez y se deja de observar: un elemento que reaparece al
  // volver a subir distrae en vez de lucir.
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  function preparar(selector, escalonado) {
    var els = document.querySelectorAll(selector);
    els.forEach(function (el, i) {
      el.classList.add('revelar');
      // Escalonado corto y con tope: una lista larga no puede hacer esperar
      // al visitante hasta el último elemento.
      if (escalonado) el.style.transitionDelay = Math.min(i * 55, 330) + 'ms';
      obs.observe(el);
    });
  }

  preparar('#exigencia > .cejilla, #exigencia > h2, #exigencia > .sub');
  preparar('#filas-exigencia tr', true);
  preparar('.banda img');
  preparar('.guia > .retrato, .guia > div');
  preparar('#reservar .cejilla, #reservar h2, #reservar .sub');
  preparar('.comparacion .tarjeta', true);
  preparar('.ahorro, .promesa');
  preparar('.tarifas caption, .tarifas thead');
  preparar('#filas-tarifas tr', true);
})();
