import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticateUser } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";

const router = Router();

// Registration route
router.post(
  "/register",
  validateRequest({
    body: {
      username: { type: "string", optional: true },
      password: { type: "string", min: 8, required: true },
    },
  }),
  authController.register
);

// Login with password (familiar device)
router.post(
  "/login",
  validateRequest({
    body: {
      username: { type: "string", required: true },
      password: { type: "string", required: true },
    },
  }),
  authController.loginWithPassword
);

// Login with passphrase (new device)
router.post(
  "/login/passphrase",
  validateRequest({
    body: {
      username: { type: "string", required: true },
      passphrase: { type: "string", required: true },
    },
  }),
  authController.loginWithPassphrase
);

// Logout route (requires authentication)
router.post("/logout", authenticateUser, authController.logout);

// Get current user (requires authentication)
router.get("/me", authenticateUser, authController.getCurrentUser);

export default router;
