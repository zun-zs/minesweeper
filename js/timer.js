export class GameTimer {
    constructor(element) {
        this.element = element;
        this.timer = null;
        this.startTime = 0;
        this.lastUpdate = 0;
    }

    start() {
        if (this.timer) return;
        this.startTime = Date.now();
        this.lastUpdate = this.startTime;
        this.update();
        this.timer = setInterval(() => {
            const now = Date.now();
            const drift = now - this.lastUpdate - 1000;
            if (Math.abs(drift) > 100) {
                this.update();
            }
            this.lastUpdate = now;
            this.update();
        }, 1000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
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
