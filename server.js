// ✅ server.js — ES Module version (works with "type": "module")

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs-extra";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fix __dirname/__filename for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(__dirname, "uploads/icons");
    fs.ensureDirSync(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Test route
app.get("/", (req, res) => {
  res.send("✅ Backend running fine on port " + PORT);
});

// Build route
app.post("/api/build", upload.single("icon"), async (req, res) => {
  try {
    const { appName, packageName } = req.body;
    const folder = path.join(__dirname, "uploads/builds");
    fs.ensureDirSync(folder);

    const apkPath = path.join(folder, `${packageName}.apk`);
    fs.writeFileSync(apkPath, "Dummy APK File");

    res.json({
      success: true,
      message: `🎉 ${appName} created successfully!`,
      downloadUrl: `http://localhost:${PORT}/uploads/builds/${packageName}.apk`,
    });
  } catch (error) {
    console.error("❌ Build Error:", error);
    res.status(500).json({ success: false, message: "Build failed" });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
