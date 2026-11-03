import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /*
   * Le repo a deux lockfiles — celui des contrats à la racine, celui du front
   * ici. Sans cette ligne Turbopack choisit la racine et prévient à chaque
   * build ; on lui dit explicitement que le front est le projet.
   */
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
