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

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// ================================
// 💾 MongoDB
// ================================
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ================================
// 🧱 Schema & Model
// ================================
const appSchema = new mongoose.Schema({
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});
const AppModel = mongoose.model("App", appSchema);

// ================================
// 📦 Multer Upload
// ================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === "icon" ? "uploads/icons" : "uploads/splash";
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ================================
// 💳 Razorpay
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
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});

// Helper: Send email with download link
async function sendEmail(to, subject, html) {
  await transporter.sendMail({
    from: `"Web to App Builder" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
}

// Helper: Build fake APK or AAB
function buildFakeFile(packageName, type = "apk") {
  const folder = "uploads/builds";
  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, `${packageName}.${type}`);
  fs.writeFileSync(filePath, `${type.toUpperCase()} build for ${packageName} at ${new Date()}`);
  return filePath;
}

// ================================
// 🚀 Routes
// ================================

// Health check
app.get("/", (req, res) => res.send("✅ Web-to-App Builder Backend Running!"));

// 1️⃣ Auto-check existing package name
app.get("/api/checkApp", async (req, res) => {
  try {
    const { packageName } = req.query;
    const appData = await AppModel.findOne({ packageName });
    if (appData) {
      return res.json({
        exists: true,
        versionName: appData.versionName,
        versionCode: appData.versionCode,
      });
    }
    res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

// 2️⃣ Submit or Update App (Free APK)
app.post("/api/submit", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const data = req.body;
    const icon = req.files?.icon?.[0]?.path || "";
    const splash = req.files?.splash?.[0]?.path || "";

    const existing = await AppModel.findOne({ packageName: data.packageName });
    const buildPath = buildFakeFile(data.packageName, "apk");

    if (existing) {
      // ⚙️ Seamless update
      existing.appName = data.appName;
      existing.versionName = data.versionName;
      existing.versionCode = data.versionCode;
      existing.website = data.website;
      existing.icon = icon || existing.icon;
      existing.splash = splash || existing.splash;
      existing.addons = data.addons || existing.addons;
      existing.admobAppId = data.admobAppId;
      existing.bannerAd = data.bannerAd;
      existing.rewardedAd = data.rewardedAd;
      existing.buildFile = buildPath;
      existing.updatedAt = new Date();
      await existing.save();

      // ✉️ Send email with new APK
      const link = `http://localhost:${process.env.PORT}/${buildPath}`;
      await sendEmail(
        existing.contactEmail,
        `✅ ${existing.appName} Updated (v${existing.versionName})`,
        `<p>Your app has been updated successfully.</p>
         <p><b>Package:</b> ${existing.packageName}</p>
         <p><a href="${link}">⬇ Download Latest APK</a></p>`
      );

      return res.json({
        success: true,
        message: `✅ Updated ${existing.appName} to v${existing.versionName}`,
        downloadUrl: link,
      });
    }

    // 🆕 Create new app
    const newApp = new AppModel({
      appName: data.appName,
      packageName: data.packageName,
      website: data.website,
      icon,
      splash,
      buildFile: buildPath,
      contactEmail: data.contactEmail,
      addons: data.addons || [],
      admobAppId: data.admobAppId,
      bannerAd: data.bannerAd,
      rewardedAd: data.rewardedAd,
      versionName: data.versionName,
      versionCode: data.versionCode,
    });
    await newApp.save();

    const link = `http://localhost:${process.env.PORT}/${buildPath}`;
    await sendEmail(
      newApp.contactEmail,
      `🎉 ${newApp.appName} Build Ready`,
      `<p>Your APK is ready for download!</p>
       <p><a href="${link}">⬇ Download APK</a></p>`
    );

    res.json({
      success: true,
      message: `🎉 ${newApp.appName} created successfully!`,
      downloadUrl: link,
    });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ success: false, error: "Failed to save app" });
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
      apkLink: `http://localhost:${process.env.PORT}/${appData.buildFile}`,
      aabLink: appData.buildAAB
        ? `http://localhost:${process.env.PORT}/${appData.buildAAB}`
        : null,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

// 4️⃣ Payment: Create Order
app.post("/api/payment/order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 699900,
      currency: "INR",
      receipt: "order_" + Date.now(),
    });
    res.json({ success: true, order });
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ success: false, error: "Payment order failed" });
  }
});

// 5️⃣ Payment: Verify & Generate AAB
app.post("/api/payment/verify", async (req, res) => {
  try {
    const { packageName, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    const generated = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated !== razorpay_signature)
      return res.status(400).json({ success: false, error: "Signature mismatch ❌" });

    const aabPath = buildFakeFile(packageName, "aab");
    const updated = await AppModel.findOneAndUpdate(
      { packageName },
      { paid: true, buildAAB: aabPath },
      { new: true }
    );

    const link = `http://localhost:${process.env.PORT}/${aabPath}`;
    await sendEmail(
      updated.contactEmail,
      `✅ ${updated.appName} AAB Build Ready`,
      `<p>Payment verified successfully!</p>
       <p><b>Package:</b> ${updated.packageName}</p>
       <p><a href="${link}">⬇ Download AAB</a></p>`
    );

    res.json({
      success: true,
      message: "✅ Payment verified & AAB generated!",
      downloadAAB: link,
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

// ================================
// 🖥️ Start Server
// ================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
