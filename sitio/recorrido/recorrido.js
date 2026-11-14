/* Recorrido 3D del ascenso al Villarrica.

   Todo con datos abiertos y sin claves:
   - Motor: CesiumJS (Apache 2.0), sin Cesium ion.
   - Relieve: AWS Terrain Tiles en formato terrarium (unos 30 m por punto),
     decodificado aca mismo y entregado a Cesium como heightmap.
   - Imagen: Esri World Imagery en su version de 2024 (archivo Wayback),
     la actual de Esri, o Sentinel-2 cloudless de EOX.

   La camara de cada parada es el encuadre que el usuario guardo en Google
   Earth (centro, rumbo, inclinacion y distancia), ver paradas.js. */
import { PARADAS, TOMAS_CUMBRE, LAVA, LAVA_GOOGLE } from './paradas.js?v=20261103';
const LAVA_ESRI = { ...LAVA };

const C = window.Cesium;
const rad = C.Math.toRadians;
const grad = C.Math.toDegrees;
const fmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const lento = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1;

/* ---------- relieve ---------- */

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const Z_FUENTE = 15;   // ultimo nivel publicado
const LADO = 65;       // muestras por lado en cada tesela de Cesium
const teselas = new Map();

/* Zona de detalle: el volcan y su faldeo, unos 14 km de lado. Ahi se carga la
   foto fina y el relieve fino; afuera el entorno queda liviano (foto hasta el
   nivel 13, relieve hasta el 12) y la niebla lo apaga a lo lejos. Los otros
   volcanes y cerros no se cargan en detalle. */
const ZONA = C.Rectangle.fromDegrees(-72.03, -39.49, -71.85, -39.35);
const NIVEL_ENTORNO = 12;
const esquema = new C.WebMercatorTilingScheme();
const enZona = (x, y, nivel) => C.Rectangle.intersection(esquema.tileXYToRectangle(x, y, nivel), ZONA) !== undefined;

const resueltas = new Map();  // las mismas teselas, ya leidas, para consultas al instante

function leerTesela(z, x, y) {
  const clave = `${z}/${x}/${y}`;
  if (!teselas.has(clave)) {
    if (teselas.size > 600) {
      const vieja = teselas.keys().next().value;
      teselas.delete(vieja);
      resueltas.delete(vieja);
    }
    teselas.set(clave, fetch(`${TERRARIUM}/${clave}.png`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => createImageBitmap(b))
      .then((bmp) => {
        const lienzo = new OffscreenCanvas(256, 256);
        const ctx = lienzo.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, 256, 256).data;
        const h = new Float32Array(256 * 256);
        for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
        resueltas.set(clave, h);
        return h;
      })
      .catch((e) => { teselas.delete(clave); throw e; }));
  }
  return teselas.get(clave);
}

/* Altura real del suelo en un punto, con las teselas que ya estan en
   memoria, del nivel mas fino que haya. Cuesta microsegundos; preguntarle lo
   mismo a Cesium (globe.getHeight) tomaba 12 ms y se hacia en cada cuadro. */
function sueloEn(lat, lng) {
  const r = rad(lat);
  for (let z = Z_FUENTE; z >= 8; z--) {
    const n = 2 ** z;
    const gx = ((lng + 180) / 360) * n * 256 - 0.5;
    const gy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256 - 0.5;
    const tx = Math.floor((gx + 0.5) / 256), ty = Math.floor((gy + 0.5) / 256);
    const h = resueltas.get(`${z}/${tx}/${ty}`);
    if (!h) continue;
    const u = Math.min(254.999, Math.max(0, gx - tx * 256)), v = Math.min(254.999, Math.max(0, gy - ty * 256));
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, i = y0 * 256 + x0;
    return (h[i] * (1 - fx) + h[i + 1] * fx) * (1 - fy) + (h[i + 256] * (1 - fx) + h[i + 257] * fx) * fy;
  }
  return undefined;
}

/* Copia a un arreglo propio el rectangulo de alturas que se pide, en
   pixeles globales de la fuente, armandolo con todas las teselas que toque.
   Asi dos teselas de Cesium que comparten borde calculan ese borde con los
   mismos datos; si cada una usaba solo los suyos, el borde quedaba a distinta
   altura en cada lado y se abria una grieta negra en el cerro.
   Se copia por filas y no punto por punto: el sombreado lee 66.000 puntos por
   tesela y buscarlos uno a uno trababa el movimiento cada vez que cargaba. */
async function bloque(z, gx0, gy0, ancho, alto) {
  const n = 2 ** z, limite = n * 256;
  const tx0 = Math.floor(gx0 / 256), tx1 = Math.floor((gx0 + ancho - 1) / 256);
  const ty0 = Math.floor(Math.max(0, gy0) / 256), ty1 = Math.floor(Math.min(limite - 1, gy0 + alto - 1) / 256);
  const pedidos = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) pedidos.push(leerTesela(z, ((tx % n) + n) % n, ty).then((h) => [tx, ty, h]));
  }
  const datos = new Float32Array(ancho * alto);
  for (const [tx, ty, h] of await Promise.all(pedidos)) {
    const ax = Math.max(gx0, tx * 256), bx = Math.min(gx0 + ancho, tx * 256 + 256);
    const ay = Math.max(gy0, ty * 256), by = Math.min(gy0 + alto, ty * 256 + 256);
    for (let gy = ay; gy < by; gy++) {
      const fuente = (gy - ty * 256) * 256 - tx * 256, destino = (gy - gy0) * ancho - gx0;
      for (let gx = ax; gx < bx; gx++) datos[destino + gx] = h[fuente + gx];
    }
  }
  // filas fuera del mapa (solo cerca de los polos): se repite la ultima valida
  for (let f = 0; f < alto; f++) {
    const gy = gy0 + f;
    if (gy < 0 || gy >= limite) {
      const valida = Math.min(limite - 1, Math.max(0, gy)) - gy0;
      datos.copyWithin(f * ancho, valida * ancho, valida * ancho + ancho);
    }
  }
  return datos;
}

/* Si la tesela pedida es mas fina que la fuente se usa la grilla del nivel
   de la fuente; si la fuente no existe, la del nivel de arriba. */
async function alturas(x, y, nivel, zMax = Z_FUENTE) {
  const z = Math.min(nivel, zMax, enZona(x, y, nivel) ? Z_FUENTE : NIVEL_ENTORNO);
  const escala = 2 ** (nivel - z);
  // posicion global (en pixeles de la fuente) de la muestra c de la tesela x
  const gx = (c) => ((x + c / (LADO - 1)) / escala) * 256 - 0.5;
  const gy = (f) => ((y + f / (LADO - 1)) / escala) * 256 - 0.5;
  const x0 = Math.floor(gx(0)), y0 = Math.floor(gy(0));
  const ancho = Math.floor(gx(LADO - 1)) + 2 - x0, alto = Math.floor(gy(LADO - 1)) + 2 - y0;
  let h;
  try {
    h = await bloque(z, x0, y0, ancho, alto);
  } catch {
    if (z === 0) return new Float32Array(LADO * LADO);
    return alturas(x, y, nivel, z - 1);
  }
  const salida = new Float32Array(LADO * LADO);
  for (let f = 0; f < LADO; f++) {
    const v = gy(f) - y0, fv = Math.floor(v), dy = v - fv;
    for (let c = 0; c < LADO; c++) {
      const u = gx(c) - x0, fu = Math.floor(u), dx = u - fu;
      const i = fv * ancho + fu;
      const a = h[i] * (1 - dx) + h[i + 1] * dx;
      const b = h[i + ancho] * (1 - dx) + h[i + ancho + 1] * dx;
      salida[f * LADO + c] = a * (1 - dy) + b * dy;
    }
  }
  return salida;
}

const terreno = new C.CustomHeightmapTerrainProvider({
  width: LADO,
  height: LADO,
  tilingScheme: esquema,
  callback: (x, y, nivel) => alturas(x, y, nivel),
  credit: 'Relieve: AWS Terrain Tiles (Mapzen)',
});

/* ---------- imagen ---------- */

/* Una sola imagen: la actual de Esri, tal cual, sin nieve agregada. El
   usuario la eligio el 2026-11-03 entre 2022, 2024, Actual y Sentinel-2, y
   entre la foto sola y dos modos de nieve calculada (cumbre y volcan nevado).
   La nieve calculada a partir de la foto se veia bien de lejos pero plana de
   cerca; la de la foto es real. Las demas versiones quedan en IMAGENES por si
   se quiere volver a compararlas. */
const IMAGEN_INICIAL = 'esri';
const IMAGENES = {
  esri: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    /* Sobre el volcan la foto real llega hasta el nivel 18; en el 19 Esri
       devuelve una tesela gris de relleno ("Map data not yet available"),
       medido el 2026-10-31 en Cafeteria, Andarivel, Colada y Cumbre. */
    maximumLevel: 18,
    // tesela de relleno conocida: si aparece en otro lugar, se descarta y se usa la del nivel de arriba
    relleno: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/19/324652/157345',
    credito: 'Imagenes: Esri, Maxar, Earthstar Geographics',
  },
  /* La version publicada el 2024-08-15 es la menos nevada y la unica que
     muestra el crater con la laguna de lava y la fumarola, como Google Earth
     (captura de enero de 2024). Revisadas las 12 versiones distintas del
     archivo el 2026-10-31. Donde esa version no tiene tesela, se usa la actual. */
  /* Version publicada el 2022-08-31: la que mas se parece en nieve a Google
     Earth (manchas blancas con vetas oscuras en la cara norte y la cumbre
     oscura). La de 2024 deja la cara del sendero casi sin nieve. Revisadas
     las 9 versiones del cono completo el 2026-10-31. */
  w2022: {
    url: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/45441/{z}/{y}/{x}',
    respaldo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 18,
    credito: 'Imagenes: Esri World Imagery, version 2022 (Wayback), Maxar',
  },
  w2024: {
    url: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/32553/{z}/{y}/{x}',
    respaldo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 18,
    credito: 'Imagenes: Esri World Imagery, version 2024 (Wayback), Maxar',
  },
  s2: {
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg',
    maximumLevel: 15,
    credito: 'Imagenes: Sentinel-2 cloudless 2023 de EOX IT Services (datos Copernicus modificados)',
  },
};
/* Pide la tesela a la fuente principal y, si no la tiene, al respaldo. */
class ConRespaldo extends C.UrlTemplateImageryProvider {
  constructor(op) { super(op); this._plantillas = [op.url, op.respaldo]; }
  requestImage(x, y, z) {
    const [a, b] = this._plantillas.map((u) => u.replace('{z}', z).replace('{y}', y).replace('{x}', x));
    const cargar = (u) => Promise.resolve(C.ImageryProvider.loadImage(this, u)).then((img) => img ?? Promise.reject(new Error('sin imagen')));
    return cargar(a).catch(() => cargar(b));
  }
}
/* `detalle`: la capa fina, recortada a la zona. Sin el, la capa del entorno,
   que llega hasta el nivel 13 y cubre todo.
   TONO: la foto de Esri llega lavada al lado de Google Earth: nieve gris y
   roca sin cuerpo. Se le sube el contraste y el brillo de los medios en la
   GPU, sin costo por cuadro. Valores ajustados a ojo contra la captura de
   Google Earth del 2026-11-02 en la vista de la Cafeteria. */
const TONO = { contrast: 1.4, saturation: 1.0, brightness: 1.0, gamma: 1.05 };
const capaDe = (k, detalle) => new C.ImageryLayer(new (IMAGENES[k].respaldo ? ConRespaldo : C.UrlTemplateImageryProvider)({
  respaldo: IMAGENES[k].respaldo,
  url: IMAGENES[k].url,
  maximumLevel: detalle ? IMAGENES[k].maximumLevel : Math.min(13, IMAGENES[k].maximumLevel),
  credit: IMAGENES[k].credito,
  tileDiscardPolicy: IMAGENES[k].relleno
    ? new C.DiscardMissingTileImagePolicy({
      missingImageUrl: IMAGENES[k].relleno,
      pixelsToCheck: [new C.Cartesian2(0, 0), new C.Cartesian2(120, 140), new C.Cartesian2(200, 60), new C.Cartesian2(255, 255)],
      disableCheckIfAllPixelsAreTransparent: true,
    })
    : undefined,
}), { ...TONO, ...(detalle ? { rectangle: ZONA } : {}) });

