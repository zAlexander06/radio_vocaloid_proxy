import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { streamingRouter } from "./streaming.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 6767;
const publicPath = path.join(__dirname, "..", "..", "public");
app.use(cors());
app.use(streamingRouter);
app.use(express.static(publicPath));
app.get(/(.*)/, (req, res) => { res.sendFile(path.join(publicPath, 'index.html')); });
app.listen(port, () => { console.log(`Server avviato su 'http://localhost:${port}`); });
console.log("Rotte registrate:", streamingRouter.stack?.map((layer) => layer.route?.path).filter(Boolean));
//# sourceMappingURL=server.js.map