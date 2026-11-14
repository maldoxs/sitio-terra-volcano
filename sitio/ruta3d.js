/* Visor del recorrido 3D para las fichas: cualquier elemento con data-ruta3d lo
   abre. Es el mismo visor del inicio (ahi vive en index.html), con su X, la
   pantalla completa en el telefono y la X que se esconde durante la presentacion.
   El recorrido se carga solo al abrirlo: Google cobra cada apertura. */
(() => {
  const botones = document.querySelectorAll('[data-ruta3d]');
  if (!botones.length) return;
  const estilo = document.createElement('style');
  estilo.textContent = `
    .visor-ruta{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#06112a}
    .visor-ruta::backdrop{background:#06112a}
    .visor-ruta iframe{display:block;width:100%;height:100%;border:0;background:#06112a}
    .visor-ruta__cerrar{position:absolute;right:16px;top:16px;z-index:2;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px 0 12px;border:1px solid rgba(255,255,255,.28);border-radius:22px;background:rgba(6,18,46,.72);color:#fff;font:700 14px/1 var(--texto,system-ui);cursor:pointer;transition:background .2s,opacity .4s}
    .visor-ruta__cerrar:hover{background:rgba(6,18,46,.92)}
    .visor-ruta__cerrar.oculto{opacity:0;pointer-events:none}
    .visor-ruta__cerrar svg{width:18px;height:18px}
    @media (max-width:760px),(max-height:500px) and (orientation:landscape){
      .visor-ruta__cerrar{right:calc(12px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));width:44px;padding:0;justify-content:center}
      .visor-ruta__cerrar span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    }`;
  document.head.append(estilo);
  const visor = document.createElement('dialog');
  visor.className = 'visor-ruta';
  visor.setAttribute('aria-label', 'Ver la ruta en 3D');
  visor.innerHTML = '<button class="visor-ruta__cerrar" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Cerrar</span></button><iframe title="Recorrido 3D del volcán Villarrica" allow="fullscreen"></iframe>';
  document.body.append(visor);
  const cerrar = visor.querySelector('button');
  const marco = visor.querySelector('iframe');

  /* Mientras el visor esta abierto la pagina ocupa toda la pantalla, tambien la
     zona de la camara del iPhone: si no, con el telefono girado quedan franjas
     azules a los lados. Al cerrar vuelve a como estaba. */
  const metaVista = document.querySelector('meta[name=viewport]');
  const vistaNormal = metaVista.content;
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(sonda);
  const mandarSeguro = () => {
    const c = getComputedStyle(sonda);
    marco.contentWindow?.postMessage({ tipo: 'recorrido-seguro', t: parseFloat(c.paddingTop), r: parseFloat(c.paddingRight), b: parseFloat(c.paddingBottom), l: parseFloat(c.paddingLeft) }, location.origin);
  };
  const ocuparTodo = (on) => {
    metaVista.content = on ? `${vistaNormal}, viewport-fit=cover` : vistaNormal;
    if (on) requestAnimationFrame(mandarSeguro);
  };
  addEventListener('resize', () => { if (visor.open) mandarSeguro(); });
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.tipo === 'recorrido-seguro-consulta') mandarSeguro(); });

  const completa = (on) => {
    if (!on) { if (document.fullscreenElement) document.exitFullscreen(); return; }
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  };
  const avisarPantalla = () => marco.contentWindow?.postMessage({ tipo: 'recorrido-pantalla-estado', on: !!document.fullscreenElement }, location.origin);
  document.addEventListener('fullscreenchange', avisarPantalla);
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.tipo === 'recorrido-pantalla') completa(!document.fullscreenElement);
    if (e.data?.tipo === 'recorrido-pantalla-consulta') avisarPantalla();
    if (e.data?.tipo === 'recorrido-inmersivo') cerrar.classList.toggle('oculto', e.data.on);
  });
  botones.forEach((b) => b.addEventListener('click', () => {
    marco.src = 'recorrido/index.html?visor';
    visor.showModal();
    ocuparTodo(true);
    if (matchMedia('(max-width:760px), (pointer:coarse)').matches) completa(true);
  }));
  cerrar.addEventListener('click', () => visor.close());
  visor.addEventListener('close', () => {
    marco.removeAttribute('src');
    completa(false);
    ocuparTodo(false);
    cerrar.classList.remove('oculto');
  });
  // en ingles la X se lee "Close"
  const etiqueta = () => { cerrar.querySelector('span').textContent = document.documentElement.lang === 'en' ? 'Close' : 'Cerrar'; };
  new MutationObserver(etiqueta).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
