/* ============================================================================
   Idioma + interpolación de datos de la agencia.
   ----------------------------------------------------------------------------
   `t('hero.bajada')` devuelve el texto en el idioma activo, con los {marcadores}
   reemplazados por valores de datos/agencia.json. Así el teléfono y las cifras
   nunca se escriben en el copy: se interpolan desde la fuente única.

   Casi todas las reseñas de la agencia están en inglés — el cliente es
   extranjero — así que se detecta el idioma del navegador y se respeta.
   ========================================================================== */
import { ref, computed } from 'vue';
import agencia from '../../datos/agencia.json';
import textos from '../i18n/textos.js';

const detectado = (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
export const idioma = ref(detectado);
/* El <html lang> tiene que coincidir con lo que realmente se muestra: los
   lectores de pantalla eligen la voz por ese atributo, y un texto en inglés
   anunciado como español se escucha ininteligible. */
document.documentElement.lang = detectado;

/** Valores disponibles para los {marcadores} del copy. */
const valores = {
  whatsapp:    agencia.contacto.whatsapp,
  direccion:   agencia.contacto.direccion,
  sector:      agencia.contacto.sector,
  ciudad:      agencia.contacto.ciudad,
  pais:        agencia.contacto.pais,
  razonSocial: agencia.identidad.razonSocial,
  fundacion:   agencia.identidad.fundacion,
  fundador:    agencia.identidad.fundador,
  decreto:     agencia.operacion.decreto,
  ratio:       agencia.operacion.ratioGuia,
  min:         agencia.precios.comisionOtaMin,
  max:         agencia.precios.comisionOtaMax,
};

function interpolar(cadena, extra) {
  if (typeof cadena !== 'string') return cadena;
  return cadena.replace(/\{(\w+)\}/g, (m, k) => {
    const v = (extra && k in extra) ? extra[k] : valores[k];
    return v == null ? m : String(v);
  });
}

function buscar(ruta, lang) {
  return ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), textos[lang]);
}

export function useIdioma() {
  /** t('precio.sub') · t('catalogo.tours.lanin.meta', { altitud: 3747 }) */
  const t = (ruta, extra) => {
    const v = buscar(ruta, idioma.value);
    if (v == null) {
      // Falla ruidosa en desarrollo: un texto faltante no debe pasar inadvertido.
      if (import.meta.env.DEV) console.warn('[i18n] falta la clave:', ruta, '→', idioma.value);
      return ruta;
    }
    if (Array.isArray(v)) return v.map((x) => interpolar(x, extra));
    return interpolar(v, extra);
  };

  const cambiar = (lang) => {
    idioma.value = lang;
    document.documentElement.lang = lang;
  };

  return { idioma, t, cambiar, agencia, es: computed(() => idioma.value === 'es') };
}
