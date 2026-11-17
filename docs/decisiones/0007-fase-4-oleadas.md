# 0007 · Fase 4 (segunda parte): modo supervivencia, horda final y rendimiento

Fecha: 2026-11-17 · Estado: **terminada, pendiente de aprobación**

El encargo se llamaba «Fase 5: sistema de supervivencia y grandes hordas». En el plan del proyecto es el resto de la **Fase 4** (enemigos y hordas): director de oleadas, modo Oleadas y prueba de estrés. Se empezó con las fases anteriores aún pendientes de aprobación ([0005](0005-fase-4-enemigos.md), [0006](0006-fase-3-suministros.md)).

Se juega con **`?modo=oleadas`** (y `&oleada=N` para empezar en la oleada N). Capturas: `docs/capturas/fase4-oleadas-*.png`, `fase4-horda-*.png`, `fase4-jefe-*.png` y `fase4-estres-150.png`.

## 1. Escenario: «Último refugio»

`src/content/chapters/survival.ts`: una calle de 1400 px con un puesto fortificado en el centro (tienda, torre de luz, dos bidones ardiendo). Alex queda entre **dos barricadas reforzadas** nuevas (sacos, chapa remachada y alambre de espino; 60 golpes; se ven más dañadas a medida que encajan golpes). Fuera hay bidones de combustible para volar grupos y dos alarmas apagadas que se encienden con la horda.

## 2. Las oleadas

`src/content/waves.ts` (datos) y `src/core/waves/WaveRun.ts` (reglas, sin Phaser).

| Oleada | Aviso | Enemigos | Total | A la vez | Llegan | Recompensa |
|---|---|---|---|---|---|---|
| 1 | CAMINANTES | 10 caminantes | 10 | 8 | de uno en uno, por un lado al azar | Escopeta + munición |
| 2 | ¡LLEGAN LOS CORREDORES! | 14 caminantes, 6 corredores | 20 | 12 | de dos en dos, alternando lados | Fusil (o escopeta) + botiquín + munición |
| 3 | ¡CHASQUEADORES! NO HAGAS RUIDO | + 5 Chasqueadores | 25 | 14 | de dos en dos | Ametralladora (o fusil) + munición ×2 |
| 4 | ¡MUTANTES Y GRANDES GRUPOS! | 22 + 8 + 4 + **2 mutantes** (al final) | 36 | 20 | **grupos de 4** | Lanzallamas (o lanzacohetes / ametralladora) + botiquín + munición ×2 |
| **Horda** | ¡DEFIENDE LA BARRICADA! | 100 + 36 + 14 + 4 mutantes | **154** | **70** | **grupos de 5 por los dos lados** | — (llega el jefe) |

- Cada oleada tiene **aviso** (3,5 s, título y novedad en grande), **contador de enemigos**, **barra de progreso**, **recompensa** (una caja en paracaídas que cae en el refugio con la primera arma que Alex aún no tenga) y **descanso** (12 s; 15 s antes de la horda) con cuenta atrás.
- Los enemigos entran **justo fuera de la pantalla** por su lado; los Chasqueadores, ciegos, avanzan hacia el refugio hasta que oyen algo.
- **Modo asedio:** en este modo todos los enemigos **derriban las barricadas** en lugar de saltarlas (los corredores pueden seguir saltando por encima de Alex). Una barricada encaja como mucho un golpe cada 0,35 s: aunque se amontonen veinte delante, solo unos pocos caben para golpear.

HUD (`src/game/hud/WaveHud.ts`), arriba en el centro: «OLEADA 3/5 · ENEMIGOS 12» (o «DESCANSO 8», «PREPARATE 2», «LLEGAN EN 5»), barra de progreso y la integridad de cada barricada (verde, amarilla, roja).

## 3. Horda final