/* ---------- sombreado del relieve ----------
   El relieve gratuito no trae normales y Cesium no lo ilumina: la pendiente
   solo se lee por las sombras de la foto. Esta capa calcula el sombreado con
   las mismas alturas y lo pone encima, sombra en negro y luz en blanco, ambas
   semitransparentes. Sol desde el noreste, como en la foto de 2024. */
const SOL = { az: rad(45), alt: rad(38) };
const REALCE = 1.6;
async function sombreado(x, y, z) {
  const h = await bloque(z, x * 256 - 1, y * 256 - 1, 258, 258);
  /* Sobre la nieve de la foto el sombreado se apaga: la foto ya trae su luz,
     y el del modelo de alturas encima la manchaba de gris como algodon
     (visto por el usuario con la imagen "Actual" el 2026-11-03). */
  let claro = null;
  const foto = await fotoDe(x, y, z).catch(() => null);
  if (foto) {
    const c2 = document.createElement('canvas');
    c2.width = c2.height = 256;
    const g2 = c2.getContext('2d', { willReadFrequently: true });
    g2.drawImage(foto, 0, 0, 256, 256);
    claro = g2.getImageData(0, 0, 256, 256).data;
  }
  const n = 2 ** z;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  const celda = (40075016.686 * Math.cos(lat)) / (256 * n);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 256;
  const ctx = lienzo.getContext('2d');
  const img = ctx.createImageData(256, 256);
  const d = img.data;
  const sx = Math.sin(SOL.az) * Math.cos(SOL.alt), sy = Math.cos(SOL.az) * Math.cos(SOL.alt), sz = Math.sin(SOL.alt);
  const k = REALCE / (2 * celda);
  for (let f = 0; f < 256; f++) {
    for (let c = 0; c < 256; c++) {
      const j = (f + 1) * 258 + c + 1;  // el bloque trae un pixel de margen
      const este = (h[j + 1] - h[j - 1]) * k;
      const norte = (h[j - 258] - h[j + 258]) * k;
      const luz = (-este * sx - norte * sy + sz) / Math.hypot(este, norte, 1);
      const i = (f * 256 + c) * 4;
      if (luz < sz) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.min(150, (sz - luz) * 260); }
      else { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(45, (luz - sz) * 110); }
      if (claro) {
        const lum = (0.2126 * claro[i] + 0.7152 * claro[i + 1] + 0.0722 * claro[i + 2]) / 255;
        d[i + 3] *= 1 - 0.9 * suaveEntre(0.5, 0.75, lum);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return lienzo;
}
/* ---------- capas calculadas por adelantado ----------
   El sombreado se calcula una vez con
   herramientas/hornear_capas.py y quedan como WebP en media/capas/. Asi el
   navegador no hace el calculo tesela por tesela mientras la persona se
   acerca: aparece listo y el movimiento queda libre, que es lo que
   necesita un celular. Si una combinacion no esta horneada (otra foto, o
   ?envivo en la direccion para comparar), se calcula en vivo como antes. */
const HORNEADAS = await fetch('media/capas/indice.json?v=20261103')
  .then((r) => (r.ok && !new URLSearchParams(location.search).has('envivo') ? r.json() : {}))
  .catch(() => ({}));
for (const capa of Object.values(HORNEADAS)) {
  capa.hay = new Set(Object.entries(capa.teselas).flatMap(([z, ts]) => ts.map((t) => `${z}/${t}`)));
}
const VACIA = document.createElement('canvas');
VACIA.width = VACIA.height = 1;
/* Proveedor que sirve la capa horneada `nombre` en sus niveles y, fuera de
   ellos o si no existe, calcula en vivo con `enVivo`. */
class Horneada extends C.UrlTemplateImageryProvider {
  constructor(opciones, nombre, enVivo) {
    super(opciones);
    this._capa = HORNEADAS[nombre];
    this._nombre = nombre;
    this._enVivo = enVivo;
  }
  requestImage(x, y, z) {
    const capa = this._capa;
    if (!capa || z < capa.niveles[0]) return this._enVivo(x, y, z);
    if (!capa.hay.has(`${z}/${x}/${y}`)) return Promise.resolve(VACIA);
    return C.ImageryProvider.loadImage(this, `media/capas/${this._nombre}/${z}/${x}/${y}.webp`);
  }
}
const nivelMaximo = (nombre, porDefecto) => HORNEADAS[nombre]?.niveles.at(-1) ?? porDefecto;

const capaSombra = () => {
  const nombre = `sombra-${IMAGEN_INICIAL}`;
  return new C.ImageryLayer(new Horneada({
    url: `${TERRARIUM}/{z}/{x}/{y}.png`,
    minimumLevel: 9, maximumLevel: nivelMaximo(nombre, Z_FUENTE),
    rectangle: ZONA,
  }, nombre, sombreado));
};


/* ---------- volcan nevado ----------
   Opcion del engranaje, apagada de entrada. Suma nieve partiendo de la misma
   foto: donde la foto es clara (ceniza, quebradas) la vuelve nieve y donde es
   oscura (las costillas de lava) deja la roca, mas cubierto mientras mas
   alto. Asi la nieve sigue la forma real de las coladas. Se calcula por
   adelantado (herramientas/hornear_capas.py); en vivo solo si falta.
   Descartado el 2026-11-02: pintar blanco a partir del modelo de alturas.
   Con 30 m por punto salian manchas redondas y planas, y se veia falso. */
const NIEVE = { desde: 1450, lleno: 2250, crater: 2760, claro: 2.4, ref: 0.28, base: 0.27, manchas: 0.35 };

/* ayudantes del sombreado y la nieve en vivo (fuera de las teselas ya calculadas) */
const suaveEntre = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const cargarFoto = (u) => new Promise((ok, mal) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => ok(img);
  img.onerror = mal;
  img.src = u;
});
const azar = (i, j) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function ruidoValor(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = azar(i, j), b = azar(i + 1, j), c = azar(i, j + 1), d = azar(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
async function fotoDe(x, y, z) {
  const def = IMAGENES[IMAGEN_INICIAL];
  if (z > def.maximumLevel) return null;
  const urls = [def.url, def.respaldo].filter(Boolean).map((u) => u.replace('{z}', z).replace('{y}', y).replace('{x}', x));
  for (const u of urls) { try { return await cargarFoto(u); } catch { /* sigue con el respaldo */ } }
  return null;
}

async function nieve(x, y, z) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 256;
  // alturas: del nivel 15 hacia abajo se leen directo; mas fino, se interpolan
  const zE = Math.min(z, Z_FUENTE), escala = 2 ** (z - zE), M = 2;
  const gx0 = Math.floor((x * 256) / escala) - M, gy0 = Math.floor((y * 256) / escala) - M;
  const lado = Math.ceil(256 / escala) + 2 * M + 1;
  const h = await bloque(zE, gx0, gy0, lado, lado);
  let tope = -Infinity;
  for (let k = 0; k < h.length; k++) if (h[k] > tope) tope = h[k];
  if (tope < NIEVE.desde) return lienzo;  // tesela entera bajo la nieve: nada que hacer
  const foto = await fotoDe(x, y, z);
  if (!foto) return lienzo;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(foto, 0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  const d = img.data;
  const n = 2 ** z;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  const celda = (40075016.686 * Math.cos(lat)) / (256 * n);
  for (let f = 0; f < 256; f++) {
    const fy = (y * 256 + f + 0.5) / escala - gy0 - 0.5, fy0 = Math.floor(fy), ty = fy - fy0;
    for (let c = 0; c < 256; c++) {
      const i = (f * 256 + c) * 4;
      const fx = (x * 256 + c + 0.5) / escala - gx0 - 0.5, fx0 = Math.floor(fx), tx = fx - fx0;
      const k = fy0 * lado + fx0;
      const e = (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - ty) + (h[k + lado] * (1 - tx) + h[k + lado + 1] * tx) * ty;
      const cubierta = suaveEntre(NIEVE.desde, NIEVE.lleno, e) * (1 - 0.65 * suaveEntre(NIEVE.crater, 2850, e));
      if (cubierta <= 0) { d[i + 3] = 0; continue; }
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // manchas grandes, de unos 200 m, para que no se cubra parejo
      const mx = (x * 256 + c) * celda, my = (y * 256 + f) * celda;
      const manchas = ruidoValor(mx / 220, my / 220) * 0.7 + ruidoValor(mx / 70, my / 70) * 0.3;
      const puntaje = cubierta + (lum - NIEVE.ref) * NIEVE.claro + (manchas - 0.5) * NIEVE.manchas - NIEVE.base;
      // borde corto: uno ancho mezclaba blanco con roca y dejaba un halo gris
      const a = suaveEntre(0, 0.05, puntaje);
      if (a <= 0) { d[i + 3] = 0; continue; }
      /* Blanco limpio con un grano apenas visible de la foto. Antes el tono
         seguia la luz de la foto entre gris y blanco: sobre ceniza oscura la
         nieve quedaba gris y cambiaba al acercarse, porque cada nivel de la
         foto trae otra luz (visto por el usuario el 2026-11-03). */
      const t = Math.min(1, Math.max(0, (lum - 0.12) / 0.55));
      d[i] = 238 + 14 * t; d[i + 1] = 241 + 12 * t; d[i + 2] = 246 + 8 * t;
      d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return lienzo;
}
const capaNieve = () => new C.ImageryLayer(new Horneada({
  url: `${TERRARIUM}/{z}/{x}/{y}.png`,
  minimumLevel: 11, maximumLevel: nivelMaximo(`nieve-${IMAGEN_INICIAL}`, IMAGENES[IMAGEN_INICIAL].maximumLevel),
  rectangle: ZONA,
}, `nieve-${IMAGEN_INICIAL}`, nieve));

/* ---------- visor ---------- */

const visor = new C.Viewer('globo', {
  baseLayer: capaDe(IMAGEN_INICIAL, false),
  terrainProvider: terreno,
  animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
  homeButton: false, sceneModePicker: false, navigationHelpButton: false,
  fullscreenButton: false, infoBox: false, selectionIndicator: false,
  creditContainer: document.getElementById('creditos-cesium'),
  // dibuja a la resolucion real de la pantalla (retina), no a la mitad
  useBrowserRecommendedResolution: false,
  // en pantalla retina los bordes ya salen finos: el antialiasing solo cuesta
  msaaSamples: 1,
});
const escena = visor.scene;
const camara = escena.camera;
const globo = escena.globe;

/* Mas descargas en paralelo para que la imagen fina llegue durante el vuelo. */
C.RequestScheduler.requestsByServer['server.arcgisonline.com:443'] = 36;
C.RequestScheduler.requestsByServer['s3.amazonaws.com:443'] = 36;
C.RequestScheduler.requestsByServer['tiles.maps.eox.at:443'] = 36;
C.RequestScheduler.requestsByServer['wayback.maptiles.arcgis.com:443'] = 36;

globo.depthTestAgainstTerrain = true;
globo.loadingDescendantLimit = 40;
globo.maximumScreenSpaceError = 1.5;

/* Resolucion adaptativa: mientras la camara se mueve se dibuja a la mitad
   (la resolucion de pantalla normal, no retina) y con un poco menos de
   detalle; al detenerse vuelve la nitidez completa. En retina dibujar a
   resolucion completa costaba unas 2,6 veces mas por cuadro. */
const prueba = new URLSearchParams(location.search);
const SSE_MOVIENDO = Number(prueba.get('sse') ?? 4);
const ESCALA_MOVIENDO = Number(prueba.get('rs') ?? 0.5);
/* Con Google la resolucion es fija, para que no se vea pixelado al moverse
   y nitido al llegar. Fija en 1,5 pixeles por punto de pantalla: medido el
   2026-11-04 en la presentacion, en retina a resolucion completa iba a 30
   cuadros por segundo con 51 tirones en 14 s; a 0,75 iba a 60 con 17, igual
   que a 0,5, y se ve mas nitido que eso. En pantallas normales queda en 1.
   ?rsg= en la direccion para medir otra. */
const ESCALA_GOOGLE = Number(prueba.get('rsg') ?? Math.min(1, 1.5 / (window.devicePixelRatio || 1)));
let enMovimiento = false;
function calidad(moviendo) {
  if (moviendo === enMovimiento) return;
  enMovimiento = moviendo;
  /* Con los modelos de Google no se baja la calidad en movimiento: se veia
     pixelado durante cada vuelo y nitido recien al llegar (visto por el
     usuario el 2026-11-03), y Google ya corre fluido a resolucion completa. */
  if (google) { visor.resolutionScale = ESCALA_GOOGLE; return; }
  visor.resolutionScale = moviendo ? Math.min(1, ESCALA_MOVIENDO * 2 / (window.devicePixelRatio || 1)) : 1;
  globo.maximumScreenSpaceError = moviendo ? SSE_MOVIENDO : 1.5;
}
/* El movimiento se detecta comparando la matriz de vista de un cuadro con la
   del anterior. Con los eventos moveStart/moveEnd de Cesium la calidad se
   quedaba a veces en media resolucion con la camara quieta: medido el
   2026-11-02, resolutionScale 0,5 tras detener la presentacion. */
const vistaPrevia = new C.Matrix4();
let ultimoCambio = 0;
escena.preRender.addEventListener(() => {
  const ahora = performance.now();
  if (!C.Matrix4.equalsEpsilon(camara.viewMatrix, vistaPrevia, 1e-9)) {
    C.Matrix4.clone(camara.viewMatrix, vistaPrevia);
    ultimoCambio = ahora;
    calidad(true);
  } else if (ahora - ultimoCambio > 250) {
    calidad(false);
  }
});

// medidor de cuadros por segundo con ?fps en la direccion
escena.debugShowFramesPerSecond = new URLSearchParams(location.search).has('fps');
globo.tileCacheSize = 500;
globo.preloadSiblings = true;
globo.showGroundAtmosphere = true;
globo.baseColor = C.Color.fromCssColorString('#0b1a2e');
escena.fog.enabled = true;
escena.fog.density = 2.4e-4;
escena.fog.screenSpaceErrorFactor = 4;  // lo que la niebla cubre se carga con menos detalle
escena.postProcessStages.fxaa.enabled = false;
escena.verticalExaggeration = 1.3;
let capaBase = visor.imageryLayers.get(0);
/* imageryLayers.add() no devuelve la capa: se guarda la referencia antes de
   agregarla. Con `let x = add(...)` las dos quedaban en undefined y ni el
   cambio de imagen ni la casilla del sombreado hacian efecto. */
let capaDetalle = capaDe(IMAGEN_INICIAL, true);
visor.imageryLayers.add(capaDetalle);
const sombra = capaSombra();
visor.imageryLayers.add(sombra);
// la nieve va encima del sombreado: ya trae la luz de la foto
const nevada = capaNieve();
nevada.show = false;
visor.imageryLayers.add(nevada);

/* ---------- modelos 3D de Google ----------
   Con clave de la Map Tiles API el volcan se dibuja con los modelos 3D
   fotorrealistas de Google (los de Google Earth): mas nitidos y, medido el
   2026-11-03 en Chrome, sin los tirones que dejaba armar el relieve propio
   (0 a 2 cuadros lentos por vuelo contra 7 a 13). El globo propio, con las
   fotos de Esri y el relieve de AWS, queda de respaldo: si no hay clave, si
   Google rechaza la clave o se acabo la cuota, se vuelve a el solo.
   La clave va en config.js (o la deja google.html en este navegador).
   ?esri en la direccion fuerza la version de respaldo, para comparar. */
let google = null;
// metros que hay que sumar a las alturas del relieve propio para caer sobre
// el modelo de Google (Google mide sobre el elipsoide, el relieve sobre el mar)
let desfase = 0;
const claveGoogle = (() => {
  if (prueba.has('esri')) return '';
  if (window.CLAVE_GOOGLE) return window.CLAVE_GOOGLE;
  try { return localStorage.getItem('clave-google-3d') || ''; } catch { return ''; }
})();
function volverAEsri(motivo) {
  if (!google) return;
  escena.primitives.remove(google);
  google = null;
  desfase = 0;
  PARADAS.forEach((p) => { delete p.sueloG; });
  delete LAVA.sueloG;
  Object.assign(LAVA, LAVA_ESRI);
  globo.show = true;
  escena.verticalExaggeration = 1.3;
  document.body.classList.remove('con-google');
  ubicarMarcas();
  crearLava();
  console.warn('Recorrido: se vuelve a las fotos de Esri.', motivo ?? '');
}
if (claveGoogle) {
  globo.show = false;
  try {
    C.GoogleMaps.defaultApiKey = claveGoogle;
    google = await C.createGooglePhotorealistic3DTileset();
    escena.primitives.add(google);
    escena.verticalExaggeration = 1;  // los modelos de Google no se exageran
    Object.assign(LAVA, LAVA_GOOGLE);  // el pozo cae en otro punto en el modelo de Google
    document.body.classList.add('con-google');
    let buenas = 0, fallas = 0;
    google.tileLoad.addEventListener(() => { buenas++; });
    // si no llega ninguna tesela y fallan las primeras, la clave o la cuota no sirven
    google.tileFailed.addEventListener((e) => { fallas++; if (!buenas && fallas >= 3) volverAEsri(e.message); });
  } catch (e) {
    google = null;
    globo.show = true;
    console.warn('Recorrido: Google no respondio, se usan las fotos de Esri.', e?.message ?? e);
  }
}
/* Altura del suelo bajo una parada en la escena que se esta mostrando. */
const alturaDe = (p) => (google && p.sueloG != null ? p.sueloG : (p.suelo ?? p.alt ?? 2300) * exag() + desfase);
/* Con Google, una vez cargado, se mide el modelo bajo cada parada y bajo la
   lava para asentar ahi los pines y el crater, y se saca el desfase que se
   aplica a la camara. */
async function asentarEnGoogle() {
  if (!google) return;
  const lugares = [...PARADAS, LAVA];
  try {
    const medidos = await escena.sampleHeightMostDetailed(lugares.map((p) => C.Cartographic.fromDegrees(p.lng, p.lat)));
    const difs = [];
    medidos.forEach((c, i) => {
      if (c?.height == null) return;
      lugares[i].sueloG = c.height;
      if (lugares[i].suelo != null) difs.push(c.height - lugares[i].suelo);
    });
    difs.sort((a, b) => a - b);
    if (difs.length) desfase = difs[difs.length >> 1];
    estado.desfase = desfase;
  } catch { /* quedan con el relieve propio */ }
  ubicarMarcas();
  crearLava();
}

/* Mismo angulo de vision que Google Earth: 60 grados en vertical. Cesium
   aplica el angulo al lado mas largo, asi que se convierte. */
function ajustarFov() {
  const a = escena.canvas.clientWidth / escena.canvas.clientHeight;
  camara.frustum.fov = a > 1 ? 2 * Math.atan(Math.tan(rad(30)) * a) : rad(60);
}
ajustarFov();
window.addEventListener('resize', ajustarFov);

/* Raton como en Google Earth: arrastrar mueve, rueda acerca, boton derecho o
   Shift+arrastrar inclina y gira. */
const ctl = escena.screenSpaceCameraController;
ctl.zoomEventTypes = [C.CameraEventType.WHEEL, C.CameraEventType.PINCH];
ctl.tiltEventTypes = [
  C.CameraEventType.RIGHT_DRAG, C.CameraEventType.MIDDLE_DRAG, C.CameraEventType.PINCH,
  { eventType: C.CameraEventType.LEFT_DRAG, modifier: C.KeyboardEventModifier.SHIFT },
  { eventType: C.CameraEventType.LEFT_DRAG, modifier: C.KeyboardEventModifier.CTRL },
];
/* Zoom con limites: de 80 m a 25 km. No se sale al globo ni se va lejos del
   volcan; si la camara se aleja de la zona, se la devuelve al borde. */
ctl.minimumZoomDistance = 80;
/* En modo manual la camara no se aleja mas que el encuadre de la Cafeteria
   (2.521 m en el KML). Las tomas propias, como la vuelta 360, no pasan por
   este limite. */
const ALEJAMIENTO_MAXIMO = 2700;
/* En pantalla vertical cabe menos ancho: la camara se aleja para que el volcan entre completo */
const encuadre = () => (innerHeight > innerWidth ? 1.7 : 1);
const fijarAlejamiento = () => { ctl.maximumZoomDistance = ALEJAMIENTO_MAXIMO * encuadre(); };
fijarAlejamiento();
addEventListener('resize', fijarAlejamiento);
const LIMITE = C.Rectangle.fromDegrees(-72.2, -39.6, -71.68, -39.24);
camara.changed.addEventListener(() => {
  const c = camara.positionCartographic;
  const lon = C.Math.clamp(c.longitude, LIMITE.west, LIMITE.east);
  const lat = C.Math.clamp(c.latitude, LIMITE.south, LIMITE.north);
  const alto = Math.min(c.height, 22000);
  if (lon !== c.longitude || lat !== c.latitude || alto !== c.height) {
    camara.setView({
      destination: C.Cartesian3.fromRadians(lon, lat, alto),
      orientation: { heading: camara.heading, pitch: camara.pitch, roll: 0 },
    });
  }
});
camara.percentageChanged = 0.01;
visor.cesiumWidget.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

/* ---------- marcas ---------- */

const svgPin = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 38.5S3.5 24.6 3.5 15a11.5 11.5 0 0 1 23 0c0 9.6-11.5 23.5-11.5 23.5z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="4.6" fill="#fff"/></svg>`;
// negro (obsidiana del logo) y mas chicos que el azul de Google Earth
const PIN = 'data:image/svg+xml,' + encodeURIComponent(svgPin('#0A0B0D'));
const ESCALA_PIN = 0.65, ESCALA_PIN_ACTIVO = 0.85;
const VISIBLE = new C.DistanceDisplayCondition(0, 80000);

const marcas = PARADAS.map((p, i) => visor.entities.add({
  id: `parada-${i}`,
  position: C.Cartesian3.fromDegrees(p.lng, p.lat, p.alt ?? 2300),
  billboard: {
    image: PIN, width: 30, height: 40, scale: ESCALA_PIN,
    verticalOrigin: C.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: VISIBLE,
  },
  label: {
    text: p.nombre,
    font: '500 32px Roboto, system-ui, sans-serif',
    scale: 0.5,  // se dibuja al doble y se reduce: queda nitida en pantallas retina
    fillColor: C.Color.WHITE,
    outlineColor: C.Color.fromCssColorString('rgba(0,0,0,.85)'),
    outlineWidth: 6,
    style: C.LabelStyle.FILL_AND_OUTLINE,
    horizontalOrigin: C.HorizontalOrigin.LEFT,
    verticalOrigin: C.VerticalOrigin.CENTER,
    pixelOffset: new C.Cartesian2(12, -17),  // a la altura de la cabeza del pin
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: VISIBLE,
  },
}));

/* Une las paradas en linea recta. No es el sendero: el KML no lo trae.
   Parte apagada; se prende desde el panel. */
const linea = visor.entities.add({
  show: false,
  polyline: {
    positions: C.Cartesian3.fromDegreesArray(PARADAS.flatMap((p) => [p.lng, p.lat])),
    clampToGround: true,
    width: 3,
    material: C.Color.fromCssColorString('#FBC02D'),
  },
});

/* Puntos visibles o no. Al cargar no se ven: primero aparece el volcan y los
   puntos cuando termina de cargar. En la cumbre se esconden para dejar solo
   el crater, y vuelven al regresar a la Cafeteria. La linea sigue al panel. */
/* Los puntos se van sumando a medida que se recorre: al cargar no se ve
   ninguno, y cada parada a la que se llega (por Play o eligiendola) muestra
   todas hasta ella. Cada punto nuevo entra creciendo. */
let puntosVisibles = false;
let alcance = -1;
const entrar = (m) => {
  const t0 = performance.now();
  const paso = (ahora) => {
    const k = Math.min(1, (ahora - t0) / 450);
    const e = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;  // crece con un pequeno rebote
    m.billboard.scale = (marcas[estado.i] === m ? ESCALA_PIN_ACTIVO : ESCALA_PIN) * e;
    m.label.scale = 0.5 * Math.min(1, k * 1.4);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
};
function mostrarPuntos(ver) {
  puntosVisibles = ver;
  marcas.forEach((m, i) => {
    const antes = m.show;
    m.show = ver && i <= alcance;
    if (m.show && !antes) entrar(m);
  });
  linea.show = ver && document.getElementById('chk-linea').checked;
}
function ampliarAlcance(i) {
  if (i <= alcance) return;
  alcance = i;
  if (puntosVisibles) mostrarPuntos(true);
}
mostrarPuntos(false);

/* ---------- datos de cada parada ---------- */

function metros(a, b) {
  const g1 = C.Cartographic.fromDegrees(a.lng, a.lat), g2 = C.Cartographic.fromDegrees(b.lng, b.lat);
  return new C.EllipsoidGeodesic(g1, g2).surfaceDistance;
}

function dms(valor, pos, neg) {
  const s = valor < 0 ? neg : pos;
  let v = Math.abs(valor);
  const g = Math.floor(v); v = (v - g) * 60;
  const m = Math.floor(v); const seg = (v - m) * 60;
  return `${g}°${String(m).padStart(2, '0')}'${seg.toFixed(2).replace('.', ',').padStart(5, '0')}"${s}`;
}

/* Las marcas se apoyan en la cota del relieve que se esta mostrando, medida
   una vez, y no en el ajuste al suelo de Cesium: ese espera a que cargue la
   tesela fina y mientras tanto deja el pin flotando a media ladera.
   El Tubo viene sin cota en el KML: se toma de la misma medicion. */
async function completarCotas() {
  try {
    const lugares = [...PARADAS, LAVA];
    const puntos = await C.sampleTerrain(terreno, Z_FUENTE, lugares.map((p) => C.Cartographic.fromDegrees(p.lng, p.lat)));
    LAVA.suelo = puntos.pop().height;
    puntos.forEach((c, i) => {
      const p = PARADAS[i];
      p.suelo = c.height;
      if (p.alt == null) { p.alt = Math.round(c.height); p.altDelRelieve = true; }
    });
  } catch { /* quedan con la cota del KML */ }
  ubicarMarcas();
  crearLava();
  pintarLista();
  armarAltimetro();
}

/* Con el relieve exagerado, las alturas absolutas se exageran igual. */
const exag = () => escena.verticalExaggeration || 1;
function ubicarMarcas() {
  PARADAS.forEach((p, i) => {
    marcas[i].position = C.Cartesian3.fromDegrees(p.lng, p.lat, alturaDe(p));
  });
}

/* ---------- lava y fumarola ----------
   La foto de 2024 muestra el pozo con un punto rojo y la columna de gas. Aca
   se le da vida: una laguna incandescente que hierve y un penacho que sube y
   se lo lleva el viento hacia el noreste, como en la foto. */
const FUENTE_LAVA = `
  uniform float tiempo;
  float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = azar(i), b = azar(i + vec2(1.0, 0.0)), c = azar(i + vec2(0.0, 1.0)), d = azar(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  czm_material czm_getMaterial(czm_materialInput entrada) {
    czm_material m = czm_getDefaultMaterial(entrada);
    vec2 p = entrada.st - 0.5;
    float r = length(p) * 2.0;
    /* Laguna de lava como se ve de verdad: costra casi negra que se mueve
       despacio, partida por grietas finas incandescentes, y un borde
       irregular donde la lava toca la roca. Antes el centro brillaba parejo
       y la laguna se veia como una esfera. */
    vec2 q = p * 7.0;
    float flujo = fbm(q + vec2(tiempo * 0.035, -tiempo * 0.025) + fbm(q * 0.6 - tiempo * 0.02));
    float grieta = 1.0 - smoothstep(0.0, 0.07, abs(flujo));
    float fina = 1.0 - smoothstep(0.0, 0.04, abs(fbm(q * 2.1 + 3.7 - tiempo * 0.05)));
    float borde = r + fbm(p * 5.0 + 1.3) * 0.12;
    float orilla = smoothstep(0.72, 0.95, borde);
    float calor = clamp(grieta * 0.9 + fina * 0.45 + orilla * 0.8 + 0.08 * sin(tiempo * 1.9 + flujo * 6.0), 0.0, 1.0);
    vec3 costra = mix(vec3(0.05, 0.035, 0.03), vec3(0.14, 0.05, 0.03), smoothstep(-0.4, 0.4, flujo));
    vec3 brasa = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.72, 0.28), smoothstep(0.6, 1.0, calor));
    vec3 color = mix(costra, brasa, smoothstep(0.25, 0.85, calor));
    m.diffuse = color;
    m.emission = brasa * smoothstep(0.25, 0.85, calor) * 1.2;
    m.alpha = 1.0 - smoothstep(0.93, 1.0, borde);
    return m;
  }`;
const FUENTE_HALO = `
  uniform float tiempo;
  czm_material czm_getMaterial(czm_materialInput entrada) {
    czm_material m = czm_getDefaultMaterial(entrada);
    float r = length(entrada.st - 0.5) * 2.0;
    float pulso = 0.85 + 0.15 * sin(tiempo * 1.7);
    m.diffuse = vec3(1.0, 0.38, 0.08);
    m.emission = vec3(1.0, 0.38, 0.08);
    m.alpha = pow(max(0.0, 1.0 - r), 2.6) * 0.35 * pulso;
    return m;
  }`;
/* Penacho de la fumarola a pleno: un plano vertical que siempre mira a la
   camara, con el humo dibujado en la tarjeta grafica. Una columna que sale
   angosta del crater, se ensancha al subir y arriba se dobla con el viento,
   con bocanadas que suben y se deforman. Es una sola superficie, mucho mas
   liviana que cientos de particulas, y se ve con volumen porque la luz va
   clara del lado del sol y gris del otro. Blanco, como pidio el usuario. */
const FUENTE_PENACHO = `
  uniform float tiempo;
  uniform float intensidad;
  uniform float curva;
  float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = azar(i), b = azar(i + vec2(1.0, 0.0)), c = azar(i + vec2(0.0, 1.0)), d = azar(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * ruido(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  czm_material czm_getMaterial(czm_materialInput entrada) {
    czm_material m = czm_getDefaultMaterial(entrada);
    float y = entrada.st.t;
    float x = entrada.st.s - 0.5;
    // columna gruesa que se tuerce hacia un lado y se abre en nube arriba
    // sube recto (sin doblarse) y ancho desde abajo (pedido del 2026-11-04)
    float centro = 0.0;
    float ancho = 0.07 + 0.33 * pow(y, 1.1);
    float u = (x - centro) / ancho;
    // las bocanadas suben: el ruido se desplaza hacia arriba con el tiempo
    vec2 q = vec2(u * 0.9, y * 4.2 - tiempo * 0.09);
    float n = fbm(q * 2.2 + vec2(0.0, -tiempo * 0.05) + fbm(q * 1.3 + tiempo * 0.03) * 0.8);
    float borde = abs(u) + (0.5 - n) * 0.9;
    float dens = smoothstep(1.15, 0.25, borde);
    dens *= smoothstep(0.0, 0.04, y) * (1.0 - smoothstep(0.62, 0.98, y + (n - 0.5) * 0.25));
    // luz: clara del lado del sol, gris en el otro y en los huecos entre bocanadas
    // siempre blanco: solo un matiz muy leve de sombra, sin llegar a gris
    float luz = clamp(0.94 - u * 0.04 + (n - 0.5) * 0.2, 0.86, 1.0);
    m.diffuse = vec3(0.98, 0.98, 0.97) * luz;
    m.emission = vec3(1.0) * luz * 0.4;
    m.alpha = dens * intensidad * 0.92;
    return m;
  }`;
const materiales = [];
let primitivasLava = [];

function disco(lat, lng, altura, radio, fuente) {
  const material = new C.Material({ fabric: { uniforms: { tiempo: 0 }, source: fuente } });
  materiales.push(material);
  return escena.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({
      geometry: new C.EllipseGeometry({
        center: C.Cartesian3.fromDegrees(lng, lat),
        semiMajorAxis: radio, semiMinorAxis: radio, height: altura,
        vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
      }),
    }),
    appearance: new C.MaterialAppearance({ material, translucent: true, flat: true }),
    asynchronous: false,
  }));
}

/* Bocanada de humo: un racimo de bolitas suaves, mas clara arriba (donde le
   da el sol) y mas gris abajo. Con un solo degradado redondo el penacho se
   veia como niebla lisa; asi tiene el volumen apelotonado de una fumarola. */
/* Plano del penacho, 1 x 1 en su marco local; cada cuadro se lo gira para
   que mire a la camara (solo en horizontal) y se lo escala al tamano real. */
let penacho = null;
/* Mas bajo y con la nube de arriba mas abierta (pedido del 2026-11-04): el
   plano ocupa menos pantalla y la tarjeta grafica trabaja menos. */
const PENACHO = { alto: 800, ancho: 1800 };
function crearPenacho(enu, viento) {
  const material = new C.Material({ fabric: { uniforms: { tiempo: 0, intensidad: 0, curva: 0 }, source: FUENTE_PENACHO } });
  materiales.push(material);
  const primitiva = escena.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({
      geometry: new C.PlaneGeometry({ vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat }),
    }),
    appearance: new C.MaterialAppearance({ material, translucent: true, flat: true, faceForward: true, closed: false }),
    asynchronous: false,
    show: false,
  }));
  const vientoLocal = C.Matrix4.multiplyByPointAsVector(C.Matrix4.inverseTransformation(enu, new C.Matrix4()), viento, new C.Cartesian3());
  C.Cartesian3.normalize(vientoLocal, vientoLocal);
  return { primitiva, material, enu, vientoLocal, local: new C.Matrix4(), aCam: new C.Cartesian3() };
}
const inversaEnu = new C.Matrix4();
escena.preRender.addEventListener(() => {
  if (!penacho) return;
  const k = humoActual;
  penacho.primitiva.show = k > 0.01;
  if (!penacho.primitiva.show) return;
  // direccion horizontal hacia la camara, en el marco local del crater
  C.Matrix4.inverseTransformation(penacho.enu, inversaEnu);
  C.Matrix4.multiplyByPoint(inversaEnu, camara.positionWC, penacho.aCam);
  const a = Math.atan2(penacho.aCam.y, penacho.aCam.x);
  const tx = -Math.sin(a), ty = Math.cos(a);   // eje horizontal del plano
  /* El penacho crece con la intensidad: chico y bajo al llegar a la cumbre,
     y alto y ancho cuando se lanza con el giro. Asi sale de a poco en vez de
     aparecer entero de golpe. */
  const W = PENACHO.ancho * (0.3 + 0.7 * k), H = PENACHO.alto * (0.18 + 0.82 * k);
  // columnas: eje x del plano, eje y (vertical) y normal hacia la camara
  C.Matrix4.fromRowMajorArray([
    tx * W, 0, Math.cos(a), 0,
    ty * W, 0, Math.sin(a), 0,
    0, H, 0, H / 2,
    0, 0, 0, 1,
  ], penacho.local);
  C.Matrix4.multiply(penacho.enu, penacho.local, penacho.primitiva.modelMatrix);
  // hacia que lado se dobla en pantalla: el viento proyectado sobre el plano
  const c = penacho.vientoLocal.x * tx + penacho.vientoLocal.y * ty;
  penacho.material.uniforms.curva = (c < 0 ? -1 : 1) * Math.max(0.65, Math.abs(c));
  /* El penacho es un plano vertical: mirado desde muy arriba se veia como
     una lamina plana con un corte recto. Se desvanece cuando la camara pasa
     de unos 35 grados sobre el crater y desaparece a los 60. */
  const elev = Math.atan2(penacho.aCam.z, Math.hypot(penacho.aCam.x, penacho.aCam.y)) * 180 / Math.PI;
  const deLado = 1 - Math.min(1, Math.max(0, (elev - 35) / 25));
  penacho.material.uniforms.intensidad = Math.min(1, k * 2.5) * deLado;
});

