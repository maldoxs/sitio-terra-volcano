/* Idioma: espanol en el HTML; el ingles se carga solo si hace falta */
const originales = new Map();
const guardado = () => { try { return localStorage.getItem('idioma'); } catch { return null; } };
const recordar = (i) => { try { localStorage.setItem('idioma', i); } catch { /* sin almacenamiento */ } };
const pedido = new URLSearchParams(location.search).get('lang');
const inicial = pedido || guardado() || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');

const piezas = () => {
  const lista = [];
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (paseo.nextNode()) {
    const n = paseo.currentNode;
    if (n.nodeValue.trim() && !['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) lista.push([n, 'nodeValue']);
  }
  document.querySelectorAll('[alt],[aria-label],[placeholder]').forEach((e) => {
    if (e.alt) lista.push([e, 'alt']);
    if (e.hasAttribute('aria-label')) lista.push([e, 'aria-label']);
    if (e.placeholder) lista.push([e, 'placeholder']);
  });
  return lista;
};
const leer = (o, k) => (k === 'aria-label' ? o.getAttribute(k) : o[k]);
const poner = (o, k, v) => { if (k === 'aria-label') o.setAttribute(k, v); else o[k] = v; };

const cambiar = async (idioma) => {
  const en = idioma === 'en';
  const textos = en ? await import('./textos-en.js') : null;
  piezas().forEach(([o, k]) => {
    const clave = `${k}`;
    if (!originales.has(o)) originales.set(o, {});
    const memoria = originales.get(o);
    if (!(clave in memoria)) memoria[clave] = leer(o, k);
    const base = memoria[clave];
    const limpio = base.trim();
    poner(o, k, en ? base.replace(limpio, textos.traducir(limpio)) : base);
  });
  if (!originales.has(document)) originales.set(document, { titulo: document.title, desc: document.querySelector('meta[name=description]').content });
  const doc = originales.get(document);
  document.title = en ? textos.traducir(doc.titulo) : doc.titulo;
  document.querySelector('meta[name=description]').content = en ? textos.traducir(doc.desc) : doc.desc;
  document.documentElement.lang = idioma;
  document.querySelectorAll('[data-idioma]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.idioma === idioma));
  recordar(idioma);
};

document.querySelectorAll('[data-idioma]').forEach((b) => b.addEventListener('click', () => cambiar(b.dataset.idioma)));
if (inicial === 'en') cambiar('en');
