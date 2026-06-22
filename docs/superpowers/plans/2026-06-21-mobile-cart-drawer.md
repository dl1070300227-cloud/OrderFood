# Mobile Cart Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-friendly bottom cart bar and drawer while keeping the desktop cart sidebar.

**Architecture:** Keep cart state in `DishWorkspace`, render the existing desktop cart plus a mobile-only bottom cart surface backed by the same state and handlers.

**Tech Stack:** React, CSS media queries, Vitest, Testing Library, Lucide icons.

---

### Task 1: Mobile Cart Test

**Files:**
- Modify: `client/src/App.test.tsx`

- [ ] Add a failing test that adds a dish, expects a mobile cart summary region, clicks “查看已选菜品”, and sees the selected item plus submit button.
- [ ] Run `npm run test --workspace client -- App.test.tsx -t "opens the mobile selected dishes drawer"` and verify it fails.

### Task 2: Component Implementation

**Files:**
- Modify: `client/src/components/DishWorkspace.tsx`

- [ ] Add `isMobileCartOpen` state.
- [ ] Render a mobile bottom cart bar with selected count, total price, and a drawer toggle.
- [ ] Render a mobile drawer that reuses the cart state, quantity handlers, diners count, note, and submit handler.
- [ ] Close the drawer after a successful submit.

### Task 3: Styling And Verification

**Files:**
- Modify: `client/src/styles.css`

- [ ] Add fixed bottom bar and drawer styles.
- [ ] Hide mobile cart surfaces on desktop.
- [ ] Hide desktop cart sidebar on mobile and add bottom padding to the app shell.
- [ ] Run `npm test`, `npm run build`, then restart the dev services.
