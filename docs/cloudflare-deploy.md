# Cloudflare 部署说明

本项目已增加 Cloudflare Workers 部署入口。线上版本使用：

- Workers Static Assets 托管 `client/dist` 前端资源。
- Worker 处理 `/api/*` 接口。
- D1 保存菜品、订单、教程等结构化数据。
- R2 保存菜品封面和教程步骤图片。

## 1. 登录 Cloudflare

```bash
npx wrangler login
```

## 2. 创建 Cloudflare 资源

```bash
npx wrangler d1 create order-food-db
npx wrangler r2 bucket create order-food-uploads
```

把 `d1 create` 返回的 `database_id` 填到 [wrangler.jsonc](../wrangler.jsonc)：

```jsonc
"database_id": "REPLACE_WITH_D1_DATABASE_ID"
```

## 3. 构建和部署

```bash
npm install
npm run build
npm run worker:typecheck
npx wrangler deploy
```

部署成功后，Cloudflare 会返回 `*.workers.dev` 地址。打开该地址即可访问完整应用，前端和接口都走同一个 Worker 域名。

## 4. 本地开发

原来的本地开发方式仍可使用：

```bash
npm run dev:server
npm run dev:client
```

本地和局域网访问时，前端仍会请求 `http://当前主机:3001`。部署到 Cloudflare 后，前端会自动请求同域名 `/api`。

## 5. 当前限制

- Cloudflare Worker 版本和本地 Express 版本是两套运行入口，但 API 路径保持一致。
- 上传图片在线上会进入 R2，本地仍保存到 `server/data/uploads`。
- 第一次访问线上应用时，Worker 会自动初始化 D1 表结构并导入常见菜数据。
