import { Request, Response, NextFunction } from "express";
import { config } from "../config/config";
import * as userModel from "../models/user.model";
import * as sessionModel from "../models/session.model";
import * as securityModel from "../models/security.model";
import {
  verifyPassword,
  generateToken,
  generateRandomUsername,
  generatePassphrase,
} from "../utils/auth.utils";
import {
  generateDeviceFingerprint,
  extractDeviceInfo,
} from "../utils/device.utils";
import { ApiError } from "../types/request.types";
import { AuthenticatedRequest } from "../types/request.types";
import { User } from "../types/user.types";

// Registering a new user
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username: providedUsername, password } = req.body;

    // Generating username if not provided
    const username = providedUsername || generateRandomUsername();

    // Checking if username already exists
    const existingUser = await userModel.findUserByUsername(username);
    if (existingUser) {
      throw new ApiError("Username already exists", 400);
    }

    // Generating a recovery passphrase
    const passphrase = generatePassphrase();

    // Creating the user
    const user = await userModel.createUser({
      username,
      password,
      passphrase,
    });

    // Getting device fingerprint
    const deviceInfo = extractDeviceInfo(req);
    const deviceFingerprint = generateDeviceFingerprint(deviceInfo);

    // Creating a session
    const expiresAt = new Date(Date.now() + config.auth.sessionTimeout);
    const session = await sessionModel.createSession(
      user.user_id,
      deviceFingerprint,
      req.ip || "0.0.0.0",
      expiresAt
    );

    // Generating JWT
    const token = generateToken({
      user_id: user.user_id,
      username: user.username,
      session_id: session.session_id,
    });

    // Sending response
    res.status(201).json({
      status: "success",
      message: "Registration successful",
      data: {
        token,
        user: userModel.formatUserResponse(user),
        passphrase, // Important: Only send this once during registration
        expiresAt: expiresAt.getTime(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login with password (familiar device)
export const loginWithPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || "0.0.0.0";

    // Checking for rate limiting
    if (await securityModel.isIpRateLimited(ipAddress)) {
      throw new ApiError(
        "Too many login attempts. Please try again later.",
        429
      );
    }

    // Finding user
    const user = await userModel.findUserByUsername(username);
    if (!user) {
      await securityModel.recordFailedAttempt(ipAddress, username);
      throw new ApiError("Invalid username or password", 401);
    }

    // Checking if account is under attack
    if (await securityModel.isAccountUnderAttack(username)) {
      throw new ApiError(
        "Account temporarily locked. Please try again later or use passphrase recovery.",
        429
      );
    }

    // Verifying password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      await securityModel.recordFailedAttempt(ipAddress, username);
      throw new ApiError("Invalid username or password", 401);
    }

    // Get device info
    const deviceInfo = extractDeviceInfo(req);
    const deviceFingerprint = generateDeviceFingerprint(deviceInfo);

    // Checking if device is familiar
    const existingSession = await sessionModel.findSessionByDevice(
      user.user_id,
      deviceFingerprint
    );

    const isNewDevice = !existingSession;

    // If new device, requiring passphrase login instead
    if (isNewDevice) {
      throw new ApiError(
        "Unrecognized device. Please login with your recovery passphrase.",
        403,
        [{ code: "NEW_DEVICE", message: "Please use passphrase login method" }]
      );
    }

    // Creating a new session
    const expiresAt = new Date(Date.now() + config.auth.sessionTimeout);
    const session = await sessionModel.createSession(
      user.user_id,
      deviceFingerprint,
      ipAddress,
      expiresAt
    );

    // Updating last login time
    await userModel.updateLastLogin(user.user_id);

    // Generating JWT
    const token = generateToken({
      user_id: user.user_id,
      username: user.username,
      session_id: session.session_id,
    });

    // Send response
    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        token,
        user: userModel.formatUserResponse(user),
        expiresAt: expiresAt.getTime(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login with passphrase (new device)
export const loginWithPassphrase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, passphrase } = req.body;
    const ipAddress = req.ip || "0.0.0.0";

    // Check for rate limiting
    if (await securityModel.isIpRateLimited(ipAddress)) {
      throw new ApiError(
        "Too many login attempts. Please try again later.",
        429
      );
    }

    // Find user
    const user = await userModel.findUserByUsername(username);
    if (!user) {
      await securityModel.recordFailedAttempt(ipAddress, username);
      throw new ApiError("Invalid username or passphrase", 401);
    }

    // Verify passphrase
    const isPassphraseValid = await verifyPassword(
      passphrase,
      user.passphrase_hash
    );
    if (!isPassphraseValid) {
      await securityModel.recordFailedAttempt(ipAddress, username);
      throw new ApiError("Invalid username or passphrase", 401);
    }

    // Get device info
    const deviceInfo = extractDeviceInfo(req);
    const deviceFingerprint = generateDeviceFingerprint(deviceInfo);

    // Create a new session
    const expiresAt = new Date(Date.now() + config.auth.sessionTimeout);
    const session = await sessionModel.createSession(
      user.user_id,
      deviceFingerprint,
      ipAddress,
      expiresAt
    );

    // Update last login time
    await userModel.updateLastLogin(user.user_id);

    // Generate JWT
    const token = generateToken({
      user_id: user.user_id,
      username: user.username,
      session_id: session.session_id,
    });

    // Send response
    res.status(200).json({
      status: "success",
      message: "Login successful with passphrase",
      data: {
        token,
        user: userModel.formatUserResponse(user),
        expiresAt: expiresAt.getTime(),
        isNewDevice: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.session) {
      throw new ApiError("No active session", 400);
    }

    // Invalidate the session
    await sessionModel.invalidateSession(req.session.session_id);

    res.status(200).json({
      status: "success",
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
export const getCurrentUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Not authenticated", 401);
    }

    res.status(200).json({
      status: "success",
      data: {
        user: userModel.formatUserResponse(req.user as User),
      },
    });
  } catch (error) {
    next(error);
  }
};
