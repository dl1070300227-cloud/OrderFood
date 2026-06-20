import { mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";

const maxImageSize = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

function getSafeExtension(originalName: string, mimeType: string): string {
  const originalExtension = extname(originalName).toLowerCase();
  const mimeExtension = allowedImageTypes.get(mimeType) ?? "";
  return originalExtension === mimeExtension || (mimeType === "image/jpeg" && originalExtension === ".jpeg")
    ? originalExtension
    : mimeExtension;
}

export function createUploadsRouter(uploadRoot: string): Router {
  const router = Router();
  const recipeUploadDir = join(uploadRoot, "recipes");
  mkdirSync(recipeUploadDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        callback(null, recipeUploadDir);
      },
      filename: (_request, file, callback) => {
        const extension = getSafeExtension(file.originalname, file.mimetype);
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      }
    }),
    limits: { fileSize: maxImageSize },
    fileFilter: (_request, file, callback) => {
      if (!allowedImageTypes.has(file.mimetype)) {
        callback(new Error("仅支持 JPG、PNG 或 WebP 图片"));
        return;
      }
      callback(null, true);
    }
  });

  router.post("/recipe-image", (request, response) => {
    upload.single("image")(request, response, (error) => {
      if (error) {
        response.status(400).json({ message: error instanceof Error ? error.message : "图片上传失败" });
        return;
      }

      if (!request.file) {
        response.status(400).json({ message: "请选择要上传的图片" });
        return;
      }

      response.status(201).json({ path: `/uploads/recipes/${request.file.filename}` });
    });
  });

  return router;
}
