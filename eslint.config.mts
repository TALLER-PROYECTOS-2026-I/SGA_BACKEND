import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier"; 

export default defineConfig([
  globalIgnores(["dist", "node_modules", "out", "coverage", "drizzle"]),

  {
    files: ["**/*.ts"],
    ignores: ["drizzle.config.ts",
      "drizzle/meta/**",
      "drizzle/schema.ts",
      "drizzle/relations.ts"],  // Agrega esta línea
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettier, 
    ],
    plugins: {
      prettier: eslintPluginPrettier, 
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json"],
      },
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
        console: true,
        process: true,
        __dirname: true,
        module: true,
        require: true,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "prefer-const": "warn",
      "eqeqeq": ["warn", "always"],
      "prettier/prettier": [
        "warn",
        {
          singleQuote: true,
          semi: true,
          trailingComma: "all",
          printWidth: 100,
        },
      ],
    },
  },
]);