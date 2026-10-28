<script setup>
import { ref } from 'vue';
import { onScroll, quieto } from '../composables/useScrollRaf.js';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();

/* Parallax de tres capas. La velocidad vive en el dato, no en el CSS: así
   agregar una capa es agregar una línea acá y nada más. */
const CAPAS = [
  { vel: 0.06, z: 1 },
  { vel: 0.14, z: 2 },
  { vel: 0.26, z: 3 },
];
const desplazamiento = ref(CAPAS.map(() => 0));
const opPista = ref(1);

onScroll(() => {
  const y = scrollY;
  if (!quieto()) desplazamiento.value = CAPAS.map((c) => y * c.vel);
  opPista.value = y > 120 ? 0 : 1;
});
</script>

<template>
  <header class="hero" id="top">
    <div class="cielo"></div>

    <div class="capa" :style="{ zIndex: CAPAS[0].z, transform: `translate3d(0,${desplazamiento[0]}px,0)` }">
      <svg viewBox="0 0 1440 340" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#CBBBA4" d="M0 340V214l118-62 96 44 128-78 142 84 118-54 146 72 134-86 152 92 104-48 102 58v104z"/>
      </svg>
    </div>
    <div class="capa" :style="{ zIndex: CAPAS[1].z, transform: `translate3d(0,${desplazamiento[1]}px,0)` }">
      <svg viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#8E7A63" d="M0 420V352l286-96 160-150 72-66 74 68 158 150 288 94 202 58v20z"/>
        <path fill="#F2EDE6" opacity=".92" d="M518 40l74 68 76 72-66 24-84-30-72 28-60-26 70-66z"/>
        <path fill="#D64A1E" opacity=".85" d="M560 44l32-4 34 38-36 14-40-12z"/>
      </svg>
    </div>
    <div class="humo" aria-hidden="true"></div>
    <div class="capa" :style="{ zIndex: CAPAS[2].z, transform: `translate3d(0,${desplazamiento[2]}px,0)` }">
      <svg viewBox="0 0 1440 190" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#2F5D4A" d="M0 190V96l70-34 54 30 78-44 66 40 84-46 72 44 90-50 76 48 88-44 74 42 86-48 78 46 92-42 70 40 76-38 86 46v134z"/>
        <path fill="#1E3E31" opacity=".86" d="M0 190v-54l96 26 92-34 104 38 96-30 110 36 98-32 112 38 96-30 108 36 98-28 106 34 124-38v38z"/>
      </svg>
    </div>

    <div class="wrap texto">
      <span class="cejilla">{{ t('hero.cejilla') }}</span>
      <h1>{{ t('hero.t1') }} <span class="marca-texto" v-marcador>{{ t('hero.t2') }}</span></h1>
      <p class="bajada">{{ t('hero.bajada') }}</p>
      <div class="acciones">
        <a class="btn btn--lava" :href="agencia.contacto.whatsappUrl">{{ t('hero.cta1') }}</a>
        <a class="btn btn--linea" href="#catalogo">{{ t('hero.cta2') }}</a>
      </div>
    </div>

    <div class="pista" :style="{ opacity: opPista }">
      <span>{{ t('hero.pista') }}</span><i></i>
    </div>
  </header>
</template>

<style scoped>
.hero{position:relative;min-height:100svh;display:grid;align-items:end;overflow:hidden}
.cielo{position:absolute;inset:0;z-index:0;
  background:radial-gradient(120% 70% at 72% 14%, rgba(232,179,60,.5), transparent 58%),
             linear-gradient(176deg,#F7F2EA 0%, var(--nieve) 38%, #EADFD0 74%, #E2D2BE 100%)}
.capa{position:absolute;left:0;right:0;bottom:0;will-change:transform}
.capa svg{display:block;width:100%;height:auto}
.humo{position:absolute;z-index:2;left:50%;bottom:34%;width:min(42vw,420px);aspect-ratio:1;
  background:radial-gradient(circle at 50% 70%, rgba(242,237,230,.8), transparent 62%);
  filter:blur(22px);opacity:.75;animation:derivar 14s ease-in-out infinite alternate}
@keyframes derivar{from{transform:translate(-54%,6px) scale(1)}to{transform:translate(-44%,-22px) scale(1.14)}}

.texto{position:relative;z-index:3;padding-bottom:clamp(56px,11vh,120px);padding-top:140px}
h1{font-weight:800;font-size:clamp(2.9rem,8.2vw,6.4rem);line-height:.95;max-width:16ch;margin:0 0 22px}
.bajada{font-size:clamp(1.05rem,2.1vw,1.3rem);max-width:46ch;color:#3f3730;margin:0 0 34px}
.acciones{display:flex;flex-wrap:wrap;gap:12px;align-items:center}

.pista{position:absolute;left:50%;bottom:22px;z-index:4;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:9px;
  font:700 10px/1 var(--texto);letter-spacing:.22em;text-transform:uppercase;
  color:var(--tinta-suave);transition:opacity .5s var(--ease)}
.pista i{display:block;width:1px;height:38px;
  background:linear-gradient(var(--tinta-suave),transparent);animation:caer 2.1s var(--ease) infinite}
@keyframes caer{0%{transform:scaleY(0);transform-origin:top}
  45%{transform:scaleY(1);transform-origin:top}
  46%{transform:scaleY(1);transform-origin:bottom}
  100%{transform:scaleY(0);transform-origin:bottom}}

@media (prefers-reduced-motion:reduce){
  .capa{transform:none !important}
  .humo,.pista i{animation:none}
}
</style>
