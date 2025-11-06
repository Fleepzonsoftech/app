<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🌐 Web to App Builder - Fleepzon Softech</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7fa; padding: 40px; color: #222; }
    .container { max-width: 720px; background: white; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 6px 25px rgba(0,0,0,0.1); }
    h2 { text-align: center; color: #007bff; font-weight: 700; }
    input, select { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; }
    button { width: 100%; padding: 12px; border: none; background: #007bff; color: white; font-size: 16px; border-radius: 8px; cursor: pointer; transition: 0.3s; }
    button:hover { background: #0056b3; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }
    #result { margin-top: 20px; padding: 15px; border-radius: 10px; display: none; text-align: center; word-break: break-word; font-size: 16px; }
    a { color: #007bff; font-weight: bold; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { margin-top: 40px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🌐 Convert Your Website to Android App (Free APK)</h2>

    <form id="appForm" enctype="multipart/form-data">
      <input type="text" name="appName" placeholder="App Name *" required>
      <input type="text" name="packageName" placeholder="Package Name *" required>
      <input type="text" name="versionName" placeholder="Version Name *" required>
      <input type="number" name="versionCode" placeholder="Version Code *" required>
      <select name="minSdk" required>
        <option value="">Select Minimum SDK</option>
        <option value="21">21 (Android 5.0)</option>
        <option value="29">29 (Android 10)</option>
        <option value="34">34 (Android 14)</option>
      </select>
      <input type="url" name="websiteUrl" placeholder="Website URL *" required>
      <label>Upload App Icon *</label>
      <input type="file" name="icon" accept="image/*" required>
      <label>Upload Splash Screen *</label>
      <input type="file" name="splash" accept="image/*" required>
      <input type="email" name="email" placeholder="Email *" required>

      <button type="submit" class="btn-success">🚀 Generate Free APK</button>
    </form>

    <p style="text-align:center;margin:10px 0;">OR</p>
    <button id="payAAB">💰 Generate Paid AAB (₹6,999)</button>

    <div id="result"></div>
  </div>

  <footer>
    <p>© 2025 Fleepzon Softech | <a href="mailto:support@fleepzonsoftech.com">Contact Support</a></p>
  </footer>

  <!-- Razorpay checkout -->
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    // =========================
    // Auto-detect backend URL
    // =========================
    let BACKEND_URL = "";
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes("android") && window.location.hostname === "localhost") {
      // Android emulator
      BACKEND_URL = "http://10.0.2.2:3000";
    } else if (ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) {
      // Real mobile device → replace with your PC LAN IP
      BACKEND_URL = "http://192.168.1.100:3000"; // <-- CHANGE to your PC LAN IP
    } else {
      // PC/laptop
      BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    console.log("Using BACKEND_URL:", BACKEND_URL);

    // =========================
    // Build APK form
    // =========================
    const form = document.getElementById("appForm");
    const resultBox = document.getElementById("result");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      resultBox.style.display = "block";
      resultBox.style.background = "#fff3cd";
      resultBox.style.color = "#856404";
      resultBox.innerHTML = "⏳ Please wait... Building your APK...";

      const formData = new FormData(form);

      try {
        const res = await fetch(`${BACKEND_URL}/api/build`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Server not responding");

        const data = await res.json();
        if (data.success) {
          resultBox.style.background = "#e9f7ef";
          resultBox.style.color = "#155724";
          resultBox.innerHTML = `
            ✅ <b>Success!</b><br>Your APK is ready.<br><br>
            <a href="${data.downloadUrl}" target="_blank" download>⬇ Download Now</a>
          `;
        } else {
          resultBox.style.background = "#f8d7da";
          resultBox.style.color = "#721c24";
          resultBox.innerHTML = "❌ Build failed. Try again.";
        }
      } catch (err) {
        console.error(err);
        resultBox.style.background = "#f8d7da";
        resultBox.style.color = "#721c24";
        resultBox.innerHTML = "⚠️ Connection error. Check backend server URL.";
      }
    });

    // =========================
    // Paid AAB button
    // =========================
    document.getElementById("payAAB").addEventListener("click", async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/create-order`, {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 6999 })
        });
        const data = await res.json();
        if (!data.success) throw new Error("Order creation failed");

        const options = {
          key: data.key_id,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "Fleepzon Softech",
          description: "Paid AAB Generation",
          order_id: data.order.id,
          handler: async function(response) {
            const verifyRes = await fetch(`${BACKEND_URL}/verify-payment`, {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
            });
            const verifyData = await verifyRes.json();
            alert(verifyData.message);
          }
        };
        new Razorpay(options).open();
      } catch (err) {
        console.error(err);
        alert("⚠️ Connection error. Check backend server URL.");
      }
    });
  </script>
</body>
</html>
