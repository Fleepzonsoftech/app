// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { exec } from "child_process";
import Razorpay from "razorpay";
import https from "https";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve APK/AAB files

// =========================
// Multer setup for uploads
// =========================
const upload = multer({ dest: "uploads/" });

// =========================
// Builds JSON storage
// =========================
const BUILDS_FILE = "./builds.json";
if (!fs.existsSync(BUILDS_FILE)) fs.writeJSONSync(BUILDS_FILE, []);

// =========================
// Nodemailer setup
// =========================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Gmail user
    pass: process.env.EMAIL_PASS  // App password if 2FA enabled
  }
});

// =========================
// Razorpay setup
// =========================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =========================
// Search existing app build
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
// Free APK build
// =========================
app.post("/api/build", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const { appName, packageName, versionName, versionCode, minSdk, websiteUrl, email } = req.body;
    if (!appName || !packageName || !versionName || !versionCode || !minSdk || !websiteUrl || !email)
      return res.json({ success: false, message: "Missing fields" });

    // Copy Android template
    const templateDir = path.join(__dirname, "androidTemplate");
    const buildDir = path.join(__dirname, "builds", `${packageName}-${Date.now()}`);
    fs.copySync(templateDir, buildDir);

    // Update strings.xml
    let stringsXml = path.join(buildDir, "app/src/main/res/values/strings.xml");
    let sXml = fs.readFileSync(stringsXml, "utf8")
      .replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${appName}</string>`);
    fs.writeFileSync(stringsXml, sXml);

    // Update build.gradle
    let gradleFile = path.join(buildDir, "app/build.gradle");
    let gContent = fs.readFileSync(gradleFile, "utf8")
      .replace(/versionCode \d+/, `versionCode ${versionCode}`)
      .replace(/versionName ".*"/, `versionName "${versionName}"`);
    fs.writeFileSync(gradleFile, gContent);

    // Update AndroidManifest.xml
    let manifest = path.join(buildDir, "app/src/main/AndroidManifest.xml");
    let mContent = fs.readFileSync(manifest, "utf8")
      .replace(/package=".*"/, `package="${packageName}"`);
    fs.writeFileSync(manifest, mContent);

    // Copy uploaded icon & splash
    if (req.files.icon?.[0])
      fs.copySync(req.files.icon[0].path, path.join(buildDir, "app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"));
    if (req.files.splash?.[0])
      fs.copySync(req.files.splash[0].path, path.join(buildDir, "app/src/main/res/drawable/splash.png"));

    // Build APK
    exec(`cd "${buildDir}" && ./gradlew assembleRelease`, async (err, stdout, stderr) => {
      if (err) { console.error(err, stderr); return res.json({ success: false, message: "APK build failed" }); }

      const apkPath = path.join(buildDir, "app/build/outputs/apk/release/app-release.apk");
      const apkFileName = `${packageName}-${versionCode}.apk`;
      const finalApk = path.join(__dirname, "public/builds", apkFileName);
      fs.ensureDirSync(path.dirname(finalApk));
      fs.copySync(apkPath, finalApk);

      // Save build info
      const builds = await fs.readJSON(BUILDS_FILE);
      const idx = builds.findIndex(b => b.packageName === packageName);
      const buildData = { appName, packageName, versionName, versionCode, minSdk, websiteUrl, apkUrl: `/builds/${apkFileName}`, aabUrl: "", createdAt: new Date().toISOString() };
      if (idx >= 0) builds[idx] = buildData; else builds.push(buildData);
      await fs.writeJSON(BUILDS_FILE, builds, { spaces: 2 });

      // Send email with download link
      const downloadLink = `https://${req.get("host")}/builds/${apkFileName}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Your APK for ${appName} is ready`,
        html: `<p>Download: <a href="${downloadLink}">⬇ APK</a></p>`
      });

      res.json({ success: true, downloadUrl: downloadLink });
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// =========================
// Paid AAB build
// =========================
app.post("/create-order", async (req, res) => {
  const { amount } = req.body;
  try {
    const order = await razorpay.orders.create({ amount: amount * 100, currency: "INR", payment_capture: 1 });
    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Order creation failed" });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, email, packageName } = req.body;
    if (!email || !packageName) return res.json({ success: false, message: "Missing email or package" });

    // Copy template and build
    const templateDir = path.join(__dirname, "androidTemplate");
    const buildDir = path.join(__dirname, "builds", `${packageName}-${Date.now()}`);
    fs.copySync(templateDir, buildDir);

    exec(`cd "${buildDir}" && ./gradlew bundleRelease`, async (err, stdout, stderr) => {
      if (err) { console.error(err, stderr); return res.json({ success: false, message: "AAB build failed" }); }

      const aabPath = path.join(buildDir, "app/build/outputs/bundle/release/app-release.aab");
      const aabFileName = `${packageName}-${Date.now()}.aab`;
      const finalAAB = path.join(__dirname, "public/builds", aabFileName);
      fs.ensureDirSync(path.dirname(finalAAB));
      fs.copySync(aabPath, finalAAB);

      const builds = await fs.readJSON(BUILDS_FILE);
      const idx = builds.findIndex(b => b.packageName === packageName);
      if (idx >= 0) builds[idx].aabUrl = `/builds/${aabFileName}`; 
      else builds.push({ packageName, aabUrl: `/builds/${aabFileName}`, createdAt: new Date().toISOString() });
      await fs.writeJSON(BUILDS_FILE, builds, { spaces: 2 });

      const downloadLink = `https://${req.get("host")}/builds/${aabFileName}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Your Paid AAB for ${packageName}`,
        html: `<p>Download: <a href="${downloadLink}">⬇ AAB</a></p>`
      });

      res.json({ success: true, message: "✅ AAB generated and emailed" });
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// =========================
// HTTPS server
// =========================
const sslOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/fleepzonsoftech.sbs/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/fleepzonsoftech.sbs/fullchain.pem")
};

https.createServer(sslOptions, app).listen(443, () => {
  console.log("🚀 HTTPS Server running on https://fleepzonsoftech.sbs");
});
