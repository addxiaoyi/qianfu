const MouseInteractions = (function() {
    'use strict';

    const DEFAULT_SENSITIVITY = {
        tilt: 0.05,
        cursor: 0.1,
        parallax: 0.02
    };

    class TiltCard {
        constructor(element, options = {}) {
            this.element = element;
            this.sensitivity = {
                tilt: options.tiltSensitivity || DEFAULT_SENSITIVITY.tilt,
                cursor: options.cursorSensitivity || DEFAULT_SENSITIVITY.cursor
            };
            this.isEnabled = true;
            this.currentRotation = { x: 0, y: 0 };
            this.targetRotation = { x: 0, y: 0 };
            this.animationFrame = null;

            this.handleMouseMove = this.handleMouseMove.bind(this);
            this.handleMouseLeave = this.handleMouseLeave.bind(this);
            this.animate = this.animate.bind(this);

            this.bind();
        }

        bind() {
            this.element.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            this.element.addEventListener('mouseleave', this.handleMouseLeave);
            this.element.style.transformStyle = 'preserve-3d';
            this.element.style.transition = 'transform 0.1s ease-out';
        }

        handleMouseMove(e) {
            if (!this.isEnabled) return;

            const rect = this.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const mouseX = e.clientX - centerX;
            const mouseY = e.clientY - centerY;

            this.targetRotation.x = mouseY * this.sensitivity.tilt;
            this.targetRotation.y = -mouseX * this.sensitivity.tilt;

            this.startAnimation();
        }

        handleMouseLeave() {
            this.targetRotation = { x: 0, y: 0 };
            this.startAnimation();
        }

        animate() {
            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.15;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.15;

            const content = this.element.querySelector('.tilt-content');
            if (content) {
                content.style.transform = `translateZ(40px) rotateX(${this.currentRotation.x}deg) rotateY(${this.currentRotation.y}deg)`;
            } else {
                this.element.style.transform = `perspective(1000px) rotateX(${this.currentRotation.x}deg) rotateY(${this.currentRotation.y}deg)`;
            }

            if (Math.abs(this.targetRotation.x - this.currentRotation.x) > 0.01 ||
                Math.abs(this.targetRotation.y - this.currentRotation.y) > 0.01) {
                this.animationFrame = requestAnimationFrame(this.animate);
            } else {
                this.animationFrame = null;
            }
        }

        startAnimation() {
            if (!this.animationFrame) {
                this.animationFrame = requestAnimationFrame(this.animate);
            }
        }

        enable() {
            this.isEnabled = true;
        }

        disable() {
            this.isEnabled = false;
            this.element.style.transform = '';
            const content = this.element.querySelector('.tilt-content');
            if (content) {
                content.style.transform = '';
            }
        }

        destroy() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            this.element.removeEventListener('mousemove', this.handleMouseMove);
            this.element.removeEventListener('mouseleave', this.handleMouseLeave);
        }
    }

    class CursorTracker {
        constructor(options = {}) {
            this.target = options.target || document.body;
            this.sensitivity = options.sensitivity || DEFAULT_SENSITIVITY.cursor;
            this.delay = options.delay || 0;
            this.elements = options.elements || [];

            this.cursor = null;
            this.cursorVisible = false;
            this.isDestroyed = false;

            this.currentX = 0;
            this.currentY = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.animationFrame = null;

            this.init();
        }

        init() {
            if (typeof DeviceDetector !== 'undefined' && DeviceDetector.isMobile()) {
                return;
            }

            this.createCursor();
            this.bindEvents();
            this.startAnimation();
        }

        createCursor() {
            this.cursor = document.createElement('div');
            this.cursor.className = 'custom-cursor';
            this.cursor.style.cssText = `
                position: fixed;
                width: 20px;
                height: 20px;
                border: 2px solid rgba(184, 146, 62, 0.8);
                border-radius: 50%;
                pointer-events: none;
                z-index: 99999;
                transition: transform 0.15s ease-out, opacity 0.2s ease;
                mix-blend-mode: difference;
            `;
            document.body.appendChild(this.cursor);
        }

        bindEvents() {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
            document.addEventListener('mouseenter', this.handleMouseEnter.bind(this), { passive: true });
            document.addEventListener('mouseleave', this.handleMouseLeave.bind(this), { passive: true });

            this.elements.forEach(selector => {
                const els = document.querySelectorAll(selector);
                els.forEach(el => {
                    el.addEventListener('mouseenter', () => this.onElementEnter(el));
                    el.addEventListener('mouseleave', () => this.onElementLeave(el));
                });
            });
        }

        handleMouseMove(e) {
            this.targetX = e.clientX;
            this.targetY = e.clientY;

            if (!this.cursorVisible) {
                this.cursorVisible = true;
                this.cursor.style.opacity = '1';
            }
        }

        handleMouseEnter() {
            this.cursorVisible = true;
            this.cursor.style.opacity = '1';
        }

        handleMouseLeave() {
            this.cursorVisible = false;
            this.cursor.style.opacity = '0';
        }

        onElementEnter(el) {
            this.cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
            this.cursor.style.borderColor = '#b8923e';
        }

        onElementLeave(el) {
            this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            this.cursor.style.borderColor = 'rgba(184, 146, 62, 0.8)';
        }

        animate() {
            if (this.isDestroyed) return;

            this.currentX += (this.targetX - this.currentX) * this.sensitivity;
            this.currentY += (this.targetY - this.currentY) * this.sensitivity;

            this.cursor.style.left = `${this.currentX}px`;
            this.cursor.style.top = `${this.currentY}px`;

            this.animationFrame = requestAnimationFrame(this.animate.bind(this));
        }

        startAnimation() {
            if (this.animationFrame) return;
            this.animationFrame = requestAnimationFrame(this.animate.bind(this));
        }

        stopAnimation() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }

        show() {
            if (this.cursor) {
                this.cursor.style.opacity = '1';
                this.cursorVisible = true;
            }
        }

        hide() {
            if (this.cursor) {
                this.cursor.style.opacity = '0';
                this.cursorVisible = false;
            }
        }

        destroy() {
            this.isDestroyed = true;
            this.stopAnimation();
            if (this.cursor && this.cursor.parentNode) {
                this.cursor.parentNode.removeChild(this.cursor);
            }
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseenter', this.handleMouseEnter);
            document.removeEventListener('mouseleave', this.handleMouseLeave);
        }
    }

    class HoverEffect {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                type: options.type || 'glow',
                color: options.color || 'rgba(184, 146, 62, 0.5)',
                scale: options.scale || 1.05,
                duration: options.duration || 0.3
            };

            this.handleMouseEnter = this.handleMouseEnter.bind(this);
            this.handleMouseLeave = this.handleMouseLeave.bind(this);

            this.bind();
        }

        bind() {
            this.element.addEventListener('mouseenter', this.handleMouseEnter);
            this.element.addEventListener('mouseleave', this.handleMouseLeave);
        }

        handleMouseEnter(e) {
            this.element.style.transition = `all ${this.options.duration}s cubic-bezier(0.34, 1.56, 0.64, 1)`;

            switch (this.options.type) {
                case 'glow':
                    this.element.style.boxShadow = `0 0 30px ${this.options.color}, 0 20px 40px rgba(0, 0, 0, 0.3)`;
                    break;
                case 'scale':
                    this.element.style.transform = `scale(${this.options.scale})`;
                    this.element.style.boxShadow = `0 20px 40px rgba(0, 0, 0, 0.3)`;
                    break;
                case 'lift':
                    this.element.style.transform = `translateY(-5px)`;
                    this.element.style.boxShadow = `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px ${this.options.color}`;
                    break;
            }
        }

        handleMouseLeave() {
            this.element.style.boxShadow = '';
            this.element.style.transform = '';
        }

        destroy() {
            this.element.removeEventListener('mouseenter', this.handleMouseEnter);
            this.element.removeEventListener('mouseleave', this.handleMouseLeave);
        }
    }

    class ParallaxEffect {
        constructor(element, options = {}) {
            this.element = element;
            this.container = options.container || element.parentElement;
            this.sensitivity = options.sensitivity || DEFAULT_SENSITIVITY.parallax;
            this.scale = options.scale || 1.1;

            this.currentX = 0;
            this.currentY = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.animationFrame = null;

            this.handleMouseMove = this.handleMouseMove.bind(this);
            this.animate = this.animate.bind(this);

            this.bind();
        }

        bind() {
            if (this.container) {
                this.container.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            } else {
                document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            }
            this.startAnimation();
        }

        handleMouseMove(e) {
            const rect = this.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            this.targetX = (e.clientX - centerX) * this.sensitivity;
            this.targetY = (e.clientY - centerY) * this.sensitivity;
        }

        animate() {
            this.currentX += (this.targetX - this.currentX) * 0.1;
            this.currentY += (this.targetY - this.currentY) * 0.1;

            this.element.style.transform = `translate(${this.currentX}px, ${this.currentY}px) scale(${this.scale})`;

            this.animationFrame = requestAnimationFrame(this.animate);
        }

        startAnimation() {
            if (!this.animationFrame) {
                this.animationFrame = requestAnimationFrame(this.animate);
            }
        }

        destroy() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            if (this.container) {
                this.container.removeEventListener('mousemove', this.handleMouseMove);
            } else {
                document.removeEventListener('mousemove', this.handleMouseMove);
            }
        }
    }

    let initialized = false;
    let tiltCards = new Map();
    let cursorTracker = null;

    function init() {
        if (initialized) return;
        if (typeof DeviceDetector !== 'undefined' && DeviceDetector.isMobile()) {
            return;
        }

        initialized = true;

        const style = document.createElement('style');
        style.textContent = `
            .no-touch .custom-cursor {
                cursor: none;
            }
        `;
        document.head.appendChild(style);
    }

    function createTiltCard(element, options) {
        init();
        const tilt = new TiltCard(element, options);
        tiltCards.set(element, tilt);
        return tilt;
    }

    function destroyTiltCard(element) {
        if (tiltCards.has(element)) {
            tiltCards.get(element).destroy();
            tiltCards.delete(element);
        }
    }

    function initCursorTracker(options = {}) {
        init();
        if (cursorTracker) {
            cursorTracker.destroy();
        }
        cursorTracker = new CursorTracker(options);
        return cursorTracker;
    }

    function createHoverEffect(element, options) {
        init();
        return new HoverEffect(element, options);
    }

    function createParallaxEffect(element, options) {
        init();
        return new ParallaxEffect(element, options);
    }

    function addKeyboardShortcut(key, callback, modifiers = {}) {
        document.addEventListener('keydown', (e) => {
            const keyMatches = e.key.toLowerCase() === key.toLowerCase();
            const ctrlMatches = modifiers.ctrl ? (e.ctrlKey || e.metaKey) : true;
            const shiftMatches = modifiers.shift ? e.shiftKey : true;
            const altMatches = modifiers.alt ? e.altKey : true;

            if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
                e.preventDefault();
                callback(e);
            }
        });
    }

    return {
        init,
        TiltCard,
        CursorTracker,
        HoverEffect,
        ParallaxEffect,
        createTiltCard,
        destroyTiltCard,
        initCursorTracker,
        createHoverEffect,
        createParallaxEffect,
        addKeyboardShortcut,
        DEFAULT_SENSITIVITY
    };
})();

if (typeof window !== 'undefined') {
    window.MouseInteractions = MouseInteractions;
}