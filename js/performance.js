/**
 * 性能监控工具
 * 用于跟踪和优化扫雷游戏的性能指标
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            gameInitTime: 0,
            boardRenderTime: 0,
            cellRevealTime: 0,
            memoryUsage: 0,
            frameRate: 0
        };
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.isMonitoring = false;
    }

    /**
     * 开始性能监控
     */
    startMonitoring() {
        this.isMonitoring = true;
        this.monitorFrameRate();
        this.monitorMemoryUsage();
    }

    /**
     * 停止性能监控
     */
    stopMonitoring() {
        this.isMonitoring = false;
    }

    /**
     * 测量函数执行时间
     * @param {Function} fn - 要测量的函数
     * @param {string} metricName - 指标名称
     * @returns {*} 函数执行结果
     */
    measureTime(fn, metricName) {
        const startTime = performance.now();
        const result = fn();
        const endTime = performance.now();
        this.metrics[metricName] = endTime - startTime;
        return result;
    }

    /**
     * 测量异步函数执行时间
     * @param {Function} fn - 要测量的异步函数
     * @param {string} metricName - 指标名称
     * @returns {Promise<*>} 函数执行结果
     */
    async measureTimeAsync(fn, metricName) {
        const startTime = performance.now();
        const result = await fn();
        const endTime = performance.now();
        this.metrics[metricName] = endTime - startTime;
        return result;
    }

    /**
     * 监控帧率
     */
    monitorFrameRate() {
        if (!this.isMonitoring) return;

        const currentTime = performance.now();
        this.frameCount++;

        if (currentTime - this.lastFrameTime >= 1000) {
            this.metrics.frameRate = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }

        requestAnimationFrame(() => this.monitorFrameRate());
    }

    /**
     * 监控内存使用情况
     */
    monitorMemoryUsage() {
        if (!this.isMonitoring) return;

        if (performance.memory) {
            this.metrics.memoryUsage = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }

        setTimeout(() => this.monitorMemoryUsage(), 1000);
    }

    /**
     * 获取性能报告
     * @returns {Object} 性能指标对象
     */
    getReport() {
        const report = {
            ...this.metrics,
            timestamp: new Date().toISOString()
        };
        
        // 添加内存池和事件管理器统计
        if (typeof window !== 'undefined' && window.minesweeperMemory) {
            try {
                report.memoryPool = window.minesweeperMemory.getCellPoolStats();
                report.eventManager = window.minesweeperMemory.getEventStats();
            } catch (e) {
                // 忽略错误，可能是模块还未初始化
            }
        }
        
        return report;
    }

    /**
     * 打印性能报告到控制台
     */
    logReport() {
        const report = this.getReport();
        console.group('🚀 扫雷游戏性能报告');
        
        // 性能指标
        console.group('⏱️ 性能指标');
        console.log('游戏初始化时间:', report.gameInitTime.toFixed(2), 'ms');
        console.log('棋盘渲染时间:', report.boardRenderTime.toFixed(2), 'ms');
        console.log('单元格揭示时间:', report.cellRevealTime.toFixed(2), 'ms');
        console.log('当前帧率:', report.frameRate, 'fps');
        console.groupEnd();
        
        // 内存使用
        if (report.memoryUsage) {
            console.group('💾 内存使用');
            console.log('JS堆内存:', `${report.memoryUsage.used}MB / ${report.memoryUsage.total}MB`);
            console.log('内存限制:', `${report.memoryUsage.limit}MB`);
            console.groupEnd();
        }
        
        // 对象池统计
        if (report.memoryPool) {
            console.group('🔄 对象池统计');
            console.log('池中可用元素:', report.memoryPool.poolSize);
            console.log('活跃元素:', report.memoryPool.activeElements);
            console.log('总元素数:', report.memoryPool.totalElements);
            console.log('估算内存使用:', report.memoryPool.memoryUsage, 'KB');
            console.groupEnd();
        }
        
        // 事件管理器统计
        if (report.eventManager) {
            console.group('🎯 事件管理器统计');
            console.log('总事件监听器:', report.eventManager.totalListeners);
            console.log('委托事件:', report.eventManager.delegatedEvents);
            console.log('监听元素数:', report.eventManager.uniqueElements);
            console.groupEnd();
        }
        
        console.groupEnd();
    }

    /**
     * 重置所有指标
     */
    reset() {
        this.metrics = {
            gameInitTime: 0,
            boardRenderTime: 0,
            cellRevealTime: 0,
            memoryUsage: 0,
            frameRate: 0
        };
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
    }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();