function texturaHumo() {
  const l = document.createElement('canvas');
  l.width = l.height = 128;
  const ctx = l.getContext('2d');
  let semilla = 7;
  const azarH = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 14; k++) {
    const ang = azarH() * Math.PI * 2, dist = azarH() * 30;
    const x = 64 + Math.cos(ang) * dist, y = 64 + Math.sin(ang) * dist;
    const r = 22 + azarH() * 20;
    // blanco puro: el volumen lo da la transparencia, no el gris
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return l;
}

function crearLava() {
  primitivasLava.forEach((p) => escena.primitives.remove(p));
  materiales.length = 0;
  const base = alturaDe(LAVA) + 4;
  const enu = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(LAVA.lng, LAVA.lat, base));
  const viento = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(2.6, 2.2, 0), new C.Cartesian3());
  const paso = new C.Cartesian3();
  const boca = C.Cartesian3.fromDegrees(LAVA.lng, LAVA.lat, base);
  /* Con los modelos de Google no se dibuja la laguna: ahi el pozo es una
     imagen sobre una superficie plana, y cualquier disco encima se veia
     pegado, como una bola. Queda solo el penacho de la fumarola. Decidido
     con el usuario el 2026-11-03. */
  // ?sinhumo en la direccion: sin fumarola ni penacho, para medir cuanto pesan
  if (prueba.has('sinhumo')) { penacho = null; primitivasLava = []; return; }
  // en pantallas chicas (celular) no va el penacho: queda solo el humo suave
  penacho = crearPenacho(enu, viento);
  primitivasLava = [
    ...(penacho ? [penacho.primitiva] : []),
    ...(google ? [] : [
      disco(LAVA.lat, LAVA.lng, base + 0.6, LAVA.radio * 1.7, FUENTE_HALO),
      disco(LAVA.lat, LAVA.lng, base, LAVA.radio, FUENTE_LAVA),
    ]),
    /* Con Google no van las bocanadas: el modelo ya trae la bruma real del
       crater, y las bocanadas se veian como una mancha gris encima (marcado
       por el usuario el 2026-11-04). Queda solo el penacho del giro. */
    ...(google ? [] : [escena.primitives.add(new C.ParticleSystem({
      image: texturaHumo(),
      startColor: C.Color.fromCssColorString('rgba(255,255,255,0.4)'),
      endColor: C.Color.fromCssColorString('rgba(255,255,255,0)'),
      startScale: 0.6, endScale: 7,
      minimumParticleLife: 14, maximumParticleLife: 22,
      minimumSpeed: 3.5, maximumSpeed: 7,
      imageSize: new C.Cartesian2(26, 26), sizeInMeters: true,
      emissionRate: 3.2,
      emitter: new C.CircleEmitter(LAVA.radio * 0.6),
      modelMatrix: enu,
      updateCallback: (p, dt) => {
        /* el viento empuja mas mientras mas alto esta el humo: la columna sale
           recta del crater y arriba se dobla en una nube que se va de lado */
        const alto = C.Cartesian3.distance(p.position, boca);
        C.Cartesian3.multiplyByScalar(viento, dt * (1 + humoActual * (1 + alto / 120)), paso);
        C.Cartesian3.add(p.position, paso, p.position);
      },
    }))]),
  ];
  aplicarHumo(humoActual);  // si se rehace a mitad del giro, conserva la intensidad
  mostrarHumo(humoVisible);
}
escena.preRender.addEventListener(() => {
  const t = performance.now() / 1000;
  for (const m of materiales) m.uniforms.tiempo = t;
});

