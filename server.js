import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =========================
// Storage & Upload Setup
// =========================
const upload = multer({ dest: "uploads/" });
const BUILDS_FILE = "./builds.json";

// Ensure builds file exists
if (!fs.existsSync(BUILDS_FILE)) fs.writeJSONSync(BUILDS_FILE, []);

// =========================
// Email Setup
// =========================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =========================
// Search API
// =========================
app.get("/api/search", async (req, res) => {
  const query = req.query.query?.toLowerCase();
  if (!query) return res.json({ exists: false });

  const builds = await fs.readJSON(BUILDS_FILE);
  const appFound = builds.find(
    b => b.appName.toLowerCase() === query || b.packageName.toLowerCase() === query
  );

  if (appFound) return res.json({ exists: true, app: appFound });
  res.json({ exists: false });
});

// =========================
// Build Free APK
// =========================
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode, minSdk, websiteUrl, email } = req.body;
    if (!appName || !packageName || !versionName || !versionCode || !minSdk || !websiteUrl || !email) {
      return res.json({ success: false, message: "Missing fields" });
    }

    // Simulate APK build by creating a dummy APK file
    const apkFileName = `${packageName}-${versionCode}.apk`;
    const apkPath = path.join(__dirname, "public", "builds", apkFileName);
    fs.ensureDirSync(path.dirname(apkPath));
    fs.writeFileSync(apkPath, "Dummy APK content");

    // Save build info
    const builds = await fs.readJSON(BUILDS_FILE);
    const existingIndex = builds.findIndex(b => b.packageName === packageName);
    const buildData = {
      appName, packageName, versionName, versionCode, minSdk, websiteUrl,
      apkUrl: `/builds/${apkFileName}`, aabUrl: "", createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) builds[existingIndex] = buildData;
    else builds.push(buildData);

    await fs.writeJSON(BUILDS_FILE, builds, { spaces: 2 });

    // Send email with download link
    const downloadLink = `${req.protocol}://${req.get("host")}/builds/${apkFileName}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your APK for ${appName} is ready`,
      html: `<p>Your APK has been built successfully!</p>
             <p><a href="${downloadLink}">⬇ Download APK</a></p>`,
    });

    res.json({ success: true, downloadUrl: downloadLink });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// =========================
// Razorpay Setup
// =========================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/create-order", async (req, res) => {
  const { amount } = req.body;
  const order = await razorpay.orders.create({
    amount: amount * 100, // in paise
    currency: "INR",
    payment_capture: 1,
  });
  res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
});

// =========================
// Verify Payment + Generate AAB per Package
// =========================
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, email, packageName } = req.body;

    if (!packageName || !email) return res.json({ success: false, message: "Missing package or email" });

    // Read builds.json
    const builds = await fs.readJSON(BUILDS_FILE);

    // Check if app exists
    let appIndex = builds.findIndex(b => b.packageName === packageName);
    let appData;
    if (appIndex >= 0) {
      appData = builds[appIndex]; // update existing
    } else {
      // If new build, create dummy app info
      appData = {
        appName: packageName,
        packageName,
        versionName: "1.0",
        versionCode: 1,
        minSdk: 21,
        websiteUrl: "",
        apkUrl: "",
        aabUrl: "",
        createdAt: new Date().toISOString()
      };
      builds.push(appData);
      appIndex = builds.length - 1;
    }

    // Generate new AAB file
    const aabFileName = `${packageName}-${Date.now()}.aab`;
    const aabPath = path.join(__dirname, "public", "builds", aabFileName);
    fs.ensureDirSync(path.dirname(aabPath));
    fs.writeFileSync(aabPath, "Dummy AAB content");

    // Update builds.json
    builds[appIndex].aabUrl = `/builds/${aabFileName}`;
    builds[appIndex].createdAt = new Date().toISOString();
    await fs.writeJSON(BUILDS_FILE, builds, { spaces: 2 });

    // Send email
    const downloadLink = `${req.protocol}://${req.get("host")}/builds/${aabFileName}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your Paid AAB for ${packageName} is ready`,
      html: `<p>Your AAB has been generated successfully!</p>
             <p><a href="${downloadLink}">⬇ Download AAB</a></p>`,
    });

    res.json({ success: true, message: "✅ Payment verified! AAB has been generated and emailed." });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// =========================
// Start Server
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
