import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /*
   * Le repo a deux lockfiles — celui des contrats à la racine, celui du front
   * ici. Sans cette ligne Turbopack choisit la racine et prévient à chaque
   * build ; on lui dit explicitement que le front est le projet.
   */
  turbopack: { root: path.resolve(process.cwd()) },
  // The EVM desk pages are gone on Solana: old links land on Make a deal.
  async redirects() {
    return ["offers", "positions", "wallets", "pools", "history"].map((p) => ({ source: `/${p}/:rest*`, destination: "/deal/new", permanent: false }));
  },
};

export default nextConfig;
