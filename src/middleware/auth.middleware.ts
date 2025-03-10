import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.utils";
import * as userModel from "../models/user.model";
import * as sessionModel from "../models/session.model";
import { ApiError } from "../types/request.types";
import { User } from "../types/user.types";
import { Session } from "../types/auth.types";

// Declaring module augmentation to extend the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError("Not authenticated", 401);
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      throw new ApiError("Invalid or expired token", 401);
    }

    // Get user
    const user = await userModel.findUserById(payload.user_id);
    if (!user) {
      throw new ApiError("User not found", 401);
    }

    // Get session
    const session = await sessionModel.findSessionById(payload.session_id);
    if (!session) {
      throw new ApiError("Session expired or invalid", 401);
    }

    // Check if session is still valid
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      throw new ApiError("Session expired", 401);
    }

    // Attach user and session to request
    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    next(error);
  }
};
