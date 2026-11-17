# 0006 · Fase 3 (segunda parte): Cóndor 7 y cajas de suministros

Fecha: 2026-11-16 · Estado: **terminada, pendiente de aprobación**

El encargo se llamaba «Fase 4: helicóptero militar y entrega de suministros». En el plan del proyecto corresponde a la **Fase 3** (arsenal y supervivencia): helicóptero Cóndor 7 y cajas de suministro. Incluye también los botiquines y dos armas nuevas (lanzallamas y lanzacohetes), porque el encargo los pedía como botín. Se empezó con la Fase 4 (enemigos) todavía pendiente de aprobación ([0005](0005-fase-4-enemigos.md)).

Capturas: `docs/capturas/fase3-suministros-*.png`, `fase3-lanzallamas.png`, `fase3-lanzacohetes.png`, `fase3-botiquin*.png` y `fase3-arsenal-2.png`.

## 1. El evento, paso a paso

| Momento | Qué pasa | Duración |
|---|---|---|
| Aviso | Alarma de radio (estática y tres pitidos dobles) y cartel parpadeante **«¡SUMINISTROS DETECTADOS!»** con franjas de alerta | 3,2 s |
| Llegada | El helicóptero arranca a 760 px de la zona, fuera de la pantalla: **se le oye acercarse antes de verlo** (el rotor se oye a 1100 px). Mensaje de radio de la capitana Vega | ~5 s |
| Sobrevuelo | Entra por un extremo (al azar), morro abajo al acelerar y morro arriba al frenar. Foco de búsqueda que ilumina la calle | — |
| Suelta | Se queda en estacionario sobre cada punto 1,4 s, el foco barre el suelo, el aire del rotor levanta polvo y la caja sale de la carga colgada | 1,4 s por caja |
| Salida | Acelera y sale por el extremo contrario | ~4 s |
| Caída | Caída libre, chasquido del paracaídas al abrirse, bajada lenta balanceándose con la baliza encendida | ~4,5 s |
| Aterrizaje | Golpe en el asfalto, nubes de polvo, sacudida de cámara si está cerca, el paracaídas se desinfla y queda en el suelo | — |

El ritmo cambia: **durante todo el evento la música de combate no baja del 55 %**, el rotor hace ruido cada 0,9 s (los zombis miran al cielo y acuden) y el golpe de cada caja se oye a 380 px.

## 2. Cuándo aparece

`src/content/supplies.ts` → `AIRDROP_SCHEDULE`:

- **Al azar en algunas partidas:** en el 70 % de las partidas hay lanzamientos al azar; el primero entre los 55 y los 100 s, y los siguientes cada 110–170 s.
- **Por evento:** llegar por primera vez al **CAMPAMENTO** lo provoca siempre.
- Nunca se solapan dos y hay **tres como máximo por partida**.
- Sin `?semilla=` cada partida es distinta (semilla aleatoria). Con `?semilla=N` es reproducible.

## 3. Cajas

- **Dos por lanzamiento, a veces tres** (35 %). Caen **por delante de Alex** (a 100–190 px, separadas 40–70 px), nunca encima de un obstáculo, nunca a menos de 84 px de Alex y nunca dos juntas. Al final del nivel caen por detrás.
- **Iluminación especial:** baliza del color de la **rareza de su mejor pieza** (gris común, verde poco común, amarillo rara, naranja épica). Así se sabe desde lejos por qué caja merece la pena arriesgarse. Late en escalones mientras está cerrada y se apaga al abrirla.
- **Interacción:** acercarse y **mantener E 0,75 s**. Soltar E, alejarse o recibir un golpe interrumpe la apertura, y entonces hay que soltar E y volver a pulsarla.
- Lo recogido sube sobre la caja con el color de su rareza («NUEVA ARMA: LANZACOHETES»).
- **Flechas en los bordes** de la pantalla señalan las cajas sin abrir que no se ven, con la distancia en metros.

## 4. Botín: probabilidades y rarezas

`LOOT_TABLE` en `src/content/supplies.ts` (pesos relativos, suman 100):

| Rareza | Contenido | Peso |
|---|---|---|
| Común | Munición 46 · Botiquín 24 · Pistola 6 | 76 |
| Poco común | Escopeta 8 · Fusil de asalto 7 | 15 |
| Rara | Ametralladora 4 · Lanzallamas 3,5 | 7,5 |
| Épica | Lanzacohetes 1,5 | 1,5 |

