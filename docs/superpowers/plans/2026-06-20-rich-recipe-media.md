# Rich Recipe Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade recipe tutorials from text-only content to cover images, step images, and video links.

**Architecture:** Keep `recipes` as the tutorial parent record and add `recipe_steps` for ordered step content. Store uploaded images under `data/uploads/recipes/`, expose them through `/uploads/...`, and save video tutorials as external URLs only.

**Tech Stack:** React, Vite, TypeScript, Node.js, Express, Node built-in SQLite, Multer, Vitest, Supertest, Testing Library.

---

## File Structure

- Modify: `server/package.json` to add `multer` and its type package.
- Modify: `server/src/db/schema.ts` to add recipe media columns, `recipe_steps`, and migration/backfill logic.
- Modify: `server/src/db/commonDishes.ts` to keep common recipe steps compatible with `stepItems`.
- Modify: `server/src/modules/dishes.ts` to validate and persist `coverImagePath`, `videoUrl`, and `stepItems`.
- Create: `server/src/routes/uploads.ts` to handle image upload.
- Modify: `server/src/app.ts` to mount `/api/uploads` and `/uploads` static serving.
- Modify: `server/src/test/app.test.ts` to cover rich recipe persistence and migration.
- Create: `server/src/test/uploads.test.ts` to cover image upload success and rejection.
- Modify: `client/src/types.ts` to add `RecipeStep`.
- Modify: `client/src/api.ts` to add `uploadRecipeImage`.
- Modify: `client/src/components/DishWorkspace.tsx` to render cover images, video links, and step cards.
- Modify: `client/src/components/DishManager.tsx` to edit cover image, video URL, and ordered steps.
- Modify: `client/src/App.test.tsx` to cover rich recipe display and step submission.
- Modify: `client/src/styles.css` to style media previews, upload rows, and step cards.

## Task 1: Backend Rich Recipe Data

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/modules/dishes.ts`
- Modify: `server/src/db/commonDishes.ts`
- Modify: `server/src/test/app.test.ts`

- [ ] **Step 1: Write failing tests for rich recipe persistence**

Add to `server/src/test/app.test.ts`:

```ts
it("creates and updates a dish with cover image, video link, and recipe step items", async () => {
  const app = createApp({ databasePath: ":memory:" });
  const created = await request(app).post("/api/dishes").send({
    name: "图文教程测试菜",
    category: "家常菜",
    price: 20,
    description: "用于测试图文教程",
    estimatedMinutes: 15,
    difficulty: "简单",
    isRecommended: false,
    recipe: {
      ingredients: "鸡蛋，番茄",
      seasonings: "盐",
      steps: "旧文本步骤",
      coverImagePath: "/uploads/recipes/cover.webp",
      videoUrl: "https://example.com/video",
      stepItems: [
        { stepOrder: 1, instruction: "切番茄", imagePath: "/uploads/recipes/step-1.webp" },
        { stepOrder: 2, instruction: "炒鸡蛋", imagePath: "" }
      ]
    }
  });

  expect(created.status).toBe(201);
  expect(created.body.recipe.coverImagePath).toBe("/uploads/recipes/cover.webp");
  expect(created.body.recipe.videoUrl).toBe("https://example.com/video");
  expect(created.body.recipe.stepItems).toHaveLength(2);
  expect(created.body.recipe.stepItems[0].instruction).toBe("切番茄");

  const updated = await request(app)
    .put(`/api/dishes/${created.body.id}`)
    .send({
      ...created.body,
      recipe: {
        ...created.body.recipe,
        videoUrl: "https://example.com/updated",
        stepItems: [{ stepOrder: 1, instruction: "更新后的步骤", imagePath: "" }]
      }
    });

  expect(updated.status).toBe(200);
  expect(updated.body.recipe.videoUrl).toBe("https://example.com/updated");
  expect(updated.body.recipe.stepItems).toHaveLength(1);
  expect(updated.body.recipe.stepItems[0].instruction).toBe("更新后的步骤");
});

