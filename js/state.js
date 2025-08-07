export class MinesweeperState {
    constructor(width = 9, height = 9, mines = 10) {
        this.boardWidth = width;
        this.boardHeight = height;
        this.mineCount = mines;
        this.gameOver = false;
        this.firstClick = true;
        this.gameWon = false;
        this.leftMouseDown = false;
        this.rightMouseDown = false;
        this.revealedCount = 0; // 性能优化：维护已揭示单元格计数
    }
}
