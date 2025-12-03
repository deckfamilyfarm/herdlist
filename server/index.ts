import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Request / response logger (API routes only, with bounded JSON preview)
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown = undefined;

  // Capture res.json body
  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  } as any;

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;

    const duration = Date.now() - start;
    const baseLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

    if (capturedJsonResponse === undefined) {
      log(baseLine);
      return;
    }

    // Bounded JSON preview so logs don't explode but still show useful detail
    const jsonStr = JSON.stringify(capturedJsonResponse);
    const MAX_LEN = 600;
    const preview =
      jsonStr.length > MAX_LEN
        ? jsonStr.slice(0, MAX_LEN) + "…(truncated)"
        : jsonStr;

    log(`${baseLine} :: ${preview}`);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // -------------------------------------------------------------------------
  // Central error handler: log nicely, don't rethrow
  // -------------------------------------------------------------------------
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Summary line
    log(
      `ERROR ${status} ${req.method} ${req.path} :: ${message}`
    );

    // More detail in dev/non-production
    if (process.env.NODE_ENV !== "production" && err.stack) {
      log(err.stack);
    }

    // If headers already sent, let Express deal with it
    if (res.headersSent) {
      return;
    }

    res.status(status).json({ message });
  });

  // Only setup vite in development and after all other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();