/* Intensidad de la fumarola, de 0 (el penacho tranquilo de siempre) a 1
   (a pleno). En la presentacion sube mientras la camara se aleja girando
   desde la cumbre y vuelve a 0 al regresar a la Cafeteria. */
/* A pleno sale mas humo, mas rapido y el viento lo estira en penacho; cada
   bocanada es poco opaca. Con mas opacidad las bocanadas se juntaban en una
   bola blanca vista desde lejos. */
/* A pleno el penacho es unas cinco veces el normal (pedido del usuario el
   2026-11-03): sube hasta cerca de un kilometro y se abre mucho mas. */
// mas opaco y mas chico: transparente sobre la roca oscura del crater se veia gris
const HUMO_NORMAL = { tasa: 3.2, alfa: 0.4, escala: 5, vel: 3.5, vida: 14 };
// a pleno el volumen lo pone el penacho; las particulas solo agregan jirones
// cerca de la boca, y asi pesan poco
const HUMO_PLENO = { tasa: 4, alfa: 0.1, escala: 10, vel: 8, vida: 16 };
let humoActual = 0, humoAnim = 0;
/* La fumarola solo existe en la cumbre: aparece al llegar al crater, sube a
   pleno durante el giro y se apaga al volver a la Cafeteria. En las demas
   paradas no se ve (pedido del usuario el 2026-11-04). */
