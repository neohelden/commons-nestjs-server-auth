const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const path = require("path");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat.config({
    root: true,
    extends: ["@neohelden"],
    parserOptions: {
      project: "tsconfig.json",
      sourceType: "module",
    },
    env: {
      node: true,
    },
    rules: {},
  }),
];
