const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "eslint.config.js",
      "vitest.config.js",
      "playwright.config.js",
      "tests/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
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
        Blob: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      camelcase: ["error", { properties: "never", ignoreDestructuring: true }],
      "id-match": [
        "error",
        "^([a-z][a-zA-Z0-9]*|[A-Z][a-zA-Z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$",
        {
          onlyDeclarations: true,
          properties: false,
          ignoreDestructuring: true,
        },
      ],
      "new-cap": ["error", { newIsCap: true, capIsNew: false }],
    },
  },
  eslintConfigPrettier,
];
