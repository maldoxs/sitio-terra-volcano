/* Las ocho paradas del recorrido, tomadas del proyecto de Google Earth del
   usuario (KML exportado el 2026-10-31). Cada una trae el encuadre exacto
   con que se miro en Google Earth: centro, rumbo, inclinacion y distancia.

   `alt` es la cota del TERRENO en ese punto segun Google Earth, no la de la
   etiqueta: el KML decia "Andarivel 2.060" y "capilla 2.100", pero el terreno
   da 1.880 y 2.015. Las cotas reales las confirma Richard.

   Dos datos del KML venian copiados y se corrigieron aca:
   - El Tubo tenia la cota de Piedra Blanca al decimal: queda sin cota (null).
   - La Cumbre del primer KML tenia la camara de la Colada. Se reemplazo
     entera por la de cumbre.kml (2026-10-31): punto en el borde del crater
     y camara mirando el pozo desde arriba.

   Las tomas del final salen de dos vistas que el usuario marco en Google
   Earth (URL @lat,lng,alt a,dist d,60y,rumbo h,inclinacion t). */
export const TOMAS_CUMBRE = {
  // el cono entero con el crater arriba, mirando desde la Colada
  aproximacion: { lat: -39.4157107, lng: -71.93958367, alt: 2614.7, heading: 138.95, tilt: 44.63, range: 1115 },
  // el crater de cerca, con la laguna de lava al centro
  crater: { lat: -39.42013856, lng: -71.93745361, alt: 2767.9, heading: 138.95, tilt: 44.62, range: 710 },
};

/* Pozo del crater: centro del hueco oscuro de la imagen Esri de 2024
   (Wayback 32553), medido sobre la imagen ya puesta en el relieve, que es
   donde tiene que calzar. Unos 30 m de radio. Ahi va la laguna de lava. */
export const LAVA = { lat: -39.42035, lng: -71.93995, radio: 19 };
/* El mismo pozo en los modelos 3D de Google: ahi el pozo es una imagen sobre
   una superficie plana (a 2.854 m) y su centro cae unos 16 m al norte y 18 m
   al este del de la foto de Esri. Medido el 2026-11-03 mirando el crater
   desde arriba con la camara vertical. El pozo mide unos 120 m de ancho; la
   laguna de lava ocupa el fondo, como en la foto. */
export const LAVA_GOOGLE = { lat: -39.420204, lng: -71.939741, radio: 24 };

export const PARADAS = [
  { n: 1, nombre: 'Cafetería', etiquetaKml: 'Cafeteria',
    lat: -39.39214985, lng: -71.95961335, alt: 1443,
    camara: { lat: -39.39748443, lng: -71.94735258, alt: 1668.6, heading: 138.36, tilt: 79.91, range: 2521 } },
  { n: 2, nombre: 'Andarivel N°5', etiquetaKml: 'Andarivel Nº5  2.060 Mts.',
    lat: -39.40262290, lng: -71.94744642, alt: 1880,
    camara: { lat: -39.40227132, lng: -71.94577903, alt: 1887.3, heading: 135.35, tilt: 65.75, range: 471 } },
  { n: 3, nombre: 'La Capilla', etiquetaKml: 'capilla 2.100 mts',
    lat: -39.40455037, lng: -71.94328776, alt: 2015,
    camara: { lat: -39.40415950, lng: -71.94320234, alt: 2005.9, heading: 176.75, tilt: 27.00, range: 374 } },
  { n: 4, nombre: 'Pingüinera', etiquetaKml: 'pinguinera',
    lat: -39.40727136, lng: -71.94375999, alt: 2167,
    camara: { lat: -39.40520393, lng: -71.94194636, alt: 2062.3, heading: 134.36, tilt: 72.74, range: 707 } },
  { n: 5, nombre: 'Piedra Blanca', etiquetaKml: 'piedra blanca',
    lat: -39.40958996, lng: -71.94431394, alt: 2254,
    camara: { lat: -39.40630907, lng: -71.94333629, alt: 2113.6, heading: 134.37, tilt: 72.74, range: 534 } },
  { n: 6, nombre: 'El Tubo', etiquetaKml: 'El tubo',
    lat: -39.41156680, lng: -71.94400954, alt: null,
    camara: { lat: -39.40684449, lng: -71.94098243, alt: 2145.6, heading: 138.36, tilt: 83.76, range: 2268 } },
  { n: 7, nombre: 'Colada', etiquetaKml: 'Colada',
    lat: -39.41451005, lng: -71.94371230, alt: 2462,
    camara: { lat: -39.40863140, lng: -71.94188973, alt: 2236.8, heading: 138.37, tilt: 83.75, range: 1184 } },
  { n: 8, nombre: 'Cumbre', etiquetaKml: 'cumbre',
    lat: -39.42064032, lng: -71.93957171, alt: 2838,
    camara: { lat: -39.41987708, lng: -71.93997321, alt: 2826.9, heading: 150.12, tilt: 0.21, range: 248 } },
];

/* Descripcion breve de cada parada para el altimetro lateral. Son los textos
   del sitio (src/i18n/textos.js, ascenso.hitos) donde la parada coincide con
   un hito: Cafeteria con el centro de esqui, Andarivel N°5 con el fin del
   andarivel, La Capilla y la Cumbre con el borde del crater. Las demas aun no
   tienen texto aprobado: el altimetro muestra el tramo medido desde la
   anterior. */
const TEXTOS = {
  1: 'Empieza el sendero a pie. Se reparte el equipo y se revisa el pronóstico.',
  2: 'Donde desembarcas si tomaste el telesilla. Ahorra cerca de una hora sobre arena volcánica y roca suelta.',
  3: 'Parada técnica entre las estructuras de un andarivel abandonado. Acá se come, se hidrata y se calzan los crampones.',
  8: 'Máscara de gas obligatoria por las fumarolas. Desde acá se ven los lagos y el Lanín. Se baja antes del mediodía.',
};
PARADAS.forEach((p) => { p.texto = TEXTOS[p.n] ?? null; });
