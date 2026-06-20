# Home Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local full-stack web prototype for family meal ordering, including dish management, text recipes, order creation, and order history.

**Architecture:** Use a React/Vite client and a Node.js API server backed by SQLite. Keep data access, API validation, and UI state separate so the backend can later serve a WeChat mini program.

**Tech Stack:** React, Vite, TypeScript, Node.js, Express, Node built-in SQLite, Vitest, Supertest, Testing Library.

---

## File Structure

- Create: `package.json` for npm workspaces and root scripts.
- Create: `README.md` with startup, test, and LAN access notes.
- Create: `server/package.json` for backend dependencies and scripts.
- Create: `server/vitest.config.ts` for backend tests.
- Create: `server/src/app.ts` for Express app setup.
- Create: `server/src/index.ts` for server startup.
- Create: `server/src/db/connection.ts` for Node built-in SQLite connection creation.
- Create: `server/src/db/schema.ts` for table creation and seed data.
- Create: `server/src/modules/dishes.ts` for dish and recipe validation plus data access.
- Create: `server/src/modules/orders.ts` for order validation plus data access.
- Create: `server/src/routes/dishes.ts` for dish API routes.
- Create: `server/src/routes/orders.ts` for order API routes.
- Create: `server/src/test/app.test.ts` for backend integration tests.
- Create: `client/package.json` for frontend dependencies and scripts.
- Create: `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`.
- Create: `client/src/api.ts` for backend calls.
- Create: `client/src/types.ts` for shared frontend types.
- Create: `client/src/components/DishWorkspace.tsx` for point-of-order workflow.
- Create: `client/src/components/DishManager.tsx` for dish and recipe editing.
- Create: `client/src/components/OrderHistory.tsx` for historical orders.
- Create: `client/src/App.test.tsx` for frontend workflow tests.
- Create: `client/src/styles.css` for responsive layout.

## Task 1: Repository Scaffold

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Write root workspace metadata**

Create `package.json` with:

```json
{
  "name": "order-food",
  "private": true,
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "dev:server": "npm run dev --workspace server",
    "dev:client": "npm run dev --workspace client",
    "test": "npm run test --workspace server",
    "build": "npm run build --workspace client"
  }
}
```

- [ ] **Step 2: Confirm ignore rules**

Ensure `.gitignore` contains:

```gitignore
.superpowers/
node_modules/
dist/
coverage/
.env
.env.*
*.log
*.sqlite
*.sqlite3
*.db
```

- [ ] **Step 3: Write README startup notes**

Create `README.md` with:

```markdown
# 家用点菜小程序

本项目第一版是本地全栈网页原型，用于家庭点菜、维护菜品教程和查看订单记录。

## 启动

```powershell
npm install
npm run dev:server
npm run dev:client
```

后端默认监听 `http://localhost:3001`，前端默认由 Vite 输出本地访问地址。

## 验证

```powershell
npm test
npm run build
```

## 局域网访问

如果要让同一 Wi-Fi 下的手机访问，启动前端时使用 Vite 输出的 Network 地址，并确保防火墙允许对应端口访问。
```

- [ ] **Step 4: Verify scaffold**

Run:

```powershell
npm --version
git status --short
```

Expected: npm prints a version, and Git shows only files created or modified for this task.

- [ ] **Step 5: Commit after user approval**

Only after the user explicitly asks to commit, run:

```powershell
git add package.json .gitignore README.md
git commit -m "chore: initialize project workspace"
```

## Task 2: Backend Database And API

**Files:**
- Create: `server/package.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/db/connection.ts`
- Create: `server/src/db/schema.ts`
- Create: `server/src/modules/dishes.ts`
- Create: `server/src/modules/orders.ts`
- Create: `server/src/routes/dishes.ts`
- Create: `server/src/routes/orders.ts`
- Create: `server/src/test/app.test.ts`

- [ ] **Step 1: Add backend package**

Create `server/package.json` with:

```json
{
  "name": "@order-food/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.1",
    "@types/node": "^24.0.0",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.1.1",
    "tsx": "^4.20.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Write failing integration tests**

Create `server/src/test/app.test.ts` with tests for:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("home ordering api", () => {
  it("lists seeded dishes with recipes", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).get("/api/dishes");
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty("recipe");
  });

  it("creates a dish with a text recipe", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).post("/api/dishes").send({
      name: "番茄炒蛋",
      category: "家常菜",
      price: 18,
      description: "酸甜下饭",
      estimatedMinutes: 12,
      difficulty: "简单",
      isRecommended: true,
      recipe: {
        ingredients: "番茄 2 个，鸡蛋 3 个",
        seasonings: "盐，糖",
        steps: "鸡蛋炒熟盛出；番茄炒软；合炒调味"
      }
    });
    expect(response.status).toBe(201);
    expect(response.body.name).toBe("番茄炒蛋");
    expect(response.body.recipe.steps).toContain("合炒");
  });

  it("creates an order with price snapshots", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const dishes = await request(app).get("/api/dishes");
    const dishId = dishes.body[0].id;
    const response = await request(app).post("/api/orders").send({
      dinersCount: 3,
      note: "少油",
      items: [{ dishId, quantity: 2 }]
    });
    expect(response.status).toBe(201);
    expect(response.body.items[0].dishName).toBe(dishes.body[0].name);
    expect(response.body.totalPrice).toBe(response.body.items[0].subtotal);
  });

  it("marks an order as completed", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const dishes = await request(app).get("/api/dishes");
    const created = await request(app).post("/api/orders").send({
      dinersCount: 1,
      note: "",
      items: [{ dishId: dishes.body[0].id, quantity: 1 }]
    });
    const response = await request(app)
      .patch(`/api/orders/${created.body.id}/status`)
      .send({ status: "completed" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
  });
});
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```powershell
npm install
npm run test --workspace server
```

