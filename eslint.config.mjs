import baseConfig from "@hunty/config/eslint/base";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";

const eslintConfig = [
  ...baseConfig,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "react-hooks": reactHooks,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      ...reactHooks.configs.recommended.rules,
    },
  },
];

export default eslintConfig;
