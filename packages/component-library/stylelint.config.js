import standardScss from "stylelint-config-standard-scss";

const config = {
  extends: standardScss,
  rules: {
    "selector-class-pattern": [
      "^[a-z][a-zA-Z0-9]+$",
      {
        message: (selector) =>
          `Expected class selector "${selector}" to be camel-case`,
      },
    ],
  },
};
export default config;
