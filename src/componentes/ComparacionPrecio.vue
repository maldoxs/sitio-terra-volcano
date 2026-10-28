<script setup>
/* El argumento de negocio del proyecto: mostrar las dos cifras juntas para
   que el visitante no se vaya a la OTA, donde la agencia paga 20-30%.

   El precio directo es `null` en datos/agencia.json a propósito: no hay precio
   canónico todavía. Si falta, se muestra la etiqueta «por confirmar» en vez de
   un número inventado — regla de CLAUDE.md: nada de datos inventados. */
import { computed } from 'vue';
import { useIdioma } from '../composables/useIdioma.js';

const { t, agencia } = useIdioma();
const p = agencia.precios;
const hayPrecioDirecto = computed(() => p.directoVillarrica != null && p.directoVillarricaConfirmado);
</script>

<template>
  <section class="precio seccion" id="precio">
    <div class="wrap">
      <span class="cejilla azufre" v-revelar>{{ t('precio.cejilla') }}</span>
      <h2 class="titulo" v-revelar>
        {{ t('precio.t1') }} <span class="marca-texto" v-marcador>{{ t('precio.t2') }}</span>
      </h2>
      <p class="sub" v-revelar>{{ t('precio.sub') }}</p>

      <div class="versus" v-revelar.grupo>
        <div class="caja directa" data-revelar="izq">
          <span class="etiq">{{ t('precio.etiqDirecta') }}</span>
          <span class="monto">
            <template v-if="hayPrecioDirecto">{{ p.moneda }}${{ p.directoVillarrica }}</template>
            <template v-else><span class="sinDato">—</span></template>
            <span class="pendiente" v-if="!hayPrecioDirecto">{{ t('precio.porConfirmar') }}</span>
          </span>
          <p class="unidad">{{ t('precio.por') }}</p>
          <ul class="incluye">
            <li v-for="(linea, i) in t('precio.incluye')" :key="i">{{ linea }}</li>
          </ul>
          <a class="btn btn--lava" :href="agencia.contacto.whatsappUrl">{{ t('precio.btn') }}</a>
        </div>

        <div class="caja via-ota" data-revelar="der">
          <span class="etiq">{{ t('precio.etiqOta') }}</span>
          <span class="monto">{{ p.moneda }}${{ p.otaMin }}–{{ p.otaMax }}</span>
          <p class="unidad">{{ t('precio.porOta') }}</p>
          <p class="nota">{{ t('precio.notaOta') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.precio{background:var(--obsidiana);color:var(--nieve)}
.precio :deep(.titulo){color:var(--nieve)}
.precio :deep(.sub){color:rgba(242,237,230,.66)}
.azufre{color:var(--azufre)}
.versus{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-top:46px}
.caja{border-radius:5px;padding:30px}
.etiq{font:700 10px/1 var(--texto);letter-spacing:.16em;text-transform:uppercase;
  display:block;margin-bottom:18px}
.monto{font:800 clamp(2.6rem,6.4vw,4.2rem)/1 var(--display);letter-spacing:-.04em;
  display:block;font-variant-numeric:tabular-nums}
.sinDato{opacity:.35}
.unidad{font-size:13.5px;margin-top:9px}
.directa{background:var(--nieve);color:var(--obsidiana);
  box-shadow:0 0 0 2px var(--lava),0 20px 50px rgba(0,0,0,.4);
  transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
.directa:hover{transform:translateY(-4px);box-shadow:0 0 0 2px var(--lava),0 28px 60px rgba(0,0,0,.46)}
.directa .etiq{color:var(--lava)}
.directa .unidad{color:var(--tinta-suave)}
.incluye{list-style:none;padding:0;margin:24px 0 26px;display:grid;gap:10px}
.incluye li{padding-left:24px;position:relative;font-size:14.5px;line-height:1.45}
.incluye li::before{content:"✓";position:absolute;left:0;color:var(--araucaria);font-weight:700}
.via-ota{background:rgba(242,237,230,.05);border:1px solid rgba(242,237,230,.16);
  color:rgba(242,237,230,.68);display:flex;flex-direction:column}
.via-ota .etiq{color:rgba(242,237,230,.46)}
.via-ota .monto{color:rgba(242,237,230,.46);text-decoration:line-through;text-decoration-thickness:2px}
.nota{font-size:13px;line-height:1.6;margin-top:auto;color:rgba(242,237,230,.46)}
.pendiente{display:inline-block;font:700 9.5px/1 var(--texto);letter-spacing:.1em;
  text-transform:uppercase;padding:5px 8px;border-radius:3px;vertical-align:middle;
  margin-left:.3em;background:rgba(232,179,60,.16);color:var(--azufre);
  border:1px solid rgba(232,179,60,.36)}
@media (max-width:900px){ .versus{grid-template-columns:1fr} .via-ota{order:2} }
@media (prefers-reduced-motion:reduce){ .directa{transition:none} }
</style>
