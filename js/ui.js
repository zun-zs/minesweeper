export class MinesweeperUI {
    constructor(elements) {
        this.elements = elements;
        this.initUI();
    }

    initUI() {
        if (!this.elements.message) return;
        
        this.elements.message.addEventListener('transitionend', () => {
            if (!this.elements.message.classList.contains('visible')) {
                this.elements.message.style.display = 'none';
            }
        });
    }

    showMessage(text, isWin) {
        this.elements.message.style.display = 'block';
        this.elements.messageText.textContent = text;
        document.body.classList.remove('gameWon', 'gameLost');
        document.body.classList.add(isWin ? 'gameWon' : 'gameLost');
        
        requestAnimationFrame(() => {
            this.elements.message.classList.add('visible');
        });
    }

    hideMessage() {
        this.elements.message.classList.remove('visible');
    }

    updateBoard(width, height, cellSize) {
        requestAnimationFrame(() => {
            this.elements.board.style.setProperty('--board-width', width);
            this.elements.board.style.setProperty('--board-height', height);
            this.elements.board.style.setProperty('--cell-size', `${cellSize}px`);
        });
    }
}
