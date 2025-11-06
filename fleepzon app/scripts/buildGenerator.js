import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";

/**
 * Auto-build Android APK & AAB
 * - Customizes package name, app name, and version dynamically
 * - Builds signed release APK & AAB
 */

export const generateBuild = async ({ appName, packageName, versionName, versionCode }) => {
  try {
    const projectPath = path.resolve("android_template");
    const appBuildPath = path.join(projectPath, "app", "build.gradle");

    console.log(`⚙️ Starting build for ${appName} (${packageName})...`);

    // --- Step 1: Update build.gradle with app details ---
    let buildGradle = await fs.readFile(appBuildPath, "utf8");

    buildGradle = buildGradle
      .replace(/applicationId\s+"[^"]+"/, `applicationId "${packageName}"`)
      .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`)
      .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);

    await fs.writeFile(appBuildPath, buildGradle);
    console.log("✅ Updated app configuration");

    // --- Step 2: Run Gradle build for APK ---
    await runCommand("./gradlew assembleRelease", projectPath);
    console.log("✅ APK build completed");

    // --- Step 3: Run Gradle build for AAB ---
    await runCommand("./gradlew bundleRelease", projectPath);
    console.log("✅ AAB build completed");

    // --- Step 4: Locate outputs ---
    const apkPath = path.join(projectPath, "app/build/outputs/apk/release/app-release.apk");
    const aabPath = path.join(projectPath, "app/build/outputs/bundle/release/app-release.aab");

    if (!fs.existsSync(apkPath) || !fs.existsSync(aabPath)) {
      throw new Error("❌ Build failed: APK or AAB file not found.");
    }

    // --- Step 5: Copy to uploads folder ---
    const uploadsDir = path.resolve("public/uploads/builds");
    await fs.ensureDir(uploadsDir);

    const newApk = path.join(uploadsDir, `${packageName}.apk`);
    const newAab = path.join(uploadsDir, `${packageName}.aab`);

    await fs.copyFile(apkPath, newApk);
    await fs.copyFile(aabPath, newAab);

    console.log("📦 Build files copied successfully");

    // --- Step 6: Return download links ---
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    return {
      success: true,
      message: `🎉 ${appName} built successfully!`,
      apkLink: `${baseUrl}/uploads/builds/${packageName}.apk`,
      aabLink: `${baseUrl}/uploads/builds/${packageName}.aab`,
    };
  } catch (error) {
    console.error("❌ Build generation failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Helper: Run shell commands with Promise
 */
function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const process = exec(command, { cwd });

    process.stdout.on("data", (data) => console.log(data.toString()));
    process.stderr.on("data", (data) => console.error(data.toString()));

    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command}`));
    });
  });
}
