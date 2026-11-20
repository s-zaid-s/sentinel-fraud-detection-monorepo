import { defineConfig } from "vitest/config";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@sentinel/domain": r("packages/domain/src/index.ts"),
      "@sentinel/observability": r("packages/observability/src/index.ts"),
      "@sentinel/queue": r("packages/queue/src/index.ts"),
      "@sentinel/storage": r("packages/storage/src/index.ts"),
      "@sentinel/ml-engine": r("packages/ml-engine/src/index.ts"),
      "@sentinel/clients": r("packages/clients/src/index.ts"),
      "@sentinel/processors": r("services/processors/src/index.ts"),
      "@sentinel/gateway": r("services/gateway/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    setupFiles: ["tests/offline-guard.setup.ts"]
  }
});