Expected: tests fail because `server/src/app.ts` does not exist yet.

- [ ] **Step 4: Implement database schema and seed data**

Create tables `dishes`, `recipes`, `orders`, and `order_items` exactly as specified in `docs/superpowers/specs/2026-06-20-home-ordering-design.md`. Seed at least four dishes: 番茄炒蛋, 青椒土豆丝, 可乐鸡翅, 紫菜蛋花汤.

- [ ] **Step 5: Implement dish routes**

Expose:

```http
GET /api/dishes
POST /api/dishes
PUT /api/dishes/:id
DELETE /api/dishes/:id
```

Validation rules:

```ts
name: non-empty string
price: number greater than or equal to 0
estimatedMinutes: optional number greater than or equal to 0
recipe.ingredients: string
recipe.seasonings: string
recipe.steps: string
```

- [ ] **Step 6: Implement order routes**

Expose:

```http
GET /api/orders
POST /api/orders
PATCH /api/orders/:id/status
```

Order creation must load current dish names and prices from the database, calculate `subtotal` and `totalPrice` on the server, and reject empty item arrays with HTTP 400.

- [ ] **Step 7: Run backend verification**

Run:

```powershell
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: both commands pass.

- [ ] **Step 8: Commit after user approval**

Only after the user explicitly asks to commit, run:

```powershell
git add server package-lock.json package.json
git commit -m "feat: add ordering api"
```

## Task 3: Frontend Application

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/api.ts`
- Create: `client/src/types.ts`
- Create: `client/src/components/DishWorkspace.tsx`
- Create: `client/src/components/DishManager.tsx`
- Create: `client/src/components/OrderHistory.tsx`
- Create: `client/src/App.test.tsx`
- Create: `client/src/styles.css`

- [ ] **Step 1: Add frontend package**

Create `client/package.json` with:

