import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3001);
const databasePath = process.env.DATABASE_PATH ?? resolve("data/order-food.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

const app = createApp({ databasePath });

app.listen(port, () => {
  console.log(`OrderFood API listening on http://localhost:${port}`);
});
