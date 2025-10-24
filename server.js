import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(cors({ 
  origin: "http://localhost:3000", 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use("/", authRoutes);

app.get("/", (req, res) => {
  res.json({ 
    message: "Backend server is running",
    availableRoutes: [
      "GET /auth/test",
      "POST /auth/signup",
      "POST /auth/login",
      "POST /auth/google-login",
      "GET /auth/profile",
      "POST /auth/logout"
    ]
  });
});

app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: "Route not found",
    method: req.method,
    path: req.path,
    availableRoutes: [
      "POST /auth/signup",
      "POST /auth/login",
      "POST /auth/google-login",
      "GET /auth/profile",
      "POST /auth/logout"
    ]
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Available routes:");
  console.log("  POST /auth/signup");
  console.log("  POST /auth/login");
  console.log("  POST /auth/google-login");
  console.log("  GET  /auth/profile");
  console.log("  POST /auth/logout");
  console.log("  GET  /auth/test (to verify routes)");
});

export default app;