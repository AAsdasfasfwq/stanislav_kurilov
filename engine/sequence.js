// ─────────────────────────────────────────────────────────────────────────────
//  engine/sequence.js — an edit decision list for one segment.
//
//    const seq = new Sequence([
//      { at: 342.40, draw: shotNavStars,  in: TR.fromPrev(TR.water({ dur: 0.8 })) },
//      { at: 346.10, draw: shotAtlas,     in: TR.circle({ x: 960, y: 540, dur: 0.6 }) },
//      { at: 349.80, draw: shotSextant },                       // hard cut
//    ], { end: 522.4 });
//    render(ctx, t, E) { seq.render(ctx, t, E); }
//
//  draw(ctx, lt, S): lt = local seconds since shot start; S = { t, lt, dur, p, i, E, out }
//    • a shot may be asked to render past its end (lt > dur) while the NEXT shot
//      transitions in, and before its start (lt < 0) never — so keep motion
//      continuous past dur (clamp your keyframes, keep the camera drifting).
//    • S.out === true while it is being rendered as the outgoing half of a transition.
// ─────────────────────────────────────────────────────────────────────────────
export class Sequence {
  constructor(shots, { end = Infinity, name = 'seq' } = {}) {
    this.shots = shots.slice().sort((a, b) => a.at - b.at);
    this.end = end; this.name = name;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      s.i = i;
      s.end = i + 1 < this.shots.length ? this.shots[i + 1].at : end;
      s.dur = s.end - s.at;
    }
  }
  indexAt(t) {
    const sh = this.shots; let i = sh.length - 1;
    while (i > 0 && sh[i].at > t) i--;
    return i;
  }
  shotAt(t) { return this.shots[this.indexAt(t)]; }
  drawShot(ctx, shot, t, E, out = false) {
    const lt = t - shot.at;
    ctx.save();
    shot.draw(ctx, lt, { t, lt, dur: shot.dur, p: shot.dur > 0 ? lt / shot.dur : 0, i: shot.i, E, out, shot });
    ctx.restore();
  }
  render(ctx, t, E) {
    const i = this.indexAt(t); const shot = this.shots[i];
    const tr = shot.in;
    const lt = t - shot.at;
    if (tr && lt < tr.dur) {
      const p = Math.max(0, Math.min(1, lt / tr.dur));
      const prevShot = i > 0 ? this.shots[i - 1] : null;
      const useSegPrev = !prevShot && tr.fromPrev;
      if (prevShot || useSegPrev) {
        const A = E.layer(), B = E.layer();
        let okA = true;
        if (prevShot) this.drawShot(A.ctx, prevShot, t, E, true);
        else okA = E.drawPrev(A.ctx);
        this.drawShot(B.ctx, shot, t, E, false);
        if (useSegPrev && E.prevPost && tr.blendPost !== false) E.blendPost(p);
        if (!okA) { ctx.drawImage(B.canvas, 0, 0); return; }
        ctx.save(); tr.fn(ctx, A.canvas, B.canvas, p, { E, t, lt, shot, prevShot, A, B }); ctx.restore();
        return;
      }
    }
    this.drawShot(ctx, shot, t, E);
  }
}

/** Run several sub-renderers in local time — handy inside a shot: */
export const within = (lt, a, b) => lt >= a && lt < b;
