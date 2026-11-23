export default async function scenario(page, { name, out, touch }) {
  const shot = (s) => page.screenshot({ path: `${out}${name}-${s}.png` });
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const stepMinutes = (mins) => page.evaluate((mins) => { for (let t = 0; t < mins; t += 0.25) window.game.world.step(0.25); }, mins);
  await page.evaluate(() => { window.game.setSpeed(0); window.game.world.freeWill = false; });
  const focus = (x, y) => page.evaluate(([x, y]) => { window.game.camera.cx = x; window.game.camera.cy = y; }, [x, y]);
  await page.waitForTimeout(300);
  await shot('0-house');

  // M0: rotation through all four stops
  for (let r = 1; r <= 4; r++) {
    await page.click('[data-rot="1"]');
    await page.waitForTimeout(320);
  }
  if ((await page.evaluate(() => window.game.camera.rot)) !== 0) throw new Error('rotation did not return to 0');

  // M1: tap the lawn; the Mim walks out the front door
  await focus(9.5, 16.5);
  const [tx, ty] = await page.evaluate(() => window.game.screenOf(9.5, 18.5));
  const hitCanvas = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id === 'view', [tx, ty]);
  if (!hitCanvas) throw new Error('tap target is covered by UI');
  await tapAt(tx, ty);
  await stepMinutes(6);
  const pos = await page.evaluate(() => { const m = window.game.world.mims[0]; return [Math.floor(m.x), Math.floor(m.y)]; });
  if (pos[0] !== 9 || pos[1] !== 18) throw new Error(`walk failed, at ${pos}`);

  // M2: tap the toilet, pick "Use" from the pie menu
  await page.evaluate(() => (window.game.world.mims[0].needs.bladder = 20));
  await focus(11.5, 6.5);
  const [ox, oy] = await page.evaluate(() => { const o = window.game.world.objects.find((o) => o.def === 'toilet'); return window.game.screenOf(o.x + 0.5, o.y + 0.5, 0.6); });
  await tapAt(ox, oy);
  await page.waitForSelector('.pie-item');
  await page.waitForTimeout(250);
  await shot('1-pie');
  if (await page.evaluate(() => getComputedStyle(document.querySelector('.tooltip')).display !== 'none')) throw new Error('tooltip covers the pie menu');
  if ((await page.evaluate(() => window.game.world.mims[0].queue.length)) !== 0) throw new Error('opening tap selected an option');
  await page.waitForTimeout(250);
  const btn = await page.locator('.pie-item:has-text("Use")').boundingBox();
  await tapAt(btn.x + btn.width / 2, btn.y + btn.height / 2);
  const q = await page.evaluate(() => window.game.world.mims[0].queue.map((a) => a.label));
  if (q[0] !== 'Use') throw new Error(`queue: ${q}`);
  await stepMinutes(20);
  const bladder = await page.evaluate(() => window.game.world.mims[0].needs.bladder);
  if (bladder < 90) throw new Error(`bladder not refilled: ${bladder}`);

  // Watch TV from the sofa (seat preference), captured mid-activity
  await page.evaluate(() => {
    const g = window.game, w = g.world, m = w.mims[0];
    m.needs.fun = 10;
    w.queueInteraction(m, w.objects.find((o) => o.def === 'tv'), 'watch');
    for (let t = 0; t < 8; t += 0.25) w.step(0.25);
    g.camera.cx = 9; g.camera.cy = 12; g.camera.zoom = name === 'phone' ? 1 : 1.5;
  });
  await page.waitForTimeout(200);
  await shot('2-tv');
  if ((await page.evaluate(() => window.game.world.mims[0].pose)) !== 'sit') throw new Error('not sitting for TV');

  // Sleep in bed
  await page.evaluate(() => {
    const g = window.game, w = g.world, m = w.mims[0];
    w.cancelAction(m, m.queue[0].uid);
    for (let t = 0; t < 1; t += 0.25) w.step(0.25);
    m.needs.energy = 10;
    w.queueInteraction(m, w.objects.find((o) => o.def === 'bed_single'), 'sleep');
    for (let t = 0; t < 15; t += 0.25) w.step(0.25);
    g.camera.cx = 7; g.camera.cy = 7;
  });
  await page.waitForTimeout(200);
  await shot('3-bed');
  if ((await page.evaluate(() => window.game.world.mims[0].pose)) !== 'lie') throw new Error('not lying in bed');
  for (let r = 1; r <= 3; r++) {
    await page.evaluate(() => window.game.camera.setRot((window.game.camera.rot + 1) % 4));
    await page.waitForTimeout(100);
    await shot(`3-bed-rot${r}`);
  }
  await page.evaluate(() => window.game.camera.setRot(0));

  // Let free will run for a simulated day at full speed and make sure nothing breaks
  await page.evaluate(() => {
    const w = window.game.world, m = w.mims[0];
    w.freeWill = true;
    w.cancelAction(m, m.queue[0].uid);
    for (let t = 0; t < 24 * 60; t += 0.25) w.step(0.25);
  });
  await page.waitForTimeout(200);
  await shot('4-day-later');
}

