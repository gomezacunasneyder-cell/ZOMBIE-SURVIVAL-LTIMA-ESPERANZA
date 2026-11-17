# 0009 · Fase 6: EL DEVORADOR, jefe final

Fecha: 2026-11-17 · Estado: **terminada, pendiente de aprobación**

El encargo se llamaba «Fase 6: jefe final — EL DEVORADOR» y corresponde a la parte del jefe de la **Fase 6** del plan. El usuario pidió saltar a ella sin hacer antes la Fase 5 (campaña). Por eso el combate se juega en el refugio del **modo supervivencia**: al caer la horda final, o directamente con **`?modo=jefe`**. El capítulo 5 (laboratorio de «Origen») queda para cuando exista la campaña; el jefe está hecho para poder llevarlo allí sin cambios.

Capturas: `docs/capturas/fase6-*.png`, generadas con `node scripts/capturar-jefe.mjs` (también con `npm run capturas`).

## 1. Cómo se juega

- **`?modo=jefe`**: el refugio de noche, directamente contra el jefe, con las cuatro armas básicas, 2 granadas y 2 molotov.
- **`?modo=oleadas`**: las cinco oleadas; al caer el último enemigo de la horda empieza la presentación. La partida ya no termina sola: **termina al vencerlo**.

## 2. Presentación (11 s)

| Momento | Qué pasa |
|---|---|
| 0 s | «LA HORDA HA CAÍDO · SILENCIO...». La música se apaga y **la pantalla se oscurece** (velo oscuro y apagón de farolas) |
| 0,6 s | Llegan seis rezagados por los dos lados |
| 3 s | **Los zombis huyen** hacia fuera, saltando lo que les corta el paso, entre chillidos: «HUYEN... ALGO LES DA MIEDO». No cuentan como bajas |
| 2,5–8 s | **El suelo tiembla** cada vez más |
| 4,5 s | Columna de humo y polvo en el lado contrario a Alex; gruñido |
| 6 s | **Surge del humo**: sale caminando hacia Alex, de negro a su color |
| 8,2 s | Ruge, la pantalla se sacude, vuelve algo de luz: **«EL DEVORADOR · SUJETO 7 - VIRUS Z-13»** y aparece su barra de vida |
| 11 s | Empieza el combate. Al poco, Cóndor 7 deja una caja con munición y un botiquín junto a Alex |

Durante la presentación y el final **Alex no se controla**, y la cámara encuadra a los dos.

## 3. El combate

`src/core/boss/DevourerBrain.ts` (reglas, sin Phaser), `src/content/boss.ts` (equilibrio) y, en el juego, `entities/Devourer.ts`, `systems/BossHazards.ts` y `modes/BossFight.ts`.

**4200 de vida**, barra propia arriba en el centro con las marcas del 50 % y del 25 %.

| Ataque | Se ve venir | Qué hace | Cómo se esquiva |
|---|---|---|---|
| **Golpe contra el suelo** | Alza los dos brazos (0,95 s) | Dos **ondas expansivas** de polvo y piedras a ras de suelo, hacia los dos lados (20 de daño) | Saltando por encima |
| **Embestida** | Se agacha y tiembla (0,8 s) | Corre hacia Alex y descarga el **zarpazo** (28, empuja mucho) | Alejándose o saltando a su espalda |
| **Bilis** | Echa la cabeza atrás (0,7 s) | 3–5 gotas en parábola alrededor de Alex; las que caen dejan un **charco** que quema 2,6 s | Moviéndose; no quedarse en los charcos |
| **Invocación** | Ruge (1,1 s) | De sus heridas brotan 3–4 **infectados pequeños** (corredores y caminantes), 6 como mucho a la vez | Matándolos: sueltan piezas |
| **Destrucción de barricadas** | Brazos en alto | Si una barricada en pie le separa de Alex, la **derriba en dos mazazos** | Es la ocasión de dispararle tranquilo |
| Contacto | — | Tocarle hace 8 y empuja | No pegarse a él |

Elige el ataque según la distancia (de cerca golpea o embiste; de lejos escupe o invoca), con tiempos de espera propios y una pausa entre ataques. Cada ataque tiene **preparación y recuperación de al menos medio segundo**, también enfurecido: son las oportunidades de disparo.

**Animaciones** (en `src/art/painters/devourer.ts`, lienzo 96×112): reposo, caminar, golpe contra el suelo (4 poses), embestida (4), escupitajo (3), rugido, **daño** (respingo cada vez que pierde un 6 % de vida, y destello en cada impacto), de rodillas agotado y **muerte** (se tambalea, cae de rodillas, se derrumba y la sangre se extiende). Mide casi 4 metros: el doble que Alex. Lleva un grillete roto con su cadena y un tubo de laboratorio arrancado de la espalda.

