import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Serve static files for public access
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Ensure uploads/builds folder exists
const buildDir = path.join(__dirname, "uploads", "builds");
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

// ✅ Multer setup
const upload = multer({ dest: "uploads/" });

// ✅ Razorpay setup (replace with real keys)
const razorpay = new Razorpay({
  key_id: "rzp_test_1234567890",
  key_secret: "your_secret_key_here"
});

// ✅ Email setup (optional)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "examplemail@gmail.com",     // 🔹 Replace with your Gmail
    pass: "your_app_password_here"     // 🔹 Replace with Gmail App Password
  }
});

// ✅ Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  try {
    const options = {
      amount: 699900, // ₹6,999
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Razorpay error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Generate APK / AAB build
app.post("/api/submit", upload.fields([{ name: "icon" }, { name: "splash" }]), async (req, res) => {
  try {
    const {
      appName,
      packageName,
      versionName,
      versionCode,
      minSdk,
      websiteUrl,
      email,
      generateType
    } = req.body;

    if (!appName || !packageName || !generateType) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ✅ File extension based on build type
    const fileExt = generateType === "aab" ? "aab" : "apk";
    const outputFile = `${packageName}.${fileExt}`;
    const outputPath = path.join(buildDir, outputFile);

    // ✅ Create dummy build file
    fs.writeFileSync(outputPath, `Dummy ${fileExt} file for ${appName}`);

    // ✅ Full public download URL
    const downloadUrl = `${req.protocol}://${req.get("host")}/uploads/builds/${outputFile}`;
    console.log(`✅ ${fileExt.toUpperCase()} generated at: ${downloadUrl}`);

    // ✅ Optional email notification
    if (email) {
      try {
        await transporter.sendMail({
          from: "App Builder <examplemail@gmail.com>",
          to: email,
          subject: `${appName} ${fileExt.toUpperCase()} Ready`,
          html: `
            <h3>Your ${fileExt.toUpperCase()} build is ready!</h3>
            <p><b>App Name:</b> ${appName}</p>
            <p><b>Package:</b> ${packageName}</p>
            <a href="${downloadUrl}">⬇ Download ${fileExt.toUpperCase()}</a>
          `
        });
        console.log(`📧 Email sent to ${email}`);
      } catch (emailErr) {
        console.error("⚠️ Email send failed:", emailErr.message);
      }
    }

    // ✅ Return success response
    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("❌ Error generating build:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("🚀 Web to App Builder Backend Running Successfully!");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
