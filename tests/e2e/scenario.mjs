export default async function scenario(page, { name, out }) {
  const shot = (s) => page.screenshot({ path: `${out}${name}-${s}.png` });
  await page.waitForTimeout(400);
  await shot('0-start');
  for (let r = 1; r <= 3; r++) {
    await page.click('[data-rot="1"]');
    await page.waitForTimeout(350);
    await shot(`1-rot${r}`);
  }
  const rot = await page.evaluate(() => window.game.camera.rot);
  if (rot !== 3) throw new Error(`expected rot 3, got ${rot}`);
}