it("rejects invalid recipe video urls", async () => {
  const app = createApp({ databasePath: ":memory:" });
  const response = await request(app).post("/api/dishes").send({
    name: "非法视频链接",
    category: "家常菜",
    price: 12,
    description: "",
    estimatedMinutes: 10,
    difficulty: "简单",
    isRecommended: false,
    recipe: {
      ingredients: "豆腐",
      seasonings: "盐",
      steps: "煎一下",
      coverImagePath: "",
      videoUrl: "javascript:alert(1)",
      stepItems: [{ stepOrder: 1, instruction: "煎豆腐", imagePath: "" }]
    }
  });

  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm run test --workspace server
```

Expected: FAIL because `coverImagePath`, `videoUrl`, and `stepItems` are not persisted.

- [ ] **Step 3: Update schema**

In `server/src/db/schema.ts`, add:

```sql
ALTER TABLE recipes ADD COLUMN cover_image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS recipe_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL CHECK (step_order >= 1),
  instruction TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
```

Because SQLite cannot add the same column twice, wrap column additions in a helper that checks `PRAGMA table_info(recipes)` before running `ALTER TABLE`.

- [ ] **Step 4: Add migration from legacy text steps**

In `initializeDatabase`, after table creation and common dish backfill, add a migration that inserts one `recipe_steps` row for every recipe where `steps` is non-empty and no `recipe_steps` rows exist.

- [ ] **Step 5: Update dish types and validation**

In `server/src/modules/dishes.ts`, extend `Recipe`:

```ts
export type RecipeStep = {
  id?: number;
  stepOrder: number;
  instruction: string;
  imagePath: string;
};

export type Recipe = {
  ingredients: string;
  seasonings: string;
  steps: string;
  coverImagePath: string;
  videoUrl: string;
  stepItems: RecipeStep[];
};
```

Extend Zod validation so `videoUrl` allows empty string or `http://` / `https://` URLs only.

- [ ] **Step 6: Persist step items**

Update `createDish` and `updateDish`:

1. Save `cover_image_path` and `video_url` in `recipes`.
2. Delete old `recipe_steps` on update.
3. Insert submitted `stepItems` ordered by `stepOrder`.
4. If no `stepItems` are provided and `steps` has text, insert one default step.

- [ ] **Step 7: Run backend data tests**

Run:

```powershell
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: PASS.

## Task 2: Image Upload API

**Files:**
- Modify: `server/package.json`
- Create: `server/src/routes/uploads.ts`
- Modify: `server/src/app.ts`
- Create: `server/src/test/uploads.test.ts`

- [ ] **Step 1: Add upload dependencies**

Add to `server/package.json`:

```json
"multer": "^2.0.2"
```

Add to devDependencies:

```json
"@types/multer": "^1.4.12"
```

Run:

```powershell
npm install
```

- [ ] **Step 2: Write failing upload tests**

Create `server/src/test/uploads.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("recipe image uploads", () => {
  it("accepts image uploads", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app)
      .post("/api/uploads/recipe-image")
      .attach("image", Buffer.from("fake-image"), {
        filename: "cover.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(201);
    expect(response.body.path).toMatch(/^\/uploads\/recipes\/.+\.png$/);
  });

  it("rejects non-image uploads", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app)
      .post("/api/uploads/recipe-image")
      .attach("image", Buffer.from("<html></html>"), {
        filename: "bad.html",
        contentType: "text/html"
      });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
npm run test --workspace server
```

Expected: FAIL because the upload route does not exist.

- [ ] **Step 4: Implement upload route**

Create `server/src/routes/uploads.ts` using Multer:

- Destination: `data/uploads/recipes`.
- Limits: `fileSize: 5 * 1024 * 1024`.
- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
- Return JSON: `{ path: "/uploads/recipes/<filename>" }`.

- [ ] **Step 5: Mount static and API routes**

In `server/src/app.ts`:

```ts
app.use("/uploads", express.static("data/uploads"));
app.use("/api/uploads", createUploadsRouter());
```

- [ ] **Step 6: Run upload verification**

Run:

```powershell
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: PASS.

## Task 3: Frontend Rich Recipe Display

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/components/DishWorkspace.tsx`
- Modify: `client/src/styles.css`
- Modify: `client/src/App.test.tsx`

- [ ] **Step 1: Write failing frontend display test**

Add to `client/src/App.test.tsx` fixture data:

```ts
recipe: {
  ingredients: "番茄，鸡蛋",
  seasonings: "盐，糖",
  steps: "合炒调味",
  coverImagePath: "/uploads/recipes/cover.png",
  videoUrl: "https://example.com/video",
  stepItems: [{ id: 1, stepOrder: 1, instruction: "先炒鸡蛋", imagePath: "/uploads/recipes/step.png" }]
}
```

Add test:

```ts
it("shows rich recipe media in the workspace", async () => {
  const user = userEvent.setup();
  render(<App />);

  await screen.findByText("番茄炒蛋");
  await user.click(screen.getByRole("button", { name: "教程" }));

  expect(screen.getByAltText("番茄炒蛋封面图")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "打开视频教程" })).toHaveAttribute("href", "https://example.com/video");
  expect(screen.getByText("先炒鸡蛋")).toBeInTheDocument();
  expect(screen.getByAltText("步骤 1 图片")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run frontend test to verify failure**

Run:

```powershell
npm run test --workspace client
```

Expected: FAIL because the UI does not render media fields yet.

- [ ] **Step 3: Update frontend types**

In `client/src/types.ts`, add `RecipeStep` and fields `coverImagePath`, `videoUrl`, `stepItems` to `Recipe`.

- [ ] **Step 4: Render rich recipe content**

In `DishWorkspace.tsx`, update expanded recipe area:

- Show cover image with `alt={`${dish.name}封面图`}` when `coverImagePath` exists.
- Show video link as `<a target="_blank" rel="noreferrer">打开视频教程</a>` when `videoUrl` exists.
- Render `stepItems` as ordered step cards.
- Fall back to `steps` text when `stepItems` is empty.

- [ ] **Step 5: Style media display**

In `styles.css`, add styles for:

- `.recipe-cover`
- `.recipe-video-link`
- `.recipe-step-list`
- `.recipe-step-card`
- `.recipe-step-image`

- [ ] **Step 6: Run frontend verification**

Run:

```powershell
npm run test --workspace client
npm run build --workspace client
```

Expected: PASS.

## Task 4: Frontend Recipe Media Editing

**Files:**
- Modify: `client/src/api.ts`
- Modify: `client/src/components/DishManager.tsx`
- Modify: `client/src/App.test.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Add API upload helper**

In `client/src/api.ts`, add:

```ts
export async function uploadRecipeImage(file: File): Promise<{ path: string }> {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch(`${API_BASE}/api/uploads/recipe-image`, {
    method: "POST",
    body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "上传失败" }));
    throw new Error(payload.message ?? "上传失败");
  }
  return response.json();
}
```

- [ ] **Step 2: Write failing edit test**

In `client/src/App.test.tsx`, add a test that:

1. Clicks `菜品管理`.
2. Clicks `编辑` for a dish.
3. Types a video URL.
4. Adds a second step.
5. Saves.
6. Expects `fetch` PUT body to include `recipe.videoUrl` and two `stepItems`.

- [ ] **Step 3: Run frontend test to verify failure**

Run:

```powershell
npm run test --workspace client
```

Expected: FAIL because editor fields do not exist yet.

- [ ] **Step 4: Add media form fields**

In `DishManager.tsx`, add:

- Cover image upload input.
- Current cover preview.
- Video URL input.
- Step editor list with instruction textarea, image upload input, up/down/delete buttons.
- Add step button.

- [ ] **Step 5: Wire uploads**

When a cover or step image file is selected, call `uploadRecipeImage(file)` and place returned `path` into `form.recipe.coverImagePath` or the relevant `stepItems[index].imagePath`.

- [ ] **Step 6: Submit rich recipe**

Ensure save sends `recipe.coverImagePath`, `recipe.videoUrl`, and normalized `stepItems` with 1-based `stepOrder`.

- [ ] **Step 7: Run frontend verification**

Run:

```powershell
npm run test --workspace client
npm run build --workspace client
```

Expected: PASS.

## Task 5: Final Verification

**Files:**
- Modify: `README.md` if upload behavior needs documentation.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm test
npm run build
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 2: Manual browser verification**

With dev servers running:

1. Open `http://localhost:5173/`.
2. Edit a dish.
3. Upload a cover image.
4. Add a video URL.
5. Add two steps, with one step image.
6. Save.
7. Return to 点菜.
8. Expand the dish tutorial.
9. Confirm cover image, video button, and step image display.

- [ ] **Step 3: Commit and push after verification**

Run:

```powershell
git add server client README.md docs/superpowers/plans/2026-06-20-rich-recipe-media.md
git commit -m "feat: add rich recipe media"
git push
```

## Self-Review

- Spec coverage: covers schema changes, upload route, static image serving, video URL validation, legacy migration, workspace display, manager editing, and automated/manual verification.
- Placeholder scan: no placeholder markers are present.
- Type consistency: backend and frontend both use `coverImagePath`, `videoUrl`, and `stepItems`; database keeps snake_case columns behind the API boundary.
