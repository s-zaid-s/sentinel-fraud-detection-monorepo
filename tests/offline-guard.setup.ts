import { beforeAll } from "vitest";

beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error("Offline violation: network calls via fetch() are strictly forbidden.");
  }) as typeof fetch;
});
