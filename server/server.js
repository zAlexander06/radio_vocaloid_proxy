import { Hono } from "hono";
import { streamingRouter } from "./streaming.js";
export const app = new Hono();
app.route("/", streamingRouter);
const isLocal = process.env.NODE_ENV !== "production" && !process.env.CF_PAGES;
console.log(isLocal ? "è in locale" : "è sulla rete");
if (isLocal) {
    const { serve } = await import("@hono/node-server");
    const { serveStatic } = await import("@hono/node-server/serve-static");
    const port = Number(process.env.PORT) || 6767;
    app.use("/*", serveStatic({ root: "./public" }));
    app.get("*", serveStatic({ path: "./public/index.html" }));
    serve({
        fetch: app.fetch, port
    }, (info) => { console.log(`Server locale avviato su http://localhost:${info.port}`); });
}
export default app;
//# sourceMappingURL=server.js.map