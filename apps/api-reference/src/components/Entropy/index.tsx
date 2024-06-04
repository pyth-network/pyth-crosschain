import { ComingSoon } from "../ComingSoon";
import { InlineLink } from "../InlineLink";

export const Entropy = () => (
  <ComingSoon>
    We are working on adding references for our Entropy APIs soon. In the
    meantime, take a look at{" "}
    <InlineLink href="https://fortuna.dourolabs.app/docs" target="_blank">
      the Fortuna OpenAPI explorer
    </InlineLink>{" "}
    for off-chain use, or see{" "}
    <InlineLink href="https://docs.pyth.network/entropy" target="_blank">
      the Entropy docs
    </InlineLink>{" "}
    for on-chain usage
  </ComingSoon>
);
