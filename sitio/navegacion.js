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
