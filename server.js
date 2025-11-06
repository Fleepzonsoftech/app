import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs-extra";
import mongoose from "mongoose";
import multer from "multer";
import Razorpay from "razorpay";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fix for ES modules (__dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static folder for uploaded builds
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/webtoapp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(__dirname, "uploads/icons");
    fs.ensureDirSync(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Test API (Frontend checks this)
app.get("/", (req, res) => {
  res.send("✅ Backend running fine on port " + PORT);
});

// ✅ File upload route
app.post("/api/upload", upload.single("icon"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  res.json({
    success: true,
    filePath: `/uploads/icons/${req.file.filename}`,
  });
});

// ✅ Fake build route (simulate APK build)
app.post("/api/build", async (req, res) => {
  try {
    const { appName, packageName } = req.body;
    const folder = path.join(__dirname, "uploads/builds");
    fs.ensureDirSync(folder);

    const apkPath = path.join(folder, `${packageName}.apk`);
    fs.writeFileSync(apkPath, "Dummy APK File");

    res.json({
      success: true,
      message: `🎉 ${appName} created successfully!`,
      downloadUrl: `http://localhost:${PORT}/uploads/builds/${packageName}.apk`,
    });
  } catch (error) {
    console.error("❌ Build Error:", error);
    res.status(500).json({ success: false, message: "Build failed" });
  }
});

// ✅ Razorpay payment verification route
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret")
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    res.json({
      success: true,
      message: "✅ Payment verified & AAB generated!",
      downloadAAB: `http://localhost:${PORT}/uploads/builds/sample.aab`,
    });
  } else {
    res.status(400).json({ success: false, message: "❌ Invalid signature" });
  }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));


