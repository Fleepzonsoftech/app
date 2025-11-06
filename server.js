import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { exec } from "child_process";

dotenv.config();
const app = express();

// Enable CORS for frontend
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve APK/AAB downloads
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

// Root
app.get("/", (req, res) => res.send("✅ Fleepzon Builder API running!"));

// Build APK endpoint
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode } = req.body;
    if (!appName || !packageName || !versionName || !versionCode)
      return res.status(400).json({ success: false, message: "Missing fields" });

    // Copy Android template
    const projectTemplate = path.join(process.cwd(), "androidTemplate");
    const tempBuild = path.join("uploads", "tempBuild", Date.now().toString());
    fs.copySync(projectTemplate, tempBuild);

    // Replace placeholders
    const buildGradlePath = path.join(tempBuild, "app", "build.gradle");
    let gradleFile = fs.readFileSync(buildGradlePath, "utf-8");
    gradleFile = gradleFile.replace(/APPLICATION_ID_PLACEHOLDER/g, packageName)
                           .replace(/VERSION_CODE_PLACEHOLDER/g, versionCode)
                           .replace(/VERSION_NAME_PLACEHOLDER/g, versionName);
    fs.writeFileSync(buildGradlePath, gradleFile);

    // Copy icons & splash
    fs.copySync(req.files.icon[0].path, path.join(tempBuild, "app", "src", "main", "res", "mipmap-xxxhdpi", "ic_launcher.png"));
    fs.copySync(req.files.splash[0].path, path.join(tempBuild, "app", "src", "main", "res", "drawable", "splash.png"));

    // Run Gradle
    exec(`cd ${tempBuild} && ./gradlew assembleRelease`, (err) => {
      if (err) {
        console.error("Gradle build error:", err);
        return res.status(500).json({ success: false, message: "APK build failed" });
      }

      // Copy APK to uploads
      const apkPath = path.join(tempBuild, "app/build/outputs/apk/release/app-release.apk");
      const buildDir = path.join("uploads", "builds");
      fs.ensureDirSync(buildDir);
      const apkName = `${packageName}.apk`;
      fs.copySync(apkPath, path.join(buildDir, apkName));

      const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      const downloadUrl = `${serverUrl}/uploads/builds/${apkName}`;
      return res.json({ success: true, downloadUrl });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Fleepzon Builder API running on port ${PORT}`));
