declare module "@cookbookdev/docsbot/react" {
  import type { ComponentType } from "react";

  interface DocsBotProps {
    apiKey: string;
  }

  const DocsBot: ComponentType<DocsBotProps>;
  export default DocsBot;
}
