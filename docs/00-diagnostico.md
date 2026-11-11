# 00 · Diagnóstico del repositorio

Fecha de la inspección: 2026-11-10

## 1. Estado del proyecto

| Aspecto | Resultado |
|---|---|
| Contenido de la carpeta | **Vacía.** Ningún archivo ni subcarpeta antes de esta especificación. |
| Control de versiones | **No es un repositorio git.** |
| Código, assets o configuración previos | Ninguno. No hay nada que conservar ni migrar. |
| Ruta del proyecto | Contiene espacios y una letra acentuada (`ÚLTIMA`). Ver riesgo R-11. |

Conclusión: es un proyecto nuevo. Se aplica la pila tecnológica indicada para repositorio vacío.

## 2. Entorno local verificado

| Herramienta | Versión instalada | Observación |
|---|---|---|
| Node.js | 22.23.2 | Cumple el requisito de Vite 8 (`^20.19.0 \|\| >=22.12.0`). |
| npm | 10.9.8 | Correcto. |
| git | 2.54.0 | Instalado; falta inicializar el repositorio. |

## 3. Versiones publicadas en npm (consultadas hoy)

| Paquete | `latest` | Nota |
|---|---|---|
| phaser | **4.2.1** | La etiqueta `latest` ya es Phaser 4. La última versión de la rama 3 es **3.90.0**. |
| vite | 8.3.7 | |
| typescript | 7.0.2 | |
| vitest | 5.1.0 | |
| @playwright/test | 1.65.0 | |

### Hallazgo importante: Phaser 3 frente a Phaser 4

El encargo pide Phaser 3, pero `npm install phaser` instala hoy la 4.x. Hay que elegir de forma explícita.

**Recomendación: Phaser `3.90.0`, fijado a versión exacta.**

- Es lo que pide el encargo y es la versión final y estable de la rama 3.
- Toda la arquitectura de este documento se apoya en APIs de Phaser 3 que conozco y puedo citar con precisión (Arcade Physics, escenas, `CanvasTexture`, animaciones, emisores de partículas de la 3.60+).
- No he verificado la API de Phaser 4 y no voy a proponer funcionalidades suyas sin comprobarlas. Su renderizador es distinto, así que lo relativo a pipelines e iluminación no se puede dar por equivalente.
- Contrapartida: la rama 3 ya no recibirá funciones nuevas. Se mitiga aislando Phaser en una capa (ver arquitectura), de modo que la lógica de juego no dependa del motor y una migración futura afecte solo a esa capa.

Si prefieres Phaser 4, la Fase 0 debe incluir un estudio previo de su documentación antes de escribir código de juego.

### Compatibilidades comprobadas en la Fase 0

| Comprobación | Resultado |
|---|---|
| Tipos de Phaser 3.90.0 con TypeScript 7.0.2 | **Correcto** con `skipLibCheck` desactivado. Un único error heredado (`ActiveXObject`), resuelto con una declaración de una línea en `src/types/phaser-shim.d.ts`. |
| Phaser 3.90.0 con Vite 8.3.7 | **Correcto**, sin ajustes. Phaser queda en su propio fragmento: 1,19 MB minificado, 318 kB comprimido. |
| Audio generado por código en la caché de Phaser | **Correcto**: un `AudioBuffer` sintetizado se registra con `cache.audio.add` y `sound.play` lo reproduce sin errores. La calidad del sonido hay que juzgarla de oído. |
| typescript-eslint con TypeScript 7 | **No compatible** (admite hasta la 6.0). Las reglas de capas se comprueban con una prueba de Vitest. |

## 4. Sobre la imagen de referencia

La imagen adjunta se usa solo como referencia de **ambiente**: vista lateral, zona militar, atardecer contaminado, multitud de zombis, helicóptero y vehículos. No se copiarán sus personajes, composición ni elementos concretos. Todo el arte será original y generado por código.

Nota sobre el enemigo ciego: se decidió darle nombre propio, **LOS ECOS**, y diseño visual original. Conserva la mecánica de cazar por sonido.
