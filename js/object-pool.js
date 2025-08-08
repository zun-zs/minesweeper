/**
 * DOM元素对象池
 * 用于复用DOM元素，减少创建和销毁的开销
 */
export class DOMElementPool {
    constructor(elementType = 'div', initialSize = 50) {
        this.elementType = elementType;
        this.pool = [];
        this.activeElements = new Set();
        this.eventListeners = new WeakMap();
        
        // 预创建初始元素
        this.preAllocate(initialSize);
    }

    /**
     * 预分配指定数量的元素
     * @param {number} size - 预分配的元素数量
     */
    preAllocate(size) {
        for (let i = 0; i < size; i++) {
            const element = this.createElement();
            this.pool.push(element);
        }
    }

    /**
     * 创建新的DOM元素
     * @returns {HTMLElement} 新创建的元素
     */
    createElement() {
        const element = document.createElement(this.elementType);
        // 添加标识，便于调试
        element.dataset.pooled = 'true';
        return element;
    }

    /**
     * 从对象池获取元素
     * @returns {HTMLElement} 可用的DOM元素
     */
    acquire() {
        let element;
        
        if (this.pool.length > 0) {
            element = this.pool.pop();
        } else {
            // 池中没有可用元素，创建新的
            element = this.createElement();
        }
        
        this.activeElements.add(element);
        this.resetElement(element);
        return element;
    }

    /**
     * 将元素归还到对象池
     * @param {HTMLElement} element - 要归还的元素
     */
    release(element) {
        if (!this.activeElements.has(element)) {
            console.warn('试图释放不属于此对象池的元素');
            return;
        }
        
        this.activeElements.delete(element);
        this.cleanupElement(element);
        this.pool.push(element);
    }

    /**
     * 重置元素到初始状态
     * @param {HTMLElement} element - 要重置的元素
     */
    resetElement(element) {
        // 清除所有类名
        element.className = '';
        
        // 清除内容
        element.textContent = '';
        
        // 清除内联样式
        element.removeAttribute('style');
        
        // 清除数据属性（保留pooled标识）
        const pooled = element.dataset.pooled;
        for (const key in element.dataset) {
            if (key !== 'pooled') {
                delete element.dataset[key];
            }
        }
        element.dataset.pooled = pooled;
        
        // 从DOM中移除（如果已添加）
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * 清理元素，移除事件监听器
     * @param {HTMLElement} element - 要清理的元素
     */
    cleanupElement(element) {
        // 移除所有事件监听器
        const listeners = this.eventListeners.get(element);
        if (listeners) {
            listeners.forEach(({ type, listener, options }) => {
                element.removeEventListener(type, listener, options);
            });
            this.eventListeners.delete(element);
        }
        
        this.resetElement(element);
    }

    /**
     * 为元素添加事件监听器（带自动清理）
     * @param {HTMLElement} element - 目标元素
     * @param {string} type - 事件类型
     * @param {Function} listener - 事件处理函数
     * @param {Object} options - 事件选项
     */
    addEventListener(element, type, listener, options = false) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        
        const listeners = this.eventListeners.get(element);
        listeners.push({ type, listener, options });
        
        element.addEventListener(type, listener, options);
    }

    /**
     * 获取对象池统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            poolSize: this.pool.length,
            activeElements: this.activeElements.size,
            totalElements: this.pool.length + this.activeElements.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * 估算内存使用量（KB）
     * @returns {number} 估算的内存使用量
     */
    estimateMemoryUsage() {
        const totalElements = this.pool.length + this.activeElements.size;
        // 每个DOM元素大约占用1-2KB内存
        return Math.round(totalElements * 1.5);
    }

    /**
     * 清理对象池，释放所有元素
     */
    destroy() {
        // 清理活跃元素
        this.activeElements.forEach(element => {
            this.cleanupElement(element);
        });
        this.activeElements.clear();
        
        // 清理池中元素
        this.pool.forEach(element => {
            this.cleanupElement(element);
        });
        this.pool.length = 0;
        
        this.eventListeners = new WeakMap();
    }
}

/**
 * 扫雷游戏专用的单元格对象池
 */
export class CellElementPool extends DOMElementPool {
    constructor(initialSize = 100) {
        super('div', initialSize);
    }

    /**
     * 创建单元格元素
     * @returns {HTMLElement} 单元格元素
     */
    createElement() {
        const cell = super.createElement();
        cell.className = 'cell';
        return cell;
    }

    /**
     * 配置单元格
     * @param {HTMLElement} cell - 单元格元素
     * @param {number} row - 行索引
     * @param {number} col - 列索引
     * @param {boolean} isMine - 是否为地雷
     * @returns {HTMLElement} 配置好的单元格
     */
    configureCell(cell, row, col, isMine = false) {
        cell.className = 'cell';
        cell.dataset.row = row.toString();
        cell.dataset.col = col.toString();
        cell.dataset.mine = isMine.toString();
        
        return cell;
    }

    /**
     * 重置单元格到初始状态
     * @param {HTMLElement} cell - 要重置的单元格
     */
    resetElement(cell) {
        super.resetElement(cell);
        cell.className = 'cell';
    }
}

// 创建全局单元格对象池实例
export const cellPool = new CellElementPool();