# StarMC Integrated Payment System - Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [User Interface Features](#user-interface-features)
4. [Payment Methods](#payment-methods)
5. [API Integration](#api-integration)
6. [Deployment Guide](#deployment-guide)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The StarMC Integrated Payment System is a modernized, Glassmorphism-styled payment gateway built on top of the XPay v3.1 platform. It provides a seamless, secure, and visually stunning payment experience for users while maintaining full compatibility with the existing backend infrastructure.

### Key Features
- **Glassmorphism Design**: Modern translucent UI with backdrop blur effects
- **Spring Physics Interactions**: Elastic, responsive animations using GSAP
- **Mouse-Following Effects**: Dynamic cursor glow that follows user movement
- **Card Folding/Expansion**: Smooth 3D card animations for QR code display
- **Responsive Design**: Fully responsive across all device sizes
- **Cross-Browser Compatible**: Works on Chrome, Firefox, Safari, Edge
- **Multiple Payment Methods**: Supports Alipay, WeChat Pay, QQ Pay, and UnionPay

---

## System Architecture

### Frontend Components
```
starmc-pay.html      - Main payment form with Glassmorphism UI
starmc-wechat.html   - WeChat Pay QR code display
starmc-alipay.html   - Alipay QR code display
starmc-confirm.html  - Payment confirmation page
starmc-success.html  - Payment success page
```

### Backend Components
```
StarMCController.java - New controller for StarMC endpoints
PayController.java    - Existing payment processing (unchanged)
PayService.java       - Business logic layer (unchanged)
```

### URL Mapping
| Endpoint | Description |
|----------|-------------|
| `/starmc/pay` | Main payment interface |
| `/starmc/wechat` | WeChat Pay QR display |
| `/starmc/alipay` | Alipay QR display |
| `/starmc/confirm` | Payment confirmation |
| `/starmc/success` | Payment success page |
| `/starmc/api/status/{payId}` | Payment status API |

---

## User Interface Features

### 1. Glassmorphism Design System
The interface uses a sophisticated Glassmorphism design with:
- **Translucent backgrounds**: `rgba(255, 255, 255, 0.15)` with `backdrop-filter: blur(20px)`
- **Gradient backgrounds**: Animated multi-color gradients
- **Subtle borders**: `1px solid rgba(255, 255, 255, 0.3)`
- **Soft shadows**: Multi-layered box shadows for depth

### 2. Spring Physics Interactions
All interactive elements use spring physics animations:
```css
.spring-btn {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```
- **Hover effects**: Scale up with elastic bounce
- **Click feedback**: Scale down then spring back
- **GSAP integration**: Advanced timeline animations

### 3. Mouse-Following Glow Effect
A dynamic glow effect follows the cursor:
```javascript
const mouseGlow = document.getElementById('mouseGlow');
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
```

### 4. 3D Card Tilt Effect
The payment form card responds to mouse movement with 3D tilt:
```javascript
tiltCard.addEventListener('mousemove', (e) => {
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});
```

### 5. Card Folding/Expansion
QR code display uses 3D folding animation:
```css
.card-fold {
    transform-origin: top;
    transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-fold.expanded {
    transform: perspective(1000px) rotateX(0deg);
}
```

---

## Payment Methods

### Supported Payment Options

1. **Alipay Face-to-Face (DMF)**
   - Official Alipay merchant QR code
   - Real-time payment confirmation
   - 5-minute timeout

2. **WeChat Pay (Official)**
   - Official WeChat Pay API integration
   - Native in-app payment support
   - 5-minute timeout

3. **Alipay Transfer**
   - Personal transfer QR code
   - Manual amount entry
   - 2-minute timeout

4. **WeChat Transfer**
   - Personal WeChat transfer
   - QR code scanning
   - 2-minute timeout

5. **QQ Pay**
   - QQ wallet integration
   - Transfer-based payment
   - 2-minute timeout

6. **UnionPay**
   - Quick payment option
   - Bank card integration
   - 2-minute timeout

### Payment Flow
1. User selects amount and payment method
2. System generates unique transaction ID
3. QR code is displayed with countdown timer
4. User scans QR code with payment app
5. System polls for payment status every 3 seconds
6. Upon confirmation, success page is displayed

---

## API Integration

### Payment Status Check
```http
GET /pay/state/{payId}
```

**Response:**
```json
{
    "success": true,
    "result": 1  // 0: Pending, 1: Success, 2: Failed, 4: Scanned
}
```

### Create Payment
```http
POST /pay/add
Content-Type: application/x-www-form-urlencoded

nickName={name}&money={amount}&email={email}&payType={type}&info={message}&custom={bool}&mobile={bool}&device={ua}
```

### Alipay Pre-create
```http
POST /alipay/precreate
Content-Type: application/x-www-form-urlencoded

nickName={name}&money={amount}&email={email}&payType=DMF&info={message}&custom={bool}&mobile={bool}&device={ua}
```

### WeChat Pre-create
```http
POST /wechat/precreate
Content-Type: application/x-www-form-urlencoded

nickName={name}&money={amount}&email={email}&payType=WechatOfficial&info={message}&custom={bool}&mobile={bool}&device={ua}
```

---

## Deployment Guide

### Prerequisites
- Java 8 or higher
- Maven 3.6+
- MySQL 5.7+
- Redis 5.0+

### Step 1: Build the Project
```bash
cd xpay-code
mvn clean package -DskipTests
```

### Step 2: Configure Database
Update `application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/xpay?useUnicode=true&characterEncoding=utf-8
spring.datasource.username=your_username
spring.datasource.password=your_password

spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=your_redis_password
```

### Step 3: Deploy
```bash
# Copy the JAR file to your server
scp target/xpay-*.jar user@server:/opt/xpay/

# Run the application
java -jar xpay-*.jar
```

### Step 4: Access the Application
- Original interface: `http://your-domain/`
- StarMC interface: `http://your-domain/starmc/pay`

---

## Configuration

### QR Code Images
Place your QR code images in the following locations:
```
src/main/resources/static/assets/images/
├── wechat-qr.png      # WeChat Pay QR code
├── alipay-qr.png      # Alipay QR code
└── qq-qr.png          # QQ Pay QR code
```

### Custom Amount Settings
Edit the amount options in `starmc-pay.html`:
```javascript
const amountOptions = ['10.00', '68.00', '168.00'];
```

### Timeout Configuration
Modify countdown durations in the respective HTML files:
```javascript
startCountdown(120); // 120 seconds for transfer methods
startCountdown(300); // 300 seconds for official APIs
```

---

## Troubleshooting

### Common Issues

#### 1. QR Code Not Displaying
**Solution:**
- Verify QR code images exist in `/assets/images/`
- Check file permissions
- Ensure images are in PNG format

#### 2. Payment Status Not Updating
**Solution:**
- Check Redis connection
- Verify `/pay/state/{payId}` endpoint is accessible
- Check browser console for JavaScript errors

#### 3. Glassmorphism Effects Not Working
**Solution:**
- Ensure browser supports `backdrop-filter`
- Check for CSS conflicts
- Verify Tailwind CSS is loaded

#### 4. Mobile Display Issues
**Solution:**
- Add viewport meta tag
- Test on actual devices
- Use responsive breakpoints

### Browser Compatibility
| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 80+ | ✅ Supported |
| Firefox | 75+ | ✅ Supported |
| Safari | 13+ | ✅ Supported |
| Edge | 80+ | ✅ Supported |
| IE 11 | - | ❌ Not Supported |

### Performance Optimization
1. **Enable Gzip compression** on your web server
2. **Use CDN** for static assets (Tailwind, GSAP, Lucide)
3. **Optimize images** - compress QR codes
4. **Enable browser caching** for static resources

---

## Security Considerations

### Data Protection
- All API calls use HTTPS
- Email validation implemented
- Amount validation prevents negative values
- XSS protection through proper escaping

### Payment Security
- 256-bit SSL encryption
- Transaction ID uniqueness verification
- Timeout mechanisms prevent stale payments
- Redis caching for performance without compromising security

---

## Migration Guide

### From Original XPay to StarMC

1. **Backup existing data**
```bash
mysqldump -u root -p xpay > xpay_backup.sql
```

2. **Deploy new templates**
- Copy all `starmc-*.html` files to templates directory
- Deploy `StarMCController.java`

3. **Update configuration**
- Add new controller to component scan
- Verify endpoint mappings

4. **Test thoroughly**
- Test all payment methods
- Verify email notifications
- Check mobile responsiveness

5. **Switch over**
- Update main navigation to point to `/starmc/pay`
- Monitor for issues

---

## Support

For technical support or feature requests:
- GitHub Issues: [Project Repository]
- Email: support@starmc.com
- Documentation: [Documentation URL]

---

## License

This project is built upon XPay v3.1 and maintains the same license terms.

---

## Changelog

### Version 1.0.0 (2024)
- Initial StarMC release
- Glassmorphism UI implementation
- Spring physics animations
- Mouse-following effects
- Card folding/expansion animations
- Responsive design
- Multi-payment method support

---

**End of Documentation**
