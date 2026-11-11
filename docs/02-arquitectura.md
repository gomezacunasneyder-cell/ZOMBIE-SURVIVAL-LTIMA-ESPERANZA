# 02 · Arquitectura técnica y estructura de carpetas

## 1. Pila tecnológica

| Uso | Paquete | Versión | Tipo |
|---|---|---|---|
| Motor | phaser | 3.90.0 (exacta) | Ejecución |
| Empaquetado y servidor de desarrollo | vite | 8.x | Desarrollo |
| Lenguaje | typescript | 7.0.2 (compatibilidad comprobada en la Fase 0) | Desarrollo |
| Pruebas unitarias | vitest | 5.x | Desarrollo |
| Pruebas en navegador | @playwright/test | 1.x | Desarrollo |
| Reglas de capas | prueba de arquitectura en Vitest | — | Desarrollo |

**Phaser es la única dependencia de ejecución.** Sin gestor de estado, sin librería de interfaz, sin motor de audio externo y sin editor de mapas: no hacen falta para este alcance.

## 2. Principio rector: separar las reglas del motor

El código se divide en capas con una regla de dependencia estricta, comprobada por una prueba automática (`tests/unit/architecture.test.ts`). Se descartó ESLint por ahora: `typescript-eslint` 8.72 solo admite TypeScript hasta la 6.0.

```
content  ─┐
          ├─►  core  ◄──  game (Phaser)  ◄──  main.ts
platform ─┘                  ▲
                 art, audio ─┘
```

| Capa | Contiene | Puede importar Phaser |
|---|---|---|
| `core/` | Reglas del juego: vida, munición y recarga, inventario, ruido, oleadas, IA (decisiones), mejoras, guardado | **No** |
| `content/` | Datos tipados: armas, enemigos, capítulos, oleadas, diálogos | **No** |
| `platform/` | Almacenamiento y mapa de entrada tras interfaces | **No** |
| `art/` | Generadores de sprites como funciones puras que devuelven matrices de píxeles | **No** (el adaptador vive en `game/boot/`) |
| `audio/` | Síntesis de efectos y música como muestras de sonido | **No** (el adaptador vive en `game/boot/`) |
| `game/` | Escenas, entidades visuales, físicas, cámara, partículas, HUD | Sí |

Ventajas concretas:

- `core/` se prueba en Node en milisegundos, sin navegador ni canvas.
- Una futura migración de motor afecta a `game/` y a dos adaptadores, no a las reglas.
- El equilibrio del juego se ajusta editando `content/`, sin tocar lógica.

## 3. Escenas de Phaser

| Escena | Función |
|---|---|
| `BootScene` | Configuración mínima y pantalla de carga |
| `PreloadScene` | Genera texturas, animaciones, tipografía y audio por código |
| `MainMenuScene` | Menú principal, ranuras de guardado, ajustes |
| `ChapterIntroScene` | Viñeta y transmisión de radio al empezar capítulo |
| `GameScene` | Mundo, entidades y sistemas del nivel. Coordina; la lógica vive en `core/` y en cada sistema |
| `HudScene` | HUD en paralelo sobre `GameScene` (`scene.launch`), con su propia cámara |
| `PauseScene` | Superpuesta; `GameScene` queda en `scene.pause` |
| `UpgradeScene` | Banco de trabajo entre capítulos |
| `GameOverScene` | Muerte y reintento desde el punto de control |
| `GalleryScene` | Muestra todos los sprites y animaciones para revisión artística y pruebas visuales (`/?scene=gallery`) |

`GameScene` y `HudScene` no se llaman entre sí: se comunican por un bus de eventos tipado (`vida-cambiada`, `municion-cambiada`, `ruido-emitido`, `oleada-iniciada`…).

## 4. Entidades y sistemas

**Composición, no ECS completo.** Para decenas de tipos de entidad y un máximo de unos cientos de instancias, un ECS añade complejidad sin beneficio medible.

- Cada entidad visual (`Player`, `Zombie`, `SupplyCrate`…) es un sprite de Arcade Physics que **envuelve** un modelo de `core/` (por ejemplo `Health`, `WeaponState`, `EnemyBrain`).
- El modelo decide; el sprite ejecuta y anima. Ejemplo: `EnemyBrain.update(percepción, dt)` devuelve una intención («ir a x», «atacar») y `Zombie` la traduce a velocidad y animación.
- Los **sistemas** de `GameScene` coordinan grupos: `CombatSystem`, `NoiseSystem`, `WaveDirector`, `PickupSystem`, `LightingSystem`, `CheckpointSystem`.

