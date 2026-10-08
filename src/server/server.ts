import express, { Request, Response } from "express";
import path from "node:path";
import { streamingRouter } from "./streaming.js";

export const app = express();

app.use(streamingRouter);

const isLocal = process.env.NODE_ENV !== "production" && !process.env.CF_PAGES;
console.log(`${(isLocal) ? "è in locale" : "è sulla rete"}`);

if (isLocal) {
    const port = process.env.PORT || 6767;
    const publicPath = path.resolve(process.cwd(), "public");

    app.use(express.static(publicPath));

    app.get(/(.*)/, (req: Request, res: Response) => {
        res.sendFile(path.join(publicPath, "index.html"));
    });

    app.listen(port, () => {
        console.log(`Server locale avviato su http://localhost:${port}`);
    });
}

if (process.env.NODE_ENV !== "production") {
    const rotte = streamingRouter.stack
        ?.map((layer: any) => layer.route?.path)
        .filter(Boolean);
    console.log("Rotte registrate:", rotte);
}