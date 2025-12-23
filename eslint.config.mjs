import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/.vscode/",
      "**/.github/",
      "**/jest.config.js",
      "src/protos/**/*.ts",
      "node_modules/",
      "dist",
      "coverage",
      "eslint.config.mjs",
      ".yarn", "test/test.proto"
    ],
  },
  ...compat.extends("@neohelden"),
  {
    plugins: {},

    languageOptions: {
      globals: {
        ...globals.node,
      },

      ecmaVersion: 5,
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {},
  },
];
