import { AppError, ErrorCode } from '../utils/errors';
import { logAction } from '../services/auditService';
// Port 5555 error handler middleware
export const port5555ErrorHandler = (error, req, res, next) => {
    // Check if request is related to port 5555
    const isPort5555Request = req.headers['x-port-5555'] === 'true' ||
        req.path.startsWith('/api/port5555') ||
        req.originalUrl.includes(':5555');
    if (!isPort5555Request) {
        return next(error);
    }
    // Log error
    const userId = req.user?.id || 0;
    logAction(userId, 'PORT5555_ERROR', 'port5555', req, {
        error: error.message,
        statusCode: error.statusCode || 500,
        path: req.path,
        method: req.method
    }).catch(() => { });
    // Determine error details
    let statusCode = error.statusCode || 500;
    let message = 'Internal Server Error';
    let errorCode = ErrorCode.INTERNAL_ERROR;
    let redirectUrl;
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
        errorCode = error.errorCode;
    }
    // Customize error messages and redirects
    switch (errorCode) {
        case ErrorCode.UNAUTHORIZED:
            message = 'Authentication required for port 5555 management';
            redirectUrl = '/#/login';
            break;
        case ErrorCode.FORBIDDEN:
            message = 'Access denied for port 5555 management';
            redirectUrl = '/#/profile';
            break;
        case ErrorCode.SESSION_EXPIRED:
            message = 'Session expired, please login again';
            redirectUrl = '/#/login';
            break;
        case ErrorCode.RATE_LIMIT_EXCEEDED:
            message = 'Too many requests, please try again later';
            break;
        case ErrorCode.VALIDATION_ERROR:
            message = 'Invalid request parameters';
            break;
        case ErrorCode.NOT_FOUND:
            message = 'Resource not found';
            statusCode = 404;
            break;
        default:
            if (statusCode >= 500) {
                message = 'Internal server error, please try again later';
            }
            break;
    }
    // Build error response
    const errorResponse = {
        success: false,
        error: {
            code: errorCode,
            message,
            timestamp: new Date().toISOString(),
            path: req.path
        }
    };
    if (redirectUrl) {
        errorResponse.error.redirect = {
            url: redirectUrl,
            delay: 3000
        };
    }
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = error.stack;
    }
    res.status(statusCode);
    if (req.xhr || req.headers['accept']?.includes('application/json')) {
        return res.json(errorResponse);
    }
    // Return HTML error page
    res.set('Content-Type', 'text/html; charset=utf-8');
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Error - MotiaCraft MC List</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            color: white;
        }
        .error-container { 
            background: rgba(255, 255, 255, 0.1); 
            backdrop-filter: blur(10px);
            padding: 3rem; 
            border-radius: 1rem; 
            text-align: center; 
            max-width: 500px; 
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .error-icon { 
            font-size: 3rem; 
            margin-bottom: 1rem; 
            font-weight: bold;
            opacity: 0.9;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .error-icon svg {
            width: 64px;
            height: 64px;
        }
        .error-title { 
            font-size: 1.5rem; 
            margin-bottom: 1rem; 
            font-weight: 600;
        }
        .error-message { 
            margin-bottom: 2rem; 
            line-height: 1.6;
            opacity: 0.9;
        }
        .error-actions { 
            display: flex; 
            gap: 1rem; 
            justify-content: center; 
            flex-wrap: wrap;
        }
        .btn { 
            padding: 0.75rem 1.5rem; 
            border: none; 
            border-radius: 0.5rem; 
            text-decoration: none; 
            font-weight: 500; 
            transition: all 0.2s; 
            cursor: pointer;
        }
        .btn-primary { 
            background: white; 
            color: #667eea; 
        }
        .btn-primary:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        .btn-secondary { 
            background: transparent; 
            color: white; 
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .btn-secondary:hover { 
            background: rgba(255, 255, 255, 0.1);
        }
        .countdown { 
            margin-top: 1rem; 
            font-size: 0.9rem; 
            opacity: 0.8;
        }
        @media (max-width: 480px) {
            .error-container { padding: 2rem; }
            .error-actions { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">${getErrorIconSvg(statusCode)}</div>
        <h1 class="error-title">${getErrorTitle(statusCode)}</h1>
        <p class="error-message">${message}</p>
        
        <div class="error-actions">
            <a href="/" class="btn btn-primary">Home</a>
            <a href="/#/profile" class="btn btn-secondary">Profile</a>
            ${redirectUrl ? `<a href="${redirectUrl}" class="btn btn-primary">Login Now</a>` : ''}
        </div>
        
        ${redirectUrl ? `
        <div class="countdown" id="countdown">
            Redirecting in <span id="seconds">3</span>s...
        </div>
        <script>
            let seconds = 3;
            const countdownEl = document.getElementById('countdown');
            const secondsEl = document.getElementById('seconds');
            
            const timer = setInterval(() => {
                seconds--;
                secondsEl.textContent = seconds;
                
                if (seconds <= 0) {
                    clearInterval(timer);
                    window.location.href = '${redirectUrl}';
                }
            }, 1000);
            
            document.querySelectorAll('.btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    clearInterval(timer);
                    countdownEl.style.display = 'none';
                });
            });
        </script>
        ` : ''}
    </div>
</body>
</html>`;
    res.send(html);
};
// Get error icon SVG based on status code
function getErrorIconSvg(statusCode) {
    const iconStyle = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    switch (statusCode) {
        case 401:
        case 403:
            // Lock icon
            return `<svg xmlns="http://www.w3.org/2000/svg" ${iconStyle} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        case 404:
            // Search icon
            return `<svg xmlns="http://www.w3.org/2000/svg" ${iconStyle} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        case 429:
            // Clock icon
            return `<svg xmlns="http://www.w3.org/2000/svg" ${iconStyle} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        case 500:
            // Alert-triangle icon
            return `<svg xmlns="http://www.w3.org/2000/svg" ${iconStyle} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        default:
            // Alert-circle icon
            return `<svg xmlns="http://www.w3.org/2000/svg" ${iconStyle} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
}
// Get error title based on status code
function getErrorTitle(statusCode) {
    switch (statusCode) {
        case 401:
            return 'Unauthorized Access';
        case 403:
            return 'Access Denied';
        case 404:
            return 'Page Not Found';
        case 429:
            return 'Too Many Requests';
        case 500:
            return 'Server Error';
        default:
            return 'Error Occurred';
    }
}
// Port 5555 security redirect middleware
export const port5555SecurityRedirect = (req, res, next) => {
    const isPort5555AccessAttempt = req.path.includes('5555') ||
        req.headers['host']?.includes('5555') ||
        req.query.port === '5555';
    if (isPort5555AccessAttempt && !req.headers['x-port-5555']) {
        logAction(0, 'PORT5555_UNAUTHORIZED_ACCESS_ATTEMPT', 'port5555', req, {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        }).catch(() => { });
        return res.redirect('/errors/port5555-unauthorized');
    }
    next();
};
// Create port 5555 error routes
export const createPort5555ErrorRoutes = (app) => {
    app.get('/errors/port5555-unauthorized', (req, res) => {
        res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied - MotiaCraft MC List</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #0f172a;
            color: #f8fafc;
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            text-align: center;
        }
        .container { 
            background: rgba(30, 41, 59, 0.7); 
            backdrop-filter: blur(12px);
            padding: 3rem; 
            border-radius: 1.5rem; 
            border: 1px solid rgba(255, 255, 255, 0.1);
            max-width: 500px; 
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .icon {
            width: 64px;
            height: 64px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            color: #ef4444;
        }
        h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; color: #f1f5f9; }
        p { margin-bottom: 2rem; line-height: 1.6; color: #94a3b8; font-size: 1rem; }
        .btn { 
            display: inline-block; 
            padding: 0.75rem 2rem; 
            background: #3b82f6; 
            color: white; 
            text-decoration: none; 
            border-radius: 0.75rem; 
            font-weight: 600; 
            transition: all 0.2s;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
        }
        .btn:hover { 
            transform: translateY(-2px); 
            background: #2563eb;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h1>Access Denied</h1>
        <p>Admin privileges required for port 5555 management. This area is restricted.</p>
        <a href="/" class="btn">Return Home</a>
    </div>
</body>
</html>`);
    });
};
//# sourceMappingURL=port5555ErrorHandler.js.map