/* Arranque del sitio: idioma, montaje del vuelo y relleno de las secciones. */
(function () {
  'use strict';

  var CONT = window.TV_CONTENIDO, TXT = window.TV_TEXTOS;

  /* El idioma se decide una vez y la página se recarga al cambiarlo. Remontar
     el motor en caliente apilaría listeners de scroll; una recarga es más
     barata y más honesta que un cleanup a medias. */
  function idioma() {
    var url = new URLSearchParams(location.search).get('lang');
    if (url && TXT[url]) return url;
    try {
      var g = localStorage.getItem('tv-lang');
      if (g && TXT[g]) return g;
    } catch (e) { /* modo privado: seguimos con el default */ }
    return (navigator.language || 'es').slice(0, 2) === 'es' ? 'es' : 'en';
  }

  var L = idioma();
  document.documentElement.lang = L;

  // --- textos estáticos -----------------------------------------------------
  document.querySelectorAll('[data-t]').forEach(function (el) {
    var v = TXT[L][el.dataset.t];
    if (v != null) el.textContent = v;
  });
  var aviso = document.getElementById('aviso');
  if (aviso) aviso.innerHTML = TXT[L]['aviso.html'];

  // --- selector de idioma ---------------------------------------------------
  document.querySelectorAll('.idioma button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === L));
    b.addEventListener('click', function () {
      if (b.dataset.lang === L) return;
      try { localStorage.setItem('tv-lang', b.dataset.lang); } catch (e) {}
      var u = new URL(location.href);
      u.searchParams.set('lang', b.dataset.lang);
      location.href = u.toString();
    });
  });

  // --- tabla de exigencia ---------------------------------------------------
  var tb = document.getElementById('filas-exigencia');
  if (tb) {
    window.TV_EXIGENCIA.forEach(function (f) {
      var tr = document.createElement('tr');
      [f.nombre, f.dur[L], f.desnivel].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      var td = document.createElement('td');
      var sp = document.createElement('span');
      sp.className = 'nivel n' + f.nivel;
      sp.textContent = f.label[L];
      td.appendChild(sp); tr.appendChild(td); tb.appendChild(tr);
    });
  }

  // --- lo que incluye el precio directo ---
  var inc = document.getElementById('incluye');
  if (inc) TXT[L]['reserva.incluye'].forEach(function (x) {
    var li = document.createElement('li'); li.textContent = x; inc.appendChild(li);
  });

  // --- tarifas del resto del catálogo ---
  var tf = document.getElementById('filas-tarifas');
  if (tf) window.TV_TARIFAS.forEach(function (f) {
    var tr = document.createElement('tr');
    [f.tour[L], f.dur[L], f.precio].forEach(function (v, i) {
      var td = document.createElement('td');
      td.textContent = v;
      if (i === 2) td.style.textAlign = 'right';
      tr.appendChild(td);
    });
    tf.appendChild(tr);
  });

  // --- credenciales ---------------------------------------------------------
  var ul = document.getElementById('credenciales');
  if (ul) TXT[L]['guia.credenciales'].forEach(function (t) {
    var li = document.createElement('li'); li.textContent = t; ul.appendChild(li);
  });

  // --- el vuelo -------------------------------------------------------------
  var secciones = CONT.secciones.map(function (s) {
    var c = s.copy[L];
    var o = {
      id: s.id, label: s.label[L], still: s.still, clip: s.clip,
      accent: s.accent, scroll: s.scroll, linger: s.linger,
      eyebrow: c.eyebrow, title: c.title, body: c.body, tags: c.tags || []
    };
    if (c.cta) o.cta = c.cta;
    return o;
  });

  mountScrollWorld(document.getElementById('world'), {
    brand: { name: 'Terra Volcano', href: '#top' },
    hint: CONT.marca[L].hint,
    diveScroll: 1.6,
    connScroll: 0.9,
    /* Arquitectura A: sin conectores, los tramos SON el recorrido. Las costuras
       son cortes entre fotografías distintas, así que el disolvimiento va más
       ancho que el 0.12 por defecto; con menos se ve el corte seco. */
    crossfade: 0.26,
    nav: true,
    atmosphere: true,
    sections: secciones,
    connectors: CONT.conectores
  });

  /* Soltar el viewport al terminar el vuelo.
     Sin esto, las capas fijas del motor quedan encima de las secciones de
     conversión y el visitante ve el cielo del diorama en vez de la tabla de
     exigencia y el bloque de reserva. */
  (function liberarViewport() {
    var mundo = document.getElementById('world');
    if (!mundo) return;
    var pendiente = false;

    function revisar() {
      pendiente = false;
      var fin = mundo.offsetTop + mundo.offsetHeight;
      // Un 12% de holgura: el vuelo se apaga justo antes de que entre el
      // contenido, no exactamente encima, que se nota como un corte.
      var fuera = (window.scrollY + window.innerHeight * 0.12) >= fin;
      document.body.classList.toggle('fuera-del-vuelo', fuera);
    }
    function pedir() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(revisar);
    }
    addEventListener('scroll', pedir, { passive: true });
    addEventListener('resize', pedir);
    revisar();
  })();

  /* El CTA del vuelo y el del bloque de reserva apuntan al mismo lugar. El href
     real de WhatsApp se pone una sola vez acá, cuando Richard confirme el
     número (el que circula salió de una reseña, no de ellos). */
  var WSP = 'https://wa.me/56983388317?text=' + encodeURIComponent(
    L === 'es' ? 'Hola, quiero reservar el ascenso al volcán Villarrica. ¿Qué fechas tienen disponibles?'
               : 'Hi, I want to book the Villarrica volcano ascent. What dates do you have available?');
  if (WSP) document.querySelectorAll('a[href="#CONFIRMAR-WHATSAPP"]')
    .forEach(function (a) { a.href = WSP; a.target = '_blank'; a.rel = 'noopener'; });
})();
