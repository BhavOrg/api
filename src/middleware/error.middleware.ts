import { Request, Response, NextFunction } from "express";
import { ApiError } from "../types/request.types";

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Default error response for unexpected errors
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};

// 404 handler for undefined routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    status: "error",
    message: `Not found - ${req.originalUrl}`,
  });
};