/** M3: build and buy modes. Phone drags use real touch events through the DevTools protocol. */
export async function buildBuy(page, { name, out, touch }) {
  const shot = (s) => page.screenshot({ path: `${out}${name}-${s}.png` });
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const drag = async (x0, y0, x1, y1, midShot) => {
    const steps = 8;
    if (touch) {
      const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps) });
        await page.waitForTimeout(16);
      }
      if (midShot) await shot(midShot);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
        await page.waitForTimeout(16);
      }
      if (midShot) await shot(midShot);
      await page.mouse.up();
    }
    await page.waitForTimeout(80);
  };
  const scr = (x, y, z = 0) => page.evaluate(([x, y, z]) => window.game.screenOf(x, y, z), [x, y, z]);
  const state = () => page.evaluate(() => ({ funds: window.game.world.funds, objs: window.game.world.objects.length, walls: window.game.world.lot.walls.size, speed: window.game.speedIndex }));

  await page.evaluate(() => { const g = window.game; g.setSpeed(2); g.camera.setRot(0); g.camera.zoom = g.camera.w < 600 ? 0.75 : 1; g.camera.cx = 15; g.camera.cy = 9; g.world.freeWill = false; });

  // ---- Buy mode ----
  await page.click('[data-mode="buy"]');
  let st = await state();
  if (st.speed !== 0) throw new Error('buy mode should pause time');
  await page.waitForTimeout(150);
  await shot('5-buy-catalog');
  await page.click('[data-buy="fern"]');
  const [fx, fy] = await scr(15.5, 7.5);
  await tapAt(fx, fy);
  if (touch) {
    await shot('6-buy-ghost');
    await page.click('.placing .ok');
  }
  await page.waitForTimeout(100);
  let after = await state();
  if (after.objs !== st.objs + 1 || after.funds !== st.funds - 90) throw new Error(`buying failed: ${JSON.stringify([st, after])}`);
  if (!touch) await page.keyboard.press('Escape');
  else await page.click('.placing button[aria-label="Cancel"]');

  // sell it again via the object menu (full refund within the hour)
  const [sx, sy] = await scr(15.5, 7.5, 0.7);
  await tapAt(sx, sy);
  await page.waitForSelector('.pie-item');
  await page.waitForTimeout(400);
  const sell = await page.locator('.pie-item:has-text("Sell")').boundingBox();
  await tapAt(sell.x + sell.width / 2, sell.y + sell.height / 2);
  await page.waitForTimeout(100);
  after = await state();
  if (after.objs !== st.objs || after.funds !== st.funds) throw new Error(`selling failed: ${JSON.stringify([st, after])}`);

  // ---- Build mode: a shed on the lawn ----
  await page.click('[data-mode="build"]');
  await page.evaluate(() => { const c = window.game.camera; c.cx = 20.5; c.cy = 6; });
  await page.waitForTimeout(100);
  st = await state();
  await page.click('[data-tool="wall"]').catch(() => {});
  if (!(await page.evaluate(() => window.game.build.tool === 'wall'))) await page.click('[data-tool="wall"]');
  const [a0, a1] = await scr(19, 3);
  const [b0, b1] = await scr(19, 8);
  await drag(a0, a1, b0, b1, '7-build-wall-preview');
  after = await state();
  if (after.walls !== st.walls + 5) throw new Error(`wall drag added ${after.walls - st.walls} walls`);
  // floor rectangle
  await page.click('[data-tool="floor"]');
  const [c0, c1] = await scr(19.5, 3.5);
  const [d0, d1] = await scr(21.5, 7.5);
  await drag(c0, c1, d0, d1);
  const floored = await page.evaluate(() => window.game.world.lot.floor(20, 5));
  if (floored < 0) throw new Error('floor drag did nothing');
  // door on the new wall
  await page.click('[data-tool="door"]');
  const [e0, e1] = await scr(19, 5.5, 1.2);
  await tapAt(e0, e1);
  const door = await page.evaluate(() => window.game.world.lot.walls.get('v:19:5')?.kind);
  if (door !== 'door') throw new Error(`door not placed: ${door}`);
  await page.waitForTimeout(100);
  await shot('8-build-done');
  // undo three times: door, floor, walls
  for (let i = 0; i < 3; i++) await page.click('.undo');
  after = await state();
  if (after.walls !== st.walls || after.funds !== st.funds) throw new Error(`undo failed: ${JSON.stringify([st, after])}`);

  // ---- Back to live: time resumes ----
  // Undo must be visible (not scrolled away) on every screen size
  const undoBox = await page.locator('.sheet > .undo').boundingBox();
  const vp = page.viewportSize();
  if (!undoBox || undoBox.x + undoBox.width > vp.width || undoBox.x < 0) throw new Error('undo button is off-screen');
  await shot('9-build-undo-pinned');
  await page.click('[data-mode="live"]');
  if ((await state()).speed === 0) throw new Error('live mode should resume time');
  if (await page.evaluate(() => window.game.build.builder.canUndo)) throw new Error('undo history should clear when returning to live');
}