let humoVisible = false;
function mostrarHumo(ver) {
  humoVisible = ver;
  const humo = primitivasLava.at(-1);
  if (humo instanceof C.ParticleSystem) humo.show = ver;
  if (!ver) { cancelAnimationFrame(humoAnim); aplicarHumo(0); }
}
function aplicarHumo(k) {
  humoActual = k;
  const humo = primitivasLava.at(-1);
  if (!(humo instanceof C.ParticleSystem)) return;
  humo.emissionRate = mezcla(HUMO_NORMAL.tasa, HUMO_PLENO.tasa, k);
  humo.startColor = C.Color.fromCssColorString('rgb(255,255,255)').withAlpha(mezcla(HUMO_NORMAL.alfa, HUMO_PLENO.alfa, k));
  humo.endColor = C.Color.fromCssColorString('rgb(255,255,255)').withAlpha(0);
  humo.endScale = mezcla(HUMO_NORMAL.escala, HUMO_PLENO.escala, k);
  const vel = mezcla(HUMO_NORMAL.vel, HUMO_PLENO.vel, k);
  humo.minimumSpeed = vel;
  humo.maximumSpeed = vel * 2;
  const vida = mezcla(HUMO_NORMAL.vida, HUMO_PLENO.vida, k);
  humo.minimumParticleLife = vida;
  humo.maximumParticleLife = vida * 1.55;
}
function fumarola(meta, ms) {
  cancelAnimationFrame(humoAnim);
  const desde = humoActual;
  if (desde === meta) return;
  if (lento < 1 || !ms) { aplicarHumo(meta); return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    aplicarHumo(mezcla(desde, meta, seno(k)));
    if (k < 1) humoAnim = requestAnimationFrame(paso);
  };
  humoAnim = requestAnimationFrame(paso);
}

/* ---------- camara ---------- */

const CAMARA_CAFETERIA = 1643, CORRER_INICIO = 0.8;
const deGE = (c) => ({ lat: c.lat, lng: c.lng, alt: c.alt, h: c.heading, t: c.tilt, r: c.range });

function rumbo(a, b) {
  const f1 = rad(a.lat), f2 = rad(b.lat), dl = rad(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

/* Hasta La Capilla se usan los encuadres guardados en Google Earth. Desde la
   Pinguinera la camara va como un dron que sigue a la cordada: detras y por
   encima del punto, mirando hacia el siguiente. Los encuadres del KML de esos
   tramos se alejaban y volvian (El Tubo a 2,3 km), y eso era lo que se veia mal. */
const DRON_DESDE = 3;
/* En pantalla vertical los encuadres de Google Earth dejan la cumbre fuera por
   la derecha: el centro de la toma se corre hacia el crater. */
const CORRIMIENTO_VERTICAL = 0.3;
const enVertical = (v) => {
  if (encuadre() === 1) return v;
  const k = CORRIMIENTO_VERTICAL;
  return { ...v, lat: mezcla(v.lat, LAVA.lat, k), lng: mezcla(v.lng, LAVA.lng, k), alt: mezcla(v.alt, LAVA.suelo ?? 2800, k) };
};
function vistaDe(i) {
  const p = PARADAS[i];
  // Cafeteria: centro corrido hacia ella para que no quede fuera de cuadro, y la
  // distancia se calcula para que la camara quede a CAMARA_CAFETERIA metros de
  // altura (la cifra "Camara" de abajo), sea cual sea la pantalla
  if (i === 0) {
    const correr = CORRER_INICIO;  // con el centro casi sobre la Cafeteria, a 1643 m queda delante de la camara
    const v = deGE(p.camara);
    // En vertical (celular) la Cafeteria se muestra de lejos, con el volcan entero y el
    // centro de esqui abajo. La cuenta de los 1643 m no sirve ahi: con el centro corrido
    // hacia el crater daba una distancia negativa y la toma quedaba pegada a la ladera.
    if (encuadre() !== 1) {
      const k = 0.42;
      return { lat: mezcla(p.lat, LAVA.lat, k), lng: mezcla(p.lng, LAVA.lng, k), alt: mezcla(p.alt, LAVA.suelo ?? 2850, k), h: v.h, t: 68, r: 3000 };
    }
    const w = enVertical({ ...v, lat: mezcla(v.lat, p.lat, correr), lng: mezcla(v.lng, p.lng, correr), alt: mezcla(v.alt, p.alt, correr) });
    const centro = w.alt * exag() + desfase;
    // la cifra 1643 vale para el relieve de Google; con el de respaldo se usa la
    // misma altura sobre la Cafeteria (200 m: 1643 - 1443), porque su altura base es otra
    const objetivo = google ? CAMARA_CAFETERIA : p.alt * exag() + desfase + (CAMARA_CAFETERIA - p.alt);
    return { ...w, r: Math.max(300, (objetivo - centro) / (Math.cos(rad(w.t)) * encuadre())) };
  }
  if (i < DRON_DESDE) return deGE(p.camara);
  return { lat: p.lat, lng: p.lng, alt: p.suelo ?? p.alt, h: rumbo(p, PARADAS[i + 1] ?? p), t: 71, r: 480 };
}
/* Tomas de la cumbre, todas sobre la linea Colada -> crater y con ese mismo
   rumbo, para que la camara avance de frente. La aproximacion de Google Earth
   estaba centrada unos 350 m al este de esa linea y con otro rumbo, y la
   camara se iba hacia el lado antes de llegar. De Google Earth se conservan
   la inclinacion y la distancia de cada toma. */
const COLADA = 6;
const rumboCrater = () => rumbo(PARADAS[COLADA], LAVA);
const tomaAproximacion = () => {
  const c = PARADAS[COLADA], k = 0.55;
  return {
    lat: mezcla(c.lat, LAVA.lat, k), lng: mezcla(c.lng, LAVA.lng, k),
    alt: mezcla(c.suelo ?? c.alt, LAVA.suelo ?? 2800, k),
    h: rumboCrater(), t: TOMAS_CUMBRE.aproximacion.tilt, r: 950,
  };
};
const tomaCrater = () => ({ lat: LAVA.lat, lng: LAVA.lng, alt: LAVA.suelo ?? 2800, h: rumboCrater(), t: TOMAS_CUMBRE.crater.tilt, r: TOMAS_CUMBRE.crater.range });
const tomaCenital = () => ({ ...tomaCrater(), t: 0.4, r: 320 });
const GENERAL = { lat: -39.4065, lng: -71.9466, alt: 1900, h: 138, t: 58, r: 6200 };

const estado = { i: -1, vista: null, anim: null, tocando: false, pausado: false };
let cargado = false;

function aplicar(v) {
  const centro = C.Cartesian3.fromDegrees(v.lng, v.lat, v.alt * exag() + desfase);
  camara.lookAt(centro, new C.HeadingPitchRange(rad(v.h), rad(v.t - 90), v.r * encuadre()));
  camara.lookAtTransform(C.Matrix4.IDENTITY);
  // si el relieve gratuito queda mas alto que la camara, se la sube
  const pos = camara.positionCartographic;
  const real = sueloEn(grad(pos.latitude), grad(pos.longitude));
  const suelo = real === undefined ? undefined : real * exag() + desfase;
  if (suelo !== undefined && pos.height < suelo + 35) {
    camara.setView({
      destination: C.Cartesian3.fromRadians(pos.longitude, pos.latitude, suelo + 35),
      orientation: { heading: camara.heading, pitch: camara.pitch, roll: 0 },
    });
  }
  estado.vista = v;
}

function vistaDesdeCamara() {
  const lienzo = escena.canvas;
  const centro = new C.Cartesian2(lienzo.clientWidth / 2, lienzo.clientHeight / 2);
  let punto = escena.pickPositionSupported ? escena.pickPosition(centro) : undefined;
  if (!punto) { const rayo = camara.getPickRay(centro); punto = rayo && globo.pick(rayo, escena); }
  if (!punto) return null;
  const c = C.Cartographic.fromCartesian(punto);
  return {
    lat: grad(c.latitude), lng: grad(c.longitude), alt: (c.height - desfase) / exag(),
    h: grad(camara.heading), t: 90 + grad(camara.pitch), r: C.Cartesian3.distance(camara.positionWC, punto) / encuadre(),
  };
}

function cancelar() {
  estado.pausado = false;  // cancelar o partir otra toma saca de la pausa
  if (estado.anim) { estado.anim.vivo = false; estado.anim = null; }
  camara.cancelFlight();
}

const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const mezcla = (a, b, k) => a + (b - a) * k;

function animar(ms, cuadro, alTerminar) {
  cancelar();
  const anim = { vivo: true };
  estado.anim = anim;
  let t0 = performance.now();
  let previo = t0;
  const paso = (ahora) => {
    if (!anim.vivo) return;
    // en pausa el reloj de la toma no corre: al seguir, retoma donde quedo
    if (estado.pausado) { t0 += ahora - previo; previo = ahora; requestAnimationFrame(paso); return; }
    previo = ahora;
    const k = Math.min(1, (ahora - t0) / ms);
    cuadro(k);
    if (k < 1) requestAnimationFrame(paso);
    else { estado.anim = null; alTerminar?.(); }
  };
  requestAnimationFrame(paso);
}

/* Vuelo de dron: se eleva un poco a mitad de camino y mira mas hacia abajo,
   como cuando se pasa por encima de una loma. Con `dron` el salto es menor y
   la aceleracion mas pareja, como un dron siguiendo el sendero. */
const seno = (k) => (1 - Math.cos(Math.PI * k)) / 2;
function volar(desde, hasta, alTerminar, msFijo, { dron = false, directo = false } = {}) {
  const dist = metros(desde, hasta);
  const ms = (msFijo ?? (dron ? 2400 + dist * 3.2 : Math.min(5500, Math.max(2000, 1600 + dist * 1.6)))) * lento;
  // giro mas corto entre los dos rumbos. El % de JavaScript conserva el signo:
  // con rumbos acumulados sobre 360 (despues de dar vueltas) daba -360 y la
  // camara se daba una vuelta entera de mas al volver a la Cafeteria.
  const giro = ((((hasta.h - desde.h) % 360) + 540) % 360) - 180;
  // directo: sin el arco que aleja la camara a mitad de camino; avanza de frente
  const salto = directo ? 0 : dron ? Math.min(0.14, dist / 3000) : Math.min(0.45, dist / 1600);
  const curva = dron || directo ? seno : suave;
  animar(ms, (k) => {
    const e = curva(k), arco = Math.sin(Math.PI * e);
    aplicar({
      lat: mezcla(desde.lat, hasta.lat, e), lng: mezcla(desde.lng, hasta.lng, e), alt: mezcla(desde.alt, hasta.alt, e),
      h: desde.h + giro * e,
      t: mezcla(desde.t, hasta.t, e) - 12 * salto * arco,
      r: mezcla(desde.r, hasta.r, e) * (1 + salto * arco),
    });
  }, alTerminar);
}

/* Desde lejos (el globo entero) se usa el vuelo propio de Cesium. */
function volarLejos(hasta, alTerminar, segundos = 5.5) {
  cancelar();
  estado.vista = null;
  camara.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(hasta.lng, hasta.lat, hasta.alt * exag() + desfase), 1), {
    offset: new C.HeadingPitchRange(rad(hasta.h), rad(hasta.t - 90), hasta.r * encuadre()),
    duration: segundos * lento,
    complete: () => { aplicar(hasta); alTerminar?.(); },
  });
}