**Máquinas de estado.** Una clase genérica `StateMachine<Estado, Contexto>` en `core/` sirve al jugador, a los enemigos y a las fases del jefe.

**Disparos.** Las balas son proyectiles reales de Arcade Physics que salen de la boca del cañón (decisión de la Fase 1, sustituye al impacto instantáneo previsto). Se reutilizan desde una reserva fija de 48. Su velocidad por paso de física es menor que el ancho de un enemigo, de modo que no pueden atravesarlo; una prueba lo vigila al añadir armas.

**Niveles.** Definidos en datos (`content/chapters/`): tramos de suelo, plataformas, decorado, luces, puntos de aparición, disparadores y puntos de control. Sin editor externo al principio; el formato se diseña para poder importarse de uno más adelante.

## 5. Arte procedural

1. **Paleta** única indexada en `art/palette.ts`. Ningún color fuera de ella.
2. **Pintores** (`art/painters/`): funciones puras que devuelven fotogramas como matrices de índices de paleta. Los personajes se componen por partes (cabeza, torso, brazos, piernas, arma) con poses por fotograma, lo que da animaciones fluidas sin dibujar cada fotograma entero.
3. **Atlas** (`art/atlas.ts` empaqueta, `game/boot/registerArt.ts` registra): vuelca todos los fotogramas en una textura creada con `textures.createCanvas`, registra cada fotograma con `CanvasTexture.add` y llama a `refresh()`. Un único atlas favorece el dibujado por lotes. Las capas de fondo repetibles van cada una en su propia textura.
4. **Animaciones** registradas una sola vez con `anims.create` a partir de una tabla de datos.
5. **Tipografía de píxel** propia: glifos definidos en datos y registrados como fuente de mapa de bits mediante `RetroFont`.

Como los pintores son puros, se prueban sin navegador y `GalleryScene` permite revisar el arte de un vistazo.

## 6. Iluminación nocturna

Técnica base, barata y compatible con Canvas y WebGL:

- Una `RenderTexture` del tamaño de la pantalla, rellena cada fotograma con el color de oscuridad ambiente.
- Sobre ella se **borran** (`erase`) sprites de degradado radial o cónico en la posición de cada luz.
- Se dibuja encima del mundo y debajo del HUD.
- Los brillos (faros, fuego, fogonazos) añaden además un sprite con mezcla aditiva.

El pipeline `Light2D` de Phaser 3 queda **descartado como base**: solo funciona en WebGL, necesita mapas de normales para lucir, limita el número de luces y rompe el dibujado por lotes al mezclar sprites iluminados y no iluminados. Se podrá evaluar más adelante como mejora opcional.

## 7. Audio

- `audio/synth/`: recetas de efectos (osciladores, ruido filtrado, envolventes) que producen un `AudioBuffer`.
- Los buffers se generan una vez en `PreloadScene`.
- `audio/AudioDirector.ts` expone `reproducir('disparo-pistola', {x})`, controla volúmenes por canal y las capas de música según la tensión.
- El navegador bloquea el audio hasta la primera interacción: el menú principal sirve de desbloqueo natural.

## 8. Guardado

- Interfaz `SaveStorage` en `platform/` con implementación sobre `localStorage`, y otra en memoria para pruebas.
- Formato JSON con campo `version`. `core/save/migrations.ts` actualiza partidas antiguas paso a paso.
- Validación al cargar: una partida corrupta se descarta con aviso, nunca rompe el arranque.

## 9. Configuración del juego

- Resolución 480 × 270, `pixelArt: true`, escala `FIT` centrada.
- Arcade Physics con gravedad vertical y paso fijo a 60 Hz.
- Semilla de aleatoriedad controlada: `core/` recibe un generador inyectado, lo que hace reproducibles las pruebas y las oleadas.
- Modo depuración con `?debug=1`: cuerpos físicos, radios de ruido, estados de IA, contador de fotogramas.

## 10. Presupuesto de rendimiento

Objetivo: **60 fps estables con 150 zombis activos** en un portátil de gama media.

