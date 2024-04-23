import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders learn react link", () => {
  render(<App />);
  const linkElement = screen.getByText(/Click to send a 1 usd to the hard-coded account/i);
  expect(linkElement).toBeInTheDocument();
});
