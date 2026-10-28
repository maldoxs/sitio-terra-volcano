# El motor del ascenso

Referencia tecnica de la pieza firma del sitio:
[`src/componentes/SeccionAscenso.vue`](../src/componentes/SeccionAscenso.vue).

Quien vaya a modificar la animacion deberia leer esto antes. No describe que se
ve, sino por que esta construido asi y que decisiones ya se probaron y
fallaron.

---

## La idea en una linea

El scroll ES el ascenso. El visitante no mira una animacion del Villarrica:
lo sube.

---

## Arquitectura

### El pin es `position: sticky`, no una libreria

```
.pista { height: 360vh }                    la pista de scroll
.fijo  { position: sticky; top: 0;
         height: 100svh }                   el escenario que se queda quieto
```

Mientras el visitante recorre esas 3,6 pantallas, el escenario no se mueve. Lo
resuelve el compositor del navegador: **cero JavaScript por frame** para
mantenerlo fijo.

Un pin hecho a mano con JavaScript cambia la altura del documento y pelea con
el scroll del trackpad. Sticky no.

### El progreso sale de una resta

```js
const r = seccion.value.getBoundingClientRect();
const total = seccion.value.offsetHeight - innerHeight;
pintar(total > 0 ? -r.top / total : 0);        // 0 a 1
```

### Todo cuelga de `pintar(p)`

La ruta, el escalador, el altimetro, los tres colores del cielo, las estrellas
y la fumarola. **Ninguno tiene estado propio**: todos son resultado de `p`.

Ventaja practica: en desarrollo la funcion queda expuesta en la consola del
navegador.

```js
pintarAscenso(0.42)   // congela ese instante exacto, sin scrollear a buscarlo
```

---

## Parametros, con sus valores literales

| Parametro | Valor | De donde sale |
|---|---|---|
| `BASE` | 1400 | constante en el componente |
| `CUMBRE` | 2847 | `datos/agencia.json`, catalogo villarrica. Marcada `altitudConfirmada: false` |
| Altura de la banda | 360vh escritorio, 300vh movil | CSS del componente |
| `UMBRALES` | `[0.08, 0.34, 0.64, 0.92]` | fraccion del ascenso donde aparece cada hito |
| Estrellas | 70 puntos, semilla 7 | generador determinista, sin `Math.random` |
| Aparicion del escalador | `p * 14`, saturado a 1 | aparece en el primer 7% del recorrido |
| Fumarola | `(p - 0.86) / 0.14` | aparece en el ultimo 14% |
| Apagado de estrellas | `1 - p * 2.1` | llegan a cero cerca del 48% |

### El viaje de color

Tres paletas de tres paradas cada una, interpoladas en dos tramos.

```js
const CIELOS = [
  [[ 11, 18, 32], [ 27, 36, 52], [ 43, 42, 46]],   // noche
  [[ 24, 34, 61], [ 58, 70, 96], [120, 96, 84]],   // azul de amanecer
  [[ 58, 52, 74], [150,104, 78], [232,179, 60]],   // dorado de cumbre
];
```

De 0 a 0,5 interpola entre la paleta 0 y la 1. De 0,5 a 1 entre la 1 y la 2.
Cada paleta alimenta `--c1`, `--c2` y `--c3`, que son las tres paradas del
gradiente del cielo.

### La ruta

```
M210 506 L295 472 L348 439 L375 405 L375 372 L397 338
L420 304 L458 271 L485 237 L496 204 L500 166
```

Once vertices en el sistema de coordenadas del `viewBox="0 0 1000 620"`.

---

## Como se genero la ruta, y los dos intentos que fallaron

Esta es la parte que mas importa documentar: **sin ella, la proxima sesion
repite los mismos dos errores.**

### El problema

La ruta tiene que subir por la ladera izquierda del volcan y cumplir dos cosas
a la vez: que todos sus vertices caigan **dentro** de la silueta, y que cada
tramo **gane altura**. La ladera no es recta, es una polilinea de cuatro
tramos con pendientes distintas.

### Intento 1, fallido: recortar por altura

Se genero un zigzag horizontal y despues se empujaron hacia abajo los vertices
que quedaban fuera.

```
y = max(y_planificado, superficie(x) + margen)
```

Resultado: el recorte **aplasto el zigzag**. Dos vertices consecutivos
quedaron casi identicos (375 405 y 375 372 son el residuo visible de eso) y la
monotonia se rompio en dos tramos.

