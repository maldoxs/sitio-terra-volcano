/* Divisa y calendario de reserva.
   La divisa elegida se recuerda y convierte todos los precios en pesos del
   sitio con las tasas de divisas.json. En la ficha de cada tour la tarjeta
   suma pasajeros, un calendario del mes con los cupos y el total.
   Los cupos son de prueba hasta conectar la disponibilidad de TourTask. */
(() => {
  const PRECIOS = '.reserva__precio, .barra-reserva b, .tarjeta__precio, .ficha__precio';
  const CLP = /(\d{1,3}(?:[.,]\d{3})+) CLP|CLP (\d{1,3}(?:[.,]\d{3})+)/;
  const TEXTOS = {
    es: {
      meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      dias: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
      pasajeros: 'Pasajeros', menos: 'Quitar un pasajero', mas: 'Agregar un pasajero',
      anterior: 'Mes anterior', siguiente: 'Mes siguiente', divisa: 'Divisa',
      total: 'Total', ver: 'Ver fechas y reservar',
      reservar: (d, n) => `Reservar el ${d} · ${n} ${n === 1 ? 'pasajero' : 'pasajeros'}`,
      quedan: (c) => (c === 0 ? 'completo' : `quedan ${c} cupos`),
      fecha: (d, m) => `${d} de ${m}`,
    },
    en: {
      meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      dias: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      pasajeros: 'Passengers', menos: 'Remove a passenger', mas: 'Add a passenger',
      anterior: 'Previous month', siguiente: 'Next month', divisa: 'Currency',
      total: 'Total', ver: 'See dates and book',
      reservar: (d, n) => `Book ${d} · ${n} ${n === 1 ? 'passenger' : 'passengers'}`,
      quedan: (c) => (c === 0 ? 'full' : `${c} spots left`),
      fecha: (d, m) => `${m} ${d}`,
    },
  };
  const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const idioma = () => (document.documentElement.lang === 'en' ? 'en' : 'es');
  const t = () => TEXTOS[idioma()];

  let tasas = { CLP: 1 };
  let orden = ['CLP'];
  let decimales = { CLP: 0 };
  let divisa = leer('divisa') || 'CLP';

  const formato = (clp, cod = divisa) => {
    const v = clp / (tasas[cod] || 1);
    const d = decimales[cod] ?? 2;
    const n = v.toLocaleString(idioma() === 'en' ? 'en-US' : 'es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
    return idioma() === 'en' ? `${cod} ${n}` : `${n} ${cod}`;
  };

  /* Cada texto con un precio guarda su monto en pesos y su molde; si el
     cambio de idioma lo reescribe, se vuelve a leer desde el texto nuevo. */
  const moldes = new Map();
  const convertir = () => {
    document.querySelectorAll(PRECIOS).forEach((el) => {
      const paseo = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (paseo.nextNode()) {
        const n = paseo.currentNode;
        const m = n.nodeValue.match(CLP);
        if (m) moldes.set(n, { clp: Number((m[1] || m[2]).replace(/[.,]/g, '')), molde: n.nodeValue.replace(m[0], '{}') });
        const guardado = moldes.get(n);
        if (guardado) n.nodeValue = guardado.molde.replace('{}', formato(guardado.clp));
      }
    });
    const nombres = new Intl.DisplayNames([idioma()], { type: 'currency' });
    document.querySelectorAll('.divisas').forEach((caja) => {
      caja.querySelector('b').textContent = divisa;
      const lista = caja.querySelector('select');
      lista.setAttribute('aria-label', t().divisa);
      lista.innerHTML = orden.map((c) => `<option value="${c}">${c} · ${nombres.of(c).replace(/^./, (l) => l.toUpperCase())}</option>`).join('');
      lista.value = divisa;
    });
  };

  /* Menu nativo encima de la pastilla: en el celular abre el selector del
     sistema y la pastilla solo muestra el codigo elegido. */
  const selector = () => {
    const caja = document.createElement('label');
    caja.className = 'divisas';
    caja.innerHTML = '<b></b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg><select></select>';
    caja.querySelector('select').addEventListener('change', (e) => {
      divisa = e.target.value;
      guardar('divisa', divisa);
      todo();
    });
    return caja;
  };

  /* Cupos de prueba: un numero fijo por tour y fecha, para que la maqueta
     no cambie en cada visita. */
  const cupos = (tour, f) => {
    let h = 7;
    for (const c of `${tour}${f.getFullYear()}${f.getMonth()}${f.getDate()}`) h = (h * 31 + c.charCodeAt(0)) % 9973;
    if (h % 9 === 0) return 0;
    if (h % 4 === 0) return 2;
    return 8;
  };

  const tarjetas = [];
  const armarTarjeta = (aside) => {
    const precio = aside.querySelector('.reserva__precio');
    const m = precio && precio.textContent.match(CLP);
    if (!m) return;
    const clp = Number((m[1] || m[2]).replace(/[.,]/g, ''));
    const privado = /Privad|Private/.test(aside.querySelector('.reserva__tipo').textContent);
    const minimo = privado ? 2 : 1;
    const tour = location.pathname.split('/').pop().replace('.html', '');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const s = { n: Math.max(2, minimo), fecha: null, mes: new Date(hoy.getFullYear(), hoy.getMonth(), 1) };

    const tipo = aside.querySelector('.reserva__tipo');
    const cabeza = document.createElement('div');
    cabeza.className = 'reserva__cabeza';
    tipo.before(cabeza);
    cabeza.append(tipo, selector());
    const caja = document.createElement('div');
    caja.className = 'agenda';
    aside.querySelector('.reserva__por').after(caja);
    const boton = aside.querySelector('.reservar');

    const pintar = () => {
      const x = t();
      const y = s.mes.getFullYear();
      const mo = s.mes.getMonth();
      const vacios = (new Date(y, mo, 1).getDay() + 6) % 7;
      const total = new Date(y, mo + 1, 0).getDate();
      const primerMes = y === hoy.getFullYear() && mo === hoy.getMonth();
      let dias = x.dias.map((d) => `<span class="agenda__dia" aria-hidden="true">${d}</span>`).join('');
      dias += '<span></span>'.repeat(vacios);
      for (let d = 1; d <= total; d++) {
        const f = new Date(y, mo, d);
        const c = cupos(tour, f);
        const no = f <= hoy || c < s.n;
        const elegido = s.fecha && +s.fecha === +f;
        const esHoy = +f === +hoy;
        dias += `<button type="button" data-fecha="${+f}" class="${esHoy ? 'hoy' : ''}"${esHoy ? ' aria-current="date"' : ''} aria-pressed="${!!elegido}"${no ? ' disabled' : ''} aria-label="${x.fecha(d, x.meses[mo])}, ${x.quedan(f <= hoy ? 0 : c)}">${d}</button>`;
      }
      caja.innerHTML = `
        <div class="agenda__fila"><span>${x.pasajeros}</span>
          <div class="agenda__contador"><button type="button" data-paso="-1" aria-label="${x.menos}"${s.n <= minimo ? ' disabled' : ''}>−</button><output aria-live="polite">${s.n}</output><button type="button" data-paso="1" aria-label="${x.mas}"${s.n >= 12 ? ' disabled' : ''}>+</button></div></div>
        <div class="agenda__mes"><button type="button" data-mes="-1" aria-label="${x.anterior}"${primerMes ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><b>${x.meses[mo]} ${y}</b><button type="button" data-mes="1" aria-label="${x.siguiente}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>
        <div class="agenda__grilla">${dias}</div>
        <p class="agenda__total"><span>${x.total}</span><b>${formato(clp * s.n)}</b></p>`;
      boton.textContent = s.fecha ? x.reservar(x.fecha(s.fecha.getDate(), x.meses[s.fecha.getMonth()]), s.n) : x.ver;
    };

    caja.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.paso) {
        s.n = Math.min(12, Math.max(minimo, s.n + Number(b.dataset.paso)));
        if (s.fecha && cupos(tour, s.fecha) < s.n) s.fecha = null;
      }
      if (b.dataset.mes) s.mes = new Date(s.mes.getFullYear(), s.mes.getMonth() + Number(b.dataset.mes), 1);
      if (b.dataset.fecha) s.fecha = new Date(Number(b.dataset.fecha));
      pintar();
      const igual = b.dataset.paso ? `[data-paso="${b.dataset.paso}"]` : b.dataset.mes ? `[data-mes="${b.dataset.mes}"]` : `[data-fecha="${b.dataset.fecha}"]`;
      const nuevo = caja.querySelector(igual);
      if (nuevo && !nuevo.disabled) nuevo.focus();
    });
    tarjetas.push(pintar);
    pintar();
  };

  const todo = () => {
    tarjetas.forEach((p) => p());
    convertir();
  };

  const iniciar = () => {
    document.querySelectorAll('.reserva').forEach(armarTarjeta);
    const cabeza = document.querySelector('.tours-cabeza .filtros');
    if (cabeza) cabeza.after(selector());
    todo();
    /* idioma.js cambia lang al final de cada traduccion */
    new MutationObserver(todo).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  };

  fetch('divisas.json')
    .then((r) => r.json())
    .then((d) => {
      tasas = d.clpPorUnidad;
      decimales = d.decimales;
      orden = d.orden;
      if (!tasas[divisa]) divisa = 'CLP';
    })
    .catch(() => { divisa = 'CLP'; })
    .finally(iniciar);
})();
