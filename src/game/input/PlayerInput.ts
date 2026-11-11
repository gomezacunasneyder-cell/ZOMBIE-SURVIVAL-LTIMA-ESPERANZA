import Phaser from 'phaser';
import { WEAPON_SLOTS } from '../../content/weapons';

/** Lo que el jugador pide en un fotograma, ya traducido de teclas a acciones. */
export interface InputFrame {
  direction: -1 | 0 | 1;
  run: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  firePressed: boolean;
  fireHeld: boolean;
  reloadPressed: boolean;
  /** Ranura de arma elegida este fotograma (0–3), o `null`. */
  slotPressed: number | null;
  /** Rueda del ratón: siguiente (1) o anterior (-1) arma. */
  cycle: -1 | 0 | 1;
  /** Cualquier tecla de confirmación (para reintentar tras morir). */
  confirmPressed: boolean;
}

const KEYS = 'A,D,LEFT,RIGHT,SPACE,W,UP,SHIFT,R,ENTER,ONE,TWO,THREE,FOUR';
type KeyName = 'A' | 'D' | 'LEFT' | 'RIGHT' | 'SPACE' | 'W' | 'UP' | 'SHIFT' | 'R' | 'ENTER' | 'ONE' | 'TWO' | 'THREE' | 'FOUR';
const SLOT_KEYS: KeyName[] = ['ONE', 'TWO', 'THREE', 'FOUR'];

/**
 * Mapa de acciones: el resto del juego no sabe qué tecla hace qué.
 * Las pulsaciones puntuales (saltar, disparar, recargar) se acumulan entre
 * fotogramas para no perder ninguna aunque coincidan varias teclas.
 */
export class PlayerInput {
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  /** Teclas pulsadas desde la última lectura, aunque ya se hayan soltado. */
  private readonly pressed = new Set<KeyName>();
  private fireQueued = false;
  private fireHeld = false;
  private wheel: -1 | 0 | 1 = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('PlayerInput: teclado no disponible');
    // `addKeys` captura las teclas: Espacio y las flechas no desplazan la página.
    this.keys = keyboard.addKeys(KEYS) as Record<KeyName, Phaser.Input.Keyboard.Key>;
    // Cada pulsación se anota por evento: una tecla pulsada y soltada dentro
    // del mismo fotograma no se pierde.
    for (const name of Object.keys(this.keys) as KeyName[]) {
      this.keys[name].on('down', () => this.pressed.add(name));
    }

    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;
    this.fireQueued = true;
    this.fireHeld = true;
  }

  private onPointerUp(): void {
    this.fireHeld = false;
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    if (dy !== 0) this.wheel = dy > 0 ? 1 : -1;
  }

  /** Olvida las pulsaciones pendientes (al volver de la pausa). */
  reset(): void {
    this.pressed.clear();
    this.fireQueued = false;
    this.fireHeld = false;
    this.wheel = 0;
  }

  /** Lee y consume las acciones de este fotograma. */
  read(): InputFrame {
    const k = this.keys;
    const just = (key: KeyName): boolean => this.pressed.has(key);
    const left = k.A.isDown || k.LEFT.isDown;
    const right = k.D.isDown || k.RIGHT.isDown;
    const direction = left === right ? 0 : right ? 1 : -1;

    const jumpPressed = just('SPACE') || just('W') || just('UP');
    const enterPressed = just('ENTER');
    const reloadPressed = just('R');

    let slotPressed: number | null = null;
    for (let i = 0; i < WEAPON_SLOTS; i++) {
      if (just(SLOT_KEYS[i] as KeyName)) slotPressed = i;
    }

    const firePressed = this.fireQueued;
    const cycle = this.wheel;
    this.fireQueued = false;
    this.wheel = 0;
    this.pressed.clear();

    return {
      direction,
      run: k.SHIFT.isDown,
      jumpPressed,
      jumpHeld: k.SPACE.isDown || k.W.isDown || k.UP.isDown,
      firePressed,
      fireHeld: this.fireHeld,
      reloadPressed,
      slotPressed,
      cycle,
      confirmPressed: enterPressed || reloadPressed || jumpPressed || firePressed,
    };
  }

  /** Punto del mundo al que apunta el ratón, aunque la cámara se mueva y el ratón no. */
  aimPoint(): Phaser.Math.Vector2 {
    const pointer = this.scene.input.activePointer;
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }
}
