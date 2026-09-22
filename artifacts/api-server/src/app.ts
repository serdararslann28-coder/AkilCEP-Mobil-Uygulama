import express, { type Express } from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Covers the validated 24 MB decoded attachment budget after base64 expansion.
app.use(express.json({ limit: "34mb" }));
app.use(express.urlencoded({ extended: true, limit: "34mb" }));


app.get("/privacy", (_req, res) => {
  const privacyPath = path.resolve(process.cwd(), "../../site/privacy.html");
  res.sendFile(privacyPath);
});

app.use("/api", router);

export default app;
