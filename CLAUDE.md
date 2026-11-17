# ZOMBIE SURVIVAL: ÚLTIMA ESPERANZA

Shooter de supervivencia 2D de desplazamiento lateral en pixel art. Phaser 3.90.0 + TypeScript 7 + Vite 8.

## Forma de trabajar (acordada con el usuario)

- **Todo en español**: conversación, documentación, comentarios del código y textos del juego.
- **Desarrollo por fases** según `docs/03-plan-y-riesgos.md`. Al terminar una fase: mostrar capturas, explicar cómo probarla y qué falta, y **esperar aprobación** antes de empezar la siguiente.
- **No hacer commits ni subir nada a GitHub sin autorización expresa.**
- No declarar una mecánica terminada sin haberla comprobado (pruebas automáticas y, si es visual, capturas).
- Cada fase deja un registro en `docs/decisiones/NNNN-fase-N.md` con decisiones, fallos corregidos y lo que queda sin comprobar.

## Reglas técnicas

- Versiones fijadas de forma exacta (`.npmrc` con `save-exact`). No actualizar Phaser, TypeScript ni Vite sin pedirlo.
- Arquitectura por capas (ver `docs/02-arquitectura.md`): `src/core`, `src/content`, `src/art`, `src/audio` y `src/platform` **no importan Phaser**; solo `src/game` lo usa. Lo vigila `tests/unit/architecture.test.ts`, que también limita cada archivo a 400 líneas.
- Todo el arte y el sonido se generan por código. No descargar ni reutilizar recursos con licencia desconocida. Las imágenes de referencia del usuario son guía de estilo: no se recortan ni se usan como fondo.
- Paleta única en `src/art/palette.ts`; ningún color fuera de ella.
- Zoom por píxeles físicos enteros; el pixel art nunca se rota salvo giros de 90°.
- Alex tiene dos aspectos (`src/art/skins.ts`): `detallado` (32×40, predeterminado) y `clasico`. Cambiar el dibujo no debe tocar la caja de colisión (10×24).

## Órdenes

| Orden | Uso |
|---|---|
| `npm run dev` | Juego en http://localhost:5173 |
| `npm run check` | Tipos + pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas en navegador (Playwright con el Edge del sistema) |
| `npm run capturas` | Regenera `docs/capturas/` (necesita `npm run dev` en marcha) |
| `npm run build` | Compilación de producción |

Las pruebas de navegador usan `window.__ZS__` (solo en desarrollo). Esperar siempre por el **tiempo del juego** (`state().time`), no por tiempo real: con la máquina cargada el juego va más lento y las pausas fijas fallan. Las funciones que se pasan a `until()` se envían al navegador como texto y no pueden usar variables de la prueba.

Parámetros de URL: `?test=1` (sin enemigos ni lanzamientos automáticos), `&hora=noche|atardecer|0.5`, `&skin=clasico`, `&arsenal=basico|completo` (por defecto solo la pistola; `openGame` de las pruebas añade `basico`), `&semilla=N` (partida reproducible), `&suministros=ya` (Cóndor 7 llega al empezar), `?modo=oleadas` (modo supervivencia) con `&oleada=N` (empieza en la oleada N; 5 = horda), `?scene=gallery`, `?scene=compare`, `?scene=arsenal` (dos páginas: teclas 1 y 2), `?scene=bestiario`.

Añadir un arma: datos en `src/content/weapons.ts`, dibujo en `src/art/painters/guns.ts` (o `heavyGuns.ts`), voz en `src/audio/synth/gunshot.ts` y su peso en `LOOT_TABLE` de `src/content/supplies.ts` (las pruebas avisan si falta alguna pieza).

## Estado

Fases 0, 1 y 2 completadas y aprobadas. Fase 3: arsenal aprobado y subido; Cóndor 7, cajas de suministros, botiquines, lanzallamas y lanzacohetes terminados y **pendientes de aprobación** (`docs/decisiones/0006-fase-3-suministros.md`); faltan arrojadizos, inventario (Tab) y piezas. Fase 4 terminada y **pendiente de aprobación**: enemigos e IA (`docs/decisiones/0005-fase-4-enemigos.md`) y modo supervivencia con oleadas, horda final, llegada del jefe y prueba de estrés (`docs/decisiones/0007-fase-4-oleadas.md`). El combate contra EL DEVORADOR es la Fase 6. El usuario numera sus encargos con una fase menos que el plan (su «Fase 3» es la Fase 4 del plan).

Equilibrio de los suministros (calendario, vuelo, caída, botín por rarezas, emboscada): todo en `src/content/supplies.ts`; reglas puras en `src/core/supply/`.

Oleadas y recompensas: `src/content/waves.ts`; reglas puras en `src/core/waves/WaveRun.ts`. Los enemigos se reutilizan (depósito en `ZombieDirector`): no destruir zombis a mano, salvo `clear()`.

Añadir un enemigo: datos en `src/content/enemies.ts` (activa comportamientos de `src/core/ai/EnemyBrain.ts`) y animaciones en `src/art/enemyArt.ts`.
