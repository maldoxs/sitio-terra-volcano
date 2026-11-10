/* Galeria de las fichas: se ven cuatro fotos y la cuarta dice cuantas
   quedan. Cualquier foto abre el visor a pantalla completa, que se recorre
   con flechas, con el teclado o deslizando el dedo. */
(() => {
  const galeria = document.querySelector('.tour__fotos');
  if (!galeria) return;
  const fotos = [...galeria.querySelectorAll('img')];
  const en = () => document.documentElement.lang === 'en';
  const flecha = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  const visor = document.createElement('dialog');
  visor.className = 'visor';
  visor.innerHTML = `
    <div class="visor__cabeza"><span aria-live="polite"></span><button type="button" data-cerrar>${flecha('M6 6l12 12M18 6L6 18')}</button></div>
    <div class="visor__foto"><img alt=""></div>
    <div class="visor__pie"><button type="button" data-paso="-1">${flecha('M15 6l-6 6 6 6')}</button><button type="button" data-paso="1">${flecha('M9 6l6 6-6 6')}</button></div>`;
  document.body.append(visor);
  const grande = visor.querySelector('.visor__foto img');
  const cuenta = visor.querySelector('.visor__cabeza span');
  let actual = 0;

  const mostrar = (i) => {
    actual = (i + fotos.length) % fotos.length;
    const f = fotos[actual];
    grande.src = f.currentSrc || f.src;
    grande.alt = f.alt;
    cuenta.textContent = `${actual + 1} / ${fotos.length}`;
    [fotos[actual + 1], fotos[actual - 1]].forEach((v) => { if (v) new Image().src = v.src; });
  };
  const etiquetas = () => {
    visor.setAttribute('aria-label', en() ? 'Photo gallery' : 'Galería de fotos');
    visor.querySelector('[data-cerrar]').setAttribute('aria-label', en() ? 'Close' : 'Cerrar');
    visor.querySelector('[data-paso="-1"]').setAttribute('aria-label', en() ? 'Previous photo' : 'Foto anterior');
    visor.querySelector('[data-paso="1"]').setAttribute('aria-label', en() ? 'Next photo' : 'Foto siguiente');
    galeria.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-label', (en() ? 'Open photo ' : 'Abrir la foto ') + (i + 1));
    });
    const mas = galeria.querySelector('.tour__mas');
    if (mas) mas.innerHTML = `<span><b>+${fotos.length - 4}</b>${en() ? 'photos' : 'fotos'}</span>`;
  };

  fotos.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (i === 3 && fotos.length > 4) b.className = 'tour__mas';
    b.addEventListener('click', () => { mostrar(i); visor.showModal(); });
    f.parentElement.append(b);
  });
  etiquetas();
  new MutationObserver(etiquetas).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  visor.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.paso) mostrar(actual + Number(b.dataset.paso));
    else if ((b && 'cerrar' in b.dataset) || e.target === visor || e.target.classList.contains('visor__foto')) visor.close();
  });
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') mostrar(actual + 1);
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
  });
  let inicio = null;
  visor.addEventListener('pointerdown', (e) => { inicio = e.clientX; });
  visor.addEventListener('pointerup', (e) => {
    if (inicio === null) return;
    const dx = e.clientX - inicio;
    inicio = null;
    if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1));
  });
})();
