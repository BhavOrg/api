import { Pool, QueryResult } from "pg";
import * as dotenv from "dotenv";

// Loading environment variables
dotenv.config();

// Creating connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Testing database connection
pool.query("SELECT NOW()", (err: Error, res: QueryResult) => {
  if (err) {
    console.error("Database connection error:", err.stack);
  } else {
    console.log("Database connected successfully");
  }
});

// Export query function
export const query = (text: string, params?: any[]): Promise<QueryResult> => {
  return pool.query(text, params);
};

// Getting a client from the pool
export const getClient = async () => {
  const client = await pool.connect();

  return {
    client,
    release: () => client.release(),
  };
};

// Exporting pool for potential direct use
export const dbPool = pool;