/** M4: household, social interactions, relationships, voices. */
export async function household(page, { name, out, touch }) {
  const shot = (s) => page.screenshot({ path: `${out}${name}-${s}.png` });
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  // The Mim panel re-renders when needs change, so look the element up fresh and retry briefly.
  const tapEl = async (sel) => {
    for (let i = 0; i < 10; i++) {
      const b = await page.locator(sel).first().boundingBox().catch(() => null);
      if (b) return tapAt(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(50);
    }
    throw new Error(`could not tap ${sel}`);
  };
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    g.setSpeed(0);
    w.freeWill = false;
    for (const m of w.mims) for (const a of [...m.queue]) w.cancelAction(m, a.uid);
    for (let t = 0; t < 2; t += 0.25) w.step(0.25);
    g.camera.setRot(0);
    g.camera.zoom = g.camera.w < 600 ? 1 : 1.5;
  });
  // four portraits in the household strip
  const n = await page.locator('.household .pp').count();
  if (n !== 4) throw new Error(`expected 4 household portraits, got ${n}`);
  // select Dotty from her portrait: the camera centers on her
  await tapEl('.household .pp >> nth=1');
  const sel = await page.evaluate(() => window.game.selected?.name);
  if (!sel?.startsWith('Dotty')) throw new Error(`portrait selected ${sel}`);
  // put Bartley next to the living room and tap him for the social pie
  await page.evaluate(() => {
    const w = window.game.world;
    const [b, d] = [w.mims[0], w.mims[1]];
    b.x = 9.5; b.y = 12.5; d.x = 6.5; d.y = 13.5;
    window.game.camera.cx = 8; window.game.camera.cy = 13;
  });
  await page.waitForTimeout(150);
  const [bx, by] = await page.evaluate(() => window.game.screenOf(9.5, 12.5, 1.0));
  await tapAt(bx, by);
  await page.waitForSelector('.pie-item');
  await page.waitForTimeout(400);
  await shot('10-social-pie');
  const labels = await page.locator('.pie-item').allInnerTexts();
  if (!labels.some((l) => l.includes('Chat')) || !labels.some((l) => l.includes('Select'))) throw new Error(`social pie: ${labels}`);
  const hugDisabled = await page.locator('.pie-item:has-text("Hug")').isDisabled();
  if (!hugDisabled) throw new Error('hug should need a better relationship');
  await tapEl('.pie-item:has-text("Chat")');
  const q = await page.evaluate(() => window.game.world.mims[1].queue.map((a) => a.kind));
  if (q[0] !== 'social') throw new Error(`queue after chat: ${q}`);
  // run the chat and catch it mid-conversation
  const rel0 = await page.evaluate(() => window.game.world.rel(window.game.world.mims[0].id, window.game.world.mims[1].id).daily);
  await page.evaluate(() => {
    const w = window.game.world;
    w.rng.next = (() => { const r = w.rng.next.bind(w.rng); return () => Math.min(r(), 0.3); })(); // make acceptance likely
    for (let t = 0; t < 7; t += 0.25) w.step(0.25);
  });
  await page.waitForTimeout(120);
  await shot('11-chatting');
  const engaged = await page.evaluate(() => !!window.game.world.mims[0].engaged);
  if (!engaged) throw new Error('Bartley should be held in conversation');
  await page.evaluate(() => { const w = window.game.world; for (let t = 0; t < 12; t += 0.25) w.step(0.25); });
  const rel1 = await page.evaluate(() => window.game.world.rel(window.game.world.mims[0].id, window.game.world.mims[1].id).daily);
  if (!(rel1 > rel0)) throw new Error(`relationship did not grow: ${rel0} -> ${rel1}`);
  // Friends tab (expand the panel first on phones)
  if (await page.locator('.mimpanel .collapse:has-text("▴")').count()) await tapEl('.mimpanel .collapse');
  await tapEl('[data-tab="friends"]');
  const friends = await page.locator('.friend').count();
  if (friends !== 3) throw new Error(`friends list has ${friends}`);
  await shot('12-friends');
  // sound: settings popover and a real babble through Web Audio
  await tapEl('.gear');
  await page.waitForSelector('.settings-pop');
  const played = await page.evaluate(async () => {
    const g = window.game;
    for (let i = 0; i < 20 && !g.audio.ready; i++) await new Promise((r) => setTimeout(r, 50));
    return g.audio.babble(g.world.mims[2].voice, 'question', 4);
  });
  if (!(played > 0)) throw new Error('voice did not play');
  await tapEl('.gear');
}
