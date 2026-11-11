# 04 · Estrategia de pruebas

## 1. Enfoque

La arquitectura separa las reglas (`core/`) del motor para que la mayor parte del juego se pruebe sin navegador. Las pruebas en navegador son pocas y se reservan para lo que solo ahí se puede comprobar.

| Nivel | Herramienta | Qué cubre | Cuándo se ejecuta |
|---|---|---|---|
| Estático | TypeScript estricto, prueba de arquitectura | Tipos, reglas de capas, importaciones prohibidas | Al guardar y en cada commit |
| Unitario | Vitest (entorno Node) | `core/`, `content/`, pintores de `art/` | En cada commit |
| Simulación | Vitest | Varios sistemas de `core/` juntos avanzando tiempo simulado | En cada commit |
| Navegador | Playwright (Chromium) | Arranque, flujo básico, regresión visual | Antes de cerrar cada fase y en integración continua |
| Rendimiento | Playwright + escena de estrés | Tiempo por fotograma con hordas | Desde la Fase 4, antes de cerrar fase |
| Manual | Lista de comprobación | Sensación de juego, dificultad, sonido | Al cerrar cada fase |

## 2. Pruebas unitarias (ejemplos por dominio)

- **Armas:** disparar descuenta munición; no dispara con cargador vacío ni durante la recarga; la recarga toma solo lo que hay en reserva; cambiar de arma cancela la recarga; se respeta la cadencia.
- **Vida:** el daño no baja de cero; la invulnerabilidad temporal ignora golpes; el botiquín no supera la vida máxima y se interrumpe con daño.
- **Inventario:** límites por ranura y por tipo de munición; recoger con el inventario lleno.
- **Ruido e IA:** un Eco ignora al jugador silencioso a la vista y reacciona a un disparo dentro de su radio; un caminante pasa de patrulla a persecución al ver al jugador; transiciones válidas de cada máquina de estados.
- **Oleadas:** con una semilla dada, el director genera exactamente la secuencia esperada y nunca supera el máximo de enemigos vivos.
- **Guardado:** ida y vuelta sin pérdida; migración desde cada versión anterior; datos corruptos se rechazan sin excepción.
- **Contenido:** todas las armas, enemigos y oleadas referencian identificadores existentes; ningún valor negativo o imposible; todas las claves de texto existen.
- **Arte:** cada pintor devuelve fotogramas del tamaño declarado, solo con índices de la paleta y con el número de fotogramas que espera la tabla de animaciones.

**Objetivo de cobertura:** 80 % o más de líneas en `core/`. No se fija objetivo para `game/`, que se cubre por navegador.

## 3. Pruebas de simulación

Sin Phaser, se monta un combate en `core/` y se avanza el tiempo en pasos fijos:

- Un jugador simulado que dispara sin parar contra una oleada: se comprueba que el resultado es idéntico entre ejecuciones con la misma semilla.
- Barridos de equilibrio: tiempo medio para abatir cada enemigo con cada arma, munición consumida por capítulo. Sirven como alarma si un cambio de datos rompe el equilibrio.

## 4. Pruebas en navegador

Para hacerlas fiables, la compilación de desarrollo expone un objeto de prueba (`window.__ZS__`) con el estado del juego y órdenes como «cargar nivel», «fijar semilla» o «dar munición». **No existe en la compilación de producción**, y una prueba lo verifica.

- **Arranque:** la página carga, el canvas existe, se llega al menú principal y la consola no registra errores.
- **Flujo básico:** nueva partida → moverse → disparar → la munición baja → recargar → matar un zombi → pausa → reanudar.
- **Persistencia:** guardar, recargar la página y continuar en el mismo punto de control.
- **Regresión visual:** capturas de `GalleryScene` y del HUD comparadas con imágenes de referencia aprobadas (`toHaveScreenshot`). Detecta cambios accidentales de arte o paleta.
- **Escalado:** el canvas mantiene la proporción y píxeles nítidos en varios tamaños de ventana.

Las esperas se hacen sobre el estado del juego, nunca con pausas de tiempo fijo.

## 5. Pruebas de rendimiento

- Escena de estrés con 150 y 300 zombis, luces y partículas activas durante 20 segundos.
- Se registra el tiempo por fotograma y se comprueba que el percentil 95 con 150 zombis queda por debajo de 16,7 ms en el equipo de referencia.
- Se vigila que la memoria no crezca de forma sostenida en una sesión larga (reutilización de objetos correcta).
- Tamaño del paquete de producción registrado en cada fase para detectar aumentos inesperados.

Los resultados dependen del equipo: en integración continua se usa un umbral más holgado y sirve como alarma de regresión, no como medida absoluta.

## 6. Pruebas manuales por fase

Lista corta que se repasa al cerrar cada fase:

- El control responde sin retraso y los saltos son predecibles.
- Toda acción tiene respuesta visual y sonora.
- Siempre se entiende por qué se ha recibido daño.
- La interfaz se lee bien al tamaño mínimo de ventana admitido.
- La partida completa de la fase se termina sin errores en consola.
- Comprobación en Chrome, Firefox y Edge.

## 7. Automatización

- Órdenes disponibles: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run capturas`, y `npm run check` que encadena las dos primeras. `npm run test:perf` llegará en la Fase 4.
- Las pruebas de navegador usan el Edge instalado en el sistema, sin descargar otro navegador. Se ejecutan con 2 procesos: las de jugabilidad dependen del tiempo real y fallan por carga si se lanzan muchas a la vez.
- `/?test=1` abre el nivel sin enemigos; las pruebas crean los que necesitan.
- Si el proyecto se sube a GitHub, un flujo de GitHub Actions ejecuta `check` y las pruebas de navegador en cada cambio.

## 8. Definición de «hecho»

Una funcionalidad está terminada cuando:

1. Sus reglas tienen pruebas unitarias que pasan.
2. `npm run check` y `npm run test:e2e` no dan errores ni avisos.
3. Se ha visto funcionar en el navegador, no solo en pruebas.
4. No empeora el presupuesto de rendimiento.
5. Las decisiones no obvias quedan anotadas en `docs/decisiones/`.
