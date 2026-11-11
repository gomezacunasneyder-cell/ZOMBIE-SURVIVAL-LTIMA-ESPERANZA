# 01 · Documento de diseño (GDD)

**ZOMBIE SURVIVAL: ÚLTIMA ESPERANZA** · versión 0.1 (propuesta para aprobación)

Los valores numéricos son puntos de partida para ajustar jugando, no cifras cerradas.

## 1. Visión

Shooter de supervivencia 2D de vista lateral en pixel art. Alex cruza de noche una ciudad destruida por el Virus Z-13, guiado por radio desde el helicóptero militar Cóndor 7, para alcanzar una base donde supuestamente hay una cura.

**Pilares de diseño**

1. **Cada bala cuenta.** Munición escasa y recarga manual; disparar es una decisión.
2. **El ruido mata.** Disparar, correr y las explosiones atraen enemigos. El silencio es un recurso.
3. **La noche es el escenario.** La luz (faros, farolas, fuego, fogonazos) guía al jugador y construye la atmósfera.
4. **De la soledad a la horda.** La intensidad crece capítulo a capítulo: de pocos zombis a multitudes y a un jefe con fases.

**Plataforma:** navegador de escritorio (teclado y ratón). Mando y móvil quedan fuera del alcance inicial, pero la entrada se abstrae para añadirlos después.

**Duración objetivo de la campaña:** 60–90 minutos, más un modo de oleadas rejugable.

## 2. Bucle de juego

- **Momento a momento:** avanzar, escuchar, apuntar, disparar, recargar, recoger.
- **Por nivel:** explorar el tramo, gestionar munición y botiquines, resistir un evento de oleada, pedir o alcanzar el suministro de Cóndor 7, llegar al refugio.
- **Entre capítulos:** gastar piezas en mejoras en el banco de trabajo y guardar.

## 3. Controles

| Acción | Teclado y ratón |
|---|---|
| Moverse | A / D o flechas |
| Saltar | W, flecha arriba o Espacio |
| Agacharse y caminar en silencio | S o Ctrl |
| Correr (hace ruido) | Mayús |
| Apuntar | Ratón (arco limitado hacia donde mira Alex) |
| Disparar | Clic izquierdo |
| Recargar | R |
| Cambiar de arma | 1–4 o rueda del ratón |
| Usar botiquín | Q |
| Interactuar | E |
| Inventario | Tab |
| Pausa | Esc |

Las teclas se definen en un mapa de acciones reasignable, no directamente en el código de juego.

## 4. Protagonista: Alex

- **Vida:** 100 puntos. Sin regeneración; solo botiquines.
- **Movimiento:** caminar, correr, salto de altura variable (soltar la tecla corta el salto), tolerancia de borde («coyote time») y memoria de pulsación de salto para que el control se sienta justo.
- **Invulnerabilidad breve** tras recibir daño, con parpadeo.
- **Estados:** quieto, caminar, correr, agachado, saltar, caer, disparar, recargar, herido, muerto.

## 5. Armas y munición

| Arma | Papel | Cargador | Ruido | Se obtiene |
|---|---|---|---|---|
| Cuchillo | Cuerpo a cuerpo, silencioso | — | Mínimo | Inicio |
| Pistola | Fiable, munición común | 12 | Medio | Inicio |
| Escopeta | Siete perdigones en abanico a corta distancia, empuja | 6 | Alto | Inicio |
| Fusil de asalto | Automático, equilibrado y de largo alcance | 30 | Alto | Inicio |
| Ametralladora | Automática, cadencia muy alta, recarga lenta | 60 | Muy alto | Inicio |
| Granada / cóctel molotov | Área; el fuego ilumina y hace ruido | Consumible | Muy alto | Suministros |

- La munición es propia de cada arma (9 mm, cartuchos, 5.56, cinta 7.62) y se guarda en reserva. Valores exactos en `src/content/weapons.ts`.
- **Recarga manual** con duración por arma. Se interrumpe al cambiar de arma o al recibir un golpe fuerte. Recargar con balas en el cargador no las pierde.
- Las armas de fuego disparan proyectiles rápidos con alcance y caída de daño por distancia; granadas y proyectiles del jefe son objetos físicos.
- Cada arma está definida por datos (daño, cadencia, dispersión, retroceso, ruido, tiempo de recarga), no por código propio.