**Voz de criatura** (`src/audio/synth/boss.ts`): rugido largo, gruñido de ataque, bramido de dolor, lamento de muerte con el golpe del cuerpo, golpe contra el suelo que retumba, escupitajo, bilis que chisporrotea y espinas que revientan el asfalto.

### Fases

| Fase | Cuándo | Qué cambia |
|---|---|---|
| 1 | Al empezar | Comportamiento normal |
| 2 | **Al 50 %** | Ruge 2,4 s (no se le puede herir) y **se enfurece**: piel más oscura, grietas que brillan, espinas más largas con la punta roja, ojos amarillos. **Un 40 % más rápido**, ataca antes y más seguido, más bilis, **+20 % de daño**. Luz de emergencia roja que late. Cóndor 7 manda munición, un botiquín y dos granadas |
| 3 | **Al 25 %** | **Frenesí**: cada 15 s lanza la **erupción**: golpea el suelo una y otra vez y brotan **espinas de hueso por toda la arena**, en cuatro oleadas. Cada espina se **avisa con una grieta encendida** 0,75 s antes, y cada oleada deja **un hueco seguro** en un sitio distinto. Después queda **agotado** 4,2 s, de rodillas y con el corazón al descubierto: **recibe el doble de daño** («¡ESTÁ AGOTADO! ¡DISPARA AHORA!», la barra parpadea con «¡PUNTO DÉBIL!») |

### Difícil, pero justo

- Ningún golpe quita más del 40 % de la vida de Alex, ni enfurecido.
- La onda se puede saltar: el salto de Alex (40 px) es más del doble de su altura.
- Hay munición: las cuatro armas básicas tienen más del doble del daño necesario si se acierta la mitad, sin contar las dos cajas del combate. Aun así, un cargador de cada arma no basta para derribarle.
- Las explosiones le hacen el 55 % (su piel es como una coraza): el lanzacohetes no lo resuelve de un tiro.
- El fuego (lanzallamas y molotov) le hace arder: 10 por segundo durante 2 s.
- Las balas no atraviesan las barricadas: mientras derriba una, hay que apuntarle por encima, al pecho.

## 4. El final

| Momento | Qué pasa |
|---|---|
| Muere | Lamento, franjas de cine, sangre y escombros en tres golpes; **se derrumba** contra el asfalto (gran sacudida). Sus engendros huyen. La cámara se centra en él |
| +5 s | **VICTORIA · EL DEVORADOR HA CAÍDO** |
| +8,5 s | Con el juego detenido: pantalla de **VICTORIA** con bajas y tiempo, y «ENTRE SUS RESTOS HAY UNA CINTA MILITAR...» |
| | **Grabación militar** (`scenes/EpilogueScene.ts`): monitor viejo con líneas de barrido, piloto «REC» y contador de cinta; la transcripción se escribe letra a letra con el siseo de la cinta. Intro, Espacio o un clic adelantan |
| Después | Silencio y oscuridad. Alex está solo. **Un chasquido detrás de él**: se da la vuelta; otro chasquido, más cerca |
| Fin | Negro: **CONTINUARÁ...** · «ZOMBIE SURVIVAL: ÚLTIMA ESPERANZA - PARTE 2» · R para jugar de nuevo |

**Lo que revela la grabación** (Dra. Halversen, Proyecto Origen, laboratorio 4, nivel −3): el Z-13 no fue un accidente, se creó en Origen para hacer soldados sin dolor ni miedo; la cura existe pero está incompleta y la probaron en el Sujeto 7, que no dejó de crecer y se alimenta de los infectados (EL DEVORADOR); la contención falló y el virus salió por la ventilación; el mando lo sabía y selló la ciudad con todos dentro. Y lo que abre la segunda parte: **el Sujeto 7 no era el único**, hay otras instalaciones. El chasquido del final es el de un Chasqueador… o de algo peor.

Todos los textos están en `src/content/boss.ts`.

## 5. Arquitectura

| Capa | Archivos |
|---|---|
| `core` (sin Phaser) | `boss/DevourerBrain.ts` (estados, fases, elección de ataques, tiempos, daño), `boss/eruption.ts` (reparto de espinas con huecos seguros) |
| `content` | `boss.ts`: vida, fases, ataques, daños, suministros, textos y la grabación |
| `art` | `painters/devourer.ts` (cuerpo por partes desde una pose, normal y enfurecido), `painters/bossFx.ts`, `devourerArt.ts` |
| `audio` | `synth/boss.ts` |
| `game` | `entities/Devourer.ts`, `systems/BossHazards.ts`, `modes/BossFight.ts` (combate), `modes/BossCinema.ts` (presentación y final), `scenes/EpilogueScene.ts`, `hud/BossBar.ts` |

Cambios en lo existente:

