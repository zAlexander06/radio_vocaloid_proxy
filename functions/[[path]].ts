import serverless from "serverless-http";
import { app } from "../src/server/server.js";

const handler = serverless(app);

export default {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        return handler(request, { ...env, waitUntil: ctx.waitUntil?.bind(ctx), }) as unknown as Response;
    }
};