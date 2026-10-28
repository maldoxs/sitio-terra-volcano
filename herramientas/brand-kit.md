# Brand kit — Terra Volcano

> **Borrador v1.** Lo propuse yo a partir del nombre; está hecho para que lo
> corrijas, no para que lo aceptes. Si la agencia ya tiene logo, colores o tono
> definidos, esto se reemplaza completo antes de generar cualquier imagen —
> la paleta entra *verbatim* en los 17 prompts, así que cambiarla después
> significa re-renderizar todo.

## Nombre y tono

| Campo | Valor |
|---|---|
| Nombre display | Terra Volcano |
| Bajada | Expediciones en la Araucanía andina |
| Tono | Crudo, sobrio, con autoridad de montaña. Nunca "paraíso soñado" ni signos de exclamación. |
| Idioma del sitio | **Bilingüe ES/EN**, con detección automática. Casi todas sus reseñas están en inglés: el cliente es extranjero. (Corrección sobre la v0 de este documento, que asumía público chileno.) |

## Paleta

Seis valores con nombre. Van literalmente en cada prompt de escena; es lo que
mantiene el mundo cohesionado entre las 6 imágenes.

| Nombre | Hex | Uso |
|---|---|---|
| Obsidiana | `#14110F` | Texto principal, roca basáltica, silueta |
| Lava | `#D64A1E` | Acento primario, botón de reserva, el cráter |
| Azufre | `#E8B33C` | Acento secundario, luz de atardecer, fogón |
| Araucaria | `#2F5D4A` | Bosque nativo, acento de la escena 3 |
| Lago | `#3A7CA5` | Agua, acento de la escena 2 |
| Nieve | `#F2EDE6` | Fondo de página y de las escenas (tiene que ser el mismo valor en ambos, o se ve la caja) |

## Style preamble

Este bloque se repite **carácter por carácter** en los 6 prompts de escena. Es
la regla número uno de la cohesión: si lo editas, lo editas en los seis.

```
Soft matte low-poly clay diorama, high isometric view, tilt-shift miniature,
warm volcanic light at golden hour, visible hand-sculpted clay texture, subtle
contact shadows. Palette: #14110F obsidian black, #D64A1E lava orange, #E8B33C
sulphur yellow, #2F5D4A araucaria green, #3A7CA5 lake blue, #F2EDE6 snow bone.
On a plain solid #F2EDE6 background with a soft contact shadow. No text, no
letters, no logos, centered, 3:2.
```

## Las escenas son los volcanes

El vuelo no recorre "cráter / lago / bosque": recorre **su catálogo**. Villarrica,
Quetrupillán, Lanín, Sollipulli, Mocho-Choshuenco y el campamento base donde cae
el CTA. Ningún drone te muestra cinco volcanes en un plano; el diorama sí. Ahí
está el argumento del proyecto entero. Detalle en `guion.md`.

## Por qué diorama de arcilla y no fotorrealismo

Decisión con argumento, revisable:

- **El territorio es el producto.** Volcán, lago, bosque, termas, río: un mapa
  en miniatura del que vuelas de hito en hito *es* el pitch de la agencia.
- **La AI gana en lo ilustrado y pierde en lo fotográfico.** Si quieres
  fotorrealismo de Pucón, fotos y drone reales van a verse mejor y más creíbles
  que cualquier render — y te cuestan una salida de terreno, no US$27 de
  tokens. El diorama es donde el video generado aporta algo que no tienes.
- **Se re-rolea barato.** Una escena de arcilla que no quedó se regenera sin
  que nadie note el cambio de carácter; un plano fotorrealista sí.
