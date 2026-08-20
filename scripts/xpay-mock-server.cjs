const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.XPAY_MOCK_PORT || process.env.PORT || 8080);

// Configuration
// 生产环境提示：此文件仅用于本地开发模拟。
// 生产环境请使用 Tinywan/xpay 的正式版 PHP 服务，并修改 .env 中的 XPAY_API_URL。
const CONFIG = {
  TOKEN: process.env.XPAY_TOKEN || '3f8e2c91b5a0d4f7e8a9c2b3d1e0f9a7', // 与 .env 保持同步
  NOTIFY_URL: process.env.XPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/xpay/notify',
  QR_CODES_DIR: path.join(__dirname, 'qrcodes'),
};

// Ensure QR codes directory exists and clean up on start
if (!fs.existsSync(CONFIG.QR_CODES_DIR)) {
  fs.mkdirSync(CONFIG.QR_CODES_DIR);
}

// Global settings for QR codes
let SETTINGS = {
  alipay_qr: '',
  wechat_qr: ''
};

app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve QR codes as static files
app.use('/qrcodes', express.static(CONFIG.QR_CODES_DIR));

// Root Route: Show simple dashboard
app.get('/', (req, res) => {
  const qrFiles = fs.readdirSync(CONFIG.QR_CODES_DIR);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>XPay Mock Dashboard</title>
      <style>
        body { font-family: sans-serif; background: #f0f2f5; padding: 2rem; color: #3c4043; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        h1 { color: #1a73e8; border-bottom: 2px solid #f1f3f4; padding-bottom: 1rem; margin-top: 0; }
        h2 { color: #5f6368; font-size: 1.2rem; margin-top: 2rem; }
        .section { background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
        .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .stat-card { background: #e8f0fe; padding: 1.2rem; border-radius: 8px; flex: 1; text-align: center; }
        .stat-card h3 { margin: 0; font-size: 0.85rem; color: #1967d2; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-card p { margin: 0.5rem 0 0; font-size: 1.8rem; font-weight: bold; color: #174ea6; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #f1f3f4; }
        th { background: #f8f9fa; font-weight: 600; color: #5f6368; font-size: 0.9rem; }
        .status-pending { color: #f29900; background: #fff4e5; padding: 4px 12px; border-radius: 16px; font-size: 0.75rem; font-weight: 500; }
        .status-completed { color: #1e8e3e; background: #e6f4ea; padding: 4px 12px; border-radius: 16px; font-size: 0.75rem; font-weight: 500; }
        
        .qr-manager { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
        .qr-card { border: 1px solid #dadce0; border-radius: 8px; padding: 1rem; text-align: center; position: relative; }
        .qr-card img { max-width: 100%; height: 150px; object-fit: contain; margin-bottom: 0.5rem; border-radius: 4px; }
        .qr-actions { display: flex; flex-direction: column; gap: 0.5rem; }
        
        .btn { border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
        .btn-primary { background: #1a73e8; color: white; }
        .btn-primary:hover { background: #174ea6; }
        .btn-outline { background: transparent; border: 1px solid #dadce0; color: #5f6368; }
        .btn-outline:hover { background: #f8f9fa; border-color: #bdc1c6; }
        .btn-danger { background: #d93025; color: white; }
        .btn-danger:hover { background: #b31412; }
        .btn-success { background: #1e8e3e; color: white; }
        
        .active-badge { position: absolute; top: -10px; right: -10px; background: #1e8e3e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .upload-box { border: 2px dashed #dadce0; padding: 2rem; text-align: center; border-radius: 8px; margin-top: 1rem; cursor: pointer; transition: 0.2s; }
        .upload-box:hover { border-color: #1a73e8; background: #f8fbff; }
        
        code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>XPay 模拟服务控制台</h1>
        
        <div class="section">
          <h2>运行状态</h2>
          <div class="stats">
            <div class="stat-card">
              <h3>总订单数</h3>
              <p>${orders.size}</p>
            </div>
            <div class="stat-card">
              <h3>待支付</h3>
              <p>${Array.from(orders.values()).filter(o => o.status === 'pending').length}</p>
            </div>
            <div class="stat-card">
              <h3>已完成</h3>
              <p>${Array.from(orders.values()).filter(o => o.status === 'completed').length}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>收款码管理 (上传并解析)</h2>
          <p style="font-size: 0.9rem; color: #5f6368; margin-bottom: 1.5rem;">
            在此上传您的微信或支付宝收款码。在真实环境下，XPay 会解析图片中的支付链接。
          </p>
          
          <div class="qr-manager">
            ${qrFiles.map(file => {
              const isAlipay = SETTINGS.alipay_qr === file;
              const isWechat = SETTINGS.wechat_qr === file;
              return `
                <div class="qr-card">
                  ${(isAlipay || isWechat) ? `<span class="active-badge">${isAlipay ? '支付宝当前' : '微信当前'}</span>` : ''}
                  <img src="/qrcodes/${file}" />
                  <div class="qr-actions">
                    <button class="btn btn-outline" onclick="setAs('alipay', '${file}')">设为支付宝码</button>
                    <button class="btn btn-outline" onclick="setAs('wechat', '${file}')">设为微信码</button>
                    <button class="btn btn-danger" onclick="deleteQr('${file}')" style="margin-top: 5px;">删除</button>
                  </div>
                </div>
              `;
            }).join('')}
            
            <div class="upload-box" onclick="document.getElementById('fileInput').click()">
              <div style="font-size: 2rem; color: #dadce0;">+</div>
              <div style="color: #1a73e8; font-weight: 500;">点击上传收款码</div>
              <input type="file" id="fileInput" hidden accept="image/*" onchange="uploadFile(this)">
            </div>
          </div>
        </div>

        <div class="section">
          <h2>最近订单</h2>
          <table>
            <thead>
              <tr>
                <th>订单号 (Mark)</th>
                <th>金额</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>管理操作</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(orders.entries()).reverse().slice(0, 10).map(([id, order]) => `
                <tr>
                  <td><code>${id}</code></td>
                  <td>￥${order.money}</td>
                  <td>${order.type === 'alipay' ? '支付宝' : '微信'}</td>
                  <td><span class="status-${order.status}">${order.status === 'pending' ? '待支付' : '已完成'}</span></td>
                  <td>
                    ${order.status === 'pending' ? `<button class="btn btn-primary" onclick="simulateCallback('${id}')">模拟支付成功</button>` : '<span style="color: #9aa0a6;">-</span>'}
                    <a href="/pay/${id}" target="_blank" rel="noopener noreferrer" style="margin-left: 12px; font-size: 0.85rem; color: #1a73e8; text-decoration: none;">打开支付页</a>
                  </td>
                </tr>
              `).join('')}
              ${orders.size === 0 ? '<tr><td colspan="5" style="text-align: center; color: #9aa0a6; padding: 2rem;">暂无订单数据</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        async function uploadFile(input) {
          const file = input.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = async (e) => {
            const res = await fetch('/api/internal/upload-qr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: file.name, data: e.target.result })
            });
            const data = await res.json();
            if (data.code === 200) {
              location.reload();
            } else {
              alert('上传失败: ' + data.msg);
            }
          };
          reader.readAsDataURL(file);
        }

        async function setAs(type, filename) {
          await fetch('/api/internal/set-active-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, filename })
          });
          location.reload();
        }

        async function deleteQr(filename) {
          if (!confirm('确定删除此收款码吗？')) return;
          await fetch('/api/internal/delete-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
          });
          location.reload();
        }

        async function simulateCallback(orderId) {
          const res = await fetch('/api/internal/simulate-callback/' + orderId, { method: 'POST' });
          const data = await res.json();
          if (data.code === 200) {
            alert('支付回调成功！通知已发送到后端。');
            location.reload();
          } else {
            alert('模拟失败: ' + data.msg);
          }
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// Internal API: Upload QR code (base64)
app.post('/api/internal/upload-qr', (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ code: 400, msg: 'Missing data' });
  
  const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${Date.now()}-${name}`;
  
  fs.writeFileSync(path.join(CONFIG.QR_CODES_DIR, filename), buffer);
  res.json({ code: 200, msg: 'success', filename });
});

// Internal API: Set active QR code for type
app.post('/api/internal/set-active-qr', (req, res) => {
  const { type, filename } = req.body;
  if (type === 'alipay') SETTINGS.alipay_qr = filename;
  if (type === 'wechat') SETTINGS.wechat_qr = filename;
  res.json({ code: 200, msg: 'success' });
});

// Internal API: Delete QR code
app.post('/api/internal/delete-qr', (req, res) => {
  const { filename } = req.body;
  const filePath = path.join(CONFIG.QR_CODES_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    if (SETTINGS.alipay_qr === filename) SETTINGS.alipay_qr = '';
    if (SETTINGS.wechat_qr === filename) SETTINGS.wechat_qr = '';
  }
  res.json({ code: 200, msg: 'success' });
});

// Mock database
const orders = new Map();

// Helper: Generate MD5 signature
const generateSign = (params) => {
  const { type, money, mark, dt } = params;
  const str = `${type}${money}${mark}${dt}${CONFIG.TOKEN}`;
  return crypto.createHash('md5').update(str).digest('hex');
};

// API: Create Payment (Mock XPay Interface)
const handlePayRequest = (req, res) => {
  const { money, mark, type, dt, sign } = req.method === 'POST' ? req.body : req.query;
  
  if (!money || !mark || !type) {
    return res.status(400).json({ code: 400, msg: 'Missing parameters' });
  }

  // Validate signature if provided
  if (sign) {
    const expectedSign = generateSign({ type, money, mark, dt });
    if (sign !== expectedSign) {
      console.error(`[XPay Mock] Signature mismatch! Received: ${sign}, Expected: ${expectedSign}`);
      // In mock we might allow it for convenience but log a warning
    }
  }

  const orderId = mark;
  const payUrl = `http://localhost:${PORT}/pay/${orderId}`;
  
  orders.set(orderId, {
    money,
    type,
    status: 'pending',
    created_at: Date.now()
  });

  console.log(`[XPay Mock] Created order: ${orderId}, Amount: ${money}, Type: ${type}`);

  if (req.method === 'GET') {
    // Redirect to the payment UI for GET requests
    return res.redirect(payUrl);
  }

  res.json({
    code: 200,
    msg: 'success',
    data: {
      pay_url: payUrl,
      order_id: orderId,
      money: money,
      type: type
    }
  });
};

app.post('/api/pay', handlePayRequest);
app.get('/api/pay', handlePayRequest);

// Add a catch-all for Chrome devtools requests
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({ status: 'ok' });
});

// UI: Mock Payment Page
app.get('/pay/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);

  if (!order) {
    return res.status(404).send('Order not found');
  }

  const activeQr = order.type === 'alipay' ? SETTINGS.alipay_qr : SETTINGS.wechat_qr;
  const qrHtml = activeQr 
    ? `<img src="/qrcodes/${activeQr}" style="max-width: 200px; max-height: 200px;" />`
    : `<div class="qr-placeholder">[ 请在控制台上传收款码 ]</div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>XPay Mock Payment</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f4f7f6; margin: 0; }
        .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.1); text-align: center; width: 320px; }
        .qr-container { width: 200px; height: 200px; margin: 1.5rem auto; display: flex; align-items: center; justify-content: center; }
        .qr-placeholder { width: 100%; height: 100%; background: #f8f9fa; display: flex; align-items: center; justify-content: center; border: 2px dashed #dadce0; color: #9aa0a6; font-size: 0.8rem; border-radius: 8px; }
        .btn { background: #1a73e8; color: white; border: none; padding: 1rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; margin-top: 1rem; width: 100%; transition: 0.2s; }
        .btn:hover { background: #174ea6; transform: translateY(-1px); }
        .amount { font-size: 2.5rem; color: #d93025; font-weight: bold; margin: 0.5rem 0; }
        .order-id { font-size: 0.85rem; color: #5f6368; margin-bottom: 1.5rem; }
        .type-label { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; color: #3c4043; }
        .type-icon { width: 24px; height: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="type-label">
          ${order.type === 'alipay' ? '支付宝扫码支付' : '微信扫码支付'}
        </div>
        <div class="amount">￥${order.money}</div>
        <div class="order-id">订单号: ${orderId}</div>
        <div class="qr-container">
          ${qrHtml}
        </div>
        <p style="font-size: 0.85rem; color: #5f6368; line-height: 1.4;">支付成功后，系统将自动跳转。<br>如果未跳转请点击下方按钮。</p>
        <button class="btn" onclick="simulatePayment()">我已支付</button>
      </div>

      <script>
        async function simulatePayment() {
          const res = await fetch('/api/internal/simulate-callback/${orderId}', { method: 'POST' });
          const data = await res.json();
          if (data.code === 200) {
            alert('支付模拟成功！');
            window.close();
          } else {
            alert('模拟失败: ' + data.msg);
          }
        }
        
        // Auto check status (optional in mock)
        setInterval(async () => {
          // In a real app, this would poll the backend
        }, 3000);
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// Internal API: Trigger callback simulation
app.post('/api/internal/simulate-callback/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);

  if (!order) {
    return res.status(404).json({ code: 404, msg: 'Order not found' });
  }

  const dt = Date.now().toString();
  const payload = {
    type: order.type,
    money: order.money,
    mark: orderId,
    dt: dt,
    account: 'mock-user@example.com'
  };
  payload.sign = generateSign(payload);

  console.log(`[XPay Mock] Sending callback for ${orderId} to ${CONFIG.NOTIFY_URL}`);
  
  try {
    const response = await fetch(CONFIG.NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`[XPay Mock] Backend responded: ${result}`);
    
    if (result.trim() === 'success') {
      order.status = 'completed';
      res.json({ code: 200, msg: 'success' });
    } else {
      res.json({ code: 500, msg: 'Backend did not return success: ' + result });
    }
  } catch (error) {
    console.error(`[XPay Mock] Callback error:`, error.message);
    res.json({ code: 500, msg: 'Connection failed: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`[XPay] Mock Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`=========================================`);
});
