import { drawLiner, drawHullSection } from '../../lib/art/liner2d.js';
import { View, drawLand, drawGraticule, drawRoute, pin, ringNear } from '../../lib/art/maps.js';
import { PACIFIC, USSR, PHILIPPINES_HI, PLACES, CRUISE_ROUTE, WORLD } from '../../lib/art/geo-data.js';
import { bgGrad } from '../../engine/draw.js';
export function draw(ctx, t, E) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 960, 540); ctx.clip(); bgGrad(ctx, '#0f2a3a', '#06131b');
  drawLiner(ctx, { x: 480, y: 330, scale: 0.8, t, lights: 1 }); ctx.fillStyle = 'rgba(15,42,58,0.85)'; ctx.fillRect(0, 330, 960, 210); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(960, 0, 960, 540); ctx.clip(); ctx.fillStyle = '#10263f'; ctx.fillRect(960, 0, 960, 540);
  drawLiner(ctx, { x: 1440, y: 300, scale: 0.75, t, style: 'blueprint' }); drawHullSection(ctx, { x: 1440, y: 440, scale: 0.35 }); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, 540, 960, 540); ctx.clip(); ctx.fillStyle = '#1d4a5c'; ctx.fillRect(0, 540, 960, 540);
  const v = new View({ type: 'merc', center: [130, 25], zoom: 14, x: 480, y: 810 });
  drawGraticule(ctx, v, { step: 10 }); drawLand(ctx, PACIFIC, v, { relief: true }); drawLand(ctx, USSR, v, { fill: 'rgba(232,67,46,0.35)', stroke: '#e8432e', shadow: null });
  drawRoute(ctx, CRUISE_ROUTE, v, 0.7); const [x, y] = v.project(...PLACES.siargao); pin(ctx, x, y, 1, { t }); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(960, 540, 960, 540); ctx.clip(); ctx.fillStyle = '#0a3e5c'; ctx.fillRect(960, 540, 960, 540);
  const v2 = new View({ type: 'merc', center: [126.3, 9.9], zoom: 300, x: 1440, y: 810 }); drawLand(ctx, PHILIPPINES_HI, v2, { fill: '#2fa36b', stroke: '#e6f0e8', relief: true });
  const g = new View({ type: 'ortho', rot: [140, 20], radius: 160, x: 1780, y: 680 }); ctx.fillStyle = '#123'; ctx.beginPath(); ctx.arc(1780, 680, 160, 0, 6.3); ctx.fill(); drawLand(ctx, WORLD, g, { fill: '#cfc6b0', stroke: null, shadow: null }); ctx.restore();
}
