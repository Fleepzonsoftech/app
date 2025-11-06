import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build Android APK automatically using Gradle.
 * @param {Object} options - App build configuration
 * @param {string} options.appName - The display name of the app
 * @param {string} options.packageName - Unique package name (e.g., com.example.app)
 * @param {string} options.webUrl - Website URL to embed inside WebView
 * @param {string} [options.iconPath] - Optional path to custom app icon
 */
export default async function buildApp({ appName, packageName, webUrl, iconPath }) {
  const templateDir = path.join(__dirname, "android_template");
  const buildDir = path.join(__dirname, "uploads/builds", packageName);

  // 🧹 Clean and copy Android template
  await fs.remove(buildDir);
  await fs.copy(templateDir, buildDir);

  console.log(`📦 Building: ${appName} (${packageName})`);
  console.log(`🌐 Website: ${webUrl}`);

  // ✅ Update package name in AndroidManifest.xml
  const manifestPath = path.join(buildDir, "app/src/main/AndroidManifest.xml");
  let manifest = await fs.readFile(manifestPath, "utf8");
  manifest = manifest.replace(/com\.example\.app/g, packageName);
  await fs.writeFile(manifestPath, manifest);

  // ✅ Update website URL in MainActivity.java
  const mainActivityOld = path.join(buildDir, "app/src/main/java/com/example/app/MainActivity.java");
  const mainActivityNew = path.join(buildDir, "app/src/main/java", ...packageName.split("."), "MainActivity.java");

  await fs.ensureDir(path.dirname(mainActivityNew));
  let javaCode = await fs.readFile(mainActivityOld, "utf8");
  javaCode = javaCode.replace(/https:\/\/www\.example\.com/g, webUrl);
  javaCode = javaCode.replace(/MainActivity/g, "MainActivity"); // ensure consistency
  await fs.writeFile(mainActivityNew, javaCode);
  await fs.remove(mainActivityOld);

  // ✅ Copy custom app icon if provided
  if (iconPath && fs.existsSync(iconPath)) {
    const iconDest = path.join(buildDir, "app/src/main/res/mipmap-hdpi/ic_launcher.png");
    await fs.copy(iconPath, iconDest);
    console.log("🖼️ Custom icon applied successfully!");
  }

  // ✅ Determine Gradle command (Windows or Linux)
  const gradleCmd = process.platform === "win32" ? "gradlew.bat assembleRelease" : "./gradlew assembleRelease";

  // ✅ Build APK using Gradle
  console.log("🏗️ Building APK... Please wait, this may take 2–3 minutes...");
  await new Promise((resolve, reject) => {
    exec(gradleCmd, { cwd: buildDir }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Build failed:", stderr);
        return reject(error);
      }
      console.log(stdout);
      resolve();
    });
  });

  // ✅ Locate and move the built APK
  const releaseApkPath = path.join(buildDir, "app/build/outputs/apk/release/app-release.apk");
  if (!fs.existsSync(releaseApkPath)) throw new Error("APK not found after build!");

  const outputApkPath = path.join("uploads/builds", `${packageName}.apk`);
  await fs.copy(releaseApkPath, path.join(__dirname, outputApkPath));

  console.log(`🎉 Build complete: ${outputApkPath}`);
  return outputApkPath;
}
