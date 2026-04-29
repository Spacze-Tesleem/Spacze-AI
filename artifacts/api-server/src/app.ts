import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

// Build an explicit allowlist from CORS_ALLOWED_ORIGINS (comma-separated).
// Falls back to the same host (no cross-origin) when the variable is absent.
const rawOrigins = process.env["CORS_ALLOWED_ORIGINS"];
const allowedOrigins: Set<string> = rawOrigins
  ? new Set(rawOrigins.split(",").map((o) => o.trim()).filter(Boolean))
  : new Set();

export const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    // Same-origin requests (e.g. server-to-server) have no Origin header.
    if (!requestOrigin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

export default app;
