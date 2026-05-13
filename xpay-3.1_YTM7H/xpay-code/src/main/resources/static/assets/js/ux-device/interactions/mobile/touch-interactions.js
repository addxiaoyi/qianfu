const TouchInteractions = (function() {
    'use strict';

    const SWIPE_THRESHOLD = 50;
    const TAP_THRESHOLD = 200;
    const LONG_PRESS_THRESHOLD = 500;
    const DOUBLE_TAP_THRESHOLD = 300;
    const EDGE_SWIPE_THRESHOLD = 30;
    const EDGE_DETECT_ZONE = 20;

    class TouchHandler {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                onTap: options.onTap || null,
                onDoubleTap: options.onDoubleTap || null,
                onLongPress: options.onLongPress || null,
                onSwipeLeft: options.onSwipeLeft || null,
                onSwipeRight: options.onSwipeRight || null,
                onSwipeUp: options.onSwipeUp || null,
                onSwipeDown: options.onSwipeDown || null,
                onEdgeSwipeLeft: options.onEdgeSwipeLeft || null,
                onEdgeSwipeRight: options.onEdgeSwipeRight || null,
                onTouchStart: options.onTouchStart || null,
                onTouchMove: options.onTouchMove || null,
                onTouchEnd: options.onTouchEnd || null,
                enableSwipe: options.enableSwipe !== false,
                enableDoubleTap: options.enableDoubleTap !== false,
                enableLongPress: options.enableLongPress !== false,
                enableEdgeSwipe: options.enableEdgeSwipe !== false
            };

            this.touchState = {
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                startTime: 0,
                isTouching: false,
                isLongPressing: false,
                lastTapTime: 0,
                isEdgeTouch: false,
                edgeSide: null
            };

            this.longPressTimer = null;
            this.bindEvents();
        }

        bindEvents() {
            this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
            this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: true });

            if (this.options.enableLongPress) {
                this.element.addEventListener('contextmenu', e => e.preventDefault());
            }
        }

        handleTouchStart(e) {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            this.touchState.startX = touch.clientX;
            this.touchState.startY = touch.clientY;
            this.touchState.currentX = touch.clientX;
            this.touchState.currentY = touch.clientY;
            this.touchState.startTime = Date.now();
            this.touchState.isTouching = true;
            this.touchState.isLongPressing = false;
            this.touchState.isEdgeTouch = touch.clientX < EDGE_DETECT_ZONE || touch.clientX > window.innerWidth - EDGE_DETECT_ZONE;
            this.touchState.edgeSide = touch.clientX < EDGE_DETECT_ZONE ? 'left' : (touch.clientX > window.innerWidth - EDGE_DETECT_ZONE ? 'right' : null);

            if (this.options.onTouchStart) {
                this.options.onTouchStart(e, {
                    x: touch.clientX,
                    y: touch.clientY
                });
            }

            if (this.options.enableLongPress) {
                this.longPressTimer = setTimeout(() => {
                    if (this.touchState.isTouching) {
                        this.touchState.isLongPressing = true;
                        if (this.options.onLongPress) {
                            this.options.onLongPress(e, {
                                x: touch.clientX,
                                y: touch.clientY
                            });
                        }
                        this.triggerHapticFeedback();
                    }
                }, LONG_PRESS_THRESHOLD);
            }
        }

        handleTouchMove(e) {
            if (!this.touchState.isTouching) return;

            const touch = e.touches[0];
            this.touchState.currentX = touch.clientX;
            this.touchState.currentY = touch.clientY;

            if (this.options.onTouchMove) {
                this.options.onTouchMove(e, {
                    startX: this.touchState.startX,
                    startY: this.touchState.startY,
                    currentX: touch.clientX,
                    currentY: touch.clientY,
                    deltaX: touch.clientX - this.touchState.startX,
                    deltaY: touch.clientY - this.touchState.startY
                });
            }

            const deltaX = Math.abs(touch.clientX - this.touchState.startX);
            const deltaY = Math.abs(touch.clientY - this.touchState.startY);

            if (deltaX > 10 || deltaY > 10) {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        }

        handleTouchEnd(e) {
            if (!this.touchState.isTouching) return;

            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            const deltaX = this.touchState.currentX - this.touchState.startX;
            const deltaY = this.touchState.currentY - this.touchState.startY;
            const deltaTime = Date.now() - this.touchState.startTime;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (this.options.onTouchEnd) {
                this.options.onTouchEnd(e, {
                    deltaX,
                    deltaY,
                    deltaTime,
                    distance
                });
            }

            if (this.touchState.isLongPressing) {
                this.touchState.isTouching = false;
                this.touchState.isLongPressing = false;
                return;
            }

            if (distance < 10 && deltaTime < TAP_THRESHOLD) {
                const now = Date.now();
                const timeSinceLastTap = now - this.touchState.lastTapTime;

                if (this.options.enableDoubleTap && timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
                    if (this.options.onDoubleTap) {
                        this.options.onDoubleTap(e, {
                            x: this.touchState.startX,
                            y: this.touchState.startY
                        });
                        this.touchState.lastTapTime = 0;
                    }
                } else {
                    if (this.options.onTap) {
                        this.options.onTap(e, {
                            x: this.touchState.startX,
                            y: this.touchState.startY
                        });
                    }
                    this.touchState.lastTapTime = now;
                }
            }

            if (this.options.enableSwipe) {
                this.handleSwipe(deltaX, deltaY, distance);
            }

            this.touchState.isTouching = false;
        }

        handleTouchCancel() {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            this.touchState.isTouching = false;
            this.touchState.isLongPressing = false;
        }

        handleSwipe(deltaX, deltaY, distance) {
            if (distance < SWIPE_THRESHOLD) return;

            if (this.options.enableEdgeSwipe && this.touchState.isEdgeTouch) {
                if (this.touchState.edgeSide === 'left' && deltaX < -EDGE_SWIPE_THRESHOLD && this.options.onEdgeSwipeLeft) {
                    this.options.onEdgeSwipeLeft({
                        distance: Math.abs(deltaX),
                        edge: 'left'
                    });
                    this.triggerHapticFeedback();
                    return;
                }
                if (this.touchState.edgeSide === 'right' && deltaX > EDGE_SWIPE_THRESHOLD && this.options.onEdgeSwipeRight) {
                    this.options.onEdgeSwipeRight({
                        distance: Math.abs(deltaX),
                        edge: 'right'
                    });
                    this.triggerHapticFeedback();
                    return;
                }
            }

            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

            if (isHorizontal) {
                if (deltaX > 0 && this.options.onSwipeRight) {
                    this.options.onSwipeRight({
                        distance: deltaX,
                        angle: Math.atan2(deltaY, deltaX)
                    });
                    this.triggerHapticFeedback();
                } else if (deltaX < 0 && this.options.onSwipeLeft) {
                    this.options.onSwipeLeft({
                        distance: Math.abs(deltaX),
                        angle: Math.atan2(deltaY, deltaX)
                    });
                    this.triggerHapticFeedback();
                }
            } else {
                if (deltaY > 0 && this.options.onSwipeDown) {
                    this.options.onSwipeDown({
                        distance: deltaY,
                        angle: Math.atan2(deltaX, deltaY)
                    });
                    this.triggerHapticFeedback();
                } else if (deltaY < 0 && this.options.onSwipeUp) {
                    this.options.onSwipeUp({
                        distance: Math.abs(deltaY),
                        angle: Math.atan2(deltaX, deltaY)
                    });
                    this.triggerHapticFeedback();
                }
            }
        }

        triggerHapticFeedback(intensity = 'light') {
            if (!navigator.vibrate) return;

            const patterns = {
                light: 10,
                medium: 25,
                heavy: 50,
                success: [10, 50, 10],
                warning: [20, 100, 20],
                error: [50, 100, 50, 100, 50]
            };

            const pattern = patterns[intensity] || patterns.light;
            navigator.vibrate(pattern);
        }

        triggerSelectionFeedback() {
            if (navigator.vibrate) {
                navigator.vibrate(5);
            }
        }

        destroy() {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
            }
            this.element.removeEventListener('touchstart', this.handleTouchStart);
            this.element.removeEventListener('touchmove', this.handleTouchMove);
            this.element.removeEventListener('touchend', this.handleTouchEnd);
            this.element.removeEventListener('touchcancel', this.handleTouchCancel);
        }
    }

    let initialized = false;
    let handlers = new Map();

    function init() {
        if (initialized) return;
        initialized = true;

        document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
        document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    }

    let activeTouches = [];

    function handleGlobalTouchStart(e) {
        activeTouches = Array.from(e.touches);
    }

    function handleGlobalTouchMove(e) {
        activeTouches = Array.from(e.touches);
    }

    function handleGlobalTouchEnd(e) {
        activeTouches = Array.from(e.touches);
    }

    function createHandler(element, options) {
        if (!DeviceDetector || !DeviceDetector.isMobile()) {
            return null;
        }

        init();
        const handler = new TouchHandler(element, options);
        handlers.set(element, handler);
        return handler;
    }

    function destroyHandler(element) {
        if (handlers.has(element)) {
            handlers.get(element).destroy();
            handlers.delete(element);
        }
    }

    function getSwipeDirection(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > absY) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }

    function isSwipeDistance(deltaX, deltaY, threshold = SWIPE_THRESHOLD) {
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY) >= threshold;
    }

    function addSwipeListener(element, direction, callback) {
        const swipeHandlers = {
            onSwipeLeft: direction === 'left' ? callback : null,
            onSwipeRight: direction === 'right' ? callback : null,
            onSwipeUp: direction === 'up' ? callback : null,
            onSwipeDown: direction === 'down' ? callback : null
        };

        return createHandler(element, swipeHandlers);
    }

    function addTapListener(element, callback) {
        return createHandler(element, { onTap: callback });
    }

    function addDoubleTapListener(element, callback) {
        return createHandler(element, { onDoubleTap: callback });
    }

    function addLongPressListener(element, callback) {
        return createHandler(element, { onLongPress: callback });
    }

    function addEdgeSwipeListener(element, direction, callback) {
        const swipeHandlers = {
            enableEdgeSwipe: true,
            onEdgeSwipeLeft: direction === 'left' ? callback : null,
            onEdgeSwipeRight: direction === 'right' ? callback : null
        };
        return createHandler(element, swipeHandlers);
    }

    function disableBodyScroll() {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }

    function enableBodyScroll() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }

    function prefetchImages(urls) {
        urls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    return {
        init,
        createHandler,
        destroyHandler,
        getSwipeDirection,
        isSwipeDistance,
        addSwipeListener,
        addTapListener,
        addDoubleTapListener,
        addLongPressListener,
        addEdgeSwipeListener,
        disableBodyScroll,
        enableBodyScroll,
        prefetchImages,
        SWIPE_THRESHOLD,
        TAP_THRESHOLD,
        LONG_PRESS_THRESHOLD,
        DOUBLE_TAP_THRESHOLD
    };
})();

if (typeof window !== 'undefined') {
    window.TouchInteractions = TouchInteractions;
}