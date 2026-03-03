const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["node_modules/**", "eslint.config.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: "latest",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        alert: "readonly",
        confirm: "readonly",
        crypto: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Notification: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  eslintConfigPrettier,
];
