# 0004 · Fase 3 (primera parte): arsenal y sistema de combate

Fecha: 2026-11-11 · Estado: **terminada, pendiente de aprobación**

El encargo se llamaba «Fase 2: sistema de combate y armas». En el plan del proyecto la Fase 2 ya era la atmósfera (aprobada), así que este trabajo es la parte de armas de la **Fase 3**. El resto de la Fase 3 (arrojadizos, inventario, botiquines, Cóndor 7 y cajas en paracaídas) **no se ha empezado**.

## 1. Las cuatro armas

| Ranura | Arma | Daño | Cadencia | Alcance | Cargador | Reserva inicial / máx. | Recarga | Modo |
|---|---|---|---|---|---|---|---|---|
| 1 | Pistola | 34 | 261/min | 300 px | 12 | 36 / 96 | 1,3 s | Semiautomática |
| 2 | Escopeta | 15 × 7 perdigones | 75/min | 150 px | 6 | 12 / 36 | 2,4 s | Semiautomática |
| 3 | Fusil de asalto | 24 | 545/min | 400 px | 30 | 60 / 180 | 1,9 s | Automática |
| 4 | Ametralladora | 20 | 800/min | 340 px | 60 | 120 / 300 | 3,4 s | Automática |

- **Cada disparo gasta una bala real del cargador.** La escopeta gasta un cartucho y lanza siete perdigones en abanico.
- **El daño cae con la distancia**: la escopeta mata a un caminante de un disparo a quemarropa y apenas le hace nada al final de su alcance.
- Cada arma tiene además su propio **ruido** (atrae a los zombis), **empuje** al enemigo y **retroceso**.
- **Munición por arma**: cada una tiene su cargador y su reserva y los conserva al cambiar. Las cajas de suministros reponen el arma equipada; si está llena, la que tenga la reserva más vacía.
- Sin reserva no se puede recargar; con el cargador vacío el gatillo hace clic y avisa. La recarga se interrumpe al cambiar de arma sin perder balas.

## 2. Mecánicas

- **Clic izquierdo** dispara. Fusil y ametralladora disparan mientras se mantiene el botón; un toque rápido dispara una sola bala.
- **Puntería hacia el cursor**: el brazo usa el dibujo más cercano de los 7 ángulos, pero la bala sale hacia el cursor exacto (hay dibujo de bala cada 5°).
- **R** recarga, **1–4** y la **rueda del ratón** cambian de arma. Al cambiar hay 0,26 s de desenfundado en los que no se dispara (el brazo baja el arma).
- **Retroceso visual**: el arma retrocede a lo largo del cañón y vuelve escalón a escalón; sacudida de cámara propia de cada arma; la escopeta y la ametralladora empujan a Alex hacia atrás.
- **Fogonazos** distintos: corto (pistola), abanico ancho (escopeta), dardo largo (fusil) y estrella (ametralladora). Iluminan el entorno de noche.
- **Animación de disparo**: fogonazo + retroceso + casquillo (cartucho rojo en la escopeta) y **bombeo** de la corredera de la escopeta tras cada disparo. Cada arma tiene su **animación de recarga** de 6 fotogramas en el aspecto detallado.
- **Impactos**: estrella de luz, chispas y polvo contra superficies duras; sangre proporcional al daño contra zombis.

## 3. Sonido

Cada arma tiene su disparo sintetizado (seco, estampido grave con eco, restallido agudo, golpe corto para que la ráfaga no emborrone), más bombeo de la escopeta, cartuchos entrando uno a uno al recargarla, recarga de arma larga con cerrojo y sonido de cambio de arma. Los impactos de los perdigones no se apilan en siete sonidos.

## 4. HUD

Panel inferior derecho: icono y nombre del arma, **cargador** en grande (amarillo con poca munición, rojo vacío), **reserva** aparte, fila de balas (bala a bala hasta 12, finas hasta 36, barra en la ametralladora), **ranuras 1–4** (la activa iluminada, en rojo las que no tienen ni una bala) e **indicador de recarga** con texto y barra. El cursor del sistema se sustituye por un **punto de mira** que se tiñe al quedarse sin balas y muestra la recarga debajo. La vida sigue arriba a la izquierda.

## 5. Arquitectura (para añadir armas)

Añadir un arma son tres entradas, y las pruebas avisan si falta alguna:

1. Datos en `src/content/weapons.ts` (`WeaponDef`).
2. Dibujo en `src/art/painters/guns.ts` (`GUNS`): sirve para los dos aspectos de Alex, los 7 ángulos, el bombeo y la recarga.
3. Voz en `src/audio/synth/gunshot.ts` (`GUN_VOICES`).

Reglas puras en `src/core/combat/` (`Arsenal`, `WeaponState`, `ballistics`). En juego: `WeaponHandler` (entrada → arsenal → sonido y HUD), `GunfireSystem` (balas, impactos, luz, ruido), `WeaponPanel` (HUD). La escena de revisión `?scene=arsenal` muestra todas las armas en los 7 ángulos.

## 6. Fallos encontrados y corregidos

1. **Un clic rápido no disparaba con las armas automáticas**: solo miraban si el botón seguía pulsado. Lo detectó una prueba de navegador.
2. **Los fogonazos del fusil y la ametralladora parecían flechas apuntando hacia Alex** y el de la escopeta tenía «dedos» demasiado largos; rediseñados.
3. El texto de ayuda inferior habría invadido el panel de armas, más ancho; ahora va en dos líneas.

## 7. Pruebas

- 24 pruebas unitarias nuevas (138 en total): datos de cada arma, dibujos y sonidos completos, abanico de perdigones, caída de daño, puntería libre, arsenal, y **conservación de la munición**: para cada arma, 4000 acciones al azar (disparar, recargar, cancelar) comprobando en cada paso que cargador + reserva + disparadas no cambia y que nada baja de cero.
- 11 pruebas de navegador nuevas (57 en total) que juegan con cada arma: teclas 1–4 y rueda, desenfundado, semiautomáticas que no disparan al mantener, siete perdigones por cartucho, vaciar el cargador del fusil bala a bala y recargar, ametralladora sin reserva, recarga interrumpida, balas hacia el cursor, caja de munición e impactos.
- Compilación de producción correcta.

## 8. Lo que no está comprobado

- **El sonido no se ha escuchado.** Se genera y las pruebas comprueban que cada arma suena distinta y no satura, pero la calidad hay que juzgarla de oído.
- **El equilibrio** (daños, cadencias, munición) está razonado, no probado jugando largo rato. Con las cuatro armas desde el inicio el primer tramo es fácil; el GDD preveía conseguirlas en capítulos posteriores.
- **Las armas largas en diagonal** quedan finas: la figura mide 30 px y no se rota el pixel art.
- **Solo Edge.** **Sin commits.**

## 9. Cambios respecto al GDD

El GDD tenía subfusil y fusil de asalto y daba las armas por capítulos. Se ha seguido el encargo: pistola, escopeta, fusil de asalto y ametralladora, todas desde el inicio. El GDD queda actualizado.
