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
      steps: "合炒调味",
      coverImagePath: "/uploads/recipes/cover.png",
      videoUrl: "https://example.com/video",
      stepItems: [
        {
          stepOrder: 1,
          instruction: "切好番茄",
          imagePath: "/uploads/recipes/step-1.png"
        },
        {
          stepOrder: 2,
          instruction: "合炒调味",
          imagePath: ""
        }
      ]
    }
  }
];

let uploadCount = 0;
let savedDishPayload: unknown;

beforeEach(() => {
  uploadCount = 0;
  savedDishPayload = undefined;
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
      if (url.endsWith("/api/uploads/recipe-image") && init?.method === "POST") {
        uploadCount += 1;
        return Response.json(
          { path: uploadCount === 1 ? "/uploads/recipes/new-cover.png" : "/uploads/recipes/new-step.png" },
          { status: 201 }
        );
      }
      if (url.endsWith("/api/dishes") && init?.method === "POST") {
        savedDishPayload = JSON.parse(String(init.body));
        return Response.json({ id: 2, ...(savedDishPayload as object) }, { status: 201 });
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

  it("shows rich recipe media when a dish tutorial is expanded", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "教程" }));

    expect(screen.getByRole("img", { name: "番茄炒蛋 封面" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/cover.png"
    );
    expect(screen.getByRole("link", { name: "打开视频教程" })).toHaveAttribute(
      "href",
      "https://example.com/video"
    );
    expect(screen.getByText("切好番茄")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "步骤 1" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/step-1.png"
    );
  });

  it("saves recipe cover, video link, and step images from the dish manager", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "菜品管理" }));
    await user.type(screen.getByLabelText("菜名"), "葱油拌面");
    await user.type(screen.getByLabelText("视频链接"), "https://example.com/noodles");
    await user.upload(
      screen.getByLabelText("菜品封面"),
      new File(["cover"], "cover.png", { type: "image/png" })
    );
    await user.type(screen.getByLabelText("步骤 1 说明"), "煮面后拌葱油");
    await user.upload(
      screen.getByLabelText("步骤 1 图片"),
      new File(["step"], "step.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: "保存菜品" }));

    await waitFor(() =>
      expect(savedDishPayload).toMatchObject({
        name: "葱油拌面",
        recipe: {
          coverImagePath: "/uploads/recipes/new-cover.png",
          videoUrl: "https://example.com/noodles",
          stepItems: [{ instruction: "煮面后拌葱油", imagePath: "/uploads/recipes/new-step.png" }]
        }
      })
    );
  });
});
