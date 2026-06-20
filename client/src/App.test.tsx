import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    recipe: {
      ingredients: "番茄，鸡蛋",
      seasonings: "盐，糖",
      steps: "合炒调味"
    }
  }
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/dishes") && (!init || init.method === undefined)) {
        return Response.json(dishes);
      }
      if (url.endsWith("/api/orders") && (!init || init.method === undefined)) {
        return Response.json([]);
      }
      if (url.endsWith("/api/orders") && init?.method === "POST") {
        return Response.json(
          {
            id: 1,
            orderedAt: new Date().toISOString(),
            dinersCount: 2,
            note: "少油",
            totalPrice: 18,
            status: "pending",
            items: []
          },
          { status: 201 }
        );
      }
      return Response.json({}, { status: 404 });
    })
  );
});

afterEach(() => {
  cleanup();
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

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("shows the redesigned kitchen summary", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "今晚吃点什么" })).toBeInTheDocument();
    expect(screen.getByText("1 道菜可选")).toBeInTheDocument();
    expect(screen.getByText("1 个分类")).toBeInTheDocument();
  });
});
