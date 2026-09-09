import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // React 19's new rule is useful guidance, but this existing app intentionally hydrates a few
    // browser-backed states (sessionStorage/localStorage) and request-backed panels in effects.
    // Keep those findings visible without turning a framework upgrade into a behavior rewrite.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
