<?php
require 'vendor/autoload.php';
use Razorpay\Api\Api;

header('Content-Type: application/json');

$razorpay_key_id = "YOUR_KEY_ID";
$razorpay_key_secret = "YOUR_KEY_SECRET";

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $amount = isset($input['amount']) ? intval($input['amount']) : 0;
    if ($amount <= 0) echo json_encode(['success'=>false,'message'=>'Invalid amount']), exit;

    $api = new Api($razorpay_key_id, $razorpay_key_secret);
    $order = $api->order->create([
        'receipt'=>'rcpt_'.time(),
        'amount'=>$amount*100,
        'currency'=>'INR',
        'payment_capture'=>1
    ]);

    echo json_encode(['success'=>true,'order'=>$order,'key_id'=>$razorpay_key_id]);

} catch(Exception $e) {
    echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
}
?>

