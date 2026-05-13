const UXSystem = (function() {
    'use strict';

    const SYSTEM_ID = 'ux-device-system';
    const VERSION = '1.0.0';

    class UXInitializer {
        constructor() {
            this.deviceType = null;
            this.breakpoint = null;
            this.initialized = false;
            this.modules = {};
            this.listeners = [];
        }

        async init() {
            if (this.initialized) return;

            console.log(`[${SYSTEM_ID}] Initializing v${VERSION}...`);

            if (typeof DeviceDetector === 'undefined') {
                console.error(`[${SYSTEM_ID}] DeviceDetector not found!`);
                return;
            }

            DeviceDetector.init();

            this.deviceType = DeviceDetector.getDeviceType();
            this.breakpoint = DeviceDetector.getBreakpoint();

            console.log(`[${SYSTEM_ID}] Device: ${this.deviceType}, Breakpoint: ${this.breakpoint}`);

            this.applyBaseStyles();
            this.applyDeviceStyles();
            this.initializeInteractions();
            this.setupResizeHandler();

            this.initialized = true;
            console.log(`[${SYSTEM_ID}] Initialization complete`);

            this.notifyListeners('init', {
                deviceType: this.deviceType,
                breakpoint: this.breakpoint
            });
        }

        applyBaseStyles() {
            document.documentElement.classList.add('ux-system-ready');
        }

        applyDeviceStyles() {
            const html = document.documentElement;

            html.classList.remove('ux-mobile', 'ux-tablet', 'ux-desktop');
            html.classList.add(`ux-${this.deviceType}`);

            if (this.deviceType === 'mobile' || this.deviceType === 'tablet') {
                this.applyTouchOptimizations();
            }

            if (this.deviceType === 'desktop') {
                this.applyMouseOptimizations();
            }
        }

        applyTouchOptimizations() {
            const style = document.createElement('style');
            style.id = 'ux-touch-optimizations';
            style.textContent = `
                .ux-touch-target {
                    min-height: 44px;
                    min-width: 44px;
                }

                .ux-touch-optimized {
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }

                .ux-no-scroll {
                    overscroll-behavior: none;
                    overflow: hidden;
                    position: fixed;
                    width: 100%;
                    height: 100%;
                }

                .ux-swipe-container {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scroll-snap-type: x mandatory;
                }

                .ux-swipe-item {
                    scroll-snap-align: start;
                    flex-shrink: 0;
                }

                @media (hover: none) and (pointer: coarse) {
                    .hover-only {
                        display: none !important;
                    }
                }

                @media (hover: hover) and (pointer: fine) {
                    .touch-only {
                        display: none !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        applyMouseOptimizations() {
            const style = document.createElement('style');
            style.id = 'ux-mouse-optimizations';
            style.textContent = `
                .ux-cursor-pointer:hover {
                    cursor: pointer;
                }

                .ux-cursor-grab:hover {
                    cursor: grab;
                }

                .ux-cursor-grabbing:active {
                    cursor: grabbing;
                }

                .ux-hover-glow {
                    transition: box-shadow 0.3s ease;
                }

                .ux-hover-glow:hover {
                    box-shadow: 0 0 30px rgba(184, 146, 62, 0.3);
                }

                .ux-hover-scale {
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .ux-hover-scale:hover {
                    transform: scale(1.05);
                }

                .ux-hover-lift {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .ux-hover-lift:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                }
            `;
            document.head.appendChild(style);
        }

        initializeInteractions() {
            if (this.deviceType === 'mobile' || this.deviceType === 'tablet') {
                this.initTouchInteractions();
            }

            if (this.deviceType === 'desktop') {
                this.initMouseInteractions();
            }

            this.initPerformanceOptimizations();
        }

        initTouchInteractions() {
            if (typeof TouchInteractions === 'undefined') {
                console.warn(`[${SYSTEM_ID}] TouchInteractions not found`);
                return;
            }

            TouchInteractions.init();
            this.modules.touch = true;
            console.log(`[${SYSTEM_ID}] Touch interactions initialized`);
        }

        initMouseInteractions() {
            if (typeof MouseInteractions === 'undefined') {
                console.warn(`[${SYSTEM_ID}] MouseInteractions not found`);
                return;
            }

            MouseInteractions.init();
            this.modules.mouse = true;
            console.log(`[${SYSTEM_ID}] Mouse interactions initialized`);
        }

        initPerformanceOptimizations() {
            if (typeof ResourceOptimizer === 'undefined') {
                console.warn(`[${SYSTEM_ID}] ResourceOptimizer not found`);
                return;
            }

            ResourceOptimizer.preloadCriticalResources();

            if (typeof ResourceOptimizer.OptimizeImages !== 'undefined') {
                ResourceOptimizer.optimizeImages();
            }

            this.modules.performance = true;
            console.log(`[${SYSTEM_ID}] Performance optimizations initialized`);
        }

        setupResizeHandler() {
            if (typeof DeviceDetector === 'undefined') return;

            DeviceDetector.onChange((event, info) => {
                const oldDeviceType = this.deviceType;
                this.deviceType = info.getDeviceType ? info.getDeviceType() : info.type;
                this.breakpoint = info.getBreakpoint ? info.getBreakpoint() : info.breakpoint;

                console.log(`[${SYSTEM_ID}] Device changed: ${oldDeviceType} -> ${this.deviceType}`);

                this.applyDeviceStyles();

                if (oldDeviceType !== this.deviceType) {
                    this.onDeviceTypeChange(oldDeviceType, this.deviceType);
                }

                this.notifyListeners('resize', {
                    deviceType: this.deviceType,
                    breakpoint: this.breakpoint
                });
            });
        }

        onDeviceTypeChange(oldType, newType) {
            if (newType === 'mobile' || newType === 'tablet') {
                if (typeof MouseInteractions !== 'undefined') {
                }
            }

            if (newType === 'desktop') {
                if (typeof TouchInteractions !== 'undefined') {
                }
            }

            this.notifyListeners('deviceChange', {
                oldType,
                newType
            });
        }

        on(event, callback) {
            if (typeof callback === 'function') {
                this.listeners.push({ event, callback });
            }
        }

        off(event, callback) {
            this.listeners = this.listeners.filter(
                listener => !(listener.event === event && listener.callback === callback)
            );
        }

        notifyListeners(event, data) {
            this.listeners.forEach(listener => {
                if (listener.event === event) {
                    try {
                        listener.callback(data);
                    } catch (e) {
                        console.error(`[${SYSTEM_ID}] Listener error:`, e);
                    }
                }
            });
        }

        getDeviceType() {
            return this.deviceType;
        }

        getBreakpoint() {
            return this.breakpoint;
        }

        isMobile() {
            return this.deviceType === 'mobile';
        }

        isTablet() {
            return this.deviceType === 'tablet';
        }

        isDesktop() {
            return this.deviceType === 'desktop';
        }

        isTouchDevice() {
            return this.deviceType === 'mobile' || this.deviceType === 'tablet';
        }

        getModules() {
            return { ...this.modules };
        }
    }

    const initializer = new UXInitializer();

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initializer.init());
        } else {
            initializer.init();
        }
    }

    function getDeviceType() {
        return initializer.getDeviceType();
    }

    function getBreakpoint() {
        return initializer.getBreakpoint();
    }

    function isMobile() {
        return initializer.isMobile();
    }

    function isTablet() {
        return initializer.isTablet();
    }

    function isDesktop() {
        return initializer.isDesktop();
    }

    function isTouchDevice() {
        return initializer.isTouchDevice();
    }

    function on(event, callback) {
        initializer.on(event, callback);
    }

    function off(event, callback) {
        initializer.off(event, callback);
    }

    function getModules() {
        return initializer.getModules();
    }

    return {
        init,
        getDeviceType,
        getBreakpoint,
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        on,
        off,
        getModules,
        VERSION
    };
})();

if (typeof window !== 'undefined') {
    window.UXSystem = UXSystem;
}