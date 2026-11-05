// Renders comp.html frame by frame with Chrome and pipes the frames into ffmpeg.
//   node render.mjs stills 1.5 5.5 ...   -> stills/t-<t>.jpg
//   node render.mjs                      -> out/kerb-launch.mp4 (silent; music is muxed after)
import { chromium } from "/Users/rayane/hush/node_modules/playwright-core/index.mjs";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const FF = "/Users/rayane/clipfun/node_modules/ffmpeg-static/ffmpeg", FPS = 30;
const COMP = process.env.COMP || "comp.html", DUR = Number(process.env.DUR || 27), OUT = process.env.OUT || "out/silent.mp4";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + new URL(COMP, import.meta.url).pathname + (process.env.CA ? `?ca=${process.env.CA}` : ""));
await page.evaluate(() => window.ready);
const [mode, ...ts] = process.argv.slice(2);
if (mode === "stills") {
  mkdirSync("stills", { recursive: true });
  for (const t of ts) { await page.evaluate((t) => render(+t), t); await page.screenshot({ path: `stills/${COMP.replace(".html", "")}-${t}.jpg`, type: "jpeg", quality: 85 }); }
} else {
  mkdirSync("out", { recursive: true });
  const ff = spawn(FF, ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", OUT], { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = 0; f < FPS * DUR; f++) {
    await page.evaluate((t) => render(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: "jpeg", quality: 95 }));
    if (f % 150 === 0) console.log(`frame ${f}/${FPS * DUR}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r));
}
await browser.close();
