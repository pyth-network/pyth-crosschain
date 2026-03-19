import { Cookies } from "../../../cookies/initialAccessTokenCookie";
import { PlaygroundProvider } from "../../Playground/PlaygroundContext";
import { PlaygroundContent } from "./PlaygroundContent";

export async function PlaygroundPage() {
  /** server data */
  const tokenData = await Cookies.getInitialAccessToken();

  return (
    <PlaygroundProvider
      initialConfig={{
        accessToken: tokenData?.initialAccessToken ?? "",
      }}
    >
      <PlaygroundContent />
    </PlaygroundProvider>
  );
}
