/* ============================================================================
   Textos del sitio, ES/EN. Español e inglés y nada más (decisión de PLAN.md:
   es el mínimo que exige el Decreto 19/2018).

   Acá va SOLO copy. Los datos de la agencia (teléfono, cifras, precios) viven
   en datos/agencia.json y se interpolan: no se escriben dos veces.
   ========================================================================== */
export default {
  es: {
    nav:    { tours:'Expediciones', precio:'Precio', quienes:'Quiénes somos', cta:'Reservar' },
    hero:   {
      cejilla:'Pucón · Araucanía andina',
      t1:'El Villarrica no es una postal.', t2:'Está vivo.',
      bajada:'Ascensos guiados al cráter de un volcán activo. Un guía cada tres personas, siempre.',
      cta1:'Reservar directo', cta2:'Ver expediciones', pista:'Scroll',
    },
    cifras: {
      google:'Google, verificado el 26-10-2026', opiniones:'Opiniones publicadas',
      tripadvisor:'En Pucón, según Tripadvisor', ratio:'Guía por pasajeros, siempre',
      desde:'Fundada por Richard Díaz',
    },
    ascenso:{
      etiqueta:'Altitud',
      hitos:[
        { titulo:'Centro de esquí', texto:'Acá empieza la caminata. Se reparte el equipo y se revisa el pronóstico.' },
        { titulo:'Límite de nieve',  texto:'Se calzan los crampones. A partir de acá el piolet no se guarda.' },
        { titulo:'Pala final',       texto:'La pendiente llega a 35°. Es el tramo que define si el grupo sigue.' },
        { titulo:'Cráter',           texto:'Azufre, vapor y el lago abajo. Se baja antes del mediodía.' },
      ],
    },
    catalogo:{
      cejilla:'Catálogo', titulo:'Cinco formas de conocer la Araucanía.',
      sub:'Todas salen de Pucón. Todas con equipo incluido y guía certificado.',
      niveles:{ 1:'Accesible', 2:'Exigente', 3:'Alta montaña' },
      tours:{
        villarrica:{ nombre:'Villarrica',  meta:'{altitud} m · 1 día · crampones y piolet' },
        lanin:{      nombre:'Lanín',       meta:'{altitud} m · 2 días · campamento de altura' },
        'ski-touring':{ nombre:'Ski touring', meta:'{volcanes}' },
        rafting:{    nombre:'Rafting',     meta:'Río Trancura · medio día' },
        canyoning:{  nombre:'Canyoning',   meta:'Descenso en cascadas · medio día' },
      },
    },
    precio: {
      cejilla:'Reserva directa', t1:'El mismo ascenso.', t2:'Sin comisión.',
      sub:'Cuando reservas por una plataforma, entre el {min} y el {max}% de lo que pagas no llega a la agencia.',
      etiqDirecta:'Directo con Terra Volcano', por:'por persona · equipo incluido',
      porConfirmar:'por confirmar',
      incluye:['Crampones, piolet y casco','Guía certificado, ratio {ratio}',
               'Traslado desde Pucón','Reprogramación gratis por clima'],
      btn:'Reservar por WhatsApp', etiqOta:'Vía plataforma', porOta:'por persona',
      notaOta:'Rango publicado por las OTAs. La diferencia es la comisión del intermediario.',
    },
    richard:{
      cejilla:'Quiénes somos', titulo:'Richard conoce este volcán hace más de treinta años.',
      p1:'Terra Volcano es una empresa familiar fundada en {fundacion} por {fundador}, escalador chileno. No subcontrata guías: sube él o sube alguien de su equipo.',
      credenciales:['{razonSocial}','{direccion} — {sector}, {ciudad}','Registro de pasajeros conforme al {decreto}'],
      foto:'Espacio reservado para fotografía propia. Ninguna imagen del repositorio tiene licencia resuelta.',
    },
    cta:    { cejilla:'Cupos por fecha', titulo:'¿Subimos?',
              sub:'Escríbele a Richard. Responde él, no un bot.',
              wa:'WhatsApp {whatsapp}', ver:'Ver expediciones' },
    pie:    { dir:'{direccion} · {sector}, {ciudad}, {pais}',
              nota:'Maqueta de trabajo. Los datos marcados «por confirmar» esperan validación de la agencia.' },
  },

  en: {
    nav:    { tours:'Expeditions', precio:'Pricing', quienes:'About us', cta:'Book' },
    hero:   {
      cejilla:'Pucón · Andean Araucanía',
      t1:'Villarrica is not a postcard.', t2:'It is alive.',
      bajada:'Guided ascents to the crater of an active volcano. One guide per three climbers, always.',
      cta1:'Book direct', cta2:'See expeditions', pista:'Scroll',
    },
    cifras: {
      google:'Google, verified 2026-10-26', opiniones:'Published reviews',
      tripadvisor:'In Pucón, per Tripadvisor', ratio:'Guide to climbers, always',
      desde:'Founded by Richard Díaz',
    },
    ascenso:{
      etiqueta:'Altitude',
      hitos:[
        { titulo:'Ski centre',   texto:'The walk starts here. Gear is handed out and the forecast checked.' },
        { titulo:'Snow line',    texto:'Crampons go on. From here the ice axe stays in hand.' },
        { titulo:'Final headwall', texto:'The slope reaches 35°. This pitch decides whether the group continues.' },
        { titulo:'Crater',       texto:'Sulphur, steam, and the lake below. We descend before noon.' },
      ],
    },
    catalogo:{
      cejilla:'Catalogue', titulo:'Five ways to know the Araucanía.',
      sub:'All depart from Pucón. All include gear and a certified guide.',
      niveles:{ 1:'Accessible', 2:'Demanding', 3:'High mountain' },
      tours:{
        villarrica:{ nombre:'Villarrica',  meta:'{altitud} m · 1 day · crampons and ice axe' },
        lanin:{      nombre:'Lanín',       meta:'{altitud} m · 2 days · high camp' },
        'ski-touring':{ nombre:'Ski touring', meta:'{volcanes}' },
        rafting:{    nombre:'Rafting',     meta:'Trancura river · half day' },
        canyoning:{  nombre:'Canyoning',   meta:'Waterfall descent · half day' },
      },
    },
    precio: {
      cejilla:'Direct booking', t1:'Same climb.', t2:'No commission.',
      sub:'When you book through a platform, {min} to {max}% of what you pay never reaches the agency.',
      etiqDirecta:'Direct with Terra Volcano', por:'per person · gear included',
      porConfirmar:'to be confirmed',
      incluye:['Crampons, ice axe and helmet','Certified guide, {ratio} ratio',
               'Transfer from Pucón','Free rescheduling for weather'],
      btn:'Book on WhatsApp', etiqOta:'Via platform', porOta:'per person',
      notaOta:'Range published by the OTAs. The gap is the intermediary’s commission.',
    },
    richard:{
      cejilla:'About us', titulo:'Richard has known this volcano for over thirty years.',
      p1:'Terra Volcano is a family business founded in {fundacion} by {fundador}, a Chilean climber. Guides are never subcontracted: he climbs, or someone from his own team does.',
      credenciales:['{razonSocial}','{direccion} — {sector}, {ciudad}','Passenger registry compliant with {decreto}'],
      foto:'Reserved for the agency’s own photography. No image in the repository has its licence resolved.',
    },
    cta:    { cejilla:'Limited spots per date', titulo:'Shall we climb?',
              sub:'Message Richard. He answers, not a bot.',
              wa:'WhatsApp {whatsapp}', ver:'See expeditions' },
    pie:    { dir:'{direccion} · {sector}, {ciudad}, {pais}',
              nota:'Working mock-up. Values marked “to be confirmed” await the agency’s validation.' },
  },
};
