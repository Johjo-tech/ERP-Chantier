import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "supabase", "scripts", "src/lib/database.types.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Les requêtes vivent dans modules/*/api : un composant n'appelle jamais
      // Supabase directement (voir CLAUDE.md).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@supabase/supabase-js", message: "Passer par @/lib/supabase (client unique)." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/supabase.ts", "tests/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/**/components/**/*.tsx", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@supabase/supabase-js", message: "Aucune requête dans un composant." },
            { name: "@/lib/supabase", message: "Aucune requête dans un composant : passer par le hook du module." },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.essai.{ts,tsx}", "src/test/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
