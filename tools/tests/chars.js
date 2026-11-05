import { drawCharacter, pose, P, LIGHT, idle } from '../../lib/chars/rig.js';
import { CAST } from '../../lib/chars/kurilov.js';
import { bgGrad } from '../../engine/draw.js';
export function draw(ctx, t, E) {
  bgGrad(ctx, '#2a3a46', '#121c24');
  const K = CAST.kurilov;
  const yaws = [0, 0.5, 1.1, Math.PI / 2, 2.6];
  yaws.forEach((y, i) => drawCharacter(ctx, K, pose({ yaw: y, expr: ['neutral','determined','fear','pain','wonder'][i], ...idle(t) }), { x: 200 + i * 380, y: 560, scale: 0.62, light: LIGHT.stormNight, outfit: ['deck','telnyashka','swim','sweater','deck'][i], time: t }));
}
