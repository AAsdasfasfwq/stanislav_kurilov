import { drawCharacter, pose, LIGHT } from '../../lib/chars/rig.js';
import { CAST } from '../../lib/chars/kurilov.js';
import { bgGrad } from '../../engine/draw.js';
export function draw(ctx, t, E) {
  bgGrad(ctx, '#2a3a46', '#121c24');
  const K = CAST.kurilov;
  [-0.4, 0, 0.4].forEach((pt, j) => [0, 0.6, 1.2, 2.0, -0.8].forEach((y, i) =>
    drawCharacter(ctx, K, pose({ yaw: 0, headYaw: y, headPitch: pt, expr: 'neutral' }), { x: 200 + i * 380, y: 330 + j * 340 + 330, scale: 0.85, light: LIGHT.studio, outfit: 'swim', wetHair: j === 1, mask: i === 4, snorkel: i === 4, time: t })));
}
