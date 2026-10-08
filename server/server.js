import express from "express";
import { streamingRouter } from "./streaming.js";
export const app = express();
app.use(streamingRouter);
export const startLocalServer = (port = 6767) => {
    return app.listen(port, () => {
        console.log(`Server locale avviato su http://localhost:${port}`);
    });
};
//# sourceMappingURL=server.js.map