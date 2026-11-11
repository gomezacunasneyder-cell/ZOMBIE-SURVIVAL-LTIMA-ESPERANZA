# 03 · Plan de desarrollo y riesgos técnicos

## 1. Plan por fases

Cada fase termina con algo que se puede ejecutar y revisar, y no empieza sin tu aprobación de la anterior. Ninguna fase se da por cerrada si fallan las pruebas automáticas.

### Fase 0 · Cimientos — COMPLETADA y aprobada

Resultados en [decisiones/0001-fase-0.md](decisiones/0001-fase-0.md).

- Inicializar git, proyecto Vite + TypeScript, ESLint con las reglas de capas, Vitest y Playwright.
- Resolver las tres compatibilidades pendientes del diagnóstico (tipos de Phaser con TypeScript 7, Phaser con Vite 8, audio generado por código).
- Prueba de concepto artística: paleta, un Alex y un caminante animados, visibles en `GalleryScene`.
- **Diorama de aprobación:** una pantalla compuesta (cielo, ciudad, muro, calzada, Alex, dos zombis, un vehículo y una luz) para comparar con la imagen de referencia. Ver [05-direccion-artistica.md](05-direccion-artistica.md).

**Se entrega:** el juego arranca en el navegador con una escena vacía y la galería. **Criterio:** compila sin errores, las pruebas pasan y **apruebas el estilo visual** antes de producir más arte.

### Fase 1 · Núcleo jugable — COMPLETADA y aprobada

Resultados en [decisiones/0002-fase-1.md](decisiones/0002-fase-1.md).

- Movimiento y salto de Alex, cámara, un tramo de nivel de prueba.
- Pistola: apuntado, disparo, munición limitada, recarga manual.
- Caminante con IA básica, daño, vida y muerte del jugador.
- HUD mínimo: vida, cargador y reserva.

**Criterio:** se puede jugar un combate completo de principio a fin y el control se siente preciso.

### Fase 2 · Atmósfera — COMPLETADA y aprobada

Resultados en [decisiones/0003-fase-2.md](decisiones/0003-fase-2.md), que incluye también la integración del nuevo Alex.

- Capas de paralaje de la ciudad, iluminación nocturna, partículas, sacudida de cámara.
- Efectos de sonido sintetizados y primera capa de música.
- Tipografía de píxel y HUD definitivo.

**Criterio:** una captura del juego ya transmite la dirección artística del GDD.

### Fase 3 · Arsenal y supervivencia

- Resto de armas, cambio de arma, arrojadizos.
- Inventario, botiquines, piezas y objetos recogibles.
- Helicóptero Cóndor 7 y cajas de suministro.

### Fase 4 · Enemigos y hordas

- Corredor, blindado y Eco.
- Sistema de ruido completo y medidor en el HUD.
- Director de oleadas, modo Oleadas y escena de estrés de rendimiento.

**Criterio:** 150 zombis activos dentro del presupuesto de rendimiento.

### Fase 5 · Campaña

- Capítulos 1 a 4 con sus escenarios, objetivos y eventos.
- Transmisiones de radio, notas y viñetas.
- Puntos de control, guardado con ranuras, menú principal, pausa y ajustes.
- Banco de trabajo y mejoras.

### Fase 6 · El origen

- Capítulo 5 y EL DEVORADOR con sus tres fases.
- Final y créditos.

### Fase 7 · Pulido y publicación

- Equilibrio de dificultad, accesibilidad (reasignar teclas, reducir sacudida y destellos, volúmenes).
- Optimización final, revisión de errores, compilación de producción y guía de despliegue.

### Dependencias entre fases

```
0 ─► 1 ─► 2 ─┬─► 3 ─┐
             └─► 4 ─┴─► 5 ─► 6 ─► 7
```

Las fases 3 y 4 son independientes entre sí y pueden intercambiar el orden.

## 2. Riesgos técnicos

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R-01 | **El pixel art generado por código no alcanza la calidad deseada.** Es el mayor riesgo del proyecto: dibujar personajes detallados con código es lento y difícil de afinar. | Alta | Alto | Prueba de concepto y aprobación de estilo en la Fase 0. Personajes por partes con poses. `GalleryScene` para iterar rápido. Plan B: el atlas admite sustituir cualquier sprite por un PNG dibujado a mano sin tocar el juego. |
| R-02 | Phaser 3 ya no evoluciona; `latest` en npm es la 4. | Cierta | Medio | Versión exacta fijada. Reglas en `core/` sin Phaser. Migración acotada a `game/`. |
| R-03 | ~~Incompatibilidad de los tipos de Phaser 3.90 con TypeScript 7, o de su empaquetado con Vite 8.~~ | — | — | **Cerrado en la Fase 0:** ambos funcionan. |
| R-04 | Caída de fotogramas con grandes hordas. | Media | Alto | Presupuesto y medidas de la arquitectura; prueba de estrés automática desde la Fase 4. |
| R-05 | La capa de iluminación resulta costosa en equipos modestos. | Media | Medio | Textura de oscuridad a resolución interna (480 × 270, muy barata). Tope de luces activas. Opción de calidad baja. |
| R-06 | ~~Píxeles deformados al escalar a tamaños de ventana no múltiplos de 480 × 270.~~ | — | — | **Cerrado en la Fase 0:** escalado por píxeles físicos enteros, probado en 5 tamaños y densidades de pantalla. |
| R-07 | El audio sintetizado suena pobre o repetitivo. | Media | Medio | Variación aleatoria de tono y volumen; capas. Plan B: grabaciones propias o recursos con licencia CC0 verificada, previa consulta. |
| R-08 | El navegador bloquea el audio hasta que el usuario interactúa. | Cierta | Bajo | El menú principal actúa como desbloqueo. |
| R-09 | Partidas guardadas incompatibles tras una actualización, o `localStorage` no disponible (modo privado). | Media | Medio | Esquema versionado con migraciones y validación. Almacenamiento en memoria como reserva, con aviso. |
| R-10 | Crecimiento del alcance: cinco capítulos, jefe, oleadas y mejoras es mucho contenido. | Alta | Alto | Fases con criterios de cierre. Contenido en datos. Primero el capítulo 1 completo y pulido; el resto reutiliza sistemas. |
| R-11 | La ruta del proyecto tiene espacios y una «Ú»; algunas herramientas fallan con rutas así en Windows. | Baja | Bajo | Si aparece algún fallo, mover a una ruta simple como `C:\dev\zombie-survival`. |
| R-12 | Pruebas en navegador inestables por depender del tiempo real. | Media | Medio | Semilla fija, ganchos de prueba solo en desarrollo, esperas por estado del juego y no por tiempo. |
| R-13 | La IA por ruido resulta injusta o ilegible para el jugador. | Media | Medio | Señales claras: medidor de ruido, ondas visibles, postura de «escucha» del Eco. Pruebas de juego tempranas en la Fase 4. |
