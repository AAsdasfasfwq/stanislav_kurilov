import { makeLiner } from '../../lib/three/liner3d.js';
import { makeOcean, OCEAN } from '../../lib/three/ocean3d.js';
let S = null;
export async function preload(E) {
  const T = await E.getThree(); const THREE = T.THREE;
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(32, 16 / 9, 1, 8000);
  const ocean = makeOcean(THREE, OCEAN.storm); scene.add(ocean.mesh, ocean.sky);
  const ship = makeLiner(THREE, {}); scene.add(ship.group);
  scene.add(new THREE.HemisphereLight(0x9fb6c4, 0x0b1620, 0.6)); const moon = new THREE.DirectionalLight(0xbcd3e6, 1.2); moon.position.set(-200, 300, -400); scene.add(moon);
  scene.fog = null; S = { T, THREE, scene, cam, ocean, ship };
}
export function draw(ctx, t, E) {
  const { T, scene, cam, ocean, ship } = S;
  ocean.update(t + 10); ship.update(t);
  const a = ocean.attitude(0, 0, t + 10); ship.group.position.y = a.y; ship.group.rotation.z = a.pitch * 0.5; ship.group.rotation.x = a.roll * 0.7;
  cam.position.set(230, 28, 260); cam.lookAt(-10, 14, 0);
  ctx.drawImage(T.render(scene, cam), 0, 0);
  E.postSet({ bloom: 0.25 });
}
