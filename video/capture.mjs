// Real screens of Kerb for the video, taken from the running site with Chrome at 2x.
import { chromium } from "/Users/rayane/hush/node_modules/playwright-core/index.mjs";
const BASE = process.env.BASE || "http://localhost:4330";
const FILL = "0x761488f4858e6c658ea6b4d3a3db680a448515f2f611048356ad3ccd58209f78";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const settle = (ms = 2500) => page.evaluate(async (ms) => {
  await new Promise((r) => setTimeout(r, ms));
  document.querySelectorAll(".rv").forEach((e) => { e.style.transition = "none"; e.classList.add("in"); });
  document.getAnimations().forEach((a) => { try { a.finish(); } catch {} });
  document.querySelector("nextjs-portal")?.remove();
}, ms);
const shot = async (path, name, prep, ms) => { await page.goto(BASE + path); await settle(ms); if (prep) await page.evaluate(prep); await page.waitForTimeout(500); await page.screenshot({ path: `screens/${name}.png` }); };
await shot("/", "hero");
await shot("/markets", "markets", () => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "$50.0K")?.click(), 6000);
await shot("/offers/0", "offer", null, 5000);
await shot("/history", "history", null, 6000);
await shot("/offers/new?token=0x51250B135174Ca09450EC01c4afF73CF69DBb590", "make", null, 6000);
// The mega menu open, for the nav shot.
await page.goto(BASE + "/markets"); await settle(4000);
await page.hover("nav#nav .links button"); await page.waitForTimeout(900);
await page.screenshot({ path: "screens/menu.png" });
// The fill on the explorer.
try { await page.goto(`https://robinhoodchain.blockscout.com/tx/${FILL}`); await page.waitForTimeout(8000);
  await page.getByText("Reject all").click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800);
  await page.screenshot({ path: "screens/explorer.png" });
  await page.getByText("Token transfers").first().click(); await page.waitForTimeout(4000);
  await page.screenshot({ path: "screens/transfers.png" }); } catch (e) { console.log("explorer", e.message); }
await browser.close();
