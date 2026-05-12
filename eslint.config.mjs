import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "prisma/migrations/**",
  ]),

  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Unused imports/vars
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // TypeScript strict rules
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off", // handled by unused-imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // General best practices
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },
]);

export default eslintConfig;
