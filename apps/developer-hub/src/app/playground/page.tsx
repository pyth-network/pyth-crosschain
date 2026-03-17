import type { Metadata } from "next";

import { PlaygroundPage } from "../../components/Pages/PlaygroundPage";

export const metadata: Metadata = {
  description:
    "Interactive playground to explore Pyth Pro APIs. Configure subscription parameters, generate code in multiple languages, and test real-time price streams.",
  title: "Pyth Pro Playground | Pyth Network",
};

export default function Playground() {
  return <PlaygroundPage />;
}