| Medida | Detalle |
|---|---|
| Reutilización de objetos | Grupos con tamaño máximo para zombis, casquillos, sangre, números de daño. Nada se crea ni destruye en combate. |
| Colisiones acotadas | Zombis contra suelo y contra jugador; **no** zombi contra zombi. La separación entre ellos es un empuje suave calculado por celdas. |
| IA escalonada | Cada enemigo decide cada 100–200 ms, repartidos entre fotogramas; el movimiento sí se actualiza siempre. |
| Fuera de cámara | Enemigos lejanos sin animación ni percepción completa. |
| Un atlas | Todo el arte en una textura para minimizar llamadas de dibujado. |
| Partículas con tope | Límite global; los efectos viejos ceden ante los nuevos. |
| Sin basura por fotograma | Sin crear objetos ni arrays en los bucles de actualización. |
| Carga | Phaser pesa más de 1 MB minificado: se separa en su propio fragmento para aprovechar la caché. |

Una **escena de estrés** automatizada mide el tiempo por fotograma con 150 y 300 zombis y falla si se supera el presupuesto (ver estrategia de pruebas).

## 11. Estructura de carpetas

```
/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ playwright.config.ts
├─ scripts/                    Utilidades (capturas de pantalla)
├─ README.md
├─ docs/                       Especificación y registro de decisiones
│  └─ decisiones/              Una nota breve por decisión importante
├─ public/                     Icono y manifiesto (sin assets de juego)
├─ src/
│  ├─ main.ts                  Punto de entrada: crea el juego
│  ├─ styles/                  CSS del marco de la página
│  ├─ core/                    Reglas puras, sin Phaser
│  │  ├─ events/               Bus de eventos tipado
│  │  ├─ fsm/                  Máquina de estados genérica
│  │  ├─ math/                 Aleatoriedad con semilla, utilidades
│  │  ├─ combat/               Vida, daño, estado de arma y recarga
│  │  ├─ inventory/
│  │  ├─ ai/                   Cerebros de enemigos, percepción, ruido
│  │  ├─ waves/                Director de oleadas
│  │  ├─ progression/          Mejoras, piezas, capítulos
│  │  └─ save/                 Esquema, validación, migraciones
│  ├─ content/                 Datos tipados
│  │  ├─ weapons.ts
│  │  ├─ enemies.ts
│  │  ├─ upgrades.ts
│  │  ├─ chapters/             Un archivo por capítulo
│  │  ├─ waves/
│  │  └─ i18n/es.ts            Textos y diálogos
│  ├─ platform/                Almacenamiento, mapa de entrada
│  ├─ art/
│  │  ├─ palette.ts
│  │  ├─ PixelBuffer.ts        Lienzo indexado y primitivas de dibujo
│  │  ├─ rig/                  Esqueleto de personajes por partes y poses
│  │  ├─ painters/             Alex, zombis, vehículos, objetos, escenario
│  │  ├─ atlas.ts              Empaquetado del atlas
│  │  ├─ catalog.ts            Reúne sprites, capas y animaciones
│  │  ├─ lightMasks.ts
│  │  └─ font.ts
│  ├─ audio/
│  │  ├─ synth/                Recetas de efectos y música
│  │  └─ AudioDirector.ts
│  └─ game/                    Capa Phaser
│     ├─ config.ts
│     ├─ boot/                 Adaptadores: registran arte y audio en Phaser
│     ├─ display/              Escalado por píxeles enteros
│     ├─ debug/                Gancho de pruebas (solo desarrollo)
│     ├─ scenes/
│     ├─ entities/             Player, Zombie, SupplyCrate, Helicopter, Boss…
│     ├─ systems/              Combat, Noise, Lighting, Pickup, Checkpoint…
│     ├─ world/                Constructor de niveles, paralaje
│     ├─ fx/                   Partículas, sacudida de cámara
│     └─ hud/                  Componentes del HUD y menús
└─ tests/
   ├─ unit/                    Refleja la estructura de src/core y src/art
   ├─ e2e/                     Playwright: arranque, flujo, visual
   └─ perf/                    Escena de estrés
```

Reglas de la estructura:

- Un archivo, una responsabilidad; ninguna clase «dios». Límite orientativo de 300 líneas por archivo.
- No hay carpetas `utils` genéricas: cada utilidad vive junto al dominio que la usa.
- Las importaciones prohibidas entre capas las hace cumplir una prueba automática, no la disciplina.
