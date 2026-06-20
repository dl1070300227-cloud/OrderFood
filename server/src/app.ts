import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { createDatabase } from "./db/connection";
import { initializeDatabase } from "./db/schema";
import { createDishesRouter } from "./routes/dishes";
import { createOrdersRouter } from "./routes/orders";
import { createUploadsRouter } from "./routes/uploads";

type CreateAppOptions = {
  databasePath?: string;
  uploadRoot?: string;
};

type ErrorWithStatus = Error & {
  statusCode?: number;
};

const errorHandler: ErrorRequestHandler = (error: ErrorWithStatus, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ message: "请求数据无效", issues: error.issues });
    return;
  }

  response.status(error.statusCode ?? 500).json({
    message: error.message || "服务器错误"
  });
};

export function createApp(options: CreateAppOptions = {}) {
  const databasePath = options.databasePath ?? "data/order-food.sqlite";
  const uploadRoot = options.uploadRoot ?? "data/uploads";
  const db = createDatabase(databasePath);
  initializeDatabase(db);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadRoot));
  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });
  app.use("/api/uploads", createUploadsRouter(uploadRoot));
  app.use("/api/dishes", createDishesRouter(db));
  app.use("/api/orders", createOrdersRouter(db));
  app.use(errorHandler);

  return app;
}
