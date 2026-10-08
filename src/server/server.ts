import express, { Request, Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamingRouter } from "./streaming.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const port = process.env.PORT || 6767;  // tocco personale :)

const publicPath = path.join(__dirname, "..", "..", "public");

app.use(streamingRouter);
app.use(express.static(publicPath));

app.get(/(.*)/, (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(port, () => {
    console.log(`Server locale avviato su http://localhost:${port}`);
});