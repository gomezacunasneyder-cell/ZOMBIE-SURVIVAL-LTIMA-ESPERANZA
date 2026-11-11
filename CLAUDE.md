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

Parámetros de URL: `?test=1` (sin enemigos), `&hora=noche|atardecer|0.5`, `&skin=clasico`, `?scene=gallery`, `?scene=compare`, `?scene=arsenal`.

Añadir un arma: datos en `src/content/weapons.ts`, dibujo en `src/art/painters/guns.ts` y voz en `src/audio/synth/gunshot.ts` (las pruebas avisan si falta alguna).

## Estado

Fases 0, 1 y 2 completadas y aprobadas. Fase 3: el arsenal (4 armas, cambio de arma, HUD de combate) está terminado y **pendiente de aprobación** (`docs/decisiones/0004-fase-3-arsenal.md`); el resto de la Fase 3 (arrojadizos, inventario, botiquines, Cóndor 7) no se ha empezado. El usuario numeró este encargo como «Fase 2»: en el plan corresponde a la Fase 3.
