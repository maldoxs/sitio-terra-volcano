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

/* Menu del celular: las tres rayas abren un panel a pantalla completa. Se arma
   aca a partir de los enlaces que ya trae la pagina, asi no hay que repetirlo
   en cada HTML; sin JavaScript queda el desplegable simple. */
(() => {
  const simple = document.querySelector('.menu-movil');
  if (!simple || !window.HTMLDialogElement) return;
  const boton = simple.querySelector('summary');
  const pagina = (ruta) => ruta.replace(/\/(index(\.html)?)?$/, '/').replace(/\.html$/, '');
  const aqui = pagina(location.pathname);
  const categorias = [['ascensos', 'Ascensos'], ['ski', 'Ski touring'], ['trekking', 'Trekking'], ['invierno', 'Invierno'], ['agua', 'Otras actividades'], ['travesias', 'Travesías']];
  const cruz = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const mas = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/><path class="menu-panel__palo" d="M12 4v16"/></svg>';

  const filas = [...simple.querySelectorAll('a')].map((a) => {
    const actual = pagina(new URL(a.href).pathname) === aqui ? ' aria-current="page"' : '';
    const enlace = `<a href="${a.getAttribute('href')}"${actual}>${a.textContent}</a>`;
    if (!/tours\.html$/.test(a.getAttribute('href'))) return `<li><div class="menu-panel__fila">${enlace}</div></li>`;
    const sub = categorias.map(([id, nombre]) => `<li><a href="tours.html#${id}">${nombre}</a></li>`).join('');
    return `<li><div class="menu-panel__fila">${enlace}<button type="button" data-sub aria-expanded="false" aria-label="Ver categorías de tours">${mas}</button></div><ul class="menu-panel__sub">${sub}</ul></li>`;
  }).join('');

  const logo = document.querySelector('.barra img');
  const panel = document.createElement('dialog');
  panel.className = 'menu-panel';
  panel.setAttribute('aria-label', 'Menú');
  panel.innerHTML = `
    <div class="menu-panel__cabeza">${logo ? `<img src="media/logo-blanco.webp" width="191" height="50" alt="Terra Volcano">` : '<span></span>'}<button type="button" data-cerrar aria-label="Cerrar el menú">${cruz}</button></div>
    <ul class="menu-panel__lista">${filas}</ul>
    <div class="menu-panel__pie"><a class="reservar" href="https://wa.me/56983388317">Reservar por WhatsApp</a></div>`;
  document.body.append(panel);

  boton.setAttribute('aria-label', 'Abrir el menú');
  boton.addEventListener('click', (e) => { e.preventDefault(); panel.showModal(); });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) return panel.close();
    const sub = e.target.closest('[data-sub]');
    if (sub) {
      const abierta = sub.closest('li').querySelector('.menu-panel__sub').classList.toggle('abierta');
      return sub.setAttribute('aria-expanded', abierta);
    }
    const enlace = e.target.closest('a');
    if (!enlace) return;
    panel.close();
    // misma pagina con otro filtro: Tours lee el filtro solo al cargar
    const destino = new URL(enlace.href);
    if (destino.hash && pagina(destino.pathname) === aqui) { e.preventDefault(); location.href = enlace.href; location.reload(); }
  });
})();
