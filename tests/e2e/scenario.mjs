export default async function scenario(page, { name, out, touch }) {
  const shot = (s) => page.screenshot({ path: `${out}${name}-${s}.png` });
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  await page.waitForTimeout(300);

  // M0: rotation through all four stops
  for (let r = 1; r <= 4; r++) {
    await page.click('[data-rot="1"]');
    await page.waitForTimeout(320);
  }
  const rot = await page.evaluate(() => window.game.camera.rot);
  if (rot !== 0) throw new Error(`expected rot 0 after a full turn, got ${rot}`);

  // M1: tap a tile outside the house; the Mim should leave through the door and arrive
  const [tx, ty] = await page.evaluate(() => window.game.screenOf(10.5, 15.5));
  await tapAt(tx, ty);
  await page.evaluate(() => window.game.setSpeed(3));
  await page.waitForFunction(() => {
    const m = window.game.world.mims[0];
    return m.path.length === 0 && Math.floor(m.x) === 10 && Math.floor(m.y) === 15;
  }, null, { timeout: 8000 });
  await page.evaluate(() => window.game.setSpeed(1));

  // Tapping where it can't go (inside a sealed corner is not possible here) is covered by unit tests.
  // Zoom in on the Mim and capture it from every rotation.
  await page.evaluate(() => {
    const g = window.game;
    const m = g.world.mims[0];
    g.camera.cx = m.x;
    g.camera.cy = m.y;
    g.camera.zoom = 2;
  });
  for (let r = 0; r < 4; r++) {
    await page.waitForTimeout(120);
    await shot(`mim-rot${r}`);
    await page.evaluate(() => window.game.camera.rotate(1));
    await page.waitForTimeout(320);
  }

  // Send it walking back inside and capture mid-walk
  await page.evaluate(() => {
    const g = window.game;
    g.camera.zoom = name === 'phone' ? 0.75 : 1;
  }).catch(() => {});
  await page.evaluate(() => { window.game.camera.zoom = 1; window.game.camera.cx = 11; window.game.camera.cy = 11; });
  const [ix, iy] = await page.evaluate(() => window.game.screenOf(8.5, 8.5));
  await tapAt(ix, iy);
  await page.waitForTimeout(1500);
  await shot('walking');
}
