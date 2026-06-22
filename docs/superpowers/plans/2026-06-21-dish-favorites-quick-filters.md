# Dish Favorites Quick Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the top overview cards into useful dish filters and add persistent favorite dishes.

**Architecture:** Add an `is_favorite` column to dishes, expose a focused favorite-toggle API, and keep filter state in `App` so top overview buttons and `DishWorkspace` stay synchronized.

**Tech Stack:** Express, Node SQLite, Zod, React, Vite, Vitest, Testing Library, Lucide icons.

---

### Task 1: Backend Favorite Persistence

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/modules/dishes.ts`
- Modify: `server/src/routes/dishes.ts`
- Test: `server/src/test/app.test.ts`

- [ ] **Step 1: Write failing backend tests**

Add tests that assert dish list items include `isFavorite`, `PATCH /api/dishes/:id/favorite` updates the field, and a missing dish returns `404`.

- [ ] **Step 2: Run backend tests for red**

Run: `npm run test --workspace server -- app.test.ts`

Expected: tests fail because `isFavorite` and favorite route do not exist.

- [ ] **Step 3: Implement migration, mapping, and route**

Add `is_favorite` migration, select/map the field, preserve it during create/update, and add `PATCH /api/dishes/:id/favorite`.

- [ ] **Step 4: Run backend tests for green**

Run: `npm run test --workspace server -- app.test.ts`

Expected: all server tests pass.

### Task 2: Frontend Favorite API And Filters

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/DishWorkspace.tsx`
- Test: `client/src/App.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Add tests for top “推荐” and “爱好” filters, plus clicking a dish favorite button.

- [ ] **Step 2: Run frontend tests for red**

Run: `npm run test --workspace client -- App.test.tsx`

Expected: tests fail because filters and favorite button are not implemented.

- [ ] **Step 3: Implement API and UI logic**

Add `updateDishFavorite`, add `isFavorite` to types, manage quick filter state in `App`, and filter dishes in `DishWorkspace`.

- [ ] **Step 4: Run frontend tests for green**

Run: `npm run test --workspace client -- App.test.tsx`

Expected: all app tests pass.

### Task 3: Styling And Verification

**Files:**
- Modify: `client/src/styles.css`

- [ ] **Step 1: Add accessible styles**

Make summary buttons visually match cards, add selected state, and style favorite buttons with clear pressed state.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run build
npm run typecheck --workspace server
```

Expected: all commands pass.

- [ ] **Step 3: Restart service and verify URLs**

Restart dev server and verify local and LAN URLs return `200`.
