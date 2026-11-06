// Renders every visual of the X pack with Chrome: the site's font (Inter), the Kerb mark at its real
// geometry, the real logos of the brands named (Robinhood feather, DEX Screener).
// Backgrounds: real screens of the site (shots/), blurred until nothing reads, plus the kerb-yellow glow.
//   node compose.mjs            -> img/*.png
import { chromium } from "/Users/rayane/hush/node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";

const DIR = new URL(".", import.meta.url).pathname;
const Y = "#f2c230", INK = "#0d0e0b";
// The mark sits low in its 32x32 box; centred=true shifts the view so it reads centred (avatar).
const MARK = (s, centred = false) => `<svg viewBox="${centred ? "0 4.5 32 32" : "0 0 32 32"}" style="width:${s}px;height:${s}px;display:block"><path d="M2 22h12v-9h16v15H2z" fill="${Y}"/></svg>`;
const CSS = `
@font-face{font-family:IN;src:url("fonts/inter.ttf");font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{background:${INK};font-family:IN;color:#f1efe4;-webkit-font-smoothing:antialiased}
#s{position:relative;overflow:hidden;background:${INK}}
.bg{position:absolute;inset:-90px;background-size:cover;background-position:center;filter:blur(80px) brightness(.4) saturate(1.1)}
.haze{position:absolute;inset:0;background:radial-gradient(70% 60% at 50% 115%,rgba(242,194,48,.36),rgba(242,194,48,.08) 45%,rgba(242,194,48,0) 75%)}
.vig{position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))}
.kerbline{position:absolute;left:0;right:0;bottom:0;height:16px;background:repeating-linear-gradient(90deg,${Y} 0 34px,transparent 34px 68px);opacity:.9}
.lock{display:flex;align-items:center;gap:20px;white-space:nowrap}
.lock .k{display:flex;align-items:center;gap:12px}
.lock .wm{font:700 var(--wm) IN;letter-spacing:-.04em}
.lock .x{font:300 var(--x) IN;color:#8a8a7c}
.lock .rh{font:600 var(--rh) IN;letter-spacing:-.03em}
.eye{font:600 24px IN;letter-spacing:.18em;text-transform:uppercase;color:${Y}}
h1{font:700 100px/1.02 IN;letter-spacing:-.05em}
h1 span{color:${Y}}
.body{font:400 32px/1.45 IN;color:#cfcdc0;letter-spacing:-.01em}
.mono{font-family:ui-monospace,Menlo,monospace}
.foot{position:absolute;left:72px;right:72px;bottom:58px;display:flex;justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.12);padding-top:24px;font:600 20px IN;letter-spacing:.16em;text-transform:uppercase}
.foot .l{color:${Y}}.foot .r{color:#8a8a7c}
.shot{position:absolute;border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px rgba(242,194,48,.22),0 40px 90px -20px rgba(0,0,0,.8),0 30px 120px -40px rgba(242,194,48,.35)}
.shot img{display:block;width:100%}
`;
const feather = (h) => `<img src="img/robinhood.svg" style="height:${h}px;width:auto;display:block">`;
const lockup = (m = 40, wm = 36, x = 28, rh = 30, f = 34) =>
  `<div class="lock" style="--wm:${wm}px;--x:${x}px;--rh:${rh}px"><div class="k">${MARK(m)}<div class="wm">Kerb</div></div></div>`;
const bg = (shot, pos = "center") => `<div class=bg style="background-image:url(shots/${shot}.png);background-position:${pos}"></div><div class=haze></div><div class=vig></div>`;
const foot = `<div class=foot><div class=l>kerbtrade.xyz</div></div>`;

// Post 1600x900: lockup, eyebrow, two-beat title (second line in yellow), body, foot. Text block centred
// between the lockup and the foot. An optional real screen on the right.
const GRID = `<div style="position:absolute;inset:0;background:radial-gradient(70% 70% at 70% 40%,#1d2013,${INK})"></div><div class=haze></div><div class=vig></div><div class=kerbline style="height:10px;background:repeating-linear-gradient(90deg,${Y} 0 40px,transparent 40px 80px)"></div>`;
function post(shot, eyebrow, plain, gold, body, side = "") {
  const w = side ? 820 : 1300;
  return `${shot === GRID ? GRID : bg(shot)}<div style="position:absolute;left:72px;top:60px">${lockup()}</div>
    <div style="position:absolute;left:72px;top:150px;bottom:150px;width:${w}px;display:flex;flex-direction:column;justify-content:center;gap:26px">
      <div class=eye>${eyebrow}</div><h1 style="font-size:${side ? 84 : 100}px">${plain}<br><span>${gold}</span></h1><div class=body>${body}</div></div>
    ${side}${foot}`;
}
const side = (shot, top = 150, left = 950, width = 820, crop = "") =>
  `<div class=shot style="left:${left}px;top:${top}px;width:${width}px;${crop}"><img src="shots/${shot}.png"></div>`;

