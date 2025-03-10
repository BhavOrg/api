import app from "./app";
import { config } from "./config/config";

const PORT = config.port;

// Starting the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handling unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  console.error("Unhandled Rejection:", err.message);
  console.error(err.stack);

  // Gracefully shut down the server
  server.close(() => {
    process.exit(1);
  });
});

// Handling uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err.message);
  console.error(err.stack);

  // Gracefully shut down the server
  server.close(() => {
    process.exit(1);
  });
});
