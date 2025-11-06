import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Enable CORS for all domains (so GitHub Pages frontend can access)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (APK/AAB downloads)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Setup multer storage for icon and splash uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join("uploads", "temp");
    fs.ensureDirSync(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Fleepzon Builder API running successfully!");
});

// Build endpoint
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode, minSdk, websiteUrl, email } = req.body;

    if (!appName || !packageName || !websiteUrl || !email) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Ensure build directory
    const buildDir = path.join("uploads", "builds");
    fs.ensureDirSync(buildDir);

    // Dummy APK filename
    const apkName = `${packageName}.apk`;
    const apkPath = path.join(buildDir, apkName);

    // Create a dummy APK file (replace this with real build command later)
    fs.writeFileSync(apkPath, "Fake APK content - Replace with real build output");

    console.log(`✅ APK created for ${packageName}`);

    // Build download URL using your live SERVER_URL
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const downloadUrl = `${serverUrl}/uploads/builds/${apkName}`;

    return res.json({
      success: true,
      message: "Build success!",
      downloadUrl,
    });
  } catch (err) {
    console.error("❌ Build error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Fleepzon Builder API running on port ${PORT}`));