## 6. Inventario y objetos

- 4 ranuras de arma, reserva de munición por tipo, hasta 3 botiquines, consumibles arrojadizos y objetos de misión.
- **Botiquín:** cura 50 puntos tras un uso de 1,5 s que se interrumpe al recibir daño.
- **Piezas:** moneda para mejoras; la sueltan enemigos y contenedores.
- **Cajas de suministro:** las lanza Cóndor 7 en paracaídas en puntos señalados con bengala. Contienen munición, botiquines y, a veces, un arma. Su caída hace ruido y atrae zombis: recogerla es un riesgo calculado.

## 7. Enemigos

| Enemigo | Percepción | Comportamiento | Aparece |
|---|---|---|---|
| **Caminante** | Vista corta, oído normal | Lento, numeroso, ataca al contacto | Capítulo 1 |
| **Corredor** | Vista larga | Rápido, frágil, salta obstáculos bajos | Capítulo 2 |
| **Eco** | **Ciego.** Oído muy agudo | Patrulla emitiendo chasquidos; va hacia el último ruido; golpe muy dañino. Diseño visual propio | Capítulo 3 |
| **Blindado** | Vista corta | Exmilitar con casco y chaleco; resiste disparos frontales | Capítulo 4 |
| **EL DEVORADOR** | — | Jefe final con tres fases | Capítulo 5 |

**Inteligencia artificial.** Cada enemigo usa una máquina de estados: reposo o patrulla → investigar (ha oído algo) → perseguir → atacar → aturdido → muerto. Los tipos se diferencian por datos y por sus sensores, no por código duplicado.

**Sistema de ruido.** Toda acción ruidosa emite un evento con posición y radio (pasos al correr, disparos, explosiones, cajas al caer). Cada enemigo dentro del radio, según su oído, pasa a investigar ese punto. El HUD muestra el ruido que genera el jugador.

**EL DEVORADOR (propuesta de fases)**

1. **Contención rota:** embestidas y golpes de área; puntos débiles visibles.
2. **Llamada:** convoca oleadas de caminantes y lanza escombros; el escenario pierde luz.
3. **Frenesí:** más rápido, ataques encadenados; solo es vulnerable tras fallar una embestida.

## 8. Oleadas y hordas

- Un **director de oleadas** lee definiciones en datos (qué enemigos, cuántos, por dónde, con qué ritmo) y controla el presupuesto de enemigos vivos.
- En campaña las oleadas son eventos puntuales (defender una posición, esperar a Cóndor 7).
- El **modo Oleadas**, desbloqueado al terminar el capítulo 2, reutiliza el mismo director con dificultad creciente.
- Objetivo técnico para las grandes hordas: 150 zombis activos a 60 fps (ver arquitectura, rendimiento).

## 9. Historia y capítulos

**Premisa.** El Virus Z-13 arrasó la ciudad. Alex sobrevive solo hasta que una radio estropeada capta a la capitana Vega, piloto de Cóndor 7: hay una base, «Origen», y dicen que allí existe una cura.

| # | Capítulo | Escenario | Objetivo | Novedad jugable | Clímax |
|---|---|---|---|---|---|
| 1 | La ciudad muerta | Avenida comercial en ruinas, coches abandonados | Llegar a la azotea con la antena | Movimiento, pistola, caminantes, primera transmisión | Primera caja de suministros bajo ataque |
| 2 | El último suministro | Zona de almacenes y supermercado saqueado | Recuperar medicinas y combustible para Cóndor 7 | Escopeta, corredores, botiquines, banco de trabajo | Defensa del punto de recogida |
| 3 | Los Ecos | Túneles de metro a oscuras | Cruzar sin despertar el nido | Sigilo, sistema de ruido, Ecos, linterna | Huida con el nido alertado |
| 4 | La última horda | Puente y puesto de control militar | Resistir hasta abrir el portón de la base | Fusil, blindados, barricadas, gran horda | Horda masiva con apoyo aéreo de Cóndor 7 |
| 5 | El origen | Laboratorio subterráneo de la base | Encontrar la cura | Revelación y jefe final | EL DEVORADOR |

