# ZOMBIE SURVIVAL: ÚLTIMA ESPERANZA

Shooter de supervivencia 2D de vista lateral en pixel art. Phaser 3 + TypeScript + Vite.
Todo el arte y el sonido se generan por código: el repositorio no contiene imágenes ni audio descargados.

**Estado:** Fase 2 (atmósfera, iluminación y sonido) completada.

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`
- Microsoft Edge (para las pruebas de navegador; ver `playwright.config.ts` para usar otro)

## Órdenes

| Orden | Qué hace |
|---|---|
| `npm install` | Instala las dependencias (versiones exactas) |
| `npm run dev` | Arranca el juego en http://localhost:5173 |
| `npm run build` | Comprueba tipos y compila para producción en `dist/` |
| `npm run check` | Comprueba tipos y ejecuta las pruebas unitarias |
| `npm run test:e2e` | Pruebas de renderizado en navegador |
| `npm run capturas` | Regenera las imágenes de `docs/capturas/` (con `npm run dev` en marcha) |

## Qué se puede ver ahora

- **Juego** (`/`): el primer tramo del capítulo 1.
- **Galería** (`/?scene=gallery`): todos los sprites y la paleta. `D` vuelve al juego.
- **Comparación de Alex** (`/?scene=compare`): aspecto actual frente al nuevo. `E` exporta los sprites como PNG + JSON.
- `/?test=1` abre el nivel sin enemigos. `&hora=noche` o `&hora=atardecer` fija el momento del día. `&skin=clasico` usa el Alex anterior.
- Sprites propios: PNG en `public/sprites/` listados en `public/sprites/manifest.json`.

## Controles

| Acción | Tecla |
|---|---|
| Moverse | A / D o flechas izquierda y derecha |
| Correr | Mayús |
| Saltar | Espacio (también W o flecha arriba) |
| Apuntar | Ratón (7 ángulos) |
| Disparar | Clic izquierdo |
| Recargar | R |
| Cambiar de arma | 1–4 (solo la pistola por ahora) |
| Pausa y volumen | Esc o P (flechas para ajustar) |
| Reintentar tras morir | R, Intro o clic |

## Documentación

| Documento | Contenido |
|---|---|
| [docs/00-diagnostico.md](docs/00-diagnostico.md) | Entorno y compatibilidades |
| [docs/01-gdd.md](docs/01-gdd.md) | Diseño del juego |
| [docs/02-arquitectura.md](docs/02-arquitectura.md) | Arquitectura y carpetas |
| [docs/03-plan-y-riesgos.md](docs/03-plan-y-riesgos.md) | Fases y riesgos |
| [docs/04-estrategia-de-pruebas.md](docs/04-estrategia-de-pruebas.md) | Pruebas |
| [docs/05-direccion-artistica.md](docs/05-direccion-artistica.md) | Estilo visual |
| [docs/decisiones/](docs/decisiones/) | Registro de decisiones por fase |

## Estructura

```
src/core/      Reglas del juego, sin Phaser
src/content/   Datos: armas, enemigos, jugador, niveles
src/art/       Arte generado por código, sin Phaser
src/audio/     Sonido sintetizado, sin Phaser
src/game/      Capa Phaser: escenas, entidades, sistemas
tests/unit/    Vitest
tests/e2e/     Playwright
```
