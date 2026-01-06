import type { Metadata } from "next";

import { PlaygroundPage } from "../../components/Pages/PlaygroundPage";

export const metadata: Metadata = {
  title: "Pyth Pro Playground | Pyth Network",
  description:
    "Interactive playground to explore Pyth Pro APIs. Configure subscription parameters, generate code in multiple languages, and test real-time price streams.",
};

export default function Playground() {
  return <PlaygroundPage />;
}

