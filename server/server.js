import express from "express";
import path from "path";
import { streamingRouter } from "./streaming.js";
export const app = express();
const publicPath = path.resolve(process.cwd(), "public");
app.use(streamingRouter);
app.use(express.static(publicPath));
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});
export const startLocalServer = (port = 6767) => {
    return app.listen(port, () => {
        console.log(`Server locale avviato su http://localhost:${port}`);
    });
};
//# sourceMappingURL=server.js.map