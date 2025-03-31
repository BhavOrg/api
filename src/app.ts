import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

const app: express.Application = express();

// Applying middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS handling
app.use(morgan("dev")); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Apply routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);

// API health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

// Apply error handling middleware
app.use(notFoundHandler); // Handle 404s
app.use(errorHandler); // Handle all other errors

export default app;
