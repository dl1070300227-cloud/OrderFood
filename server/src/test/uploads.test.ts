import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("recipe image uploads", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function makeUploadRoot() {
    const dir = mkdtempSync(join(tmpdir(), "order-food-uploads-"));
    tempDirs.push(dir);
    return dir;
  }

  it("stores a recipe image and returns its public upload path", async () => {
    const uploadRoot = makeUploadRoot();
    const app = createApp({ databasePath: ":memory:", uploadRoot });

    const response = await request(app)
      .post("/api/uploads/recipe-image")
      .attach("image", Buffer.from("fake-png"), {
        filename: "cover.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(201);
    expect(response.body.path).toMatch(/^\/uploads\/recipes\/.+\.png$/);
  });

  it("rejects non-image recipe uploads", async () => {
    const uploadRoot = makeUploadRoot();
    const app = createApp({ databasePath: ":memory:", uploadRoot });

    const response = await request(app)
      .post("/api/uploads/recipe-image")
      .attach("image", Buffer.from("<script>alert(1)</script>"), {
        filename: "index.html",
        contentType: "text/html"
      });

    expect(response.status).toBe(400);
  });
});
