/**
 * What a sale into the pools would do.
 *
 * Every venue a coin trades on is reduced to two reserves, tokens and ETH:
 *
 *  - a Pons bonding curve, read on chain: exact constant product over its
 *    reserves, curve fee and creator tax taken from the ETH out (the curve's
 *    own formula, mirrored from PonsV2BondingCurveMath);
 *  - a graduated Pons pool on Uniswap v4, read on chain: full-range liquidity,
 *    so its virtual reserves are exact; pool fee taken from the tokens in;
 *  - any other pool DexScreener lists: modelled as constant product with half
 *    its USD value on each side. An estimate, and labelled as one.
 *
 * A sale is cut into slices and each slice goes to whichever venue pays most
 * for it at that moment, the way an aggregator routes. The chart move is the
 * deepest venue's price after the sale against before.
 */
export type Venue = {
  id: string;
  label: string;
  kind: "curve" | "v4" | "pool";
  exact: boolean;
  tokens: number; // token reserve, whole tokens
  eth: number; // ETH reserve
  feeIn: number; // fraction taken from tokens in
  feeOut: number; // fraction taken from ETH out
};

export type Impact = {
  ethOut: number;
  spotEth: number; // ETH the bag is worth at the deepest venue's spot price
  slippage: number; // fraction lost vs spot
  chartMove: number; // fraction, negative = down
  perVenue: { id: string; tokens: number; eth: number }[];
};

const SLICES = 400;

export function sellImpact(venues: Venue[], tokensToSell: number): Impact | null {
  const live = venues.filter((v) => v.tokens > 0 && v.eth > 0);
  if (!live.length || !(tokensToSell > 0)) return null;
  const deepest = live.reduce((a, b) => (b.eth > a.eth ? b : a));
  const state = live.map((v) => ({ v, x: v.tokens, y: v.eth, sold: 0, got: 0 }));
  const spot = deepest.eth / deepest.tokens;
  const slice = tokensToSell / SLICES;
  let ethOut = 0;
  for (let i = 0; i < SLICES; i++) {
    let best = state[0];
    let bestOut = -1;
    for (const s of state) {
      const dx = slice * (1 - s.v.feeIn);
      const out = ((s.y * dx) / (s.x + dx)) * (1 - s.v.feeOut);
      if (out > bestOut) {
        bestOut = out;
        best = s;
      }
    }
    const dx = slice * (1 - best.v.feeIn);
    const gross = (best.y * dx) / (best.x + dx);
    best.x += dx;
    best.y -= gross;
    best.sold += slice;
    best.got += bestOut;
    ethOut += bestOut;
  }
  const d = state.find((s) => s.v.id === deepest.id)!;
  const after = d.y / d.x;
  const spotEth = tokensToSell * spot;
  return {
    ethOut,
    spotEth,
    slippage: spotEth > 0 ? 1 - ethOut / spotEth : 0,
    chartMove: after / spot - 1,
    perVenue: state.filter((s) => s.sold > 0).map((s) => ({ id: s.v.id, tokens: s.sold, eth: s.got })),
  };
}

/** Same thing the other way: ETH it would cost to buy `tokens` out of the pools. */
export function buyCost(venues: Venue[], tokens: number): number | null {
  const live = venues.filter((v) => v.tokens > 0 && v.eth > 0);
  if (!live.length || !(tokens > 0)) return null;
  const state = live.map((v) => ({ v, x: v.tokens, y: v.eth }));
  const slice = tokens / SLICES;
  let cost = 0;
  for (let i = 0; i < SLICES; i++) {
    let best = -1;
    let bestIn = Infinity;
    state.forEach((s, j) => {
      if (slice >= s.x) return;
      const gross = (s.y * slice) / (s.x - slice) / (1 - s.v.feeIn) / (1 - s.v.feeOut);
      if (gross < bestIn) {
        bestIn = gross;
        best = j;
      }
    });
    if (best < 0) return null; // not enough tokens in the pools
    const s = state[best];
    s.y += (s.y * slice) / (s.x - slice);
    s.x -= slice;
    cost += bestIn;
  }
  return cost;
}
