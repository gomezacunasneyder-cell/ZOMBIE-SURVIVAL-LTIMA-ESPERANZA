# 05 · Dirección artística a partir de la referencia

Este documento traduce la imagen de referencia en reglas de estilo y en un inventario de elementos independientes que se integran en Phaser. Amplía la sección 11 del GDD.

## 1. Qué se toma de la referencia y qué no

**Nota:** en la conversación solo ha llegado **una imagen** (la escena del puesto militar con el helicóptero). Si hay más, incluido el póster, hay que volver a adjuntarlas y este documento se ampliará.

| Se conserva | Cómo |
|---|---|
| Estilo pixel art | Píxel grueso, contornos oscuros, sin suavizado ni degradados |
| Estética de supervivencia y terror | Multitud infectada, barricadas, sangre, restos de evacuación |
| Colores e iluminación | Paleta de la sección 3, extraída por familias de color |
| Proporciones de personajes | Regla de la sección 4 |
| Atmósfera de ciudad destruida | Capas de escenario y catálogo de objetos de la sección 6 |

**Límite importante.** La imagen pertenece a otro videojuego y su licencia no nos permite usarla. Por eso:

- **No** se recortan ni se calcan píxeles de la imagen, ni se usa como fondo.
- **No** se reproducen sus personajes, vehículos ni composiciones concretas.
- **Sí** se dibujan desde cero, por código, elementos propios que siguen las mismas reglas de estilo. El resultado tendrá el mismo aire, con diseños originales.

Esto coincide con la regla del encargo de no reutilizar recursos de licencia desconocida.

## 2. Lectura de la referencia

- **Cámara:** vista lateral con el suelo ligeramente inclinado hacia el espectador; la calzada ocupa el tercio inferior.
- **Composición por franjas:** cielo → silueta lejana de ciudad → muro con alambrada → zona de tiendas y vehículos → calzada → objetos de primer plano.
- **Luz:** atardecer contaminado. Cielo rosa polvoriento, todo lo demás frío y apagado. No hay negro puro.
- **Lectura:** los personajes destacan por contorno oscuro y por un color de acento cada uno (amarillo, naranja, rojo) sobre un fondo desaturado.
- **Narrativa ambiental:** pintadas, cartel luminoso, bolsas, coches abandonados y sangre cuentan lo ocurrido sin texto.

## 3. Paleta

La paleta definitiva tiene 56 colores y está en `src/art/palette.ts`; estos son sus tonos principales. Cada familia tiene 3–4 tonos.

| Familia | Uso | Tonos de partida |
|---|---|---|
| Cielo | Fondo | `#c9929a` `#a67a88` `#6e6258` |
| Silueta de ciudad | Capa lejana | `#727a58` `#59623f` |
| Hormigón | Muros, barreras | `#6c7c8c` `#4f5d70` `#3a4456` |
| Asfalto | Calzada | `#625c6e` `#4c475a` `#8f8b97` (líneas) |
| Militar | Vehículos, uniformes, tiendas | `#8d8758` `#63663a` `#3d402b` |
| Infectado | Piel de zombis | `#93a66c` `#7b8474` `#56604e` |
| Sangre | Heridas, charcos, pintadas | `#c23b2c` `#8a1f1f` |
| Acentos | Bidones, trajes, señales | `#d9772b` (naranja) `#e2c13a` (amarillo) |
| Luz | Fogonazos, faros, fuego | `#ffe27a` `#fff4c8` |
| Interfaz | Marcadores, vida | `#6fbf3a` (verde) |
| Contorno | Todos los sprites | `#1d1a22` |

**Reglas de color**

1. Las sombras viran hacia violeta o azul; las luces, hacia amarillo cálido.
2. Los colores saturados (rojo, naranja, amarillo) se reservan a lo que importa: peligro, objetos recogibles, luz.
3. Alex lleva un color de acento exclusivo para localizarlo siempre entre la multitud.

**Del atardecer a la noche.** El encargo pide ambiente nocturno y la referencia es un atardecer. Se concilian con una progresión, usando siempre la misma paleta y cambiando solo el tinte de la capa de iluminación:

| Capítulo | Hora y luz |
|---|---|
| 1 · La ciudad muerta | Atardecer rosa, como la referencia |
| 2 · El último suministro | Anochecer azul; primeras farolas y faros |
| 3 · Los Ecos | Oscuridad de túnel; linterna y luces de emergencia |
| 4 · La última horda | Noche cerrada; focos militares, fuego y bengalas |
| 5 · El origen | Interior de laboratorio; fluorescente frío y alarma roja |

## 4. Proporciones y dibujo de personajes

- Lienzo de **32 × 32 px**; figura de unos 26–28 px de alto.
- **Cabeza grande:** unos 9–10 px, cerca de un tercio de la altura (2,5–3 cabezas de alto).
- Extremidades gruesas, manos y botas marcadas. Silueta reconocible en negro.
- Contorno de 1 px en el color de contorno; interior con 3–4 tonos por material.
- Cada tipo se distingue por su equipo (casco, mochila, chaleco, traje), no solo por el color.
- Sombra elíptica de contacto bajo cada personaje.
- Origen del sprite en los pies, para ordenar y apoyar bien sobre el suelo.

