import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import pluginQuery from "@tanstack/eslint-plugin-query";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@tanstack/query": pluginQuery,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // 경고로만 — 65건이 남아 있고 고치지 않기로 했다(보이기만 한다).
      "react-hooks/exhaustive-deps": "warn",
      // queryKey 에 빠진 의존값은 캐시가 안 갈려 «남의 결과»를 받는 실제 버그다.
      // recommended 를 통째로 켜면 prefer-query-options 97건이 딸려오므로 이것만.
      "@tanstack/query/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-useless-escape": "off",
    },
  },
);
