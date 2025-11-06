// 📦 Dependencies
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import path from "path";
import { execSync } from "child_process";

dotenv.config();
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🗂️ Ensure upload folders exist
["uploads", "uploads/icons", "uploads/splash", "uploads/builds"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 🖼️ Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ================================
// 💾 MongoDB Connection
// ================================
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/webtoapp";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ================================
// 🧱 Schema & Model
// ================================
const appSchema = new mongoose.Schema(
  {
    appName: String,
    packageName: String,
    website: String,
    icon: String,
    splash: String,
    buildFile: String,
    buildAAB: String,
    contactEmail: String,
    versionName: String,
    versionCode: Number,
    addons: [String],
    admobAppId: String,
    bannerAd: String,
    rewardedAd: String,
    paid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AppModel = mongoose.model("App", appSchema);

// ================================
// 📦 Multer File Upload
// ================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === "icon" ? "uploads/icons" : "uploads/splash";
    cb(null, folder);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ================================
// 💳 Razorpay Setup
// ================================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================================
// 📧 Nodemailer Setup
// ================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Web to App Builder" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📩 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
}

// ================================
// 🔨 Real Android Build Generator
// ================================
function buildRealApp({ appName, packageName, website, type = "apk" }) {
  const templateDir = path.join(process.cwd(), "android_template");
  const buildOutputDir = path.join(process.cwd(), "uploads/builds");
  fs.mkdirSync(buildOutputDir, { recursive: true });

  // 1️⃣ Replace URL in MainActivity.java
  const mainActivityPath = path.join(
    templateDir,
    "app/src/main/java/com/example/app/MainActivity.java"
  );
  let code = fs.readFileSync(mainActivityPath, "utf8");
  code = code.replace(/"https:\/\/www\.example\.com"/g, `"${website}"`);
  fs.writeFileSync(mainActivityPath, code, "utf8");

  // 2️⃣ Replace app name in strings.xml
  const stringsPath = path.join(templateDir, "app/src/main/res/values/strings.xml");
  let stringsXml = fs.readFileSync(stringsPath, "utf8");
  stringsXml = stringsXml.replace(
    /<string name="app_name">.*<\/string>/,
    `<string name="app_name">${appName}</string>`
  );
  fs.writeFileSync(stringsPath, stringsXml, "utf8");

  // 3️⃣ Update package in manifest
  const manifestPath = path.join(templateDir, "app/src/main/AndroidManifest.xml");
  let manifest = fs.readFileSync(manifestPath, "utf8");
  manifest = manifest.replace(/package="[^"]+"/, `package="${packageName}"`);
  fs.writeFileSync(manifestPath, manifest, "utf8");

  // 4️⃣ Build the app
  console.log(`🧱 Building ${type.toUpperCase()} for ${packageName}...`);
  const gradleTask = type === "aab" ? "bundleRelease" : "assembleRelease";
  execSync(`cd ${templateDir} && ./gradlew ${gradleTask}`, { stdio: "inherit" });

  // 5️⃣ Copy output
  const builtPath =
    type === "aab"
      ? path.join(templateDir, "app/build/outputs/bundle/release/app-release.aab")
      : path.join(templateDir, "app/build/outputs/apk/release/app-release.apk");

  const outputPath = path.join(buildOutputDir, `${packageName}.${type}`);
  fs.copyFileSync(builtPath, outputPath);

  console.log(`✅ ${type.toUpperCase()} built:`, outputPath);
  return outputPath;
}

// ================================
// 🚀 Routes
// ================================

// Health check
app.get("/", (req, res) => res.send("✅ Web-to-App Builder API Running!"));

// 1️⃣ Check existing app
app.get("/api/checkApp", async (req, res) => {
  try {
    const { packageName } = req.query;
    const appData = await AppModel.findOne({ packageName });
    res.json(
      appData
        ? { exists: true, versionName: appData.versionName, versionCode: appData.versionCode }
        : { exists: false }
    );
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

// 2️⃣ Submit / Update App → Real APK Build
app.post("/api/submit", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const data = req.body;
    if (!data.appName || !data.packageName || !data.contactEmail || !data.website)
      return res.status(400).json({ error: "Missing required fields" });

    const icon = req.files?.icon?.[0]?.path || "";
    const splash = req.files?.splash?.[0]?.path || "";

    const buildPath = buildRealApp({
      appName: data.appName,
      packageName: data.packageName,
      website: data.website,
      type: "apk",
    });

    const link = `${req.protocol}://${req.get("host")}/${buildPath.replace(/\\/g, "/")}`;
    const existing = await AppModel.findOne({ packageName: data.packageName });

    if (existing) {
      Object.assign(existing, { ...data, icon, splash, buildFile: buildPath });
      await existing.save();
    } else {
      await AppModel.create({ ...data, icon, splash, buildFile: buildPath });
    }

    await sendEmail(
      data.contactEmail,
      `🎉 ${data.appName} Build Ready`,
      `<p>Your Android app is ready! Click below to download:</p><p><a href="${link}">⬇ Download APK</a></p>`
    );

    res.json({ success: true, message: "🎉 App built successfully!", downloadUrl: link });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ success: false, error: "Build failed" });
  }
});

// 3️⃣ Search App
app.get("/api/search", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    if (!query) return res.status(400).json({ error: "Missing search query" });

    const appData = await AppModel.findOne({
      $or: [
        { appName: { $regex: query, $options: "i" } },
        { packageName: { $regex: query, $options: "i" } },
      ],
    });

    if (!appData) return res.json({ success: false, message: "App not found" });

    res.json({
      success: true,
      data: appData,
      apkLink: `${req.protocol}://${req.get("host")}/${appData.buildFile.replace(/\\/g, "/")}`,
      aabLink: appData.buildAAB
        ? `${req.protocol}://${req.get("host")}/${appData.buildAAB.replace(/\\/g, "/")}`
        : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

// 4️⃣ Razorpay - Create Order
app.post("/api/payment/order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 699900, // ₹6,999.00
      currency: "INR",
      receipt: "order_" + Date.now(),
    });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: "Payment order failed" });
  }
});

// 5️⃣ Razorpay - Verify & Build AAB
app.post("/api/payment/verify", async (req, res) => {
  try {
    const { packageName, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_signature)
      return res.status(400).json({ success: false, error: "Missing signature" });

    const generated = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated !== razorpay_signature)
      return res.status(400).json({ success: false, error: "Signature mismatch ❌" });

    // Build AAB file
    const aabPath = buildRealApp({ appName: packageName, packageName, website: "", type: "aab" });

    const updated = await AppModel.findOneAndUpdate(
      { packageName },
      { paid: true, buildAAB: aabPath },
      { new: true }
    );

    const link = `${req.protocol}://${req.get("host")}/${aabPath.replace(/\\/g, "/")}`;
    await sendEmail(
      updated.contactEmail,
      `✅ ${updated.appName} AAB Ready`,
      `<p>Payment verified successfully!</p><p><a href="${link}">⬇ Download AAB</a></p>`
    );

    res.json({ success: true, message: "✅ Payment verified & AAB generated!", downloadAAB: link });
  } catch (err) {
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

// ================================
// 🖥️ Start Server
// ================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
