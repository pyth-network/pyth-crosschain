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
      <form action="/api/playground/deeplink" method="POST">
        <input
          name="initialAccessToken"
          placeholder="put your token here"
          type="password"
        />
        <button type="submit">Submit</button>
      </form>
      <PlaygroundContent />
    </PlaygroundProvider>
  );
}
