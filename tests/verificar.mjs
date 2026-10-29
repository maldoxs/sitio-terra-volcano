/* ============================================================================
   ARNES DE VERIFICACION
   ----------------------------------------------------------------------------
   Compila el sitio, lo sirve, lo recorre con un navegador real y comprueba que
   la pieza del ascenso y el resto de la pagina sigan cumpliendo lo que deben.

       npm run verificar

   Por que existe: una animacion puede verse bien en una captura y estar rota.
   Estos nueve controles cazaron seis defectos que ningun linter detecta: tres
   vertices de la ruta fuera del volcan, un efecto que nacia cumplido por falta
   de pista de scroll, el idioma del documento en desacuerdo con el contenido,
   y mas.

   Devuelve codigo 1 si algo falla, asi sirve en CI.
   ========================================================================== */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PUERTO = 4178;
const URL = `http://127.0.0.1:${PUERTO}/`;
const ANCHO = 1440, ALTO = 900;

const resultados = [];
const comprobar = (nombre, ok, detalle = '') => {
  resultados.push({ nombre, ok, detalle });
  console.log(`  ${ok ? 'OK  ' : 'FALLA'}  ${nombre.padEnd(46)} ${detalle}`);
};

/* ---------- servidor ---------- */
function servir() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PUERTO)], {
    stdio: 'ignore', detached: false,
  });
  return p;
}
const esperarServidor = async (intentos = 40) => {
  for (let i = 0; i < intentos; i++) {
    try { const r = await fetch(URL); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};

/* ---------- utilidades de pagina ---------- */
const scrollProgresivo = async (page, paso = 320, espera = 90) => {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= alto; y += paso) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.waitForTimeout(espera);
  }
  /* Terminar en el fondo EXACTO. Avanzando a pasos fijos se queda corto, y
     entonces nunca se comprueba lo que solo ocurre al tocar fondo: fue asi
     como este arnes dio por bueno un reveal que no disparaba nunca. */
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(espera * 3);
};

const servidor = servir();
let navegador;

