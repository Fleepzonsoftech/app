import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 Static file hosting for generated APKs
app.use("/uploads", express.static("uploads"));

// 🗂️ Setup file storage for icons & splash uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/temp";
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// 🧱 Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Fleepzon Builder API running successfully!");
});

// 🧩 Handle app build
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode, minSdk, websiteUrl, email } = req.body;

    if (!appName || !packageName || !websiteUrl || !email) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 💾 Ensure build output directory
    const buildDir = path.join("uploads", "builds");
    fs.ensureDirSync(buildDir);

    // 📦 Simulate build process (you can replace this with Gradle command)
    const apkName = `${packageName}.apk`;
    const apkPath = path.join(buildDir, apkName);

    // Create dummy APK file
    fs.writeFileSync(apkPath, "Fake APK file content - Replace with real build output");

    console.log(`✅ Build created for ${packageName}`);

    // 🧾 Respond with download link
    const serverUrl = process.env.SERVER_URL || "http://localhost:5000";
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

// ⚙️ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Fleepzon Builder running on port ${PORT}`));
