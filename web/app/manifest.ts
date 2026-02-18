import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FairMate",
    short_name: "FairMate",
    description: "Play 1v1 chess for USDC stakes with fair matchmaking and transparent payouts.",
    start_url: "/",
    display: "standalone",
    background_color: "#252525",
    theme_color: "#212121",
    icons: [
      {
        src: "/images/FairMate%20Logo.jpg?v=3",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}
