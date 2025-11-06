<?php
// =========================
// Razorpay PHP Payment Verification
// =========================

// Include Composer autoload (install Razorpay PHP SDK first)
require 'vendor/autoload.php';
use Razorpay\Api\Api;
use Razorpay\Api\Errors\SignatureVerificationError;

// Razorpay keys
$razorpay_key_id = "YOUR_KEY_ID";
$razorpay_key_secret = "YOUR_KEY_SECRET";

// Your live site domain
$site_url = "https://fleepzonsoftech.sbs";

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Get POST data
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

    // Initialize Razorpay API
    $api = new Api($razorpay_key_id, $razorpay_key_secret);

    // Verify signature
    $attributes = [
        'razorpay_order_id' => $razorpay_order_id,
        'razorpay_payment_id' => $razorpay_payment_id,
        'razorpay_signature' => $razorpay_signature
    ];

    $api->utility->verifyPaymentSignature($attributes);

    // Payment verified successfully
    // Here you can trigger your AAB build process
    // Example: call a script or API to start building the AAB
    // $build_url = "$site_url/build_aab.php?package=$packageName&email=$email";

    echo json_encode([
        'success' => true,
        'message' => "✅ Payment verified successfully for $packageName. AAB build has started.",
        'site_url' => $site_url
    ]);

} catch (SignatureVerificationError $e) {
    // Invalid signature
    echo json_encode([
        'success' => false,
        'message' => "❌ Payment verification failed: " . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => "⚠️ Error: " . $e->getMessage()
    ]);
}
?>