function irAVista(hasta, alTerminar) {
  const desde = estado.vista || vistaDesdeCamara();
  if (!desde || desde.r > 30000) volarLejos(hasta, alTerminar);
  else volar(desde, hasta, alTerminar);
}

/* En las paradas de dron no se gira: el dron sigue avanzando despacio, se
   acerca y baja un poco la mirada, y desde ahi arranca el tramo siguiente. */
function avanzar(ms, alTerminar) {
  const base = estado.vista;
  if (!base) { alTerminar?.(); return; }
  animar(ms * lento, (k) => {
    const e = seno(k);
    aplicar({ ...base, r: base.r * (1 - 0.18 * e), t: base.t + 3 * e });
  }, alTerminar);
}

/* Llegada a la cumbre, con las dos vistas marcadas en Google Earth: primero
   el cono con el crater arriba, despues el crater con la lava, y al final el
   dron se pone encima del pozo mirando hacia abajo y gira despacio. */
function llegarCumbre(alTerminar, conVuelta) {
  seleccionar(PARADAS.length - 1);
  const pasos = [
    [tomaAproximacion(), 4800],
    [tomaCrater(), 3600],
    [tomaCenital(), 4200],
  ];
  const siguiente = (n) => {
    if (n === pasos.length) {
      // sin giro: muestra el crater un momento y sigue de inmediato
      if (conVuelta) avanzar(2000, alTerminar); else alTerminar?.();
      return;
    }
    // desde la toma del crater, solo el crater y su fumarola, que empieza a salir de a poco
    if (n === 1) { mostrarPuntos(false); mostrarHumo(true); fumarola(0.22, 7000); }
    const [hasta, ms] = pasos[n];
    const desde = estado.vista || vistaDesdeCamara();
    if (!desde || desde.r > 30000) volarLejos(hasta, () => siguiente(n + 1));
    else volar(desde, hasta, () => siguiente(n + 1), ms, { dron: true });
  };
  siguiente(0);
}

/* Sobrevuelo en torno al punto mientras la presentacion se detiene en el. */
function orbitar(gradosPorSeg, ms, alTerminar) {
  const base = estado.vista;
  if (!base) { alTerminar?.(); return; }
  animar(ms * lento, (k) => aplicar({ ...base, h: base.h + gradosPorSeg * (ms / 1000) * k }), alTerminar);
}

/* ---------- presentacion ---------- */

function irA(i, alTerminar, { puntos = true, conHumo = false } = {}) {
  enMarcha = true;
  // si los controles ya estan escondidos, llegar a otra parada no los devuelve
  if (!document.body.classList.contains('inmersivo')) esperarInmersivo();
  partir();
  if (i === PARADAS.length - 1) { llegarCumbre(alTerminar, false); return; }
  if (!conHumo) mostrarHumo(false);
  if (cargado && puntos) mostrarPuntos(true);
  seleccionar(i);
  const hasta = vistaDe(i);
  const desde = estado.vista || vistaDesdeCamara();
  if (!desde || desde.r > 30000) volarLejos(hasta, alTerminar);
  else volar(desde, hasta, alTerminar, i === 0 ? 2800 : undefined, { dron: i >= DRON_DESDE, directo: i === 0 });
}

/* Despues de la vuelta sobre la lava, la camara se aleja girando otra vuelta
   completa hasta dejar el volcan entero en cuadro. */
const VOLCAN_ENTERO = { lat: -39.4170, lng: -71.9420, alt: 2350, t: 58, r: 3000 };
function alejarGirando(ms, alTerminar) {
  const desde = estado.vista;
  if (!desde) { alTerminar?.(); return; }
  animar(ms * lento, (k) => {
    const e = seno(k);
    // el giro arranca recien cuando la camara dejo de mirar hacia abajo: un
    // giro mirando el crater desde arriba se siente como dar vueltas en el lugar
    const g = seno(Math.min(1, Math.max(0, (k - 0.25) / 0.75)));
    aplicar({
      lat: mezcla(desde.lat, VOLCAN_ENTERO.lat, e), lng: mezcla(desde.lng, VOLCAN_ENTERO.lng, e),
      alt: mezcla(desde.alt, VOLCAN_ENTERO.alt, e),
      h: desde.h + 360 * g,
      t: mezcla(desde.t, VOLCAN_ENTERO.t, e),
      r: mezcla(desde.r, VOLCAN_ENTERO.r, e),
    });
  }, alTerminar);
}

/* Cierre de la presentacion: lava con vuelta de 360, alejarse girando otra
   vuelta, y volver a la Cafeteria, donde queda en pausa. */
function cierre() {
  llegarCumbre(() => {
    if (!estado.tocando) return;
    fumarola(1, 9000);  // con el giro la fumarola se lanza a pleno
    alejarGirando(26000, () => {
      if (!estado.tocando) return;
      fumarola(0, 5000);  // y se calma camino a la Cafeteria
      // vuelve a la Cafeteria sin puntos; aparecen recien cuando se detiene ahi
      irA(0, () => { mostrarHumo(false); mostrarPuntos(true); pausar(); }, { puntos: false, conHumo: true });
    });
  }, true);
}

function ciclo(i) {
  if (!estado.tocando) return;
  const ultima = i === PARADAS.length - 1;
  if (ultima) { cierre(); return; }
  irA(i, () => {
    if (!estado.tocando) return;
    const seguir = () => { if (estado.tocando) ciclo(i + 1); };
    // en cada parada la camara avanza despacio; antes giraba 15 grados en las
    // tres primeras y se veia como un corrimiento hacia la izquierda
    avanzar(2200, seguir);
  });
}

/* La camara ya esta en esa toma (misma posicion, distancia y angulos)? */
function yaEn(v, w) {
  if (!v || !w) return false;
  const giro = Math.abs(((((w.h - v.h) % 360) + 540) % 360) - 180);
  return metros(v, w) < 25 && Math.abs(v.r - w.r) < w.r * 0.05 && giro < 3 && Math.abs(v.t - w.t) < 3;
}

function presentar(desde) {
  estado.tocando = true;
  document.body.classList.toggle('sin-panel', true);
  panel.classList.add('oculto');
  btnPanel.setAttribute('aria-pressed', 'false');
  pintarPresentacion();
  esperarInmersivo();
  const i = desde ?? (estado.i < 0 || estado.i >= PARADAS.length - 1 ? 0 : estado.i);
  // Si la camara ya esta en esa parada (al inicio, o despues de elegir una a mano),
  // Play sale de inmediato hacia la siguiente: antes volaba 2 a 3 s al mismo lugar
  // y esperaba otros 2 s, y parecia que no habia pasado nada.
  if (i < PARADAS.length - 1 && yaEn(estado.vista, vistaDe(i))) {
    if (estado.i !== i) seleccionar(i);
    ciclo(i + 1);
    return;
  }
  ciclo(i);
}

/* Desde que el recorrido parte (Play, 360 o una parada elegida a mano), a los
   2,5 s sin tocar nada se esconden los controles y la X del visor del inicio
   (por mensaje). La barra de paradas no se esconde nunca. Cualquier toque o
   tecla los devuelve y vuelve a contar. */
let reloj = 0;
let enMarcha = false;
function inmersivo(on) {
  document.body.classList.toggle('inmersivo', on);
  if (parent !== window) parent.postMessage({ tipo: 'recorrido-inmersivo', on }, location.origin);
}
function esperarInmersivo() {
  clearTimeout(reloj);
  inmersivo(false);
  if (enMarcha && !estado.pausado) reloj = setTimeout(() => inmersivo(true), 2500);
}
['pointerdown', 'keydown', 'wheel'].forEach((t) => addEventListener(t, esperarInmersivo, { passive: true }));
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') esperarInmersivo(); }, { passive: true });

/* Play y Pausa del recorrido: la pausa congela la toma en curso y Play la
   retoma en el mismo punto, sin volver a la primera parada. */
function alternarPausa() {
  if (!estado.tocando) { presentar(); return; }
  estado.pausado = !estado.pausado;
  esperarInmersivo();
  pintarPresentacion();
}
function pausar() {
  estado.tocando = false;
  estado.pausado = false;
  esperarInmersivo();
  $('btn-360').setAttribute('aria-pressed', 'false');
  fumarola(0, 2500);
  pintarPresentacion();
}

/* ---------- interfaz ---------- */

const $ = (id) => document.getElementById(id);
const panel = $('panel'), btnPanel = $('btn-panel'), lista = $('lista');
const pres = $('presentacion');

