/**
 * 事件管理器
 * 优化事件监听器的内存管理，防止内存泄漏
 */
export class EventManager {
    constructor() {
        this.listeners = new Map(); // 存储所有事件监听器
        this.delegatedEvents = new Map(); // 存储委托事件
        this.abortController = new AbortController(); // 用于批量移除事件
    }

    /**
     * 添加事件监听器
     * @param {HTMLElement} element - 目标元素
     * @param {string} type - 事件类型
     * @param {Function} listener - 事件处理函数
     * @param {Object} options - 事件选项
     */
    addEventListener(element, type, listener, options = {}) {
        // 使用AbortController来管理事件生命周期
        const finalOptions = {
            ...options,
            signal: this.abortController.signal
        };

        element.addEventListener(type, listener, finalOptions);

        // 记录事件监听器以便后续管理
        const key = this.getListenerKey(element, type);
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push({ listener, options: finalOptions });
    }

    /**
     * 移除特定的事件监听器
     * @param {HTMLElement} element - 目标元素
     * @param {string} type - 事件类型
     * @param {Function} listener - 事件处理函数
     */
    removeEventListener(element, type, listener) {
        const key = this.getListenerKey(element, type);
        const listeners = this.listeners.get(key);
        
        if (listeners) {
            const index = listeners.findIndex(item => item.listener === listener);
            if (index !== -1) {
                const { options } = listeners[index];
                element.removeEventListener(type, listener, options);
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.listeners.delete(key);
                }
            }
        }
    }

    /**
     * 添加委托事件监听器
     * @param {HTMLElement} container - 容器元素
     * @param {string} type - 事件类型
     * @param {string} selector - 选择器
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 事件选项
     */
    addDelegatedListener(container, type, selector, handler, options = {}) {
        const delegatedHandler = (event) => {
            const target = event.target.closest(selector);
            if (target && container.contains(target)) {
                handler.call(target, event);
            }
        };

        this.addEventListener(container, type, delegatedHandler, options);

        // 记录委托事件
        const key = `${this.getListenerKey(container, type)}_${selector}`;
        this.delegatedEvents.set(key, {
            container,
            type,
            selector,
            handler,
            delegatedHandler
        });

        return key;
    }

    /**
     * 移除委托事件监听器
     * @param {string} key - 委托事件的键
     */
    removeDelegatedListener(key) {
        const delegatedEvent = this.delegatedEvents.get(key);
        if (delegatedEvent) {
            const { container, type, delegatedHandler } = delegatedEvent;
            this.removeEventListener(container, type, delegatedHandler);
            this.delegatedEvents.delete(key);
        }
    }

    /**
     * 生成监听器的唯一键
     * @param {HTMLElement} element - 目标元素
     * @param {string} type - 事件类型
     * @returns {string} 唯一键
     */
    getListenerKey(element, type) {
        if (!element._eventId) {
            element._eventId = Math.random().toString(36).substr(2, 9);
        }
        return `${element._eventId}_${type}`;
    }

    /**
     * 清理所有事件监听器
     */
    cleanup() {
        // 使用AbortController批量移除所有事件
        this.abortController.abort();
        
        // 清理记录
        this.listeners.clear();
        this.delegatedEvents.clear();
        
        // 创建新的AbortController
        this.abortController = new AbortController();
    }

    /**
     * 获取事件管理器统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        let totalListeners = 0;
        this.listeners.forEach(listeners => {
            totalListeners += listeners.length;
        });

        return {
            totalListeners,
            delegatedEvents: this.delegatedEvents.size,
            uniqueElements: this.listeners.size
        };
    }

    /**
     * 创建防抖事件处理器
     * @param {Function} handler - 原始处理器
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function} 防抖处理器
     */
    createDebouncedHandler(handler, delay = 300) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handler.apply(this, args), delay);
        };
    }

    /**
     * 创建节流事件处理器
     * @param {Function} handler - 原始处理器
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function} 节流处理器
     */
    createThrottledHandler(handler, delay = 100) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                handler.apply(this, args);
            }
        };
    }
}

/**
 * 扫雷游戏专用事件管理器
 */
export class MinesweeperEventManager extends EventManager {
    constructor() {
        super();
        this.gameEventKeys = new Set(); // 跟踪游戏相关的事件
    }

    /**
     * 添加游戏板事件监听器
     * @param {HTMLElement} board - 游戏板元素
     * @param {Object} handlers - 事件处理器对象
     */
    addBoardListeners(board, handlers) {
        const events = [
            { type: 'click', handler: handlers.onClick },
            { type: 'contextmenu', handler: handlers.onRightClick },
            { type: 'mousedown', handler: handlers.onMouseDown },
            { type: 'mouseup', handler: handlers.onMouseUp },
            { type: 'mouseleave', handler: handlers.onMouseLeave }
        ];

        events.forEach(({ type, handler }) => {
            if (handler) {
                const key = this.addDelegatedListener(board, type, '.cell', handler);
                this.gameEventKeys.add(key);
            }
        });

        // 添加触摸事件支持
        if (handlers.onTouchStart) {
            const touchKey = this.addDelegatedListener(board, 'touchstart', '.cell', 
                this.createThrottledHandler(handlers.onTouchStart, 50));
            this.gameEventKeys.add(touchKey);
        }
    }

    /**
     * 清理游戏相关事件
     */
    cleanupGameEvents() {
        this.gameEventKeys.forEach(key => {
            this.removeDelegatedListener(key);
        });
        this.gameEventKeys.clear();
    }

    /**
     * 添加窗口事件监听器
     * @param {Object} handlers - 事件处理器对象
     */
    addWindowListeners(handlers) {
        if (handlers.onResize) {
            this.addEventListener(window, 'resize', 
                this.createDebouncedHandler(handlers.onResize, 250));
        }

        if (handlers.onVisibilityChange) {
            this.addEventListener(document, 'visibilitychange', handlers.onVisibilityChange);
        }

        if (handlers.onBeforeUnload) {
            this.addEventListener(window, 'beforeunload', handlers.onBeforeUnload);
        }
    }
}

// 创建全局事件管理器实例
export const gameEventManager = new MinesweeperEventManager();