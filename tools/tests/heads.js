import { drawCharacter, pose, LIGHT, idle } from '../../lib/chars/rig.js';
import { CAST } from '../../lib/chars/kurilov.js';
import { bgGrad } from '../../engine/draw.js';
export function draw(ctx, t, E) {
  bgGrad(ctx, '#2a3a46', '#121c24');
  const K = CAST.kurilov;
  const cfg = [[0.0, 'neutral', 'deck'], [0.55, 'determined', 'telnyashka'], [-0.9, 'fear', 'swim']];
  cfg.forEach(([y, ex, of], i) => drawCharacter(ctx, K, pose({ yaw: y * 0.4, headYaw: y * 0.6, expr: ex, lShoulderRoll: 0.2, rShoulderRoll: 0.2, lElbow: 0.3, rElbow: 0.3 }), { x: 330 + i * 630, y: 1500, scale: 2.0, light: LIGHT.studio, outfit: of, time: t }));
}
