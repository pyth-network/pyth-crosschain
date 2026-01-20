import { createRawStyles } from "../styles";

createRawStyles("baseline-globals", () => ({
  "*": {
    boxSizing: "border-box",
  },
  body: {
    backgroundColor: "red",
  },
}));