**Giro del capítulo 5.** «Origen» no es solo donde se busca la cura: es donde nació el Z-13. La cura existe, pero es incompleta, y EL DEVORADOR es el resultado de probarla. El final se concreta en la fase de campaña.

La narración se cuenta con transmisiones de radio (retrato y texto), notas encontradas y viñetas breves entre capítulos. Todo el texto vive en archivos de datos en español, preparados para traducir.

## 10. Progresión, mejoras y guardado

- **Mejoras** en el banco de trabajo, pagadas con piezas: cargador ampliado, recarga rápida, silenciador (reduce el radio de ruido), daño, capacidad de botiquines y vida máxima.
- **Guardado** automático en puntos de control y al terminar capítulo; 3 ranuras. Se guarda capítulo, punto de control, inventario, mejoras, ajustes y estadísticas.
- **Dificultad:** Normal y Superviviente (menos munición, enemigos con mejor oído).

## 11. Dirección artística

- **Resolución interna: 480 × 270 px**, escalada a pantalla (×4 da 1920 × 1080 exactos). Píxeles nítidos, sin suavizado.
- El detalle completo (lectura de la imagen de referencia, paleta, proporciones e inventario de sprites) está en [05-direccion-artistica.md](05-direccion-artistica.md).
- **Paleta única** de 56 colores tomada de la referencia: cielo rosa polvoriento, hormigón azul grisáceo, asfalto violáceo, verdes militares e infectados, y acentos cálidos (naranja, amarillo, rojo) reservados a luz, fuego, sangre y elementos interactivos.
- **Del atardecer a la noche:** el capítulo 1 usa el atardecer de la referencia y cada capítulo oscurece el ambiente hasta la noche cerrada.
- **Personajes:** Alex y zombis en lienzo de 32 × 32 px; EL DEVORADOR en 96 × 96 px.
- **Animaciones mínimas:**
  - Alex: reposo (4 fotogramas), correr (8), saltar/caer (3), disparar (3), recargar (6), herido (2), morir (6).
  - Zombis: caminar (8), correr (6), atacar (5), golpeado (2), morir (6).
- **Escenario:** 4–5 capas con desplazamiento de paralaje (cielo, silueta de ciudad, edificios, plano de juego, primer plano), más niebla y partículas de ceniza.
- **Iluminación nocturna:** capa de oscuridad sobre la escena con focos de luz recortados (faros, farolas parpadeantes, ventanas, fuego, linterna y fogonazos de disparo).
- **Efectos:** fogonazos, casquillos, sangre, chispas, explosiones por fotogramas con sacudida de cámara y destello.
- **Interfaz:** HUD diegético y compacto con tipografía de píxel propia: vida, arma con cargador y reserva, botiquines, medidor de ruido, objetivo actual y ventana de radio. Menús con el mismo lenguaje visual; nada de controles genéricos del navegador.
- **Origen de los recursos:** 100 % generados por código. Ningún asset descargado.

## 12. Sonido

- Efectos sintetizados por código con Web Audio: disparos por arma, recarga, pasos, gemidos, chasquidos, explosiones, rotor del helicóptero, interferencia de radio.
- Música ambiental generativa por capas que suben con la tensión (calma → alerta → combate).
- El sonido es jugable: los chasquidos delatan la posición de los Ecos.

## 13. Decisiones confirmadas (2026-11-10)

| Decisión | Resultado |
|---|---|
| Motor | Phaser 3.90.0 con TypeScript y Vite, versiones exactas fijadas |
| Apuntado | Con ratón, en 7 ángulos dibujados: arriba, diagonales y horizontal (90°, 60°, 30°, 0°, −30°, −60°, −90°) |
| Enemigo ciego | Se llama **LOS ECOS** dentro del juego. Conserva la mecánica de detección por sonido y tendrá diseño visual propio |
| Modo Oleadas | Incluido desde la primera versión |
| Idioma | Español, con los textos externalizados |
