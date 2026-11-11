import Phaser from 'phaser';
import { buildArtCatalog } from '../../art/catalog';
import type { ImportReport } from '../../art/import/spritePack';
import { applyLoadedPacks, queueManifest, queuePacks, readManifest } from '../boot/importSprites';
import { registerArt } from '../boot/registerArt';
import { registerAudio } from '../boot/registerAudio';
import { buildSpriteExport, frameSignature } from '../debug/exportSprites';
import { readLaunchOptions, updateTestHook } from '../debug/testHook';
import { IMPORT_REPORTS_KEY, SCENE } from './keys';

/**
 * Genera por código todos los recursos (texturas, animaciones, fuente,
 * sonido) y, si el manifiesto de `public/sprites/` lista paquetes
 * externos, sustituye con ellos los fotogramas correspondientes.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE.preload);
  }

  preload(): void {
    queueManifest(this);
  }

  create(): void {
    const { manifest, errors } = readManifest(this);
    if (manifest.packs.length === 0) {
      this.build([], errors);
      return;
    }
    // Segunda carga: las imágenes y metadatos que pide el manifiesto.
    queuePacks(this, manifest);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const catalog = buildArtCatalog();
      const reports = applyLoadedPacks(this, manifest, catalog);
      this.finish(catalog, reports, errors);
    });
    this.load.start();
  }

  private build(reports: ImportReport[], manifestErrors: string[]): void {
    this.finish(buildArtCatalog(), reports, manifestErrors);
  }

  private finish(catalog: ReturnType<typeof buildArtCatalog>, reports: ImportReport[], manifestErrors: string[]): void {
    if (manifestErrors.length > 0) {
      reports = [{ source: 'manifest.json', applied: [], errors: manifestErrors, warnings: [] }, ...reports];
    }
    for (const report of reports) {
      for (const error of report.errors) console.warn(`[sprites] ${report.source}: ${error}`);
      for (const warning of report.warnings) console.info(`[sprites] ${report.source}: ${warning}`);
    }

    registerArt(this, catalog);
    this.registry.set(IMPORT_REPORTS_KEY, reports);
    updateTestHook({
      audioRegistered: registerAudio(this),
      renderer: this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas',
      importReports: reports,
      exportPack: (prefix) => buildSpriteExport(this, prefix),
      frameSignature: (name) => frameSignature(this, name),
    });

    const options = readLaunchOptions(window.location.search);
    this.registry.set('launch', options);
    const target = { game: SCENE.game, gallery: SCENE.gallery, compare: SCENE.compare }[options.scene];
    this.scene.start(target);
  }
}