const TX = "0x761488f4…209f78";
const JOBS = {
  pfp: [1024, 1024, `<div style="position:absolute;inset:0;background:radial-gradient(60% 60% at 50% 40%,#1d2013,${INK})"></div>
    <div style="position:absolute;inset:0;display:grid;place-items:center">${MARK(640, true)}</div>`],
  // Banner: the site's own look (blurred real screen, kerb-yellow glow, kerb stripes, a real offer screen),
  // the slogan alone on it. No ticker, no logo. Left third stays empty for the avatar.
  "x-banner": [1500, 500, `${bg("hero", "center 30%")}<div class=kerbline style="height:12px"></div>
    <div style="position:absolute;left:520px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">
      <div style="font:700 76px/1.02 IN;letter-spacing:-.05em">Trade the bag<br><span style="color:${Y}">off the chart.</span></div></div>
    <div class=shot style="left:1150px;top:70px;width:520px;transform:rotate(-4deg)"><img src="shots/offer.png"></div>`],
  "A0-cover": [1500, 600, `${bg("markets")}<div class=kerbline></div>
    <div style="position:absolute;left:80px;top:64px">${lockup(34, 30, 24, 26, 28)}</div>
    <div style="position:absolute;left:80px;top:150px;width:720px;display:flex;flex-direction:column;gap:20px">
      <div class=eye style="font-size:20px">Introducing Kerb</div>
      <div style="font:700 84px/1.0 IN;letter-spacing:-.05em">Big bag?<br><span style="color:${Y}">Keep the chart flat.</span></div></div>
    <div class=shot style="left:860px;top:90px;width:760px"><img src="shots/markets.png"></div>`],
  "T1-mechanic": [1600, 900, post("make", "How it works", "One buyer. One tx.", "Chart move: 0.0%.",
    "Lock the bag at your price. A buyer takes it.<br>Tokens and ETH swap in the same transaction,<br>or nothing moves.", side("make", 170, 980, 760))],
  "T2-simulator": [1600, 900, post("markets", "Read on chain, not guessed", "$50K of NOVAAI into the pool:", "−9.4% on the chart.",
    "The same bag on Kerb: 0.0%.<br>Kerb shows both before you sign,<br>from Pons curves and Uniswap v4.", side("markets", 150, 960, 800))],
  "T3-proof": [1600, 900, post(GRID, "Live on mainnet", "First fill settled.", "Check it yourself.",
    `1.086 NOVAAI for 0.0002 ETH, wallet to wallet.<br>One transaction. Status: success.<br><span class=mono style="font-size:26px;color:#9b9a8c">tx ${TX}</span>`, side("transfers", 190, 960, 800))],
  "T4-escrow": [1600, 900, post("offer", "No server key", "Your escrow goes one way:", "to your buyer, or back to you.",
    "No off-chain signature, no admin withdrawal.<br>Contract source verified, exact match, on Sourcify.<br>Cancel any time.")],
  "T5-whales": [1600, 900, post("history", "Private bids", "Want a whale's bag?", "Bid for it directly.",
    "Wallets lists the biggest holders of any coin.<br>One click makes them an offer only they can take.")],
  "T6-fees": [1600, 900, post("hero", "Fees", "Makers pay nothing.", "Takers pay 0.3%.",
    "Post an ask or a bid for free.<br>The fee is on the ETH leg, paid by whoever fills it.")],
  "L1-live": [1600, 900, `${bg("hero")}<div class=kerbline></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center">
      ${MARK(130)}<div style="font:700 150px/1 IN;letter-spacing:-.06em">we are live</div>
      <div class=body style="font-size:36px">The desk is open on ${`<span style="display:inline-flex;align-items:center;gap:12px;vertical-align:-6px">${feather(36)}Robinhood Chain</span>`}.</div>
      <div class=eye>kerbtrade.xyz</div></div>`],
  "D1-dexpaid": [1600, 900, `${bg("markets")}<div class=kerbline></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
      <div style="display:flex;align-items:center;gap:46px">
        <div style="display:flex;align-items:center;gap:20px">${MARK(120)}<div style="font:700 110px IN;letter-spacing:-.05em">Kerb</div></div>
        <div style="font:300 80px IN;color:#8a8a7c">×</div>
        <div style="display:flex;align-items:center;gap:22px"><img src="img/dexscreener.png" style="width:120px;height:120px;border-radius:26px;display:block"><div style="font:700 92px IN;letter-spacing:-.04em">DEX Screener</div></div></div>
      <div style="font:700 64px IN;letter-spacing:-.03em;color:${Y}">dex screener paid ✅</div></div>`],
};

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
const only = process.argv.slice(2);
for (const [name, [w, h, html]] of Object.entries(JOBS)) {
  if (only.length && !only.includes(name)) continue;
  writeFileSync(DIR + ".render.html", `<!doctype html><meta charset=utf-8><style>${CSS}</style><div id=s style="width:${w}px;height:${h}px">${html}</div>`);
  await page.setViewportSize({ width: w, height: h });
  await page.goto("file://" + DIR + ".render.html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.locator("#s").screenshot({ path: `${DIR}img/${name}.png` });
  console.log("  ", name);
}
await browser.close();
