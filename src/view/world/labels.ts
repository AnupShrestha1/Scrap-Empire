import type Phaser from 'phaser';
import { VIEW } from '../../config';

/** Labels draw above everything in the world. */
export const LABEL_DEPTH = 1e7;

/**
 * World-space text that stays the same size on screen whatever the camera zoom, rendered at device
 * resolution so it is sharp even though the world is pixel art.
 */
export class Labels {
  private readonly all: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  add(sizeCssPx = 13, color = '#ffffff'): Phaser.GameObjects.Text {
    const dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDpr);
    const text = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontStyle: 'bold',
        fontSize: `${Math.round(sizeCssPx * dpr)}px`,
        color,
        stroke: '#1e1b24',
        strokeThickness: Math.round(3 * dpr),
      })
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH);
    this.all.push(text);
    this.fit(text);
    return text;
  }

  /** Text that drifts up from (x, y) and fades out, e.g. "+$12". */
  floating(text: string, x: number, y: number, color = '#ffd76a'): void {
    const label = this.add(14, color).setText(text).setPosition(x, y);
    this.scene.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.all.splice(this.all.indexOf(label), 1);
        label.destroy();
      },
    });
  }

  /** Call when the camera zoom changes. */
  refit(): void {
    for (const text of this.all) this.fit(text);
  }

  private fit(text: Phaser.GameObjects.Text): void {
    text.setScale(1 / this.scene.cameras.main.zoom);
  }
}
