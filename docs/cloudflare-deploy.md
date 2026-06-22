# Cloudflare Pages 部署说明

本项目的线上部署方式是 Cloudflare Pages：

- `client/dist` 托管前端静态资源。
- `functions/api/*` 提供接口。
- D1 保存菜品、订单和教程数据。
- R2 保存上传的菜品图片。

## Cloudflare Pages 构建设置

在 Cloudflare Pages 连接 GitHub 仓库后，使用以下设置：

```text
Framework preset: None
Build command: npm run build
Build output directory: client/dist
Root directory: /
```

仓库里的 [wrangler.jsonc](../wrangler.jsonc) 已配置：

```jsonc
"pages_build_output_dir": "client/dist"
```

这会修复 Pages 日志中的 `未找到输出目录“dist”` 问题。

## 绑定 D1 和 R2

先在本地或 Cloudflare 控制台创建资源：

```bash
npx wrangler login
npx wrangler d1 create order-food-db
npx wrangler r2 bucket create order-food-uploads
```

然后在 Cloudflare Pages 项目中进入：

```text
Settings -> Functions -> D1 database bindings
```

添加：

```text
Variable name: DB
D1 database: order-food-db
```

再进入：

```text
Settings -> Functions -> R2 bucket bindings
```

添加：

```text
Variable name: UPLOADS
R2 bucket: order-food-uploads
```

保存后重新部署。第一次访问线上应用时，Functions 会自动创建 D1 表并导入常见菜数据。

## 本地验证 Pages Functions

```bash
npm install
npm run build
npm run worker:typecheck
npx wrangler pages dev client/dist --compatibility-date=2026-06-22
```

看到 `Compiled Worker successfully` 即表示 Pages Functions 能被识别。

## 备用 Workers 部署

[wrangler.worker.jsonc](../wrangler.worker.jsonc) 保留了 Workers Static Assets 的部署配置。如果以后不使用 Pages Git 部署，可以填入 D1 `database_id` 后执行：

```bash
npm run build
npx wrangler deploy --config wrangler.worker.jsonc
```
