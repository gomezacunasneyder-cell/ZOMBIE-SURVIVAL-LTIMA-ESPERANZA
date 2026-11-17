import Phaser from 'phaser';
import { colorNumber, type ColorName } from '../../art/palette';
import { BOSS_TEXT, MILITARY_RECORDING } from '../../content/boss';
import { FONT_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { updateTestHook } from '../debug/testHook';
import { OVERLAY_CLOSED_KEY, SCENE } from './keys';

export interface EpilogueData {
  kills: number;
  timeMs: number;
  /** Se llama al cerrar la grabación. */
  done: () => void;
}

type Stage = 'victory' | 'recording' | 'end';

/** Letras por segundo al escribir la transcripción. */
const TYPE_RATE = 42;
const VICTORY_MS = 4500;
const END_MS = 2400;
const LINE_PAUSE_MS = 900;
const TEXT_LEFT = 34;
const LINE_HEIGHT = 12;

/**
 * Final tras derrotar a EL DEVORADOR, con el juego detenido debajo:
 * VICTORIA con el resumen y, después, la grabación militar encontrada
 * entre sus restos, que revela el origen del Virus Z-13. La transcripción
 * se escribe letra a letra con el siseo de la cinta; Intro, Espacio o un
 * clic adelantan.
 */
export class EpilogueScene extends Phaser.Scene {
  private info!: EpilogueData;
  private stage: Stage = 'victory';
  private stageAt = 0;
  private line = 0;
  private lineAt = 0;
  private texts: Phaser.GameObjects.BitmapText[] = [];
  private victory: Phaser.GameObjects.BitmapText[] = [];
  private header: Phaser.GameObjects.BitmapText[] = [];
  private rec!: Phaser.GameObjects.BitmapText;
  private clock!: Phaser.GameObjects.BitmapText;
  private endText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENE.epilogue);
  }

  create(data: EpilogueData): void {
    this.info = data;
    this.stage = 'victory';
    // El reloj de una escena recién lanzada aún no corre: se cuenta desde su primer fotograma.
    this.stageAt = Number.NaN;
    this.line = 0;
    this.texts = [];

    const g = this.add.graphics();
    g.fillStyle(colorNumber('outline'), 0.92).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Líneas de barrido de un monitor viejo.
    g.fillStyle(colorNumber('shadow'), 0.5);
    for (let y = 0; y < GAME_HEIGHT; y += 3) g.fillRect(0, y, GAME_WIDTH, 1);

    const minutes = Math.floor(data.timeMs / 60000);
    const seconds = String(Math.floor((data.timeMs % 60000) / 1000)).padStart(2, '0');
    const centre = GAME_WIDTH / 2;
    this.victory = [
      this.text(centre, 70, BOSS_TEXT.victory.title, 4, 'ui1').setOrigin(0.5, 0),
      this.text(centre, 106, BOSS_TEXT.victory.subtitle, 2, 'white').setOrigin(0.5, 0),
      this.text(centre, 130, `ZOMBIS ELIMINADOS ${data.kills}   TIEMPO ${minutes}:${seconds}`, 1, 'grey1').setOrigin(0.5, 0),
      this.text(centre, 146, 'ENTRE SUS RESTOS HAY UNA CINTA MILITAR...', 1, 'light2').setOrigin(0.5, 0),
    ];

    this.header = [
      this.text(TEXT_LEFT, 30, MILITARY_RECORDING.header, 1, 'blood1'),
      this.text(TEXT_LEFT, 40, MILITARY_RECORDING.meta, 1, 'grey2'),
    ];
    this.rec = this.text(GAME_WIDTH - 20, 14, 'REC', 1, 'blood1').setOrigin(1, 0);
    this.clock = this.text(TEXT_LEFT, GAME_HEIGHT - 22, '', 1, 'grey2');
    this.endText = this.text(centre, GAME_HEIGHT - 44, MILITARY_RECORDING.end, 1, 'grey1').setOrigin(0.5, 0);
    this.texts = MILITARY_RECORDING.lines.map((_, i) => this.text(TEXT_LEFT, 62 + i * LINE_HEIGHT, '', 1, 'light1'));
    this.showStage();

    const advance = (): void => this.advance();
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || !['Enter', 'Space', 'Escape', 'KeyE'].includes(event.code)) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, advance);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, advance);
    });
    this.input.setDefaultCursor('default');
    playSfx(this, SFX.pickup, 0.5, 0);
    updateTestHook({ epilogue: 'victory' });
  }

  private text(x: number, y: number, content: string, scale: number, color: ColorName): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, content).setScale(scale).setTint(colorNumber(color));
  }

  private showStage(): void {
    const victory = this.stage === 'victory';
    this.victory.forEach((t) => t.setVisible(victory));
    for (const t of [...this.header, ...this.texts, this.rec, this.clock]) t.setVisible(!victory);
    this.endText.setVisible(this.stage === 'end');
  }

  private enter(stage: Stage): void {
    this.stage = stage;
    this.stageAt = this.time.now;
    this.showStage();
    updateTestHook({ epilogue: stage });
    if (stage === 'recording') {
      playSfx(this, SFX.tape, 0.6, 0);
      this.startLine(0);
    }
    if (stage === 'end') playSfx(this, SFX.tape, 0.4, 0);
  }

  private startLine(index: number): void {
    this.line = index;
    this.lineAt = this.time.now;
    playSfx(this, SFX.radioChatter, 0.25, 80);
  }

  /** Intro: termina la línea que se está escribiendo o pasa a la siguiente. */
  private advance(): void {
    if (this.stage === 'victory') return this.enter('recording');
    if (this.stage === 'end') return this.close();
    const line = MILITARY_RECORDING.lines[this.line] ?? '';
    const typed = Math.floor(((this.time.now - this.lineAt) / 1000) * TYPE_RATE);
    if (typed < line.length) {
      this.lineAt = this.time.now - (line.length / TYPE_RATE) * 1000;
      return;
    }
    this.nextLine();
  }

  private nextLine(): void {
    this.texts[this.line]?.setText(MILITARY_RECORDING.lines[this.line] ?? '');
    if (this.line + 1 >= MILITARY_RECORDING.lines.length) this.enter('end');
    else this.startLine(this.line + 1);
  }

  override update(time: number): void {
    if (Number.isNaN(this.stageAt)) this.stageAt = time;
    const elapsed = time - this.stageAt;
    if (this.stage === 'victory' && elapsed >= VICTORY_MS) this.enter('recording');
    if (this.stage === 'end' && elapsed >= END_MS) this.close();
    if (this.stage !== 'recording') return;
    // El piloto rojo parpadea y el contador de la cinta corre.
    this.rec.setVisible(Math.floor(time / 500) % 2 === 0);
    const tape = Math.floor((time - this.stageAt) / 1000);
    this.clock.setText(`00:${String(Math.floor(tape / 60)).padStart(2, '0')}:${String(tape % 60).padStart(2, '0')}`);
    const line = MILITARY_RECORDING.lines[this.line] ?? '';
    const typed = Math.min(line.length, Math.floor(((time - this.lineAt) / 1000) * TYPE_RATE));
    this.texts[this.line]?.setText(line.slice(0, typed) + (typed < line.length && Math.floor(time / 200) % 2 === 0 ? '.' : ''));
    if (typed >= line.length && time - this.lineAt >= (line.length / TYPE_RATE) * 1000 + LINE_PAUSE_MS) this.nextLine();
  }

  private close(): void {
    updateTestHook({ epilogue: null });
    this.registry.set(OVERLAY_CLOSED_KEY, performance.now());
    this.scene.stop();
    this.scene.resume(SCENE.game);
    this.info.done();
  }
}
