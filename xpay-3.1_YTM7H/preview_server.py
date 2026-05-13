import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 8888
TEMPLATES_DIR = Path(r"c:\Users\l\Desktop\下载\xpay-3.1\xpay-code\src\main\resources\templates")
STATIC_DIR = Path(r"c:\Users\l\Desktop\下载\xpay-3.1\xpay-code\src\main\resources\static")

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
        print(f"🚀 StarMC 支付系统预览服务器已启动！")
        print(f"📍 访问地址: http://localhost:{PORT}")
        print(f"📁 模板目录: {TEMPLATES_DIR}")
        print(f"📁 静态资源: {STATIC_DIR}")
        print("\n可访问页面:")
        print(f"  - 支付页面: http://localhost:{PORT}/starmc-pay.html")
        print(f"  - 融合生成器: http://localhost:{PORT}/starmc-fusion-generator.html")
        print(f"  - 融合支付: http://localhost:{PORT}/starmc-fusion-pay.html")
        print(f"  - 千服配置: http://localhost:{PORT}/qianfu-settings.html")
        print(f"  - 设置页面: http://localhost:{PORT}/starmc-settings.html")
        print("\n按 Ctrl+C 停止服务器")

        # 自动打开浏览器
        webbrowser.open(f"http://localhost:{PORT}/starmc-pay.html")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 服务器已停止")