try {
  if (!(await esperarServidor())) throw new Error(`el servidor no respondio en ${URL}`);

  navegador = await chromium.launch();

  /* =====================================================================
     1. La pagina carga sin errores
     ===================================================================== */
  console.log('\nHOME');
  const page = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO } });
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message.slice(0, 120)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  // El scroll suave interfiere con las mediciones: se mide en posiciones exactas.
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await page.waitForTimeout(900);

  const base = await page.evaluate(() => ({
    secciones: [...document.querySelectorAll('section,header')].map((s) => s.id).filter(Boolean),
    lang: document.documentElement.lang,
    h1: document.querySelector('h1')?.textContent.trim() || '',
    wa: document.querySelector('a[href*="wa.me"]')?.getAttribute('href') || '',
    htmlClass: document.documentElement.className,
  }));

  const ESPERADAS = ['top', 'ascenso', 'catalogo', 'precio', 'richard', 'reservar'];
  const faltan = ESPERADAS.filter((s) => !base.secciones.includes(s));
  comprobar('las secciones estan todas', faltan.length === 0, faltan.length ? `faltan: ${faltan}` : `${base.secciones.length} secciones`);

  comprobar('la clase js esta puesta', base.htmlClass.includes('js'),
    'sin ella el contenido quedaria oculto para siempre si el script falla');

  /* El telefono tiene que venir de datos/agencia.json, no escrito a mano. */
  const { default: agencia } = await import('../datos/agencia.json', { with: { type: 'json' } });
  comprobar('el whatsapp sale de agencia.json', base.wa === agencia.contacto.whatsappUrl,
    base.wa || '(no hay enlace)');

  /* El atributo lang decide la voz del lector de pantalla: debe coincidir. */
  const esIngles = /is not a postcard|It is alive/i.test(base.h1);
  comprobar('el lang coincide con el contenido', (base.lang === 'en') === esIngles,
    `lang="${base.lang}" h1="${base.h1.slice(0, 32)}"`);

  /* =====================================================================
     2. Reveals: todos disparan al recorrer la pagina
     ===================================================================== */
  console.log('\nREVEALS');
  await scrollProgresivo(page);
  await page.waitForTimeout(1200);
  const rev = await page.evaluate(() => {
    const e = [...document.querySelectorAll('[data-revelar]')];
    return { total: e.length, visibles: e.filter((x) => x.classList.contains('visible')).length };
  });
  comprobar('todos los reveals dispararon', rev.total > 0 && rev.visibles === rev.total,
    `${rev.visibles}/${rev.total}`);

  /* =====================================================================
     3. El ascenso: progreso monotono y altimetro ascendente
     ===================================================================== */
  console.log('\nASCENSO');
  const banda = await page.evaluate(() => {
    const s = document.getElementById('ascenso');
    return { top: s.getBoundingClientRect().top + scrollY, alto: s.offsetHeight };
  });
  comprobar('la banda tiene pista de scroll', banda.alto > ALTO * 2,
    `${(banda.alto / ALTO).toFixed(1)} pantallas. Sin pista, el efecto nace cumplido`);

  const muestras = [];
  for (let i = 0; i <= 10; i++) {
    await page.evaluate(({ t, h, f }) => scrollTo(0, t + (h - innerHeight) * f),
      { t: banda.top, h: banda.alto, f: i / 10 });
    await page.waitForTimeout(170);
    muestras.push(await page.evaluate(() => {
      const r = document.querySelector('#ascenso .ruta');
      const L = r.getTotalLength();
      return {
        p: +(1 - parseFloat(r.style.strokeDashoffset) / L).toFixed(3),
        alt: +(document.querySelector('#ascenso .hud__alt')?.textContent || '').replace(/\D/g, ''),
      };
    }));
  }
  const ps = muestras.map((m) => m.p);
  const alts = muestras.map((m) => m.alt);
  const monotona = (a) => a.every((v, i) => i === 0 || v >= a[i - 1]);

  comprobar('el progreso de la ruta es monotono', monotona(ps), `${ps[0]} a ${ps.at(-1)}`);
  comprobar('el altimetro sube siempre', monotona(alts), `${alts[0]} a ${alts.at(-1)} m`);
  comprobar('el recorrido llega a la cumbre', ps.at(-1) >= 0.999 && alts.at(-1) === agencia.catalogo.find((c) => c.id === 'villarrica').altitud,
    `${alts.at(-1)} m`);

  /* El escalador tiene que ir SOBRE el trazo, no cerca. */
  const sobreRuta = await page.evaluate(() => {
    const r = document.querySelector('#ascenso .ruta');
    /* Por clase, no por posicion: `g[transform]` agarraba el primer grupo
       transformado del SVG, y basto agregar las araucarias antes del guia
       para que el control midiera el arbol equivocado. */
    const g = document.querySelector('#ascenso .guia-grupo');
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(g?.getAttribute('transform') || '');
    if (!m) return null;
    const fin = r.getPointAtLength(r.getTotalLength());
    return Math.hypot(+m[1] - fin.x, +m[2] - fin.y);
  });
  comprobar('el escalador termina sobre el trazo', sobreRuta !== null && sobreRuta < 1,
    sobreRuta === null ? 'no se encontro' : `${sobreRuta.toFixed(2)} px de distancia`);

  /* Los hitos son botones: al pulsarlos el scroll salta a su altitud. La
     posicion se despeja de la misma cuenta con que se calcula el progreso,
     asi que el altimetro tiene que marcar EXACTAMENTE la cota del hito. */
  await page.evaluate(({ t, h }) => scrollTo(0, t + (h - innerHeight) * 0.1),
    { t: banda.top, h: banda.alto });
  await page.waitForTimeout(600);
  const salto = await page.evaluate(async () => {
    const gs = [...document.querySelectorAll('#ascenso .marcas > g')];
    if (gs.length < 5) return null;
    gs[4].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1800));
    return +(document.querySelector('#ascenso .hud__alt')?.textContent || '').replace(/\D/g, '');
  });
  const cotaPlateau = agencia.rutaVillarrica.hitos.find((x) => x.id === 'plateau').altitud;
  comprobar('pulsar un hito salta a su cota', salto === cotaPlateau,
    `${salto} m, esperado ${cotaPlateau}`);

  /* =====================================================================
     4. Rendimiento durante la pieza
     ===================================================================== */
  console.log('\nRENDIMIENTO');
  const fps = await page.evaluate(async ({ t, h }) => {
    let f = 0, corriendo = true;
    const contar = () => { if (corriendo) { f++; requestAnimationFrame(contar); } };
    requestAnimationFrame(contar);
    const t0 = performance.now();
    for (let i = 0; i <= 50; i++) {
      scrollTo(0, t + (h - innerHeight) * i / 50);
      await new Promise((r) => setTimeout(r, 55));
    }
    const dt = (performance.now() - t0) / 1000;
    corriendo = false;
    return +(f / dt).toFixed(1);
  }, { t: banda.top, alto: banda.alto, h: banda.alto });
  comprobar('fps durante el ascenso', fps >= 30, `${fps} fps`);

  comprobar('sin errores de consola', errores.length === 0,
    errores.length ? errores[0] : '0 errores');

  /* =====================================================================
     5. La landing del Villarrica sigue servida y sin imagenes rotas
     ===================================================================== */
  console.log('\nLANDING /villarrica/');
  const resp = await page.goto(URL + 'villarrica/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const v = await page.evaluate(() => ({
    imgs: document.images.length,
    rotas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
  }));
  comprobar('/villarrica/ responde', resp?.status() === 200, `HTTP ${resp?.status()}`);
  comprobar('sin imagenes rotas', v.rotas.length === 0,
    v.rotas.length ? v.rotas.join(', ') : `${v.imgs} imagenes`);

  /* =====================================================================
     6. Movimiento reducido: la banda colapsa y todo queda visible
     ===================================================================== */
  console.log('\nMOVIMIENTO REDUCIDO');
  const pq = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO }, reducedMotion: 'reduce' });
  await pq.goto(URL, { waitUntil: 'networkidle' });
  await pq.waitForTimeout(1200);
  const q = await pq.evaluate(() => {
    const s = document.getElementById('ascenso');
    return {
      altoBanda: s.offsetHeight, vh: innerHeight,
      alt: +(document.querySelector('#ascenso .hud__alt')?.textContent || '').replace(/\D/g, ''),
      ocultos: [...document.querySelectorAll('[data-revelar]')].filter((e) => getComputedStyle(e).opacity !== '1').length,
    };
  });
  comprobar('la banda colapsa', q.altoBanda < q.vh * 1.5,
    `${q.altoBanda} px. Sin animacion no tiene sentido hacer scrollear pantallas vacias`);
  comprobar('entrega la cumbre directamente', q.alt === agencia.catalogo.find((c) => c.id === 'villarrica').altitud, `${q.alt} m`);
  comprobar('ningun contenido queda oculto', q.ocultos === 0, `${q.ocultos} ocultos`);

} catch (e) {
  comprobar('el arnes corrio completo', false, e.message);
} finally {
  await navegador?.close();
  servidor.kill();
}

/* ---------- resumen ---------- */
const fallan = resultados.filter((r) => !r.ok);
console.log(`\n${'-'.repeat(72)}`);
console.log(`${resultados.length - fallan.length}/${resultados.length} controles pasaron`);
if (fallan.length) {
  console.log('\nFALLAN:');
  fallan.forEach((f) => console.log(`  - ${f.nombre}: ${f.detalle}`));
}
process.exit(fallan.length ? 1 : 0);
