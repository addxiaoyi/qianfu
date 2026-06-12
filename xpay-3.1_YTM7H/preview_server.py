import http.server
import os
import socketserver
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PORT = int(os.environ.get("XPAY_PREVIEW_PORT", "8890"))
TEMPLATES_DIR = BASE_DIR / "xpay-code" / "src" / "main" / "resources" / "templates"
STATIC_DIR = BASE_DIR / "xpay-code" / "src" / "main" / "resources" / "static"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(TEMPLATES_DIR), **kwargs)

    def do_GET(self):
        # 处理静态资源请求
        if self.path.startswith('/assets/'):
            self.directory = str(STATIC_DIR)
        elif self.path.startswith('/images/'):
            self.directory = str(STATIC_DIR)
        elif self.path.startswith('/js/'):
            self.directory = str(STATIC_DIR)
        elif self.path.startswith('/css/'):
            self.directory = str(STATIC_DIR)
        else:
            self.directory = str(TEMPLATES_DIR)

        # 默认首页
        if self.path == '/':
            self.path = '/starmc-pay.html'

        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(str(TEMPLATES_DIR))

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print("StarMC payment preview server started.")
        print(f"URL: http://localhost:{PORT}")
        print(f"Templates: {TEMPLATES_DIR}")
        print(f"Static: {STATIC_DIR}")
        print("")
        print("Available pages:")
        print(f"  - Pay page: http://localhost:{PORT}/starmc-pay.html")
        print(f"  - Fusion generator: http://localhost:{PORT}/starmc-fusion-generator.html")
        print(f"  - Fusion pay: http://localhost:{PORT}/starmc-fusion-pay.html")
        print(f"  - QianFu settings: http://localhost:{PORT}/qianfu-settings.html")
        print(f"  - Settings page: http://localhost:{PORT}/starmc-settings.html")
        print("")
        print("Press Ctrl+C to stop.")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview server stopped.")