**Regla técnica: nada de rotar sprites libremente.** El pixel art girado se deforma. El brazo que apunta usa fotogramas dibujados para 7 ángulos fijos; los casquillos y escombros, 4 fotogramas de giro.

## 5. Vista y plano de juego

Se mantiene la vista lateral con saltos del encargo. De la referencia se adopta la calzada con profundidad visual: el decorado y los cadáveres ocupan distintas alturas del suelo, pero la acción ocurre en una línea de juego clara.

## 6. Inventario de elementos independientes

Cada fila es un pintor en `art/painters/` y un conjunto de fotogramas en el atlas. Nombres de fotograma con el patrón `grupo/elemento/animación/n`.

### Personajes

| Elemento | Tamaño | Animaciones |
|---|---|---|
| Alex | 32 × 32 | Reposo, caminar, correr, agachado, saltar, caer, herido, morir, usar botiquín |
| Brazos de Alex por arma | 32 × 32 | 7 ángulos × (apuntar, disparar, recargar) |
| Soldados de la base | 32 × 32 | Reposo, disparar, descender por cuerda |
| Capitana Vega (retrato de radio) | 48 × 48 | Hablar (3), interferencia |

### Enemigos

| Elemento | Tamaño | Variantes y animaciones |
|---|---|---|
| Caminante | 32 × 32 | 4 variantes de ropa (civil, oficinista, obrero, traje de protección); caminar, atacar, golpeado, morir |
| Corredor | 32 × 32 | Correr, saltar, atacar, morir |
| Eco | 32 × 32 | Patrulla, escuchar, embestir, atacar, morir |
| Blindado | 32 × 32 | Caminar, atacar, perder el casco, morir |
| EL DEVORADOR | 96 × 96 | Por fase: reposo, embestida, golpe, rugido, aturdido, transición, morir |

### Vehículos y maquinaria

Coche siniestrado, furgoneta volcada, camión militar, todoterreno militar, torre de luz con generador, y el **helicóptero Cóndor 7** (rotor de 4 fotogramas, foco orientable, cuerda y caída de caja).

### Escenario

| Capa | Contenido | Factor de paralaje |
|---|---|---|
| Cielo | Bandas de color, humo lejano | 0 |
| Ciudad lejana | Siluetas de edificios | 0,15 |
| Ciudad media | Edificios en ruinas con ventanas | 0,4 |
| Fondo de juego | Muros con alambrada, tiendas, fachadas | 0,8 |
| Plano de juego | Calzada, aceras, plataformas | 1 |
| Primer plano | Siluetas oscuras: postes, restos, vallas | 1,2 |

**Objetos:** barreras de hormigón, bidones, conos, sacos terreros, alambrada, cartel luminoso con texto propio, farolas, contenedores, cajas, bolsas, pintadas y manchas como calcomanías.

### Armas y objetos

Cada arma tiene sprite en mano (dentro de los brazos de Alex), sprite en el suelo e icono de HUD de 24 × 12. Objetos: munición por tipo, botiquín, piezas, granada, cóctel molotov, caja de suministro con paracaídas y su marcador flotante.

### Efectos

| Efecto | Fotogramas |
|---|---|
| Fogonazo por arma | 3 |
| Trazadora de bala | 1 (estirada por código) |
| Casquillo | 4 de giro |
| Impacto de sangre + charco | 5 + 3 calcomanías |
| Chispas en metal y polvo en hormigón | 4 |
| Explosión | 8 |
| Fuego en bucle | 6 |
| Humo | 6 |
| Polvo de aterrizaje y de pisada | 4 |
| Anillo de polvo del rotor | 6 |
| Bengala y humo de señal | 6 |
| Onda de ruido | 4 |

### Interfaz

Tipografía de píxel, marcos, barra de vida, iconos de arma, medidor de ruido, ventana de radio, marcador de suministros, botones de menú y cursor de mira.

## 7. Integración en Phaser

- Todos los elementos se generan en `PreloadScene` y se guardan en un único atlas (ver arquitectura, sección 5).
- Los personajes son sprites de Arcade Physics con un cuerpo de colisión más estrecho que el dibujo.
- Las capas de fondo son `TileSprite` repetibles con su factor de paralaje; los objetos son imágenes sueltas colocadas por los datos del nivel.
- El orden de dibujado se fija por capa y, dentro del plano de juego, por la posición de los pies.
- La capa de iluminación aplica el tinte de cada capítulo.

## 8. Control de coherencia

1. **Paleta cerrada:** una prueba automática rechaza cualquier píxel fuera de `palette.ts`.
2. **Galería:** `GalleryScene` muestra todos los elementos juntos y a escala real.
3. **Diorama de aprobación** (Fase 0): una pantalla compuesta con cielo, ciudad, muro, calzada, Alex, dos zombis, un vehículo y una luz, para compararla con la referencia antes de producir el resto.
4. **Capturas de referencia:** una vez aprobado el estilo, las pruebas visuales detectan desviaciones.

## 9. Expectativa realista

La referencia tiene un nivel de detalle alto, hecho a mano por artistas. Generar ese nivel por código es el mayor riesgo del proyecto (R-01). El diorama de la Fase 0 sirve para que juzgues pronto si el resultado te convence; si no, la arquitectura permite sustituir cualquier elemento por un PNG propio dibujado a mano sin tocar el juego.
