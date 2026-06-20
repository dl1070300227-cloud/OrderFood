# Existing Recipe Media Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade existing seeded dishes from one long text recipe into structured recipe steps plus a direct highest-play Bilibili video link.

**Architecture:** Keep the behavior in the database seed/backfill layer so both fresh databases and already-created local databases are upgraded on startup. Add a generated local video mapping refreshed by script, then use it from `initializeDatabase`; fall back to a search URL only if a dish has no mapped video.

**Tech Stack:** Node.js, Express, `node:sqlite`, Vitest, Supertest.

---

### Task 1: Add Failing Backfill Tests

**Files:**
- Modify: `server/src/test/app.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that creates an in-memory app, fetches `/api/dishes`, finds `宫保鸡丁`, and expects `recipe.videoUrl` to contain `bilibili.com/video/` plus at least two `recipe.stepItems`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace server`

Expected: FAIL if seeded dishes return a search page instead of a direct video.

### Task 2: Implement Seeded Media Helpers

**Files:**
- Modify: `server/src/db/commonDishes.ts`
- Modify: `server/src/db/schema.ts`

- [ ] **Step 1: Add helper functions**

Create helpers that read a generated Bilibili top-video mapping and split text steps on Chinese or ASCII punctuation.

- [ ] **Step 2: Use helpers during insert and backfill**

New common dishes should insert direct mapped `video_url`. Existing recipes with empty `video_url` or a system-generated search URL should be updated. Old one-step recipe rows should be replaced by split steps only when they still match the original `recipes.steps`.

- [ ] **Step 3: Run tests**

Run: `npm run test --workspace server`

Expected: PASS.

### Task 3: Preserve Manual Edits

**Files:**
- Modify: `server/src/test/app.test.ts`
- Modify: `server/src/db/schema.ts`

- [ ] **Step 1: Write the failing preservation test**

Create a temp database, update a dish with custom `videoUrl` and two custom `stepItems`, restart the app, and verify those values remain unchanged.

- [ ] **Step 2: Run test to verify it fails if overwrite logic is unsafe**

Run: `npm run test --workspace server`

Expected: PASS once the guarded backfill logic is in place.

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full checks**

Run:

```powershell
npm test
npm run build
npm run typecheck --workspace server
```

Expected: all commands pass.

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs server
git commit -m "feat: backfill recipe media for seeded dishes"
git push
```
