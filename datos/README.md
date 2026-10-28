# datos/

**`agencia.json` es la fuente única de verdad** de todo dato de Terra Volcano:
teléfono, dirección, cifras de reputación, precios y catálogo.

## La regla

Un dato se escribe **acá y en ningún otro lugar**. Si lo necesitas en otra
parte:

- **En código** (sitio Vue): `import agencia from '@/../../datos/agencia.json'`
- **En documentación** (`.md`): escribe un enlace a este archivo, no copies el
  número.

Es la regla «un dato, un solo lugar» de [`../CLAUDE.md`](../CLAUDE.md). Antes de
existir este archivo, el WhatsApp estaba escrito en 6 archivos y la dirección en
4: cambiar el número obligaba a tocarlos todos, y el que se olvidara quedaba
mintiendo en silencio.

## `confirmado: false`

Marca un dato que **no se publica** hasta que Richard lo valide. Los pendientes
están listados en el propio JSON y en
[`../claude/ESTADO-ACTUAL.md`](../claude/ESTADO-ACTUAL.md).

El caso más importante: **no hay precio directo canónico**. `directoVillarrica`
es `null` a propósito. Lo que se ve en el sitio es un marcador con etiqueta
visible, no una propuesta de precio.