function pintarLista() {
  const filtro = $('buscar').value.trim().toLowerCase();
  lista.innerHTML = '';
  PARADAS.forEach((p, i) => {
    if (filtro && !p.nombre.toLowerCase().includes(filtro)) return;
    const li = document.createElement('li');
    li.className = 'lugar' + (i === estado.i ? ' activo' : '');
    const previa = PARADAS[i - 1];
    let detalle = `Parada <b>${i + 1} de ${PARADAS.length}</b><br>${dms(p.lat, 'N', 'S')} &nbsp;${dms(p.lng, 'E', 'O')}`;
    if (previa) {
      const desnivel = p.alt != null && previa.alt != null ? p.alt - previa.alt : null;
      detalle += `<br>Desde ${previa.nombre}: <b>${fmt.format(metros(previa, p))} m</b> en linea recta`;
      if (desnivel != null) detalle += `, <b>${desnivel >= 0 ? '+' : ''}${fmt.format(desnivel)} m</b> de desnivel`;
    }
    if (p.altDelRelieve) detalle += '<br>Cota tomada del relieve, el KML no la trae.';
    li.innerHTML = `
      <img class="lugar__pin" src="${PIN}" alt="">
      <span class="lugar__nombre">${p.nombre}</span>
      <span class="lugar__cota">${p.alt != null ? (p.altDelRelieve ? '≈ ' : '') + fmt.format(p.alt) + ' m' : ''}</span>
      <span class="lugar__detalle">${detalle}</span>`;
    li.addEventListener('click', () => { pausar(); irA(i); });
    lista.appendChild(li);
  });
  const total = PARADAS.reduce((s, p, i) => (i ? s + metros(PARADAS[i - 1], p) : 0), 0);
  $('resumen').textContent = `${PARADAS.length} lugares · ${fmt.format(PARADAS[0].alt)} a ${fmt.format(PARADAS.at(-1).alt)} m · ${(total / 1000).toFixed(1).replace('.', ',')} km entre paradas`;
}

/* ---------- altimetro ----------
   Riel vertical a la derecha con las paradas a distancia pareja. El tramo de
   color sube hasta la parada activa. La ficha con la altura y la descripcion
   aparece recien cuando parte el recorrido; antes, el punto de la Cafeteria
   parpadea para invitar a partir. */
const alti = {
  caja: $('altimetro'), lista: $('alt-lista'), tramo: $('alt-tramo'), cursor: $('alt-cursor'),
  ficha: $('alt-ficha'), fichaIn: $('alt-ficha-in'), cifra: $('alt-cifra'),
  btns: [], i: null, valor: 0, anim: 0, partio: false,
};
const cotaDe = (i) => {
  const p = PARADAS[i];
  if (p.alt != null) return p.alt;
  const a = PARADAS[i - 1]?.alt ?? PARADAS[0].alt, b = PARADAS[i + 1]?.alt ?? a;
  return (a + b) / 2;
};
const fraccion = (i) => i / (PARADAS.length - 1);


function armarAltimetro() {
  const alto = alti.lista.clientHeight;
  if (!alto) return;
  alti.lista.innerHTML = '';
  alti.btns = PARADAS.map((p, i) => {
    const li = document.createElement('li');
    li.className = 'altimetro__hito';
    li.style.transform = `translateY(${(1 - fraccion(i)) * alto}px)`;
    const b = document.createElement('button');
    b.className = 'altimetro__btn';
    const nombre = document.createElement('span');
    nombre.textContent = p.nombre;
    b.appendChild(nombre);
    b.addEventListener('click', () => { pausar(); irA(i); });
    li.appendChild(b);
    alti.lista.appendChild(li);
    return b;
  });
  const i = alti.i;
  alti.i = null;
  if (i != null) marcarAltimetro(i);
}

function contarHasta(meta) {
  cancelAnimationFrame(alti.anim);
  const desde = alti.valor, t0 = performance.now(), ms = lento < 1 ? 0 : 1100;
  const paso = (t) => {
    const k = ms ? Math.min(1, (t - t0) / ms) : 1;
    alti.valor = Math.round(desde + (meta - desde) * (1 - (1 - k) ** 3));
    alti.cifra.textContent = fmt.format(alti.valor);
    if (k < 1) alti.anim = requestAnimationFrame(paso);
  };
  alti.anim = requestAnimationFrame(paso);
}

function marcarAltimetro(i) {
  // la barra de paradas siempre se ve; sin parada elegida no hay cursor y la
  // Cafeteria parpadea en blanco invitando a empezar
  alti.caja.hidden = false;
  alti.caja.inert = false;
  alti.caja.classList.toggle('invita', i < 0);
  alti.ficha.hidden = i < 0 || !alti.partio;
  if (i < 0 || i === alti.i || !alti.btns.length) return;
  const primera = alti.i == null;
  alti.i = i;
  const p = PARADAS[i], alto = alti.lista.clientHeight, f = fraccion(i);
  alti.btns.forEach((b, j) => {
    if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.parentElement.classList.toggle('pasado', j <= i);
  });
  alti.tramo.style.transform = `scaleY(${f})`;
  alti.cursor.style.transform = `translateY(${(1 - f) * alto}px)`;
  const rellenar = () => {
    $('alt-nombre').textContent = p.nombre;
    $('alt-paso').textContent = `${p.altDelRelieve ? '≈ ' : ''}${i + 1} de ${PARADAS.length}`;
    let texto = p.texto;
    if (!texto) {
      const previa = PARADAS[i - 1];
      texto = `A ${fmt.format(metros(previa, p))} m de ${previa.nombre} en línea recta, ${fmt.format(Math.round(cotaDe(i) - cotaDe(i - 1)))} m más arriba.`;
    }
    $('alt-texto').textContent = texto;
    alti.fichaIn.classList.remove('cambiando');
  };
  contarHasta(Math.round(cotaDe(i)));
  if (primera || lento < 1) { rellenar(); return; }
  alti.fichaIn.classList.add('cambiando');
  setTimeout(rellenar, 250);
}
function partir() {
  if (alti.partio) return;
  alti.partio = true;
  alti.caja.classList.remove('esperando');
}
alti.caja.classList.add('esperando');
armarAltimetro();
window.addEventListener('resize', armarAltimetro);

function pintarPresentacion() {
  marcarAltimetro(estado.i);
  const corriendo = estado.tocando && !estado.pausado;
  $('btn-presentar-modo').setAttribute('aria-pressed', String(corriendo));
  $('modo-estado').textContent = corriendo ? 'Pausa' : 'Play';
  if (estado.i < 0) { pres.hidden = true; return; }
  pres.hidden = false;
  const p = PARADAS[estado.i];
  $('pres-n').textContent = `${estado.i + 1} de ${PARADAS.length}`;
  $('pres-nombre').textContent = p.nombre;
  $('pres-avance').style.width = `${((estado.i + 1) / PARADAS.length) * 100}%`;
  $('btn-anterior').disabled = estado.i === 0;
  $('btn-siguiente').disabled = estado.i === PARADAS.length - 1;
  $('ico-play').innerHTML = estado.tocando ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  $('btn-play').title = estado.tocando ? 'Pausar' : 'Reproducir';
}

function seleccionar(i) {
  ampliarAlcance(i);
  if (estado.i >= 0) marcas[estado.i].billboard.scale = ESCALA_PIN;
  estado.i = i;
  marcas[i].billboard.scale = ESCALA_PIN_ACTIVO;
  pintarLista();
  pintarPresentacion();
  lista.querySelector('.activo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function mostrarPanel(ver) {
  panel.classList.toggle('oculto', !ver);
  document.body.classList.toggle('sin-panel', !ver);
  btnPanel.setAttribute('aria-pressed', String(ver));
}

btnPanel.addEventListener('click', () => mostrarPanel(panel.classList.contains('oculto')));
$('buscar').addEventListener('input', pintarLista);
$('btn-presentar').addEventListener('click', () => presentar(0));
$('btn-general').addEventListener('click', () => { pausar(); irAVista(GENERAL); });
$('chk-linea').addEventListener('change', (e) => { linea.show = e.target.checked && marcas[0].show; });
$('btn-play').addEventListener('click', () => (estado.tocando ? (pausar(), cancelar()) : presentar()));
$('btn-anterior').addEventListener('click', () => {
  if (estado.i <= 0) return;
  if (estado.tocando) ciclo(estado.i - 1); else irA(estado.i - 1);
});
$('btn-siguiente').addEventListener('click', () => {
  if (estado.i >= PARADAS.length - 1) return;
  if (estado.tocando) ciclo(estado.i + 1); else irA(estado.i + 1);
});
$('btn-cerrar').addEventListener('click', () => {
  pausar(); cancelar();
  marcas[estado.i].billboard.scale = ESCALA_PIN;
  estado.i = -1;
  pintarLista(); pintarPresentacion(); mostrarPanel(true);
});
/* Pantalla completa. En Android, al entrar se fija la pantalla en horizontal;
   el iPhone no permite pantalla completa para paginas, y ahi el boton no aparece. */
const embebido = parent !== window;
const pantallaCompleta = () => {
  // dentro del visor del inicio la pantalla completa la maneja esa pagina, que conserva la X para cerrar
  if (embebido) { parent.postMessage({ tipo: 'recorrido-pantalla' }, location.origin); return; }
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
};
$('btn-pantalla').addEventListener('click', pantallaCompleta);
if (document.fullscreenEnabled) {
  const btn = $('btn-pantalla-movil');
  btn.hidden = false;
  btn.addEventListener('click', pantallaCompleta);
  document.addEventListener('fullscreenchange', () => { if (!embebido) btn.setAttribute('aria-pressed', String(!!document.fullscreenElement)); });
  addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data?.tipo === 'recorrido-pantalla-estado') btn.setAttribute('aria-pressed', String(!!e.data.on));
  });
  if (embebido) parent.postMessage({ tipo: 'recorrido-pantalla-consulta' }, location.origin);
}

/* mando: Play y engranaje con opciones */
const opciones = $('opciones'), btnOpciones = $('btn-opciones');
function abrirOpciones(abrir) {
  opciones.classList.toggle('abierta', abrir);
  btnOpciones.setAttribute('aria-expanded', String(abrir));
}
btnOpciones.addEventListener('click', () => abrirOpciones(!opciones.classList.contains('abierta')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirOpciones(false); });
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#mando')) abrirOpciones(false); });
$('btn-presentar-modo').addEventListener('click', alternarPausa);
$('opc-linea').addEventListener('change', (e) => {
  $('chk-linea').checked = e.target.checked;
  $('chk-linea').dispatchEvent(new Event('change'));
});
$('chk-linea').addEventListener('change', (e) => { $('opc-linea').checked = e.target.checked; });

/* Vuelta 360: lleva la camara al volcan entero y lo rodea una vez, con
   arranque y frenada suaves. */
/* Vuelta 360: vuela al volcan entero, la fumarola sale de a poco y se lanza
   a pleno mientras la camara da la vuelta completa; al terminar se calma y
   la camara vuelve a la Cafeteria. */
function vuelta360() {
  pausar(); cancelar();
  enMarcha = true;
  esperarInmersivo();
  const btn = $('btn-360');
  btn.setAttribute('aria-pressed', 'true');
  const fin = () => btn.setAttribute('aria-pressed', 'false');
  const desde = estado.vista || vistaDesdeCamara();
  const base = { ...VOLCAN_ENTERO, h: desde?.h ?? GENERAL.h };
  mostrarPuntos(false);  // la vuelta muestra el volcan limpio; los puntos vuelven en la Cafeteria
  mostrarHumo(true);
  fumarola(0.22, 3000);
  const girar = () => {
    fumarola(1, 9000);
    animar(30000 * lento, (k) => aplicar({ ...base, h: base.h + 360 * seno(k) }), () => {
      fumarola(0, 5000);
      irA(0, () => { mostrarHumo(false); fin(); }, { conHumo: true });
    });
  };
  if (!desde || desde.r > 30000) volarLejos(base, girar);
  else volar(desde, base, girar);
}
$('btn-360').addEventListener('click', () => { abrirOpciones(false); vuelta360(); });
$('opc-general').addEventListener('click', () => { abrirOpciones(false); $('btn-general').click(); });
$('opc-pantalla').addEventListener('click', () => { abrirOpciones(false); $('btn-pantalla').click(); });

/* capas */
const imagenActual = IMAGEN_INICIAL;
$('opc-relieve').addEventListener('click', (e) => {
  const v = e.target.closest('[data-relieve]')?.dataset.relieve;
  if (!v) return;
  const vista = estado.vista || vistaDesdeCamara();
  escena.verticalExaggeration = Number(v);
  ubicarMarcas();
  crearLava();
  if (vista) aplicar(vista);
  $('opc-relieve').querySelectorAll('.opcion').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.relieve === v)));
});
$('chk-sombra').addEventListener('change', (e) => { sombra.show = e.target.checked; });
$('chk-nevado').addEventListener('change', (e) => { nevada.show = e.target.checked; });

