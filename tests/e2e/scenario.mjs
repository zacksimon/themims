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