- `WaveRun`: la fase del jefe ya no acaba por tiempo, sino con `defeatBoss()`. Se añade `skipToBoss()` para `?modo=jefe`.
- `ZombieDirector.scatter()` y `Zombie.fleeing`: huida sin cerebro, saltando obstáculos. Los que salen de la pantalla vuelven al depósito.
- `GunfireSystem.wireTarget()`: las balas, llamas y cohetes alcanzan a otro objetivo. `CombatSystem.blastTargets` reparte las explosiones y `ThrowableSystem.onFireTick` el fuego del molotov.
- La reacción a los golpes de los zombis pasa de `GameScene` a `CombatSystem.directorEvents()`, para no superar las 400 líneas.
- El atlas pasa de 512 a **1024 px de ancho**: con los 64 fotogramas del jefe, a 512 superaba los 2048 px de alto que admite cualquier GPU.
- Se retira la silueta del jefe tras el muro (`BossIntro`, `paintDevourer`): la sustituye la presentación nueva.

## 6. Fallos encontrados y corregidos

- **Las grietas de aviso de las espinas se duplicaban en cada fotograma** tras brotar la espina: cientos de brillos naranjas que no se borraban, ni siquiera al morir el jefe. Ahora cada espina se avisa una sola vez.
- **La pantalla de VICTORIA se saltaba al instante:** el reloj de una escena recién lanzada vale 0 hasta su primer fotograma. Ahora la escena empieza a contar en ese fotograma.
- **El chasquido y el «CONTINUARÁ» llegaban de golpe** al cerrar la grabación: el juego estuvo detenido, pero su reloj siguió corriendo. La escena final empieza a contar al reanudarse.
- **Los rezagados no huían:** chocaban con los bidones. Ahora los saltan.
- Al levantar los brazos para el golpe, **la mano se salía del lienzo:** se pasó de 96×96 a 96×112. La cabeza parecía una caja: se redibujó con cresta, hocico afilado y fauces.
- Durante la presentación **el jefe quedaba fuera de pantalla:** la cámara encuadra a los dos.
- El mensaje de Cóndor 7 tapaba el nombre del jefe: la caja llega cuando ya se ha leído.
- La barra de vida tapaba los contadores de granadas: se bajó.
- El aviso «¡HAN ROTO LA BARRICADA! ENTRAN POR LA DERECHA» de las oleadas se solapaba con el del jefe: contra el jefe solo salen los suyos.
- Tras la presentación el jefe tardaba 2,6 s en moverse: ahora 0,6 s.

## 7. Pruebas

- **Unitarias (236, 20 nuevas en `tests/unit/boss.test.ts`):** aparición invulnerable; fase 2 al 50 % y fase 3 al 25 %; invulnerable mientras se enfurece; erupción y agotamiento con daño doble y recuperación; agonía y muerte; respingo de daño; usa sus cuatro ataques según la distancia; preparación y recuperación de al menos medio segundo; golpe, embestida y escupitajo producen su efecto; tope de invocaciones; derriba la barricada que le separa de Alex; combate reproducible con la misma semilla; la erupción siempre deja un hueco seguro (40 semillas); justicia (ningún golpe mata, la onda se puede saltar, munición suficiente pero no sobrada); arte (todas las animaciones en los dos aspectos, nada se sale del lienzo, apoyado en el suelo); sonidos; textos escribibles con la fuente y que caben en pantalla; la grabación cuenta el origen y deja abierta la segunda parte. `waves.test.ts`: la partida no termina hasta vencer al jefe.
- **Navegador (`tests/e2e/boss.spec.ts`, 4 nuevas):** presentación completa (rezagados que huyen sin contar como bajas, Alex sin control, silencio, nombre, barra, caja de Cóndor 7); el fusil le hiere y él derriba la barricada y hace daño a Alex; fases (furia invulnerable, cambio de aspecto, caja de munición, erupción con espinas, agotado con «¡PUNTO DÉBIL!» y daño doble, espinas retiradas); final completo (agonía sin peligros activos, animación de muerte, VICTORIA, grabación con el juego detenido, Intro adelanta, Alex se da la vuelta con el chasquido, CONTINUARÁ y R vuelve a empezar). `waves.spec.ts`: de la horda al jefe y del jefe a la pantalla final.

## 8. Lo que no está comprobado

- **No he jugado el combate entero con teclado y ratón.** Las pruebas recorren cada parte, pero el daño al jefe se aplica con una orden de prueba salvo en la prueba del fusil. Falta comprobar jugando que es **difícil pero justo**: vida, daños y tiempos están en `src/content/boss.ts` para ajustarlos.
- **Sonido:** las nueve recetas nuevas suenan y no saturan (prueba automática), pero **no las he escuchado**.
- No hay una animación propia de giro de Alex en el chasquido: cambia de lado de golpe, como al apuntar.
- El combate se juega en el refugio del modo supervivencia, no en el laboratorio del capítulo 5, que no existe todavía.
- Solo se ha probado en el Edge del sistema.
