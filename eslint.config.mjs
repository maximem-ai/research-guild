import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "supabase/functions/**", "src/generated/**", "cloudflare-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // images are unoptimized on purpose (Workers bundle size; avatars come from Supabase Storage)
  { rules: { "@next/next/no-img-element": "off" } },
];
