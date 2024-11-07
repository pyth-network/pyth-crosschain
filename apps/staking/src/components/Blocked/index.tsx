import { LinkButton } from "../Button";

export const RegionBlocked = () => (
  <Blocked reason="This program is currently unavailable to users in your region" />
);

export const VpnBlocked = () => (
  <Blocked reason="You cannot access this app via a VPN.  Please disable your VPN and try again." />
);

type Props = {
  reason: string;
};

const Blocked = ({ reason }: Props) => (
  <main className="grid size-full place-content-center py-20 text-center">
    <h1 className="mb-8 text-4xl font-semibold text-pythpurple-400">
      {"We're sorry"}
    </h1>
    <p className="mb-20 text-lg">{reason}</p>
    <LinkButton
      className="w-full max-w-96 place-self-center px-8 py-3"
      href="https://www.pyth.network"
      target="_blank"
    >
      Read More About Pyth
    </LinkButton>
  </main>
);