### Intento 2, fallido: desplazar en perpendicular

Se camino sobre la ladera y se desplazo cada vertice segun la normal hacia
dentro del cerro, con amplitud decreciente.

Resultado: todos los vertices quedaron dentro, pero **la traversa bajaba**. Es
lo que hace un zigzag real de montana, pero visualmente una ruta que retrocede
se lee como un error.

### Lo que funciono: parametrizar por ALTURA

En vez de recorrer la ruta y corregir la altura, se recorre la **altura** y se
calcula la posicion.

```
Para cada altura y, de 506 bajando a 166:
    borde  = flankX(y)                      donde esta la ladera a esa altura
    holgura = max(24, f(progreso))          separacion del borde, sinusoidal
    x      = borde + holgura
```

`flankX(y)` interpola la ladera izquierda, que va de (150,512) a (330,404) a
(430,252) a (500,150).

**Por que funciona:** como `y` es la variable que se recorre y siempre
decrece, *subir siempre* deja de ser algo que haya que comprobar despues. Es
una propiedad del metodo.

La holgura respira con un seno para que el sendero se vea sinuoso en vez de
paralelo al borde, con un minimo duro de 24 px para que nunca toque el filo.

### La leccion general

> Cuando una restriccion es dificil de verificar, buscar la parametrizacion que
> la haga imposible de violar.

---

## Que hace cada paso de `pintar(p)`

| Paso | Que hace | Tecnica |
|---|---|---|
| 1 | la ruta se dibuja | `strokeDashoffset = LARGO * (1 - p)` |
| 2 | el escalador va sobre el trazo | `ruta.getPointAtLength(LARGO * p)` |
| 3 | altimetro | interpolacion lineal entre `BASE` y `CUMBRE` |
| 4 | cielo y estrellas | dos tramos de interpolacion de color |
| 5 | fumarola | aparece en el ultimo 14% |
| 6 | hitos | cambian solo al cruzar un umbral, no en cada frame |

El paso 2 es la clave del efecto: **la posicion no se calcula, se le pregunta
al propio trazo**. Por eso el punto sigue los quiebres del sendero con
exactitud en vez de aproximarlos.

El paso 6 guarda el indice del hito actual y solo reescribe el DOM cuando
cambia. Sin eso se repintaria el texto sesenta veces por segundo.

---

## Restricciones que la pieza debe cumplir

Las comprueba [`tests/verificar.mjs`](../tests/verificar.mjs) con
`npm run verificar`.

1. **Pista de scroll suficiente.** Un efecto atado al scroll necesita recorrido
   por delante o nace cumplido. Con la banda a 110vh, el marcador arranca al
   92% y el efecto no existe.
2. **Progreso monotono.** Ni la ruta ni el altimetro pueden retroceder.
3. **El escalador termina sobre el trazo**, no cerca.
4. **Sesenta fotogramas por segundo** durante toda la pieza.
5. **Movimiento reducido**: la banda colapsa a una pantalla y entrega la
   cumbre. Sin animacion no tiene sentido hacer recorrer tres pantallas vacias.
6. **Cero errores de consola.**

---

## Como extenderla

Todo elemento nuevo entra como una linea mas dentro de `pintar(p)`, sin tocar
lo que ya esta. Ese es el beneficio de que todo cuelgue del mismo numero.

Ideas conversadas y no implementadas:

- El lago apareciendo abajo al pasar cierta altura
- Un segundo escalador desfasado (`p - 0.06`) para mostrar la ratio 1:3 sin
  explicarla con texto
- Hitos clicables que salten a su altura
- La sombra del volcan alargandose con el amanecer

### Reglas que no se negocian

- Sin librerias de animacion. CSS, SVG, `IntersectionObserver` y el
  `requestAnimationFrame` compartido de
  [`useScrollRaf`](../src/composables/useScrollRaf.js)
- Solo `transform` y `opacity`
- Una sola curva de aceleracion, `--ease` en `src/estilos/base.css`
- Correr `npm run verificar` antes de hacer push

---

## Registro de cambios de la pieza

La entrada nueva va arriba.

### 2026-10-28 · version inicial

Pieza construida y verificada: 17/17 controles. Seis defectos encontrados y
corregidos durante la construccion, listados en el repositorio de
documentacion del proyecto.
