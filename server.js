import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { exec } from "child_process";
import Razorpay from "razorpay";
import bodyParser from "body-parser";
import crypto from "crypto";
import os from "os";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join("uploads", "temp");
    fs.ensureDirSync(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname),
});
const upload = multer({ storage });

// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper: get local IP
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// Root route
app.get("/", (req, res) => res.send("✅ Fleepzon Builder API running!"));

// Build APK endpoint
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode } = req.body;
    if (!appName || !packageName || !versionName || !versionCode)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const projectTemplate = path.join(process.cwd(), "androidTemplate");
    const tempBuild = path.join("uploads", "tempBuild", Date.now().toString());
    fs.copySync(projectTemplate, tempBuild);

    // Update build.gradle
    const buildGradlePath = path.join(tempBuild, "app", "build.gradle");
    let gradleFile = fs.readFileSync(buildGradlePath, "utf-8");
    gradleFile = gradleFile
      .replace(/APPLICATION_ID_PLACEHOLDER/g, packageName)
      .replace(/VERSION_CODE_PLACEHOLDER/g, versionCode)
      .replace(/VERSION_NAME_PLACEHOLDER/g, versionName);
    fs.writeFileSync(buildGradlePath, gradleFile);

    // Copy icon and splash
    fs.copySync(req.files.icon[0].path, path.join(tempBuild, "app", "src", "main", "res", "mipmap-xxxhdpi", "ic_launcher.png"));
    fs.copySync(req.files.splash[0].path, path.join(tempBuild, "app", "src", "main", "res", "drawable", "splash.png"));

    // Build APK
    exec(`cd ${tempBuild} && ./gradlew assembleRelease`, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "APK build failed" });
      }

      const apkPath = path.join(tempBuild, "app/build/outputs/apk/release/app-release.apk");
      const buildDir = path.join("uploads", "builds");
      fs.ensureDirSync(buildDir);
      const apkName = `${packageName}.apk`;
      fs.copySync(apkPath, path.join(buildDir, apkName));

      // Use dynamic IP
      const serverUrl = process.env.SERVER_URL || `http://${getLocalIP()}:${process.env.PORT || 3000}`;
      const downloadUrl = `${serverUrl}/uploads/builds/${apkName}`;
      res.json({ success: true, downloadUrl });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Razorpay Create Order
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Razorpay Verify Payment
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature)
    res.json({ success: true, message: "✅ Payment verified successfully" });
  else res.status(400).json({ success: false, message: "❌ Payment verification failed" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://${getLocalIP()}:${PORT}`);
  console.log("💡 Use this IP in your frontend BACKEND_URL for mobile/emulator access");
});

