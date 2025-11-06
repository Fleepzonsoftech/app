<?php
require 'vendor/autoload.php';
use Razorpay\Api\Api;
use Razorpay\Api\Errors\SignatureVerificationError;

header('Content-Type: application/json');

// ---------------------
// Razorpay Keys
// ---------------------
$razorpay_key_id = "YOUR_KEY_ID";
$razorpay_key_secret = "YOUR_KEY_SECRET";

// ---------------------
// File system paths
// ---------------------
$templateDir = __DIR__ . '/androidTemplate'; // Android project template
$buildsDir = __DIR__ . '/public/builds';    // Folder where APK/AAB will be saved

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $razorpay_payment_id = $input['razorpay_payment_id'] ?? null;
    $razorpay_order_id = $input['razorpay_order_id'] ?? null;
    $razorpay_signature = $input['razorpay_signature'] ?? null;
    $email = $input['email'] ?? null;
    $packageName = $input['packageName'] ?? null;

    if (!$razorpay_payment_id || !$razorpay_order_id || !$razorpay_signature || !$email || !$packageName) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    // ---------------------
    // Razorpay signature verification
    // ---------------------
    $api = new Api($razorpay_key_id, $razorpay_key_secret);
    $api->utility->verifyPaymentSignature([
        'razorpay_order_id' => $razorpay_order_id,
        'razorpay_payment_id' => $razorpay_payment_id,
        'razorpay_signature' => $razorpay_signature
    ]);

    // ---------------------
    // Trigger AAB build
    // ---------------------
    $buildDir = $buildsDir . '/' . $packageName . '-' . time();
    if (!is_dir($buildDir)) mkdir($buildDir, 0777, true);

    // Copy template to build folder
    function rrmdir($src) {
        $dir = opendir($src);
        while(false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                $full = $src . '/' . $file;
                if (is_dir($full)) rrmdir($full); else unlink($full);
            }
        }
        closedir($dir);
        rmdir($src);
    }

    function copyDir($src, $dst) {
        mkdir($dst);
        $dir = opendir($src);
        while(false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                if (is_dir($src . '/' . $file)) {
                    copyDir($src . '/' . $file, $dst . '/' . $file);
                } else {
                    copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }
        closedir($dir);
    }

    copyDir($templateDir, $buildDir);

    // Build command (Linux server) - make sure Java & Gradle installed
    $cmd = "cd " . escapeshellarg($buildDir) . " && ./gradlew bundleRelease";
    exec($cmd, $output, $return_var);

    if ($return_var !== 0) {
        echo json_encode(['success' => false, 'message' => "AAB build failed. Check server logs."]);
        rrmdir($buildDir); // cleanup
        exit;
    }

    // Move generated AAB to public/builds folder
    $aabPath = $buildDir . "/app/build/outputs/bundle/release/app-release.aab";
    $finalAAB = $buildsDir . "/" . $packageName . "-" . time() . ".aab";
    if (!file_exists($aabPath)) {
        echo json_encode(['success' => false, 'message' => "AAB not found after build."]);
        rrmdir($buildDir);
        exit;
    }
    rename($aabPath, $finalAAB);

    // Cleanup temporary build folder
    rrmdir($buildDir);

    // Generate download link
    $downloadLink = "https://fleepzonsoftech.sbs/builds/" . basename($finalAAB);

    // Optionally: send email with download link (use mail() or PHPMailer)
    // mail($email, "Your AAB is ready", "Download here: $downloadLink");

    echo json_encode(['success' => true, 'message' => "✅ Payment verified. AAB build ready.", 'download' => $downloadLink]);

} catch (SignatureVerificationError $e) {
    echo json_encode(['success' => false, 'message' => "❌ Payment verification failed: " . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => "⚠️ Error: " . $e->getMessage()]);
}
?>
