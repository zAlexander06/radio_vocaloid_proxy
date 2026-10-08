import express, { Request, Response } from "express";
import path from "node:path";
import { streamingRouter } from "./streaming.js";

export const app = express();
const port = process.env.PORT || 6767;

const publicPath = path.resolve(process.cwd(), "public");

app.use(streamingRouter);

if (!process.env.CF_PAGES && !process.env.WORKER) {
    app.use(express.static(publicPath));

    app.get(/(.*)/, (req: Request, res: Response) => {
        res.sendFile(path.join(publicPath, "index.html"));
    });

    app.listen(port, () => {
        console.log(`Server locale avviato su http://localhost:${port}`);
    });
}