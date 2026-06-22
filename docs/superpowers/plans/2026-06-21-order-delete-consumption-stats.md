# Order Delete Consumption Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add order deletion and consumption statistics to the order history workflow.

**Architecture:** Keep order deletion and statistics inside the existing orders module and router. Add a small frontend API surface, load stats from `App`, and render the controls inside `OrderHistory` so the feature stays attached to order records.

**Tech Stack:** Express, Node SQLite, Zod, React, Vite, Vitest, Testing Library.

---

### Task 1: Backend Order Delete And Stats

**Files:**
- Modify: `server/src/modules/orders.ts`
- Modify: `server/src/routes/orders.ts`
- Test: `server/src/test/app.test.ts`

- [ ] **Step 1: Write failing API tests**

Add tests that create orders, call `DELETE /api/orders/:id`, verify the list no longer includes the order, verify a missing order returns `404`, and verify `GET /api/orders/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns `total` and `orderCount`.

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test --workspace server -- app.test.ts`

Expected: delete and stats tests fail because routes do not exist.

- [ ] **Step 3: Implement minimal backend code**

Add `deleteOrder`, `getOrderStats`, and `orderStatsQuerySchema` to `server/src/modules/orders.ts`. Add routes before `/:id/status` in `server/src/routes/orders.ts`.

- [ ] **Step 4: Run tests and verify green**

Run: `npm run test --workspace server -- app.test.ts`

Expected: all server tests pass.

### Task 2: Frontend API And App State

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Extend the fetch stub to handle stats and deletion. Add tests for rendering today/month/year/custom stats and deleting an order from the history tab.

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test --workspace client -- App.test.tsx`

Expected: tests fail because stats are not fetched and delete UI does not exist.

- [ ] **Step 3: Implement frontend API and state**

Add `OrderStats`, `fetchOrderStats`, and `deleteOrder`. In `App`, load today/month/year/custom stats, pass them to `OrderHistory`, and reload orders plus stats after delete or status changes.

- [ ] **Step 4: Run tests and verify green**

Run: `npm run test --workspace client -- App.test.tsx`

Expected: app tests pass.

### Task 3: Order History UI Polish And Full Verification

**Files:**
- Modify: `client/src/components/OrderHistory.tsx`
- Modify: `client/src/styles.css`
- Test: `client/src/App.test.tsx`

- [ ] **Step 1: Add UI controls**

Render four statistic cards, date inputs for custom range, a query button, and a delete button per order with confirmation.

- [ ] **Step 2: Add responsive CSS**

Use compact grid cards on desktop and single-column layout on mobile, following existing 8px radius and restrained kitchen dashboard styling.

- [ ] **Step 3: Run complete verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 4: Restart service**

Restart `npm run dev:server` and `npm run dev:client`, then verify `http://localhost:5173/` and the LAN URL return `200`.
