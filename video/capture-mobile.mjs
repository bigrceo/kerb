// Mobile captures of the live site (375x812 at 2x) for the product film's phone mockups.
import { chromium } from "/Users/rayane/hush/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await b.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [n, u] of [["home", "/"], ["markets", "/markets"], ["make", "/offers/new"], ["offer", "/offers/0"], ["history", "/history"], ["wallets", "/wallets"]]) {
  await p.goto("https://kerbtrade.xyz" + u, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".rv").forEach((e) => e.classList.add("in")));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `mobile/${n}.png` });
  console.log(n);
}
await b.close();
