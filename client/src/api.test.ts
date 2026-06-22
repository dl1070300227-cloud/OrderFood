import { describe, expect, it } from "vitest";
import { buildApiBase } from "./api";

describe("buildApiBase", () => {
  it("uses the configured API base first", () => {
    expect(buildApiBase("http://example.com:3001", "192.168.1.3")).toBe("http://example.com:3001");
  });

  it("uses the current page hostname for LAN access", () => {
    expect(buildApiBase(undefined, "192.168.1.3")).toBe("http://192.168.1.3:3001");
  });

  it("keeps localhost for local desktop access", () => {
    expect(buildApiBase(undefined, "localhost")).toBe("http://localhost:3001");
  });

  it("uses same-origin API calls for deployed hosts", () => {
    expect(buildApiBase(undefined, "order-food.example.workers.dev")).toBe("");
  });
});
