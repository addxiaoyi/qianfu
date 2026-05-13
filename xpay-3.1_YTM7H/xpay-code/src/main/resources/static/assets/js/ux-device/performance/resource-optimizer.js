const ResourceOptimizer = (function() {
    'use strict';

    const LAZY_LOAD_THRESHOLD = 200;
    const THROTTLE_DELAY = 100;
    const DEBOUNCE_DELAY = 250;

    class LazyLoader {
        constructor(options = {}) {
            this.options = {
                root: options.root || null,
                rootMargin: options.rootMargin || `${LAZY_LOAD_THRESHOLD}px`,
                threshold: options.threshold || 0
            };

            this.observer = null;
            this.elements = new Set();
            this.loadedCount = 0;

            this.init();
        }

        init() {
            if (!('IntersectionObserver' in window)) {
                this.loadAllImmediately();
                return;
            }

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadElement(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, this.options);
        }

        observe(element) {
            if (!element) return;

            element.dataset.lazySrc = element.src || '';
            element.src = '';

            element.classList.add('lazy-loading');

            if (this.observer) {
                this.observer.observe(element);
                this.elements.add(element);
            } else {
                this.loadElement(element);
            }
        }

        loadElement(element) {
            const src = element.dataset.lazySrc;
            if (!src) return;

            element.classList.remove('lazy-loading');
            element.classList.add('lazy-loaded');

            if (element.tagName === 'IMG' || element.tagName === 'IFRAME') {
                element.src = src;
            } else if (element.tagName === 'DIV' || element.tagName === 'SECTION') {
                element.style.backgroundImage = `url(${src})`;
            }

            this.loadedCount++;
            this.onLoad(element);
        }

        onLoad(element) {
            if (element.dataset.lazyCallback) {
                try {
                    const callback = new Function(element.dataset.lazyCallback);
                    callback.call(element);
                } catch (e) {
                    console.error('Lazy load callback error:', e);
                }
            }
        }

        loadAllImmediately() {
            this.elements.forEach(el => {
                const src = el.dataset.lazySrc;
                if (src) {
                    if (el.tagName === 'IMG' || el.tagName === 'IFRAME') {
                        el.src = src;
                    }
                }
            });
            this.elements.clear();
        }

        unobserve(element) {
            if (this.observer) {
                this.observer.unobserve(element);
                this.elements.delete(element);
            }
        }

        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
                this.elements.clear();
            }
        }
    }

    class AnimationOptimizer {
        constructor() {
            this.animations = new Map();
            this.frameId = null;
            this.isRunning = false;
        }

        add(element, keyframes, options = {}) {
            const id = Symbol('animation');

            if (typeof gsap !== 'undefined') {
                const animation = gsap.to(element, {
                    ...keyframes,
                    duration: options.duration || 0.5,
                    ease: options.ease || 'power2.out',
                    paused: options.paused !== false,
                    onComplete: options.onComplete
                });

                this.animations.set(id, animation);
                return id;
            } else {
                element.style.transition = `all ${options.duration || 0.5}s ${options.ease || 'ease-out'}`;
                this.animations.set(id, { element, keyframes });
                return id;
            }
        }

        play(id) {
            const animation = this.animations.get(id);
            if (!animation) return;

            if (animation.play) {
                animation.play();
            }
        }

        pause(id) {
            const animation = this.animations.get(id);
            if (!animation) return;

            if (animation.pause) {
                animation.pause();
            }
        }

        reverse(id) {
            const animation = this.animations.get(id);
            if (!animation) return;

            if (animation.reverse) {
                animation.reverse();
            }
        }

        kill(id) {
            const animation = this.animations.get(id);
            if (!animation) return;

            if (animation.kill) {
                animation.kill();
            }
            this.animations.delete(id);
        }

        enableHardwareAcceleration(element) {
            element.style.willChange = 'transform';
            element.style.transform = 'translateZ(0)';
            element.style.backfaceVisibility = 'hidden';
        }

        disableHardwareAcceleration(element) {
            element.style.willChange = '';
            element.style.transform = '';
            element.style.backfaceVisibility = '';
        }
    }

    function throttle(func, wait = THROTTLE_DELAY) {
        let timeout = null;
        let previous = 0;

        return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);

            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    function debounce(func, wait = DEBOUNCE_DELAY, immediate = false) {
        let timeout = null;

        return function(...args) {
            const context = this;

            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            }, wait);

            if (immediate && !timeout) {
                func.apply(context, args);
            }
        };
    }

    function rafThrottle(func) {
        let rafId = null;
        let lastArgs = null;

        return function(...args) {
            lastArgs = args;

            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    func.apply(this, lastArgs);
                    rafId = null;
                });
            }
        };
    }

    function preloadImage(src, options = {}) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = options.crossOrigin || 'anonymous';

            img.onload = () => {
                if (options.cache) {
                    preloadImage.cache = preloadImage.cache || new Map();
                    preloadImage.cache.set(src, img);
                }
                resolve(img);
            };

            img.onerror = () => {
                reject(new Error(`Failed to preload image: ${src}`));
            };

            img.src = src;
        });
    }

    function getCachedImage(src) {
        if (preloadImage.cache && preloadImage.cache.has(src)) {
            return preloadImage.cache.get(src);
        }
        return null;
    }

    function optimizeImages(container = document) {
        const images = container.querySelectorAll('img[data-src]');

        images.forEach(img => {
            const src = img.dataset.src;

            if ('loading' in HTMLImageElement.prototype) {
                img.loading = 'lazy';
                img.src = src;
            } else {
                img.dataset.lazySrc = src;
                img.classList.add('lazy-load');
            }
        });
    }

    function preloadCriticalResources() {
        const criticalFonts = [
            'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
            'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap'
        ];

        criticalFonts.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    function observePerformance(callback) {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    callback(entry);
                });
            });

            try {
                observer.observe({ entryTypes: ['paint', 'navigation', 'resource'] });
            } catch (e) {
                console.warn('Performance observer not supported for this entry type');
            }

            return observer;
        }
    }

    function getResourceTiming(resourceName) {
        if (!window.performance) return null;

        const resources = performance.getEntriesByName(resourceName);
        if (resources.length > 0) {
            const resource = resources[0];
            return {
                duration: resource.duration,
                transferSize: resource.transferSize,
                dns: resource.domainLookupEnd - resource.domainLookupStart,
                tcp: resource.connectEnd - resource.connectStart,
                ttfb: resource.responseStart - resource.requestStart
            };
        }
        return null;
    }

    return {
        LazyLoader,
        AnimationOptimizer,
        throttle,
        debounce,
        rafThrottle,
        preloadImage,
        getCachedImage,
        optimizeImages,
        preloadCriticalResources,
        observePerformance,
        getResourceTiming,
        LAZY_LOAD_THRESHOLD,
        THROTTLE_DELAY,
        DEBOUNCE_DELAY
    };
})();

if (typeof window !== 'undefined') {
    window.ResourceOptimizer = ResourceOptimizer;
}