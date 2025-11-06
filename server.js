import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { exec } from "child_process";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve generated APKs
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Multer storage
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

// Build APK endpoint
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode, minSdk, websiteUrl, email } = req.body;
    if (!appName || !packageName || !websiteUrl || !email) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 1️⃣ Copy Android template for this build
    const buildId = Date.now();
    const buildDir = path.join("uploads", `build_${buildId}`);
    fs.copySync("android-template", buildDir);

    // 2️⃣ Replace icon & splash
    if (req.files.icon) {
      const iconPath = path.join(buildDir, "app/src/main/res/mipmap/ic_launcher.png");
      fs.copyFileSync(req.files.icon[0].path, iconPath);
    }
    if (req.files.splash) {
      const splashPath = path.join(buildDir, "app/src/main/res/drawable/splash.png");
      fs.copyFileSync(req.files.splash[0].path, splashPath);
    }

    // 3️⃣ Update app name and version in build.gradle
    const buildGradlePath = path.join(buildDir, "app/build.gradle");
    let gradleContent = fs.readFileSync(buildGradlePath, "utf-8");
    gradleContent = gradleContent.replace(/versionCode \d+/g, `versionCode ${versionCode}`);
    gradleContent = gradleContent.replace(/versionName ".*"/g, `versionName "${versionName}"`);
    fs.writeFileSync(buildGradlePath, gradleContent, "utf-8");

    // 4️⃣ Replace package name in AndroidManifest.xml
    const manifestPath = path.join(buildDir, "app/src/main/AndroidManifest.xml");
    let manifestContent = fs.readFileSync(manifestPath, "utf-8");
    manifestContent = manifestContent.replace(/package=".*?"/, `package="${packageName}"`);
    manifestContent = manifestContent.replace(/<application android:label=".*?"/, `<application android:label="${appName}"`);
    fs.writeFileSync(manifestPath, manifestContent, "utf-8");

    // 5️⃣ Trigger Gradle build
    exec("./gradlew assembleRelease", { cwd: buildDir }, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Build error:", stderr);
        return res.status(500).json({ success: false, message: "Build failed", error: stderr });
      }

      // APK path
      const apkPath = path.join(buildDir, "app/build/outputs/apk/release/app-release.apk");

      // Copy APK to /uploads for frontend
      const outDir = path.join("uploads", "builds");
      fs.ensureDirSync(outDir);
      const apkName = `${packageName}.apk`;
      fs.copySync(apkPath, path.join(outDir, apkName));

      const downloadUrl = `${process.env.SERVER_URL}/uploads/builds/${apkName}`;
      return res.json({ success: true, downloadUrl });
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Fleepzon Builder API running on port ${PORT}`));

