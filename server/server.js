import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Clinic SaaS API is running",
  });
});




app.listen(PORT, async () => {
    await connectDB();
  console.log(`Server running on port ${PORT}`);
});