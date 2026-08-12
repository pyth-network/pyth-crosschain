import { render, screen } from "@testing-library/react";
import { useSelectedLayoutSegment } from "next/navigation";

import {
  GEO_BLOCKED_SEGMENT,
  GOVERNANCE_ONLY_SEGMENT,
  VPN_BLOCKED_SEGMENT,
} from "../../config/isomorphic";
import {
  OIS_GOVERNANCE_UPDATE_URL,
  OisPausedBanner,
} from "./ois-paused-banner";

jest.mock("next/navigation", () => ({
  useSelectedLayoutSegment: jest.fn(),
}));

const mockSegment = (segment: string | null) => {
  jest.mocked(useSelectedLayoutSegment).mockReturnValue(segment);
};

const banner = () =>
  screen.queryByRole("region", { name: /rewards are paused/i });

describe("<OisPausedBanner /> tests", () => {
  it("shows the banner on an unrestricted segment", () => {
    mockSegment(null);
    render(<OisPausedBanner isEnabled />);

    expect(banner()).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Read the governance update" }),
    ).toHaveProperty("href", OIS_GOVERNANCE_UPDATE_URL);
  });

  it("hides the banner when the feature is disabled", () => {
    mockSegment(null);
    render(<OisPausedBanner isEnabled={false} />);

    expect(banner()).toBeNull();
  });

  it.each([
    GEO_BLOCKED_SEGMENT,
    GOVERNANCE_ONLY_SEGMENT,
    VPN_BLOCKED_SEGMENT,
  ])("hides the banner on the %s segment", (segment) => {
    mockSegment(segment);
    render(<OisPausedBanner isEnabled />);

    expect(banner()).toBeNull();
  });
});
