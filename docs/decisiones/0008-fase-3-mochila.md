# 0008 · Fase 3 (tercera parte): arrojadizos, piezas e inventario

Fecha: 2026-11-17 · Estado: **terminada, pendiente de aprobación**

Cierra lo que faltaba de la **Fase 3** del plan (arsenal y supervivencia): granadas y cócteles molotov, piezas y la pantalla de inventario con Tab. Se hizo con la parte de suministros ([0006](0006-fase-3-suministros.md)) y la Fase 4 ([0005](0005-fase-4-enemigos.md), [0007](0007-fase-4-oleadas.md)) todavía pendientes de aprobación. El usuario pidió «completa las fases y haz commits».

Capturas: `docs/capturas/fase3-granada-1-vuelo.png`, `fase3-granada-2-explosion.png`, `fase3-molotov.png`, `fase3-piezas.png`, `fase3-piezas-suelo.png`, `fase3-hud-mochila.png` y `fase3-inventario.png`. Se generan con `node scripts/capturar-mochila.mjs` (y también con `npm run capturas`).

## 1. Controles nuevos

| Tecla | Acción |
|---|---|
| **G** | Lanzar una granada hacia el ratón |
| **F** | Lanzar un cóctel molotov hacia el ratón |
| **Tab** | Abrir y cerrar el inventario (el juego se detiene) |

El GDD no fijaba la tecla de los arrojadizos. Se eligieron dos teclas, una por tipo, en lugar de una tecla para lanzar y otra para cambiar de tipo, porque en pleno combate es más rápido.

## 2. Arrojadizos

`src/content/throwables.ts` (equilibrio), `src/core/combat/Throwables.ts` (reglas, sin Phaser) y `src/game/systems/ThrowableSystem.ts`.

| | Granada (G) | Molotov (F) |
|---|---|---|
| Máximo en la mochila | 3 | 3 |
| Al empezar | 0 (2 con `arsenal=basico`, 3 con `completo`) | igual |
| Vuelo | Parábola de 38° | Parábola de 42° |
| Alcance | 36–230 px | 36–200 px |
| Al caer | Rebota (cada bote le quita la mitad del impulso), rueda y se frena | Se rompe al primer contacto: suelo, obstáculo o zombi |
| Efecto | Estalla a los **1,7 s**: radio de 64 px, 230 de daño a enemigos y 45 a Alex (cae con la distancia), empuje 170 | **Charco de fuego** de 60 px durante 5,5 s: prende a quien lo pisa (16 por segundo durante 2,2 s) y hiere a Alex (6 cada medio segundo) |
| Ruido | La explosión, como cualquier otra (520 px) | El cristal (300 px) y el fuego chisporroteando cada 1,2 s (230 px) |
| Luz | El destello de la explosión | La mecha encendida mientras vuela y el charco ilumina la calle |
| Cadena | Hace estallar los bidones cercanos | Hace estallar los bidones que quedan dentro del charco |

- **Cae donde apunta el ratón.** Con el ángulo fijo, la velocidad de salida se calcula para que la parábola, que sale de la mano y acaba en el asfalto (18 px más abajo), pase por el punto señalado: v² = g·d² / (2·cos²θ·(d·tanθ + h)). Una prueba simula el vuelo a 60 Hz y comprueba que cae a menos de 6 px del objetivo, hacia los dos lados.
- **Sin rotar el pixel art:** el objeto en vuelo gira con cuatro dibujos, cada uno girado exactamente 90° respecto al anterior.
- La granada **parpadea en rojo** el último medio segundo antes de estallar.
- No se puede lanzar **mientras se cura, se cambia de arma o se está aturdido**. Lanzar interrumpe la recarga. Entre dos lanzamientos hay 0,65 s.
- Sin unidades, la tecla solo avisa: «SIN GRANADA» o «SIN MOLOTOV».

**Dónde se consiguen:** en las cajas de Cóndor 7 y en las recompensas de las oleadas 3 y 4.

- `LOOT_TABLE` incluye ahora **granada (peso 6)** y **molotov (peso 5)**, comunes, dos unidades por caja. Para que la suma siga siendo 100 bajan la munición (de 46 a 40), los botiquines (de 24 a 20) y la pistola (de 6 a 5). Las piezas extra de una caja pueden ser munición, botiquín o arrojadizo, nunca un arma.
- Oleada 3: dos granadas además de lo que ya daba. Oleada 4, antes de la horda: dos molotov y una granada.

## 3. Piezas

`src/content/scrap.ts`, `src/core/economy/Scrap.ts` y `src/game/systems/ScrapSystem.ts`.

| Origen | Piezas |
|---|---|
| Caminante | 35 % de las veces, 1–2 |
| Corredor | 45 %, 1–3 |
| Chasqueador | 60 %, 2–4 |
| Mutante | Siempre, 8–12 |
| Caja de suministros | 3–6 la **primera** vez que se abre (según el punto de caída, para no alterar la semilla de los lanzamientos) |
| Caja de munición del nivel | 2 |