```json
{
  "name": "@order-food/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.5.2",
    "vite": "^6.3.5",
    "typescript": "^5.8.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Write failing frontend workflow tests**

Create `client/src/App.test.tsx` with tests that mock `fetch` and verify:

```ts
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const dishes = [
  {
    id: 1,
    name: "番茄炒蛋",
    category: "家常菜",
    price: 18,
    description: "酸甜下饭",
    estimatedMinutes: 12,
    difficulty: "简单",
    isRecommended: true,
    recipe: { ingredients: "番茄，鸡蛋", seasonings: "盐，糖", steps: "合炒调味" }
  }
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/dishes") && (!init || init.method === undefined)) {
      return Response.json(dishes);
    }
    if (url.endsWith("/api/orders") && (!init || init.method === undefined)) {
      return Response.json([]);
    }
    if (url.endsWith("/api/orders") && init?.method === "POST") {
      return Response.json({ id: 1, orderedAt: new Date().toISOString(), dinersCount: 2, note: "少油", totalPrice: 18, status: "pending", items: [] }, { status: 201 });
    }
    return Response.json({}, { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("orders a dish from the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "加入餐单" }));
    await user.clear(screen.getByLabelText("就餐人数"));
    await user.type(screen.getByLabelText("就餐人数"), "2");
    await user.type(screen.getByLabelText("备注"), "少油");
    await user.click(screen.getByRole("button", { name: "提交订单" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/orders"), expect.objectContaining({ method: "POST" })));
  });
});
```

Run `npm run test --workspace client`. Expected: FAIL because `client/src/App.tsx` does not exist.

- [ ] **Step 3: Define frontend types**

Create `client/src/types.ts` with interfaces for `Dish`, `Recipe`, `Order`, `OrderItem`, and `CartItem`. Use camelCase names matching API responses, including `estimatedMinutes`, `isRecommended`, `dinersCount`, `totalPrice`, and `dishName`.

- [ ] **Step 4: Implement API client**

Create `client/src/api.ts` exporting:

```ts
export async function fetchDishes(): Promise<Dish[]>;
export async function createDish(input: DishInput): Promise<Dish>;
export async function updateDish(id: number, input: DishInput): Promise<Dish>;
export async function deleteDish(id: number): Promise<void>;
export async function fetchOrders(): Promise<Order[]>;
export async function createOrder(input: CreateOrderInput): Promise<Order>;
export async function updateOrderStatus(id: number, status: "pending" | "completed"): Promise<Order>;
```

Use `const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";`.

- [ ] **Step 5: Build the point-of-order workspace**

Create `DishWorkspace.tsx` with:

- Search input.
- Category select.
- Dish list cards.
- Recipe expand panel.
- Cart panel with quantity controls.
- Diners count input.
- Note textarea.
- Submit button.

Empty cart submission must show a visible message and avoid calling `createOrder`.

- [ ] **Step 6: Build dish management**

Create `DishManager.tsx` with:

- Dish form for name, category, price, description, estimated minutes, difficulty, recommended flag, ingredients, seasonings, and steps.
- Edit button that loads an existing dish into the form.
- Delete button with `confirm("确定删除这道菜吗？")`.
- Save button that calls create or update based on edit state.

- [ ] **Step 7: Build order history**

Create `OrderHistory.tsx` with:

- Orders sorted by newest first from API response.
- Order item list with quantity, unit price, and subtotal.
- Diners count, note, total price, ordered time, and status.
- Button to toggle status between `pending` and `completed`.

- [ ] **Step 8: Compose app navigation**

Create `App.tsx` with three tabs:

```ts
type Tab = "order" | "dishes" | "history";
```

Use tab labels: 点菜, 菜品管理, 订单记录. Refresh dishes after dish save/delete and refresh orders after order creation/status change.

- [ ] **Step 9: Style responsive UI**

Create `styles.css` with:

- Desktop two-column layout for dish list and cart.
- Mobile single-column layout below 720px.
- Clear focus states for inputs and buttons.
- Distinct status styles for pending and completed orders.
- Stable card spacing and no nested card layouts.

- [ ] **Step 10: Run frontend verification**

Run:

```powershell
npm run test --workspace client
npm run build --workspace client
```

Expected: frontend tests, TypeScript, and Vite build pass.

- [ ] **Step 11: Commit after user approval**

Only after the user explicitly asks to commit, run:

```powershell
git add client package-lock.json package.json
git commit -m "feat: add home ordering interface"
```

## Task 4: End-To-End Verification And Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Start backend**

Run:

```powershell
npm run dev:server
```

Expected: server logs that it is listening on `http://localhost:3001`.

- [ ] **Step 2: Start frontend**

In a second terminal, run:

```powershell
npm run dev:client
```

Expected: Vite prints Local and Network URLs.

- [ ] **Step 3: Manually verify core workflow**

In the browser:

1. Open the frontend URL.
2. Create a dish with a recipe.
3. Return to 点菜.
4. Search for the new dish.
5. Expand its recipe.
6. Add it to the cart.
7. Set diners count to `2`.
8. Add note `少油`.
9. Submit the order.
10. Open 订单记录.
11. Confirm the new order shows dish snapshot, total price, diners count, note, and pending status.
12. Toggle the order to completed.

- [ ] **Step 4: Update README with final commands**

Add the final verified commands and ports:

```markdown
## 常用命令

```powershell
npm run dev:server
npm run dev:client
npm test
npm run build
```
```

- [ ] **Step 5: Run final verification**

Run:

```powershell
npm test
npm run build
git status --short
```

Expected: tests pass, build passes, and Git lists only intentional project files.

- [ ] **Step 6: Commit after user approval**

Only after the user explicitly asks to commit, run:

```powershell
git add README.md
git commit -m "docs: add local startup guide"
```

## Self-Review

- Spec coverage: the plan covers local full-stack architecture, dish CRUD, text recipes, order creation, order snapshots, order status, validation, seed data, frontend workflow, README, and verification.
- Placeholder scan: this plan avoids placeholder markers and names concrete files, commands, routes, models, and validation rules.
- Type consistency: API and frontend use camelCase fields consistently; database tables keep snake_case fields behind the backend boundary.
