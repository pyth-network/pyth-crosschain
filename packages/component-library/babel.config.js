/* eslint-disable n/no-process-env */
const config = {
  presets: ["@babel/preset-typescript"],
  plugins: [
    "babel-plugin-react-compiler",
    [
      "@stylexjs/babel-plugin",
      {
        dev: process.env.NODE_ENV === "development",
        test: process.env.NODE_ENV === "test",
        runtimeInjection: false,
        treeshakeCompensation: true,
        unstable_moduleResolution: {
          type: "commonJS",
        },
      },
    ],
  ],
};

export default config;
