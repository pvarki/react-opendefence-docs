import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "helpcontent",
      "public",
      "src/routeTree.gen.ts",
      "node_modules",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Ambient declaration shims legitimately use `import x = require(...)`.
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // TanStack Router file routes export `Route` (and loader data types)
    // alongside their components by design; fast refresh falls back to a
    // full reload there, which is fine.
    files: ["src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Vendored shadcn registry code — kept byte-close to upstream so
    // re-vendoring stays a clean diff; not held to our strictest rules.
    files: ["src/components/ui/**/*.tsx", "src/hooks/use-mobile.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Build/sync scripts are CLI tools: console output is their UI.
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
