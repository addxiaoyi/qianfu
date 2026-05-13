from playwright.sync_api import sync_playwright
import os
import time

def inspect_header():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate mobile
        context_mobile = browser.new_context(viewport={'width': 375, 'height': 812})
        page_mobile = context_mobile.new_page()
        page_mobile.on("console", lambda msg: print(f"Mobile Console [{msg.type}]: {msg.text}"))
        page_mobile.on("pageerror", lambda err: print(f"Mobile Error: {err.message}"))
        
        # Emulate desktop
        context_desktop = browser.new_context(viewport={'width': 1280, 'height': 800})
        page_desktop = context_desktop.new_page()
        page_desktop.on("console", lambda msg: print(f"Desktop Console [{msg.type}]: {msg.text}"))
        page_desktop.on("pageerror", lambda err: print(f"Desktop Error: {err.message}"))
        
        # Ensure directories exist
        os.makedirs('screenshots', exist_ok=True)
        base_url = os.getenv("BASE_URL", "http://localhost:4123")
        fallback_url = os.getenv("FALLBACK_URL", "http://localhost:4124")
        
        def goto_with_fallback(page, primary, fallback):
            try:
                page.goto(primary)
            except Exception as e:
                print(f"Primary URL failed: {e}. Trying fallback...")
                page.goto(fallback)
        
        # Inspect popups on desktop
        try:
            goto_with_fallback(page_desktop, base_url, fallback_url)
            time.sleep(2)
            
            # 1. Search (Command Palette)
            page_desktop.keyboard.press("Control+k")
            time.sleep(1)
            page_desktop.screenshot(path='screenshots/desktop_command_palette.png')
            page_desktop.keyboard.press("Escape")
            time.sleep(1)
            
            # 2. Theme Toggle
            theme_btn = page_desktop.locator('button[aria-label*="主题"], button[aria-label*="Theme"]').first
            if theme_btn.is_visible():
                theme_btn.click()
                time.sleep(1)
                page_desktop.screenshot(path='screenshots/desktop_theme_menu.png')
                page_desktop.mouse.click(0, 0) # Close menu
                time.sleep(1)
                
            # 3. Language Toggle
            lang_btn = page_desktop.locator('button[aria-label*="语言"], button[aria-label*="Language"]').first
            if lang_btn.is_visible():
                lang_btn.click()
                time.sleep(1)
                page_desktop.screenshot(path='screenshots/desktop_lang_menu.png')
                page_desktop.mouse.click(0, 0) # Close menu
                time.sleep(1)

            # 4. Login Dialog
            login_btn = page_desktop.locator('button:has-text("登录"), button:has-text("Login")').first
            if login_btn.is_visible():
                login_btn.click()
                time.sleep(1)
                page_desktop.screenshot(path='screenshots/desktop_login_dialog.png')
                page_desktop.keyboard.press("Escape")
                time.sleep(1)

        except Exception as e:
            print(f"Error during desktop inspection: {e}")

        # Inspect popups on mobile
        try:
            goto_with_fallback(page_mobile, base_url, fallback_url)
            time.sleep(2)
            
            # 1. Mobile Menu
            menu_btn = page_mobile.locator('button[aria-label*="菜单"], button[aria-label*="Menu"]').first
            if menu_btn.is_visible():
                menu_btn.click()
                time.sleep(1)
                page_mobile.screenshot(path='screenshots/mobile_menu_open.png')
                
                # Inside mobile menu: Search
                search_btn = page_mobile.locator('button:has-text("搜索"), button:has-text("Search")').first
                if search_btn.is_visible():
                    search_btn.click()
                    time.sleep(1)
                    page_mobile.screenshot(path='screenshots/mobile_command_palette.png')
                    page_mobile.keyboard.press("Escape")
                    time.sleep(1)
                
                # Re-open menu for login check
                if not menu_btn.is_visible():
                     menu_btn = page_mobile.locator('button[aria-label*="菜单"], button[aria-label*="Menu"]').first
                     menu_btn.click()
                     time.sleep(1)

                # Inside mobile menu: Login
                login_btn = page_mobile.locator('button:has-text("登录"), button:has-text("Login")').first
                if login_btn.is_visible():
                    login_btn.click()
                    time.sleep(1)
                    page_mobile.screenshot(path='screenshots/mobile_login_dialog.png')
                    page_mobile.keyboard.press("Escape")
                    time.sleep(1)
        except Exception as e:
            print(f"Error during mobile inspection: {e}")

        browser.close()

if __name__ == "__main__":
    inspect_header()
