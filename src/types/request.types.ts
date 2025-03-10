import { Request } from "express";
import { User } from "./user.types";
import { Session } from "./auth.types";

export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: Session;
}

export interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: any[];
}

export class ApiError extends Error {
  statusCode: number;
  errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = "ApiError";
  }
}