Reglas (`src/core/supply/loot.ts`, sin Phaser):

- Cada caja trae una pieza y, con un 40 %, **una segunda que solo puede ser munición o botiquín**.
- **Como mucho un arma por lanzamiento.**
- Un arma que ya se tiene sale con un **35 % de su peso** y, si sale, se convierte en munición para ella.
- **El lanzacohetes, una vez por partida** como mucho.
- **Seguro de mala suerte:** tras dos lanzamientos seguidos sin arma, el siguiente trae seguro un arma nueva.

## 5. Equilibrio: suministros limitados

- **Alex empieza solo con la pistola** (antes, con las cuatro armas). El resto hay que ganárselo en las cajas. `?arsenal=basico` y `?arsenal=completo` devuelven las cuatro armas de antes o las seis.
- Un arma nueva llega con el cargador lleno y **poca reserva** (la escopeta, 12 cartuchos; el lanzacohetes, 1 + 2 cohetes).
- La munición es siempre **la cantidad fija de una caja** para el arma que más la necesita, y **nunca supera la reserva máxima**. Lo que no cabe **se queda en la caja**, que se puede volver a abrir más tarde: nada se pierde y nada es infinito.
- **Los zombis rodean la carga:** al tocar el suelo la primera caja llegan de 2 a 4 enemigos por el borde de la pantalla más cercano (con tope de 14 vivos), atraídos por el golpe. Mientras una caja sigue cerrada, su bengala chisporrotea cada 1,6 s y **los mantiene rondando**.

## 6. Armas nuevas

| | Lanzallamas (5) | Lanzacohetes (6) |
|---|---|---|
| Cargador / reserva inicial / máxima | 80 / 40 / 160 de combustible | 1 / 2 / 6 cohetes |
| Disparo | Automático, 2 bocanadas cada 70 ms | Un cohete cada 0,9 s; recarga 2,2 s |
| Daño | 3 por bocanada, **atraviesa** (cada bocanada quema una vez a cada enemigo) y **prende fuego**: 14 por segundo durante 2,6 s | 60 al impactar + **explosión** de 60 px (260 a enemigos, 40 a Alex) |
| Alcance | 96 px (el menor del juego) | 420 px; estalla al impactar, contra el suelo o al agotar el alcance |
| Detalles | Llama piloto siempre encendida; las bocanadas crecen y se apagan; el enemigo en llamas lleva fuego encima con luz propia y se tiñe de naranja; un chorro sobre un bidón lo hace estallar | Estela de humo; el cohete vuela fuera de la pantalla y se oye estallar; a quemarropa también hiere a Alex; hace estallar los bidones cercanos |

Las dos tienen dibujo en los 7 ángulos y en los dos aspectos de Alex, recarga animada, icono y voz propia. Se dibujan en `src/art/painters/heavyGuns.ts` (las herramientas comunes de dibujo de armas pasaron a `gunShapes.ts`). La escena `?scene=arsenal` ahora tiene dos páginas (teclas 1 y 2).

## 7. Botiquines

- Alex empieza con **1** y lleva como máximo **3** (GDD §6). **Q** lo usa: 1,5 s caminando despacio y sin poder disparar; cura 50.
- Un golpe **interrumpe la cura sin gastar el botiquín**. Con la vida al máximo o sin botiquines, solo aparece un aviso.
- HUD: icono y contador junto a la vida; durante la cura el punto de mira se vuelve verde con su barra de progreso.

## 8. Arquitectura

| Capa | Archivos |
|---|---|
| `core` (sin Phaser) | `supply/airdrop.ts` (calendario, puntos de caída, vuelo, caída en paracaídas), `supply/loot.ts` (botín), `combat/Medkits.ts`, `combat/Arsenal.ts` (`grant`, `addAmmo`) |
| `content` | `supplies.ts` (todo el equilibrio del evento), `weapons.ts` (dos armas y equipos iniciales), `player.ts` (botiquines) |
| `art` | `painters/airdrop.ts`, `painters/heavyGuns.ts`, `painters/heavyFx.ts`, `supplyArt.ts` |
| `audio` | `synth/supplies.ts`: alarma de radio, transmisión, paracaídas, golpe de la caja, apertura, bengala y botiquín |
| `game` | `systems/AirdropSystem.ts`, `entities/SupplyCrate.ts`, `entities/HelicopterView.ts` (reescrito), `systems/BurnSystem.ts`, `systems/lootApply.ts`, `hud/AirdropHud.ts`, `debug/snapshot.ts` (sacado de `GameScene` para no pasar de 400 líneas) |

