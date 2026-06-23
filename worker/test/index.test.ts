import { describe, expect, it } from "vitest";
import { handleApi } from "../src/index";

class FakeD1Statement {
  constructor(private readonly sql: string) {}

  bind(): this {
    return this;
  }

  async first() {
    if (this.sql.includes("seeded_common_dishes_v2")) {
      return { value: "true" };
    }
    return null;
  }

  async all() {
    return { results: [] };
  }

  async run() {
    return { meta: { last_row_id: 1 } };
  }
}

function createStrictExecD1(): D1Database {
  return {
    async exec(sql: string) {
      if (sql.includes("\n")) {
        throw new Error("D1_EXEC_ERROR: incomplete input");
      }
      return { count: 1, duration: 0 };
    },
    prepare(sql: string) {
      return new FakeD1Statement(sql);
    }
  } as unknown as D1Database;
}

describe("handleApi", () => {
  it("initializes D1 with single statements before listing dishes", async () => {
    const response = await handleApi(
      { DB: createStrictExecD1() },
      new Request("https://example.com/api/dishes", { method: "GET" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
