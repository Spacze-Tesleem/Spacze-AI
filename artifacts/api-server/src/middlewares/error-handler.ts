import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

/**
 * Global error-handling middleware.
 *
 * Must be registered AFTER all routes (four-argument signature required by
 * Express to recognise it as an error handler).
 *
 * - ZodError  → 400 with a structured list of field-level issues. Raw input
 *               values are intentionally omitted to avoid leaking user data.
 * - Everything else → 500 with a generic message. The real error is logged
 *               server-side only.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    return;
  }

  // Log unexpected errors server-side; never send internals to the client.
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  res.status(500).json({ error: "Internal server error" });
}
