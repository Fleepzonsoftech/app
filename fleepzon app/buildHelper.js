// buildHelper.js
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";

const TEMPLATE_DIR = path.join(process.cwd(), "android_template");
const PROJECTS_DIR = path.join(process.cwd(), "android_projects");
const BUILDS_DIR = path.join(process.cwd(), "uploads", "builds");

// 🏗️ Helper to ensure dirs exist
fs.ensureDirSync(PROJECTS_DIR);
fs.ensureDirSync(BUILDS_DIR);

// 🧩 Copy Template Project
export async function createAndroidProject(packageName, appName) {
  const projectPath = path.join(PROJECTS_DIR, packageName);
  if (fs.existsSync(projectPath)) fs.removeSync(projectPath);

  await fs.copy(TEMPLATE_DIR, projectPath);
  console.log(`📂 Project created for ${packageName}`);

  // Update package name & app name in files
  const manifestPath = path.join(projectPath, "app", "src", "main", "AndroidManifest.xml");
  let manifest = await fs.readFile(manifestPath, "utf8");
  manifest = manifest.replace(/com\.template\.app/g, packageName);
  await fs.writeFile(manifestPath, manifest);

  const gradlePath = path.join(projectPath, "app", "build.gradle");
  let gradleFile = await fs.readFile(gradlePath, "utf8");
  gradleFile = gradleFile.replace(/applicationId "com\.template\.app"/g, `applicationId "${packageName}"`);
  await fs.writeFile(gradlePath, gradleFile);

  console.log("✅ AndroidManifest & build.gradle updated");
  return projectPath;
}

// ⚙️ Build APK
export async function buildRealApk(packageName) {
  return new Promise((resolve, reject) => {
    const projectPath = path.join(PROJECTS_DIR, packageName);
    const buildCmd = `cd ${projectPath} && ./gradlew assembleRelease`;

    console.log("🏗️ Building APK...");
    exec(buildCmd, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ APK Build Error:", stderr);
        return reject(error);
      }

      const apkPath = path.join(projectPath, "app/build/outputs/apk/release/app-release.apk");
      if (fs.existsSync(apkPath)) {
        const destPath = path.join(BUILDS_DIR, `${packageName}.apk`);
        fs.copyFileSync(apkPath, destPath);
        console.log("✅ APK build success:", destPath);
        resolve(destPath);
      } else reject(new Error("APK not found after build"));
    });
  });
}

// ⚙️ Build AAB
export async function buildRealAab(packageName) {
  return new Promise((resolve, reject) => {
    const projectPath = path.join(PROJECTS_DIR, packageName);
    const buildCmd = `cd ${projectPath} && ./gradlew bundleRelease`;

    console.log("🏗️ Building AAB...");
    exec(buildCmd, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ AAB Build Error:", stderr);
        return reject(error);
      }

      const aabPath = path.join(projectPath, "app/build/outputs/bundle/release/app-release.aab");
      if (fs.existsSync(aabPath)) {
        const destPath = path.join(BUILDS_DIR, `${packageName}.aab`);
        fs.copyFileSync(aabPath, destPath);
        console.log("✅ AAB build success:", destPath);
        resolve(destPath);
      } else reject(new Error("AAB not found after build"));
    });
  });
}
