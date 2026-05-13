from playwright.sync_api import sync_playwright
import os

def capture_screenshots():
    """预览StarMC支付系统UI界面"""

    templates_dir = r"c:\Users\l\Desktop\下载\xpay-3.1\xpay-code\src\main\resources\templates"

    # 要预览的页面
    pages = [
        ("starmc-pay.html", "StarMC支付页面 - 桌面端"),
        ("starmc-pay-mobile.html", "StarMC支付页面 - 移动端"),
        ("starmc-fusion-generator.html", "融合支付码生成器"),
        ("starmc-fusion-pay.html", "融合支付页面"),
        ("qianfu-settings.html", "千服系统配置"),
        ("starmc-settings.html", "StarMC设置"),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for filename, description in pages:
            filepath = os.path.join(templates_dir, filename)
            if not os.path.exists(filepath):
                print(f"❌ 文件不存在: {filename}")
                continue

            # 桌面端截图
            desktop_page = browser.new_page(viewport={'width': 1440, 'height': 900})
            desktop_page.goto(f'file://{filepath}')
            desktop_page.wait_for_load_state('networkidle')
            desktop_page.wait_for_timeout(2000)  # 等待动画完成

            desktop_path = f'c:\\Users\\l\\Desktop\\下载\\xpay-3.1\\preview_{filename.replace(".html", "")}_desktop.png'
            desktop_page.screenshot(path=desktop_path, full_page=True)
            print(f"✅ {description} - 桌面端预览已保存: {desktop_path}")
            desktop_page.close()

            # 移动端截图
            mobile_page = browser.new_page(viewport={'width': 375, 'height': 812})
            mobile_page.goto(f'file://{filepath}')
            mobile_page.wait_for_load_state('networkidle')
            mobile_page.wait_for_timeout(2000)

            mobile_path = f'c:\\Users\\l\\Desktop\\下载\\xpay-3.1\\preview_{filename.replace(".html", "")}_mobile.png'
            mobile_page.screenshot(path=mobile_path, full_page=True)
            print(f"✅ {description} - 移动端预览已保存: {mobile_path}")
            mobile_page.close()

        browser.close()
        print("\n🎉 所有UI预览已完成！")

if __name__ == "__main__":
    capture_screenshots()