| | |
|---|---|
| **Alarma** | 7 s: se encienden las dos alarmas (luz roja giratoria y sirena), suena la alarma de radio, «¡ALARMA! EL RUIDO HA DESPERTADO A LA HORDA». Las sirenas hacen ruido en todo el nivel |
| **Dos frentes** | «¡VIENEN POR LOS DOS LADOS! DEFIENDE LA BARRICADA»; grupos de cinco alternando extremos |
| **Velocidades y comportamientos** | Caminantes lentos que golpean la barricada, corredores rápidos que saltan por encima de Alex, Chasqueadores que van al ruido y mutantes al final que la derriban a mazazos |
| **Iluminación** | La oscuridad se tiñe de rojo y late con la sirena (`DayNight.setEmergency`) |
| **Ambiente** | Temblores de cámara que crecen con la multitud; el suelo retumba durante la alarma |
| **Música** | Tensión y combate al máximo durante toda la horda |
| **Avisos de peligro** | Marco rojo que late en los bordes (más intenso cuanto más dañadas las barricadas), «¡LA BARRICADA CEDE! LADO IZQUIERDA», «¡HAN ROTO LA BARRICADA!» |

Sin defenderse, las barricadas aguantan unos 25 s a una horda de 70 y Alex cae unos 10 s después.

## 4. Llegada del jefe

Al caer el último enemigo de la horda (`src/game/modes/BossIntro.ts`, 14 s): «LA HORDA HA CAIDO · SILENCIO...», la música se apaga, las alarmas callan, **las farolas se apagan** una tras otra y el suelo tiembla cada vez más; un rugido lejano; «ALGO SE ACERCA · EL SUELO TIEMBLA»; **una silueta enorme se alza tras el muro** (EL DEVORADOR, 150×112 px, espinas de hueso recortadas contra el cielo); abre **cuatro ojos rojos que brillan**, ruge y la pantalla se sacude; rótulo **«EL DEVORADOR · HA DESPERTADO»**. Después: «HAS SOBREVIVIDO», resumen (oleadas, bajas, tiempo), «PERO EL DEVORADOR YA ESTA AQUI. CONTINUARA...» y R para jugar de nuevo.

**El combate contra el jefe no está hecho:** según el plan es la Fase 6. Esto es solo la secuencia de aparición que pedía el encargo.

## 5. Rendimiento y reutilización de objetos

| Técnica | Dónde |
|---|---|
| **Depósito de enemigos:** un zombi muerto no se destruye; cuando su cadáver se desvanece vuelve a un depósito por tipo y se reutiliza (`Zombie.revive`) | `ZombieDirector`, `Zombie` |
| **Precalentado:** durante los 7 s de alarma se crean, 4 por fotograma, los enemigos que cabrán a la vez en la horda | `ZombieDirector.prewarm` |
| **Tope de vivos:** nunca más de 70 a la vez; el resto espera en la cola | `WaveRun` |
| **Cadáveres más breves** con mucha gente: 6 s → 4 s (más de 20 en juego) → 2,5 s (más de 40) | `ZombieDirector.spawn` |
| **Voces limitadas:** dos gruñidos iguales no suenan con menos de 110 ms de separación (antes, 70 zombis atacando lanzaban 70 sonidos por segundo) | `ZombieDirector.voice` |
| **Lista de enemigos en juego** mantenida a mano en vez de recorrer el grupo de Phaser cada vez | `ZombieDirector.live` |
| Solo el mazazo del mutante sacude la cámara; los golpes de los demás a la barricada, apenas | `GameScene` |

**Medidas** (Edge del sistema, tiempo de CPU de cada fotograma de `prestep` a `postrender`, presupuesto 16,7 ms):

| Situación | Media | p95 | fps |
|---|---|---|---|
| Calle sin enemigos | 1,3 ms | — | 60 |
| **150 zombis persiguiendo a Alex** (prueba de estrés) | **2,4–2,6 ms** | 3,8 ms | 60 |
| Horda: 70 en pantalla golpeando las barricadas | — | — | 56–60 |

En una horda de 154 enemigos (164 apariciones contando la oleada anterior) se crean entre 90 y 120 objetos `Zombie`, casi todos durante la alarma; cuantos más muertos a la vez, más cadáveres esperan a desvanecerse antes de reutilizarse. **El criterio del plan («150 zombis activos dentro del presupuesto») se cumple.** Ojo: el fps de este equipo varía mucho según lo que haya abierto (IntelliJ, Steam…). Por eso la prueba automática mide el coste del fotograma y no los fps.

## 6. Arquitectura

