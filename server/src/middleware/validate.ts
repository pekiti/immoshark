import type { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema, source: "body" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const messages = (result.error as ZodError).errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      res.status(400).json({
        error: { message: messages, code: "VALIDATION_ERROR" },
      });
      return;
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      // Express 5 query is readonly, store parsed data in res.locals
      res.locals.query = result.data;
    }
    next();
  };
}
