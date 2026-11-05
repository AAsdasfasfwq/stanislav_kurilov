import { drawCharacter, pose, P, LIGHT, idle, treadWater, swimCrawl } from '../../lib/chars/rig.js';
import { CAST } from '../../lib/chars/kurilov.js';
import { bgGrad, glow } from '../../engine/draw.js';
export function draw(ctx, t, E) {
  const K = CAST.kurilov;
  // panel 1: stern rail, back view, storm
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 960, 540); ctx.clip(); bgGrad(ctx, '#1c2b36', '#0b1620');
  drawCharacter(ctx, K, pose({ ...P.standRail, ...idle(t), wind: 18 }), { x: 480, y: 330, scale: 0.55, light: LIGHT.stormNight, outfit: 'deck', time: t });
  ctx.fillStyle = '#20262c'; ctx.fillRect(0, 395, 960, 14); ctx.restore();
  // panel 2: swimming close-up with mask & snorkel
  ctx.save(); ctx.beginPath(); ctx.rect(960, 0, 960, 540); ctx.clip(); bgGrad(ctx, '#0f3b52', '#06202d');
  drawCharacter(ctx, K, pose({ ...treadWater(t, 0.5), headYaw: 0.35, expr: 'determined', wet: 1 }), { x: 1440, y: 620, scale: 1.0, light: LIGHT.tropicSun, outfit: 'swim', mask: true, snorkel: true, time: t, burn: 0.4, stubble: 0.6 });
  ctx.fillStyle = 'rgba(20,90,120,0.75)'; ctx.fillRect(960, 470, 960, 80); ctx.restore();
  // panel 3: leap silhouette with rim light
  ctx.save(); ctx.beginPath(); ctx.rect(0, 540, 960, 540); ctx.clip(); bgGrad(ctx, '#2a3f4f', '#0b1620');
  drawCharacter(ctx, K, pose({ ...P.leap, yaw: 1.2, pitch: -0.25 }), { x: 480, y: 860, scale: 0.45, light: LIGHT.stormNight, outfit: 'swim', mask: true, time: t });
  ctx.restore();
  // panel 4: crawl stroke + expressions busts
  ctx.save(); ctx.beginPath(); ctx.rect(960, 540, 960, 540); ctx.clip(); bgGrad(ctx, '#e8dcc4', '#c9b894');
  ['exhausted', 'wonder', 'pain'].forEach((ex, i) => drawCharacter(ctx, K, pose({ headYaw: -0.4 + i * 0.4, expr: ex, ...idle(t) }), { x: 1120 + i * 300, y: 1290, scale: 0.95, light: LIGHT.memory, outfit: 'sweater', time: t, stubble: i === 0 ? 0.8 : 0.1 }));
  ctx.restore();
}