| Capa | Archivos |
|---|---|
| `core` | `waves/WaveRun.ts`: fases, cola mezclada con los duros al final, llegadas en grupos con tope, lados, bajas, descansos, horda y jefe |
| `content` | `waves.ts` (oleadas, tiempos, recompensas), `chapters/survival.ts`, `level.ts` (barricada reforzada y golpes por barricada), `supplies.ts` (`rarityOf`) |
| `art` | `painters/survival.ts` (barricada en tres estados, silueta del jefe), `survivalArt.ts` |
| `game` | `modes/SurvivalMode.ts` (ambiente de la horda, avisos), `modes/BossIntro.ts`, `systems/WaveSystem.ts`, `hud/WaveHud.ts`, `debug/gameHooks.ts` (sacado de `GameScene`, que volvía a pasar de 400 líneas) |

Cambios en lo existente: `DayNight` admite luz de emergencia y apagón; `AudioDirector`, peligro y silencio; las alarmas se pueden apagar (`armed`); las barricadas tienen golpes propios, estados de deterioro y límite de golpes por segundo; el contador de bajas aparta la calavera cuando pasa de 99.

## 7. Fallos encontrados y corregidos

- **La horda tardaba 20 s en verse:** aparecía en los extremos del nivel, a 600 px. Ahora entra justo fuera de la pantalla.
- **Zombis atascados:** al quitarles la capacidad de trepar para que golpeasen las barricadas, se quedaban parados ante coches y bidones. Ahora trepan los obstáculos normales y solo dejan de saltar las barricadas.
- **Barricadas de papel:** 38 zombis amontonados las tiraban en 6 s. Límite de golpes por barricada y 60 de aguante.
- **Bajón a 39–47 fps** con 70 atacando: era el audio (un gruñido por zombi). Voces limitadas: de nuevo 60 fps.
- **Bajón al empezar la horda** por crear decenas de objetos a la vez: precalentado.
- El rótulo de zona tapaba el panel de oleadas; el contador de bajas de tres cifras pisaba la calavera; la silueta del jefe apenas se distinguía y quedaba bajo el rótulo (ahora tiene contorno iluminado y está a un lado).
- Las pruebas unitarias no cargaban un módulo que arrastraba Phaser: `rewardLoot` y `rarityOf` pasaron a `content`.

## 8. Pruebas

- **Unitarias (201, 11 nuevas en `tests/unit/waves.test.ts`):** la dificultad crece como pide el encargo (tipos por oleada, totales, tope, grupos, horda mayor que todo lo anterior y de al menos 150); recompensas y descansos; arma de la recompensa; cola (cuentas, duros al final, reproducible); partida simulada completa en orden (aviso, combate, descanso… alarma, horda, jefe, fin) con todos los enemigos y sin pasar nunca del tope; tiempos de aviso, descanso, alarma y jefe; horda repartida por igual entre los dos lados y en grupos de 5; progreso y salto de oleada; escenario y arte.
- **Navegador (`tests/e2e/waves.spec.ts`, 5 nuevas):** oleada 1 completa (aviso, enemigos que llegan de fuera de la pantalla, contador, bajas, recompensa con escopeta en el refugio, descanso y oleada 2); horda (alarma, luz roja, sirena, precalentado, dos frentes, reutilización, ataque a las dos barricadas); jefe y pantalla final, y R vuelve a empezar; reintento tras morir; **estrés de 150 zombis** (media < 8 ms y p95 < 16,7 ms por fotograma).

## 9. Lo que no está comprobado

- **La batería completa de navegador no está confirmada.** Las 5 pruebas nuevas pasaron ejecutadas solas, pero en la pasada completa (77 pruebas) fallaron 12, casi todas por tiempo agotado, con el equipo sin memoria: tardó 24 min en vez de 5, y el sistema terminó cerrando el servidor de desarrollo. Hay que repetirla con memoria libre. Las capturas `fase4-*` tampoco se han regenerado por la misma razón.

- **El equilibrio con un jugador de verdad:** las pruebas matan a los enemigos con una orden de depuración. Falta jugarlo para ajustar cuántos, qué tan rápido y las recompensas.
- **El sonido** de la horda (sirenas, muchos gruñidos a la vez) no lo he escuchado.
- El rendimiento se ha medido solo en este equipo y con Edge.
- El modo no tiene todavía entrada desde un menú (no hay menú principal; es de la Fase 5 del plan). Se abre por la URL.
