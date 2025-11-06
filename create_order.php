<?php
// =========================
// Razorpay PHP Order Creation
// =========================

// Include Composer autoload (install Razorpay PHP SDK first)
require 'vendor/autoload.php';

use Razorpay\Api\Api;

// Load Razorpay keys
$razorpay_key_id = "YOUR_KEY_ID";
$razorpay_key_secret = "YOUR_KEY_SECRET";

// Your live site domain
$site_url = "https://fleepzonsoftech.sbs";

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    $amount = isset($input['amount']) ? intval($input['amount']) : 0;

    if ($amount <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid amount']);
        exit;
    }

    // Initialize Razorpay API
    $api = new Api($razorpay_key_id, $razorpay_key_secret);

    // Create order
    $order = $api->order->create([
        'receipt' => 'rcpt_' . time(),
        'amount' => $amount * 100, // amount in paise
        'currency' => 'INR',
        'payment_capture' => 1
    ]);

    // Return JSON response including live site URL
    echo json_encode([
        'success' => true,
        'order' => $order,
        'key_id' => $razorpay_key_id,
        'site_url' => $site_url
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
