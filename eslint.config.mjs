import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "coverage/**", "tsconfig.tsbuildinfo"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: [
      "src/app/academic*/**/*.{ts,tsx}",
      "src/app/api/travis/**/*.ts",
      "src/components/academic*/**/*.{ts,tsx}",
      "src/components/academic-studio/**/*.{ts,tsx}",
    ],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  },
];

export default eslintConfig;