function pintarCreditos() {
  /* CesiumJS no se nombra en pantalla: su licencia (Apache 2.0) no lo exige
     y no se usa Cesium ion, que si pide su logo. Esri y el relieve si se
     atribuyen, porque sus condiciones lo piden. */
  $('credito').textContent = `${IMAGENES[imagenActual].credito} · Relieve: AWS Terrain Tiles`;
  $('fuentes').innerHTML = `${IMAGENES[imagenActual].credito}.<br>Relieve: AWS Terrain Tiles (SRTM, GMTED y otras fuentes publicas).<br>Paradas y encuadres: proyecto de Google Earth del recorrido.`;
}

/* zoom */
const zoom = (f) => {
  pausar();
  const v = estado.vista || vistaDesdeCamara();
  if (v) volar(v, { ...v, r: Math.min(ALEJAMIENTO_MAXIMO, Math.max(80, v.r * f)) }, null, 500);
  else if (f < 1) camara.zoomIn(camara.positionCartographic.height * 0.4); else camara.zoomOut(camara.positionCartographic.height * 0.6);
};
$('btn-acercar').addEventListener('click', () => zoom(0.6));
$('btn-alejar').addEventListener('click', () => zoom(1 / 0.6));

/* Si la persona toma el control con el raton, la camara es suya. */
const lienzo = escena.canvas;
/* Un toque quieto no le quita el recorrido a nadie: eso es Play o Pausa (mas
   abajo, en LEFT_CLICK). La camara pasa a ser de la persona recien cuando
   arrastra, pellizca con dos dedos o usa la rueda. */
const tomarControl = () => {
  if (estado.anim || estado.tocando) { pausar(); cancelar(); }
  estado.vista = null;
};
let abajo = null;
lienzo.addEventListener('pointerdown', (e) => {
  abrirOpciones(false);
  if (abajo) { abajo = 'varios'; tomarControl(); return; }
  abajo = { x: e.clientX, y: e.clientY };
}, { passive: true });
lienzo.addEventListener('pointermove', (e) => {
  if (!abajo || abajo === 'varios') return;
  if (Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 8) { abajo = 'varios'; tomarControl(); }
}, { passive: true });
['pointerup', 'pointercancel'].forEach((ev) => addEventListener(ev, () => { abajo = null; }, { passive: true }));
lienzo.addEventListener('wheel', () => { abrirOpciones(false); tomarControl(); }, { passive: true });

const manejador = new C.ScreenSpaceEventHandler(lienzo);
let raton = null;
let ultimoPaso = 0;
manejador.setInputAction((m) => {
  raton = C.Cartesian2.clone(m.endPosition);
  // ver si el mouse esta sobre un punto cuesta un dibujo extra: como mucho cada 100 ms
  const ahora = performance.now();
  if (ahora - ultimoPaso < 100) return;
  ultimoPaso = ahora;
  const elegido = escena.pick(m.endPosition);
  lienzo.style.cursor = elegido?.id?.id?.startsWith?.('parada-') ? 'pointer' : '';
}, C.ScreenSpaceEventType.MOUSE_MOVE);
manejador.setInputAction((c) => {
  const elegido = escena.pick(c.position);
  const id = elegido?.id?.id;
  if (typeof id === 'string' && id.startsWith('parada-')) { irA(Number(id.slice(7))); return; }
  // Un toque (o un clic) en cualquier parte del mapa hace de Play y Pausa, como
  // en un video. Arrastrar o pellizcar no cuenta: eso mueve la camara.
  alternarPausa(); destellar();
}, C.ScreenSpaceEventType.LEFT_CLICK);
/* Senal breve al centro: muestra si el toque dejo el recorrido andando o en pausa */
function destellar() {
  const d = $('destello');
  d.dataset.estado = estado.tocando && !estado.pausado ? 'play' : 'pausa';
  d.classList.remove('visible');
  void d.offsetWidth;
  d.classList.add('visible');
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') $('btn-siguiente').click();
  else if (e.key === 'ArrowLeft') $('btn-anterior').click();
  else if (e.key === ' ') { e.preventDefault(); estado.i < 0 ? presentar(0) : $('btn-play').click(); }
  else if (e.key === 'Escape' && estado.i >= 0) $('btn-cerrar').click();
});

/* ---------- barra de estado ---------- */

let ultimoEstado = 0;
escena.postRender.addEventListener(() => {
  const ahora = performance.now();
  if (ahora - ultimoEstado < 250) return;
  ultimoEstado = ahora;

  /* Sin globe.pick: tomaba 23 ms y se hacia tres veces cada 120 ms. El punto
     se lee del buffer de profundidad (pickPosition, 2 ms) y la escala sale de
     la distancia de la camara al centro y del angulo de vision. */
  $('estado-camara').textContent = `Cámara: ${fmt.format(camara.positionCartographic.height)} m`;
  const centro = new C.Cartesian2(lienzo.clientWidth / 2, lienzo.clientHeight / 2);
  /* Mientras la camara vuela en una animacion propia no se lee el buffer de
     profundidad: con teselas nuevas cargando, pickPosition tardaba 60 a 120 ms
     y congelaba un cuadro cada 250 ms al partir hacia cada parada. El centro
     ya se conoce: es el de la vista que se esta aplicando. */
  const enVuelo = estado.anim && estado.vista;
  const punto = enVuelo ? null : escena.pickPositionSupported ? escena.pickPosition(raton ?? centro) : undefined;
  const lugar = enVuelo ? { lat: estado.vista.lat, lng: estado.vista.lng }
    : punto ? (() => { const c = C.Cartographic.fromCartesian(punto); return { lat: grad(c.latitude), lng: grad(c.longitude) }; })() : null;
  if (lugar) {
    const { lat, lng } = lugar;
    $('estado-coord').textContent = `${dms(lat, 'N', 'S')}  ${dms(lng, 'E', 'O')}`;
    const h = sueloEn(lat, lng);
    $('estado-elev').textContent = h != null ? `${fmt.format(h)} m` : '';
  }
  const enCentro = estado.vista ? null : (escena.pickPositionSupported ? escena.pickPosition(centro) : undefined);
  const dist = estado.vista ? estado.vista.r : enCentro ? C.Cartesian3.distance(camara.positionWC, enCentro) : undefined;
  pintarEscala(dist);
  const pendientes = globo._surface?._tileLoadQueueHigh?.length + globo._surface?._tileLoadQueueMedium?.length;
  $('carga').classList.toggle('activa', google ? !google.tilesLoaded : !globo.tilesLoaded || pendientes > 0);
});

function pintarEscala(dist) {
  if (!dist) { $('escala-texto').textContent = ''; $('escala-barra').style.width = '0'; return; }
  // metros por pixel en el centro de la pantalla, con 60 grados de vision vertical
  const mpp = (2 * dist * Math.tan(rad(30))) / lienzo.clientHeight;
  const tope = mpp * 110;
  const pot = 10 ** Math.floor(Math.log10(tope));
  const largo = [5, 2, 1].map((f) => f * pot).find((v) => v <= tope) ?? pot;
  $('escala-barra').style.width = `${largo / mpp}px`;
  $('escala-texto').textContent = largo >= 1000 ? `${fmt.format(largo / 1000)} km` : `${fmt.format(largo)} m`;
}

/* ---------- arranque ---------- */

// Luz de mediodia de verano en la zona, para que el cielo y la atmosfera se vean de dia.
visor.clock.currentTime = C.JulianDate.fromIso8601('2026-01-15T16:00:00Z');
// el reloj corre para que la fumarola se mueva; en minutos el sol casi no cambia
visor.clock.shouldAnimate = true;

pintarCreditos();
pintarLista();
completarCotas();
// arranca con la toma amplia de Google Earth, sin parada activa ni puntos.
// Al elegir la Cafeteria (o Play) la camara se acerca y recien ahi aparece su punto
// En vertical (celular) parte con el mismo encuadre lejano de la Cafeteria, con el
// volcan entero en cuadro; la toma de Google Earth quedaba demasiado cerca
const tomaInicial = () => (encuadre() === 1 ? enVertical(deGE(PARADAS[0].camara)) : vistaDe(0));
let intacto = true;  // nadie ha tocado la camara todavia
addEventListener('pointerdown', () => { intacto = false; });
aplicar(tomaInicial());
marcarAltimetro(-1);  // la barra se ve desde el inicio, con la Cafeteria invitando

/* Precarga en segundo plano. Medido en Chrome el 2026-10-31: al abrir la toma
   del volcan entero por primera vez llegan cientos de teselas juntas y el
   giro cae a 13-18 cuadros por segundo; con esas teselas ya en la cache del
   navegador corre a 48-57. Mientras se mira la Cafeteria se bajan de a pocas
   las de la zona: relieve hasta el nivel 14 y foto hasta el 15. */
function teselasDeZona(z) {
  const n = 2 ** z;
  const x = (lng) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat) => { const r = rad(lat); return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
  const lista = [];
  for (let ty = y(grad(ZONA.north)); ty <= y(grad(ZONA.south)); ty++) {
    for (let tx = x(grad(ZONA.west)); tx <= x(grad(ZONA.east)); tx++) lista.push([z, tx, ty]);
  }
  return lista;
}
async function precargar() {
  const tareas = [
    ...[12, 13, 14].flatMap(teselasDeZona).map(([z, x, y]) => () => leerTesela(z, x, y)),
    ...[13, 14, 15].flatMap(teselasDeZona).map(([z, x, y]) => () => fetch(IMAGENES[IMAGEN_INICIAL].url.replace('{z}', z).replace('{y}', y).replace('{x}', x), { mode: 'cors' })),
  ];
  const libre = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 500 }) : setTimeout(r, 50)));
  const obrero = async () => {
    while (tareas.length) {
      await libre();
      try { await tareas.shift()(); } catch { /* si una falla, se sigue */ }
    }
  };
  const t0 = performance.now();
  await Promise.all([obrero(), obrero(), obrero()]);
  estado.precarga = Math.round(performance.now() - t0);  // ms que tardo, para medir
}
/* Los puntos aparecen solo cuando el volcan termino de cargar: ninguna
   tesela pendiente en la vista durante 1,2 s seguidos. Cesium carga primero
   unas pocas teselas gruesas y la cuenta toca 0 un instante antes de pedir
   las finas; sin esa espera los puntos salian al tiro, antes que el volcan.
   Si la carga nunca se queda en cero, a los 25 s aparecen igual. */
function aparecerPuntos() {
  if (cargado) return;
  cargado = true;
  window.telon?.terminar();
  if (estado.i !== PARADAS.length - 1) mostrarPuntos(true);
  // con las alturas de Google ya medidas se reencuadra la toma inicial, si nadie movio nada
  asentarEnGoogle().then(() => { if (intacto && estado.i < 0 && !enMarcha) aplicar(tomaInicial()); });
  avisarGiro();
}

/* Sugerencia de girar el telefono: solo en vertical, se va sola o al primer toque. */
/* La pantalla de girar el telefono se muestra sola en vertical (ver .girar en
   index.html); el enlace "Seguir en vertical" la cierra. */
function avisarGiro() {}
$('girar-seguir').addEventListener('click', () => $('aviso-girar').classList.add('descartado'));
/* La pagina que abre el recorrido en su visor manda la zona segura del telefono
   (la camara y las esquinas), para que los mandos no queden debajo. */
addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.tipo !== 'recorrido-seguro') return;
  const raiz = document.documentElement.style;
  ['t', 'r', 'b', 'l'].forEach((k) => raiz.setProperty(`--sa-${k}`, `${Number(e.data[k]) || 0}px`));
});
if (parent !== window) parent.postMessage({ tipo: 'recorrido-seguro-consulta' }, location.origin);
setTimeout(aparecerPuntos, 25000);
let empezo = false;
let espera = null;
function progreso(pendientes) {
  if (pendientes > 0) { empezo = true; clearTimeout(espera); espera = null; return; }
  if (!empezo || espera) return;
  espera = setTimeout(() => {
    dejar();
    aparecerPuntos();
    // con Google no hay teselas propias que precargar
    if (!google && !prueba.has('sinprecarga')) setTimeout(precargar, 800);
  }, 1200);
}
const dejar = google
  ? google.loadProgress.addEventListener((pendientes, procesando) => progreso(pendientes + procesando))
  : globo.tileLoadProgressEvent.addEventListener(progreso);

window.recorrido = { visor, estado, irA, presentar, alejarGirando, fumarola, PARADAS, aplicar, vistaDe };
