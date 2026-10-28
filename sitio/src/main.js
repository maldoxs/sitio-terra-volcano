import { createApp } from 'vue';
import App from './App.vue';
import revelar from './directivas/revelar.js';
import marcador from './directivas/marcador.js';
import './estilos/base.css';

/* El estado oculto de los reveals SOLO aplica con la clase `js`. Si este script
   nunca corre, el contenido queda visible: nadie ve una página en blanco por
   culpa de un error de JavaScript. */
document.documentElement.classList.add('js');

createApp(App)
  .directive('revelar', revelar)
  .directive('marcador', marcador)
  .mount('#app');
