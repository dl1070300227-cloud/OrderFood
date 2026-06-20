# 家用点菜小程序

本项目第一版是本地全栈网页原型，用于家庭点菜、维护菜品教程和查看订单记录。
菜品教程支持封面图、图文步骤和视频外链，图片会保存到本地 `data/uploads/recipes/`。

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

## 常用命令

```powershell
npm run dev:server
npm run dev:client
npm test
npm run build
```

默认端口：

- 后端 API：`http://localhost:3001`
- 前端页面：`http://localhost:5173`

## 局域网访问

如果要让同一 Wi-Fi 下的手机访问，启动前端时使用 Vite 输出的 Network 地址，并确保防火墙允许对应端口访问。
