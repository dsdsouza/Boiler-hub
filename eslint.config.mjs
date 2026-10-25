import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "cloudflare-env.d.ts",
      "out/**",
      "output/**",
      "build/**",
      "next-env.d.ts",
      ".qa/**",
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "all-blob-reports/**",
      "qa-runs/**",
    ],
  },
];

export default eslintConfig;
