import { serveUpload, type ApiEnv } from "../../worker/src/index";

export const onRequest: PagesFunction<ApiEnv> = async ({ request, env }) => {
  return serveUpload(env, new URL(request.url).pathname);
};
