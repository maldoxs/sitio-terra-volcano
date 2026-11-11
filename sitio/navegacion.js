/* Menu siempre a mano: pasada la portada, la barra se esconde al bajar
   para no tapar las fotos y vuelve fija arriba apenas se sube. Mientras esta
   fija pasa a ser hija del body: en el home vive dentro de la portada, que es
   sticky y la dejaria atrapada debajo del resto de la pagina. */
(() => {
  const barra = document.querySelector('.barra');
  if (!barra) return;
  const lugar = { padre: barra.parentElement, siguiente: barra.nextSibling };
  let previo = scrollY;
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const y = scrollY;
    if (y <= barra.offsetHeight) {
      barra.classList.remove('barra--fija', 'barra--visible');
      if (barra.parentElement !== lugar.padre) lugar.padre.insertBefore(barra, lugar.siguiente);
      previo = y;
      return;
    }
    if (barra.parentElement !== document.body) document.body.append(barra);
    barra.classList.add('barra--fija');
    if (y < previo - 6) barra.classList.add('barra--visible');
    else if (y > previo + 6 && !barra.querySelector('details[open]')) barra.classList.remove('barra--visible');
    else return;
    previo = y;
  };
  addEventListener('scroll', () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); }
  }, { passive: true });
})();

/* Volver de una ficha: si se llego desde otra pagina del sitio, el enlace
   regresa a esa pagina tal como quedo, con su posicion y sus filtros. Quien
   entra directo a la ficha conserva el enlace fijo a Tours. */
(() => {
  const enlaces = document.querySelectorAll('.tour-volver-tours');
  if (!enlaces.length || !document.referrer) return;
  let origen;
  try { origen = new URL(document.referrer); } catch { return; }
  if (origen.origin !== location.origin || origen.pathname === location.pathname) return;
  const desdeTours = /\/tours(\.html)?$/.test(origen.pathname);
  enlaces.forEach((a) => {
    if (!desdeTours) {
      a.href = origen.href;
      a.textContent = 'Volver';
    }
    a.addEventListener('click', (e) => {
      if (history.length < 2 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const ficha = location.pathname;
      history.back();
      setTimeout(() => { if (location.pathname === ficha) location.href = a.href; }, 400);
    });
  });
})();
