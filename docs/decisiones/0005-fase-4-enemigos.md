# 0005 · Fase 4 (primera parte): enemigos e inteligencia artificial

Fecha: 2026-11-11 · Estado: **terminada, pendiente de aprobación**

El encargo se llamaba «Fase 3: sistema de enemigos e inteligencia artificial»; en el plan del proyecto corresponde a la **Fase 4** (enemigos y hordas). Queda fuera, para una entrega posterior: el director de oleadas completo, el modo Oleadas y la prueba de estrés de 150 zombis.

## 1. Los cuatro enemigos

| | Caminante | Corredor | Chasqueador | Mutante |
|---|---|---|---|---|
| Vida | 100 | 60 | 190 | 1100 |
| Velocidad (Alex: 26 sigilo, 54 andar, 104 correr) | 30 | 92 | 66 | 24 |
| Golpe | 15 | 7 × 2 seguidos | 40 (agarre) | 40 (mazazo) |
| Preparación del golpe | 340 ms | 150 ms | 420 ms | 760 ms |
| Percepción | Vista 170 px, oído normal | Vista 230 px, oído fino | **Ciego**, oído 1,7×, oye a otras criaturas | Vista 210 px, oído débil |
| Comportamiento propio | Lento, acude a los disparos, trepa obstáculos | **Rodea**: salta por encima de Alex y ataca por la espalda | **Investiga** el ruido, **chasquea** para escuchar, carga si Alex hace ruido cerca | **Rompe barricadas**, no se aturde con balas, sacude la pantalla |
| Aspecto | Cuatro variantes de ropa (Fase 1) | Delgado, volcado hacia delante, ojos rojos; calvo o con capucha | Cabeza reventada por un hongo en placas, sin cara, encogido, manos en garra | Casi el doble que Alex, hombros enormes, pústulas, espolones de hueso |

Cada uno tiene animaciones de andar, atacar, recibir golpe y morir; el corredor añade el **salto para rodear** y el Chasqueador la **animación de chasquidos** (cabeza echada atrás y sacudida) con su sonido de clics de garganta. Muertes propias: el Chasqueador deja un charco de esporas.

**Escapar de cada uno es distinto:** del caminante se escapa andando, del corredor solo corriendo, del Chasqueador en silencio y del mutante incluso en sigilo.

## 2. Inteligencia artificial

Una sola máquina de estados (`src/core/ai/EnemyBrain.ts`, sin Phaser) hecha de comportamientos reutilizables que cada enemigo activa con sus datos (`src/content/enemies.ts`):

- **Detección**: vista (alcance y altura; al perseguir ve un 40 % más lejos), oído (campo de ruido) y contacto (el Chasqueador).
- **Estados**: deambular → investigar → escuchar → perseguir → rodear → preparar golpe → recuperarse → aturdido → romper → muerto.
- **Memoria**: si deja de percibir a Alex, tras un tiempo va a su última posición conocida y mira alrededor. El ciego no sigue a Alex, sigue al **último ruido**: si Alex se aleja en silencio tras disparar, el Chasqueador llega a un sitio vacío.
- **Aplomo**: daño mínimo para aturdir. Las balas no aturden al mutante; los perdigones sueltos no aturden al Chasqueador.
- **Reacción al impacto**: al recibir un disparo se gira hacia el tirador.

## 3. Ruido y sigilo

- Campo de ruido compartido (`src/core/ai/noise.ts`): cada suceso sonoro tiene posición, radio y tipo. Disparos (radio propio de cada arma), explosiones, **correr** (150 px), andar (55 px), impactos de bala en el escenario (70 px) y **gruñidos de otras criaturas** (los oye el Chasqueador).
- **Sigilo**: mantener **S o Ctrl** camina en silencio (26 px/s). Estar quieto tampoco hace ruido.
- **Medidor de ruido** en el HUD (bajo la vida) y el texto «SIGILO».
- Distracción: un disparo contra una pared lejana hace ruido allí. El disparo también suena donde está Alex, así que solo funciona si el Chasqueador está más cerca del impacto.

## 4. Barricadas y colisiones

Las barreras, sacos terreros y cajas son **barricadas**: el mutante las golpea (tres golpes, con astillas, temblor y sonido) y al romperse desaparece su colisión. Los demás las saltan. En el capítulo 1 el mutante espera tras la barricada del campamento. Los enemigos chocan con Alex (no se atraviesan) y con el escenario.

## 5. Nivel y dificultad

El capítulo 1 sube de dificultad al avanzar: caminantes en la avenida, el primer corredor en el puesto de control, Chasqueadores en la barricada y el mutante al final. Los refuerzos que llegan por los bordes dependen de la zona.

## 6. Fallos encontrados y corregidos

1. **A quemarropa, las armas largas fallaban**: la boca del cañón (20 px) quedaba por delante de un enemigo pegado a Alex y la bala salía detrás de él. Ahora el tramo entre hombro y boca se comprueba al disparar.
2. **La caja de colisión del mutante estaba desplazada 8 px**: sus datos decían que el lienzo medía 48 px y el dibujo mide 64. Lo detectó una prueba que compara datos y dibujo.
3. **El primer mutante parecía un bloque**: torso rectangular y brazos fundidos con el cuerpo. Rediseñado con silueta en V, cabeza visible y brazos más oscuros.
4. **Las balas perdían alcance con el equipo cargado** (fallo introducido en la Fase 3): caducaban por tiempo y, cuando la física va por detrás del reloj, la bala de pistola desaparecía a unos 50 px. Ahora el alcance se mide en distancia recorrida.
5. Una prueba antigua esperaba tiempo real entre disparos y fallaba con la máquina cargada; ahora espera tiempo de juego.

## 7. Pruebas

- 25 pruebas unitarias nuevas (163 en total): aspecto y animaciones de cada tipo, tamaños, que no compartan comportamientos, equilibrio (velocidades frente a Alex, disparos para matar con cada arma, daño máximo por ataque), ruido (alcance, sigilo, filtro de criaturas, olvido) y la IA de cada enemigo (rodeo, combo, ceguera, investigación y chasquidos, carga hacia el ruido y no hacia Alex, aplomo del mutante, romper barricadas).
- 7 pruebas de navegador nuevas (64 en total): los cuatro tipos con su aspecto; el Chasqueador no oye a Alex en sigilo y sí cuando corre; acude a una explosión, chasquea al llegar y no va hacia Alex; el corredor llega antes y golpea; el mutante rompe la barricada y no se aturde; daño exacto por arma y escopetazo a quemarropa; medidor de ruido.

## 8. Lo que no está comprobado

- **Los sonidos nuevos no se han escuchado** (chasquidos, chillido, rugido, mazazo, barricada).
- **El rodeo del corredor** está probado en las reglas, no en el navegador: depende del azar y de la posición, y una prueba fiable exigiría hacer invulnerable a Alex.
- **Los enemigos no chocan entre sí**: pueden solaparse en grupo. Se deja así a propósito (las hordas no se atascan), pero puede verse raro con el mutante.
- **Equilibrio** razonado con números, no jugando partidas largas.
- **Rendimiento con muchos enemigos**: es la prueba de estrés que queda para la segunda parte de la fase.
- **Solo Edge.** **Sin commits.**
