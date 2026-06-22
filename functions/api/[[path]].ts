import { handleApi, type ApiEnv } from "../../worker/src/index";

export const onRequest: PagesFunction<ApiEnv> = async ({ request, env }) => {
  return handleApi(env, request);
};
