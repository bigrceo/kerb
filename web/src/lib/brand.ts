/**
 * The whole brand in one place. Change a value here and the site follows:
 * name, ticker, domain, copy, colours and the mark itself.
 */
export const BRAND = {
  name: "Kerb",
  ticker: "KERB",
  domain: "kerbtrade.xyz",
  url: "https://kerbtrade.xyz",
  x: "https://x.com/kerbotc",
  github: "https://github.com/bigrceo/kerb",
  tagline: "Trade the bag off the chart.",
  pitch:
    "Sell a whole bag to one buyer at a price you set, or bid for someone's bag. It settles wallet to wallet in one transaction on Solana, and the pools never see it.",
  /** Kerb trading: dealing outside the exchange, on the kerb. */
  origin: "Kerb trading is the old name for deals struck outside the exchange, on the street kerb.",
  /** $KERB contract address. Empty hides every CA spot on the site. */
  tokenAddress: (process.env.NEXT_PUBLIC_KERB_TOKEN || "") as string,
  colors: {
    ink: "#0d0e0b",
    panel: "#15170f",
    line: "#2a2c22",
    text: "#f1efe4",
    dim: "#9b9a8c",
    accent: "#f2c230", // kerb paint
    up: "#7fd48a",
    down: "#ff6b57",
  },
  /** The mark: a kerb seen side on, road low on the left, pavement up on the right. 32×32. */
  markPath: "M2 22h12v-9h16v15H2z",
} as const;
