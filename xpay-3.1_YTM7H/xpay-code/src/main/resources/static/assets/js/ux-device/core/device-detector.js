const DeviceDetector = (function() {
    'use strict';

    const BREAKPOINTS = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        xxl: 1536
    };

    const DEVICE_TYPES = {
        MOBILE: 'mobile',
        TABLET: 'tablet',
        DESKTOP: 'desktop'
    };

    const UA_MOBILE_PATTERNS = [
        /Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i,
        /BlackBerry/i, /IEMobile/i, /Opera Mini/i,
        /MiuiBrowser/i, /HuaweiBrowser/i, /OPPO/i,
        /vivo/i, /OPPO/i, /Samsung/i, /LG/i,
        /Xiaomi/i, /Redmi/i, /POCO/i, /realme/i,
        /OnePlus/i, /Motorola/i, /Lenovo/i, /ASUS/i
    ];

    const UA_TABLET_PATTERNS = [
        /iPad/i, /Android/i, /Tablet/i, /Kindle/i,
        /Silk/i, /PlayBook/i, /Nexus 10/i, /Xoom/i,
        /SCH-I800/i, /GT-P3110/i, /SM-T210/i,
        /Surface/i, /ARM/i
    ];

    class DeviceInfo {
        constructor() {
            this.userAgent = navigator.userAgent;
            this.screenWidth = window.screen.width;
            this.screenHeight = window.screen.height;
            this.innerWidth = window.innerWidth;
            this.innerHeight = window.innerHeight;
            this.pixelRatio = window.devicePixelRatio || 1;
            this.orientation = window.screen.orientation?.type || (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
            this.supportsTouch = this._checkTouchSupport();
            this.isMobile = this._checkIsMobile();
            this.isTablet = this._checkIsTablet();
            this.isDesktop = !this.isMobile && !this.isTablet;
            this.os = this._detectOS();
            this.browser = this._detectBrowser();
        }

        _checkTouchSupport() {
            return ('ontouchstart' in window) ||
                   (navigator.maxTouchPoints > 0) ||
                   (navigator.msMaxTouchPoints > 0);
        }

        _checkIsMobile() {
            const uaLower = this.userAgent.toLowerCase();
            const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
            const isMobileUA = mobileRegex.test(this.userAgent);
            const hasMobileViewport = this.innerWidth < 768;
            const noDesktopUA = !(/Windows NT/i.test(this.userAgent) && !/Phone/i.test(this.userAgent));
            return isMobileUA || (hasMobileViewport && this.supportsTouch && noDesktopUA);
        }

        _checkIsTablet() {
            const isTabletUA = UA_TABLET_PATTERNS.some(pattern => pattern.test(this.userAgent));
            const isLargeTouchDevice = this.supportsTouch &&
                                       this.innerWidth >= 768 &&
                                       this.innerWidth < 1024;
            return isTabletUA || (isLargeTouchDevice && !this._checkIsMobile());
        }

        _detectOS() {
            const ua = this.userAgent;
            if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
            if (/Android/i.test(ua)) return 'Android';
            if (/Windows NT/i.test(ua)) return 'Windows';
            if (/Mac OS X/i.test(ua)) return 'macOS';
            if (/Linux/i.test(ua)) return 'Linux';
            return 'Unknown';
        }

        _detectBrowser() {
            const ua = this.userAgent;
            if (/MiuiBrowser/i.test(ua)) return 'MiuiBrowser';
            if (/HuaweiBrowser/i.test(ua)) return 'HuaweiBrowser';
            if (/Edg/i.test(ua)) return 'Edge';
            if (/Chrome/i.test(ua)) return 'Chrome';
            if (/Safari/i.test(ua)) return 'Safari';
            if (/Firefox/i.test(ua)) return 'Firefox';
            if (/SamsungBrowser/i.test(ua)) return 'SamsungBrowser';
            if (/OPR|Opera/i.test(ua)) return 'Opera';
            return 'Unknown';
        }

        getDeviceType() {
            if (this.isMobile) return DEVICE_TYPES.MOBILE;
            if (this.isTablet) return DEVICE_TYPES.TABLET;
            return DEVICE_TYPES.DESKTOP;
        }

        getBreakpoint() {
            const width = this.innerWidth;
            if (width >= BREAKPOINTS.xxl) return 'xxl';
            if (width >= BREAKPOINTS.xl) return 'xl';
            if (width >= BREAKPOINTS.lg) return 'lg';
            if (width >= BREAKPOINTS.md) return 'md';
            if (width >= BREAKPOINTS.sm) return 'sm';
            return 'xs';
        }

        isBreakpointUp(name) {
            return this.innerWidth >= BREAKPOINTS[name];
        }

        isBreakpointDown(name) {
            return this.innerWidth < BREAKPOINTS[name];
        }

        getOrientation() {
            return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        }

        isLandscape() {
            return this.getOrientation() === 'landscape';
        }

        isPortrait() {
            return this.getOrientation() === 'portrait';
        }

        toJSON() {
            return {
                type: this.getDeviceType(),
                os: this.os,
                browser: this.browser,
                screen: {
                    width: this.screenWidth,
                    height: this.screenHeight
                },
                viewport: {
                    width: this.innerWidth,
                    height: this.innerHeight
                },
                breakpoint: this.getBreakpoint(),
                orientation: this.getOrientation(),
                supportsTouch: this.supportsTouch,
                pixelRatio: this.pixelRatio
            };
        }
    }

    let deviceInfo = null;
    let listeners = [];
    let resizeTimeout = null;
    let initialized = false;

    function init() {
        if (initialized) return;
        deviceInfo = new DeviceInfo();
        initialized = true;

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('orientationchange', handleOrientationChange, { passive: true });

        applyDeviceClasses();
    }

    function handleResize() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            const newInfo = new DeviceInfo();
            const hasChanged = deviceInfo.getDeviceType() !== newInfo.getDeviceType() ||
                             deviceInfo.getBreakpoint() !== newInfo.getBreakpoint();

            if (hasChanged) {
                deviceInfo = newInfo;
                applyDeviceClasses();
                notifyListeners('resize', deviceInfo);
            }
        }, 100);
    }

    function handleOrientationChange() {
        setTimeout(() => {
            deviceInfo = new DeviceInfo();
            applyDeviceClasses();
            notifyListeners('orientationchange', deviceInfo);
        }, 100);
    }

    function applyDeviceClasses() {
        const html = document.documentElement;
        const body = document.body;

        html.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
        html.classList.add(`device-${deviceInfo.getDeviceType()}`);

        html.classList.remove('breakpoint-xs', 'breakpoint-sm', 'breakpoint-md',
                           'breakpoint-lg', 'breakpoint-xl', 'breakpoint-xxl');
        html.classList.add(`breakpoint-${deviceInfo.getBreakpoint()}`);

        html.classList.remove('orientation-portrait', 'orientation-landscape');
        html.classList.add(`orientation-${deviceInfo.getOrientation()}`);

        if (deviceInfo.supportsTouch) {
            html.classList.add('supports-touch');
        } else {
            html.classList.add('no-touch');
        }

        if (deviceInfo.isPortrait()) {
            html.classList.add('is-portrait');
        } else {
            html.classList.add('is-landscape');
        }
    }

    function notifyListeners(event, data) {
        listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('Device detector listener error:', e);
            }
        });
    }

    return {
        init,

        getInfo() {
            if (!initialized) init();
            return deviceInfo;
        },

        isMobile() {
            if (!initialized) init();
            return deviceInfo.isMobile;
        },

        isTablet() {
            if (!initialized) init();
            return deviceInfo.isTablet;
        },

        isDesktop() {
            if (!initialized) init();
            return deviceInfo.isDesktop;
        },

        getDeviceType() {
            if (!initialized) init();
            return deviceInfo.getDeviceType();
        },

        getBreakpoint() {
            if (!initialized) init();
            return deviceInfo.getBreakpoint();
        },

        isBreakpointUp(name) {
            if (!initialized) init();
            return deviceInfo.isBreakpointUp(name);
        },

        isBreakpointDown(name) {
            if (!initialized) init();
            return deviceInfo.isBreakpointDown(name);
        },

        supportsTouch() {
            if (!initialized) init();
            return deviceInfo.supportsTouch;
        },

        getOrientation() {
            if (!initialized) init();
            return deviceInfo.getOrientation();
        },

        isLandscape() {
            if (!initialized) init();
            return deviceInfo.isLandscape();
        },

        isPortrait() {
            if (!initialized) init();
            return deviceInfo.isPortrait();
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                listeners.push(callback);
            }
        },

        offChange(callback) {
            listeners = listeners.filter(cb => cb !== callback);
        },

        refresh() {
            deviceInfo = new DeviceInfo();
            applyDeviceClasses();
            return deviceInfo;
        },

        BREAKPOINTS,
        DEVICE_TYPES
    };
})();

if (typeof window !== 'undefined') {
    window.DeviceDetector = DeviceDetector;
}