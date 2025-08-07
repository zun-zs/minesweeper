export class GameTimer {
    constructor(element) {
        this.element = element;
        this.animationId = null;
        this.startTime = 0;
        this.lastDisplayedSeconds = -1;
    }

    start() {
        if (this.animationId) return;
        this.startTime = Date.now();
        this.lastDisplayedSeconds = -1;
        this.update();
        
        // 使用requestAnimationFrame代替setInterval
        const updateTimer = () => {
            if (!this.animationId) return;
            
            const currentSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            
            // 只在秒数变化时更新DOM，减少重绘
            if (currentSeconds !== this.lastDisplayedSeconds) {
                this.lastDisplayedSeconds = currentSeconds;
                this.update();
            }
            
            this.animationId = requestAnimationFrame(updateTimer);
        };
        
        this.animationId = requestAnimationFrame(updateTimer);
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.stop();
        this.element.textContent = '000';
    }

    update() {
        const seconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.element.textContent = seconds.toString().padStart(3, '0');
    }

    getCurrentTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
}