**El helicóptero inclinado no se rota:** sus tres actitudes se dibujan desplazando cada columna del fuselaje un número entero de píxeles (cizallado), sin suavizado. Rotor, foco, carga y balizas siguen a los mismos puntos del dibujo.

El helicóptero que patrullaba fijo sobre el campamento desde la Fase 2 **ya no está**: Cóndor 7 solo aparece cuando trae suministros. `LevelDef.helicopter` guarda ahora solo la altura de vuelo.

## 9. Fallos encontrados y corregidos

- **Dos cajas en el mismo punto.** Una simulación de 60 semillas con los obstáculos reales del capítulo 1 dio `570,570`: el hueco libre más cercano a dos puntos era el mismo. Ahora las cajas ya colocadas cuentan como obstáculo y la zona de Alex también. Prueba nueva con 400 semillas sobre la calle real.
- **La apertura se reiniciaba sola** si un golpe la interrumpía con E pulsada. Ahora hay que soltar E.
- **Zombis en llamas convertidos en siluetas blancas:** cada bocanada disparaba el destello blanco de impacto. El fuego ahora tiñe de naranja.
- **Lanzallamas demasiado fuerte:** con 6 de daño por bocanada mataba a tres caminantes en menos de un segundo. Bajado a 3.
- **(De la Fase 4)** Retirar un zombi muerto antes de que desapareciera su cadáver (`clearZombies` en las pruebas) dejaba un temporizador que **detenía el bucle del juego**. Los temporizadores del cadáver comprueban ahora que siga existiendo.
- Aviso «E: ABRIR», barra de apertura y textos del botín tapaban la cabeza de Alex: subidos. El botín salía duplicado (HUD y sobre la caja): ahora solo sobre la caja. El paracaídas plegado parecía una llama: redibujado.

## 10. Pruebas

- **Unitarias (190, 25 nuevas en `tests/unit/supplies.test.ts`):** frecuencias de la tabla en 10 000 cajas (±20 % de cada peso), un arma por lanzamiento, tope del lanzacohetes, armas repetidas menos probables, seguro de mala suerte, rareza de cada caja, munición con tope, botiquines, calendario (70 % de partidas, ventanas, eventos, tope), puntos de caída (también en la calle real), vuelo en los dos sentidos (orden de suelta, entra y sale fuera de la zona, nunca retrocede, menos de 30 s), inclinación, caída en paracaídas (fases, balanceo, 3–7 s), arte y sonidos. Las pruebas del arsenal comprueban que las dos armas nuevas tienen dibujo, icono, voz y fotogramas en los dos aspectos.
- **Navegador (`tests/e2e/supplies.spec.ts`, 8 nuevas):** equipo inicial, evento completo (aviso, entrada desde fuera de la pantalla, sonido, estacionario, caída, aterrizaje, salida), apertura con E e interrupción por un golpe, lo que no cabe se queda en la caja, lanzallamas que prende fuego, cohete que estalla, botiquín (cura e interrupción) y partida real con zombis acudiendo a las cajas.
- Las pruebas de navegador anteriores abren el juego con `arsenal=basico` para conservar las cuatro armas con las que se escribieron.

## 11. Lo que no está comprobado

- **Sonido:** las recetas existen, suenan y no saturan (prueba automática), pero **no las he escuchado**. Falta tu oído para la alarma de radio, la transmisión y el golpe de la caja.
- **Equilibrio en partidas reales:** los pesos y cantidades son una primera propuesta. Habrá que ajustarlos jugando, sobre todo el lanzallamas y la cantidad de zombis de la emboscada.
- Solo se ha probado en el Edge del sistema.
- Las granadas y molotov (arrojadizos), el inventario con Tab y las piezas siguen pendientes del resto de la Fase 3.