- Al morir, el enemigo suelta sus piezas **en uno a tres montoncitos** (engranaje, tuerca de latón, chapa) que saltan del cadáver y caen botando.
- Alex las recoge al pasar a **14 px**. Desde **36 px** vuelan hacia él.
- Duran **20 s** en el suelo; los tres últimos parpadean. Como mucho hay 40 montoncitos a la vez (en la horda mueren decenas de enemigos).
- HUD: engranaje y total bajo el contador de bajas, con un «+N» verde un momento al recoger.
- **Todavía no se gastan:** son la moneda del banco de trabajo, que llega en la Fase 5. Por ahora solo se cuentan durante la partida (no hay guardado).

## 4. Inventario (Tab)

`src/game/scenes/InventoryScene.ts` y `src/game/hud/inventoryView.ts`.

- El juego queda **detenido** debajo, como en la pausa.
- **Armas:** las seis ranuras con icono, nombre, cargador y reserva (en rojo si no queda nada) y la que está «EN MANO». Las ranuras vacías dicen qué arma falta («LANZACOHETES - SIN ENCONTRAR»): el jugador sabe qué buscar en las cajas.
- **Consumibles:** botiquines, granadas y molotov con su cantidad y máximo, y la tecla de cada uno.
- **Piezas** y **objetos de misión** («NINGUNO» hasta que la campaña los traiga).
- Arriba/abajo (o W/S) elige un arma; **Enter o E la equipa** y vuelve al juego. También sirven las teclas 1–6. Tab o Esc cierran.
- La tecla que cierra el inventario (o la pausa) llegaba también al juego al reanudarse y lo volvía a abrir en el acto. Ahora el juego ignora una nueva apertura durante 0,2 s tras cerrarlo.

## 5. Arquitectura

| Capa | Archivos |
|---|---|
| `core` (sin Phaser) | `combat/Throwables.ts` (mochila y trayectoria), `economy/Scrap.ts` (cartera, botín de piezas, reparto en montones), `supply/loot.ts` (`lootId` y la pieza `throwable`) |
| `content` | `throwables.ts`, `scrap.ts`, `supplies.ts` (pesos nuevos), `waves.ts` (recompensas) |
| `art` | `painters/throwables.ts`, `throwArt.ts` |
| `audio` | `synth/throwables.ts`: silbido del lanzamiento, rebote metálico, cristal roto con soplido de fuego y tintineo de piezas |
| `game` | `systems/ThrowableSystem.ts`, `systems/ScrapSystem.ts`, `systems/CombatSystem.ts`, `scenes/InventoryScene.ts`, `hud/PackHud.ts`, `hud/inventoryView.ts` |

`CombatSystem` saca de `GameScene` el daño a Alex y a los enemigos y los efectos de las explosiones. Hacía falta para no pasar de 400 líneas, y además es el sitio natural de «al morir, suelta piezas».

## 6. Fallos encontrados y corregidos

- **La granada caía 25 px más lejos de lo apuntado:** la fórmula del alcance suponía que salía y caía a la misma altura, pero sale de la mano. Ahora tiene en cuenta los 18 px de caída hasta el asfalto.
- **Rodaba casi 50 px tras el primer bote** y chocaba contra las barreras. Ahora cada bote le quita la mitad del impulso horizontal y en el suelo se frena deprisa.
- **Contorno cortado** en los dibujos que tocaban el borde del lienzo: los pintores de arrojadizos y piezas dejan un píxel libre alrededor.
- En las capturas, **las piezas del suelo apenas se veían** y la granada era muy oscura: se redibujaron con colores más claros (latón, acero con brillo).
- El engranaje de las piezas en el HUD quedaba lejos de su número: ahora se coloca según el ancho del texto, como la calavera de las bajas.
- La ayuda de teclas pasó de dos a tres líneas para que no invada el panel de armas.

## 7. Pruebas

- **Unitarias (216, 15 nuevas en `tests/unit/inventory.test.ts`):** mochila (máximos, gasto, tiempo entre lanzamientos, equipos iniciales), trayectoria (alcance exacto en llano, caída simulada a 60 Hz hacia los dos lados, alcance mínimo y máximo), datos de granada y molotov, arrojadizos en la tabla de botín y en las cajas, cartera de piezas, media de piezas de cada enemigo, reparto en montones, dibujos (cuatro giros exactos, iconos, montoncitos) y sonidos.
- **Navegador (`tests/e2e/inventory.spec.ts`, 7 nuevas):** sin arrojadizos, G solo avisa; la granada vuela, cae cerca del punto apuntado, estalla con la mecha, mata a los cercanos y hace ruido; el molotov deja fuego que prende a un zombi y se apaga solo; no se puede lanzar curándose; el mutante suelta piezas y Alex las recoge; las piezas vuelan hacia Alex; Tab abre el inventario con el juego detenido, el número de ranura equipa el arma y Tab cierra sin que se vuelva a abrir.
- La batería completa pasa: **216 unitarias y 84 de navegador**.

## 8. Lo que no está comprobado

- **Sonido:** las cuatro recetas nuevas suenan y no saturan (prueba automática), pero **no las he escuchado**.
- **Equilibrio en partidas reales:** daño de la granada, duración del fuego y cantidad de piezas son una primera propuesta.
- **Animación de lanzamiento:** el brazo solo da un pequeño tirón (sin fogonazo). No hay una pose propia de lanzar; si hace falta, se dibujaría en los dos aspectos de Alex.
- Las piezas **no se gastan todavía** (banco de trabajo, Fase 5) y no se guardan entre partidas.
- El inventario no tiene ratón: se maneja con el teclado.
- Solo se ha probado en el Edge del sistema.
