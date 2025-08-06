import { MinesweeperState } from './state.js';
import { MinesweeperUI } from './ui.js';
import { GameStorage } from './storage.js';
import { GameBoard } from './board.js';
import { GameTimer } from './timer.js';
import { DIFFICULTY_SETTINGS, MAX_BOARD_SIZE } from './constants.js';
import { debounce, validateBoardSize, validateMineCount } from './utils.js';

class Minesweeper {
    constructor() {
        if (!this.initializeElements()) {
            throw new Error('Failed to initialize game elements');
        }

        const defaultSettings = DIFFICULTY_SETTINGS.easy;
        this.state = new MinesweeperState(
            defaultSettings.width,
            defaultSettings.height,
            defaultSettings.mines
        );

        this.ui = new MinesweeperUI(this.elements);
        this.timer = new GameTimer(this.elements.timer);
        this.board = null;
        
        this.stats = {
            easy: { gamesPlayed: 0, wins: 0, bestTime: Infinity },
            medium: { gamesPlayed: 0, wins: 0, bestTime: Infinity },
            hard: { gamesPlayed: 0, wins: 0, bestTime: Infinity },
            custom: { gamesPlayed: 0, wins: 0, bestTime: Infinity }
        };

        const savedStats = GameStorage.loadStats();
        if (savedStats) {
            this.stats = savedStats;
        }

        this.initEventListeners();
        this.initBoard();
        this.updateStatsDisplay();
    }

    initializeElements() {
        try {
            const requiredElements = {
                board: "game-board",
                message: "message",
                messageText: "message-text",
                difficulty: "difficulty",
                customSettings: "custom-settings",
                customWidth: "custom-width",
                customHeight: "custom-height",
                customMines: "custom-mines",
                newGameButton: "new-game-button",
                timer: "timer",
                bestTime: "best-time",
                winRate: "win-rate"
            };

            this.elements = {};
            
            for (const [key, id] of Object.entries(requiredElements)) {
                const element = document.getElementById(id);
                if (!element) {
                    console.error(`Required element "${id}" not found`);
                    return false;
                }
                this.elements[key] = element;
            }

            return true;
        } catch (error) {
            console.error('Error initializing elements:', error);
            return false;
        }
    }

    initEventListeners() {
        if (this.elements.board) {
            this.elements.board.addEventListener('click', this.handleBoardClick.bind(this));
            this.elements.board.addEventListener('contextmenu', this.handleBoardRightClick.bind(this));
            this.elements.board.addEventListener('mousedown', this.handleBoardMouseDown.bind(this));
            this.elements.board.addEventListener('mouseup', this.handleBoardMouseUp.bind(this));
            // 移动端触控支持
            this.elements.board.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target && target.classList.contains('cell')) {
                    this.handleBoardClick({ target });
                }
            });
        }

        if (this.elements.difficulty) {
            this.elements.difficulty.addEventListener('change', () => {
                if (this.elements.customSettings) {
                    this.elements.customSettings.style.display = 
                        this.elements.difficulty.value === 'custom' ? 'block' : 'none';
                }
                this.updateStatsDisplay();
            });
        }

        if (this.elements.newGameButton) {
            this.elements.newGameButton.addEventListener('click', () => this.startNewGame());
        }
        // 重新开始按钮
        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.resetGame();
                this.initBoard();
            });
        }

        if (this.elements.customWidth) {
            this.elements.customWidth.addEventListener('change', () => this.validateCustomInputs());
        }
        if (this.elements.customMines) {
            this.elements.customMines.addEventListener('change', () => this.validateCustomInputs());
        }

        window.addEventListener('resize', debounce(() => {
            if (!this.state.gameOver) {
                this.resetGame();
                this.initBoard();
            }
        }, 250));
    }

    handleBoardClick(event) {
        const cell = event.target;
        if (!cell.classList.contains('cell')) return;
        if (this.state.gameOver) return;
        
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (this.state.firstClick) {
            this.board.placeMines(this.state.mineCount, row, col);
            this.state.firstClick = false;
            this.timer.start();
        }

        if (cell.dataset.mark) return;

        if (cell.dataset.mine === "true") {
            this.endGame(false);
        } else {
            const shouldRevealMore = this.board.revealCell(row, col);
            if (shouldRevealMore) {
                this.revealAdjacentCells(row, col);
            }
            this.checkWin();
        }
    }

    handleBoardRightClick(event) {
        event.preventDefault();
        const cell = event.target;
        if (!cell.classList.contains('cell') || this.state.gameOver) return;
        if (cell.classList.contains("revealed")) return;

        if (!cell.dataset.mark) {
            cell.dataset.mark = "flag";
            cell.textContent = "🚩";
        } else if (cell.dataset.mark === "flag") {
            cell.dataset.mark = "question";
            cell.textContent = "?";
        } else {
            cell.dataset.mark = "";
            cell.textContent = "";
        }
        this.checkWin();
    }

    handleBoardMouseDown(event) {
        const cell = event.target;
        if (!cell.classList.contains('cell') || this.state.gameOver) return;

        if (event.button === 0) this.state.leftMouseDown = true;
        if (event.button === 2) this.state.rightMouseDown = true;

        if (this.state.leftMouseDown && this.state.rightMouseDown) {
            this.handleDualButtonPress(cell);
        }
    }

    handleDualButtonPress(cell) {
        if (!this.isRevealedNumber(cell)) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const adjacentCells = this.board.getAdjacentCells(row, col);
        const flagCount = adjacentCells.filter(cell => cell.dataset.mark === "flag").length;

        if (flagCount === parseInt(cell.textContent)) {
            this.revealAdjacentCells(row, col);
        } else {
            this.highlightAdjacentCells(adjacentCells);
        }
    }

    handleBoardMouseUp(event) {
        if (event.button === 0) this.state.leftMouseDown = false;
        if (event.button === 2) this.state.rightMouseDown = false;

        const cell = event.target;
        if (this.isRevealedNumber(cell)) {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const adjacentCells = this.board.getAdjacentCells(row, col);
            adjacentCells.forEach(cell => cell.classList.remove("highlight"));
        }
    }

    isRevealedNumber(cell) {
        return cell.classList.contains("revealed") && 
               cell.textContent && 
               !["🚩", "?"].includes(cell.textContent);
    }

    highlightAdjacentCells(cells) {
        cells.forEach(cell => {
            if (!cell.classList.contains("revealed")) {
                cell.classList.add("highlight");
            }
        });
    }

    revealAdjacentCells(row, col) {
        const adjacentCells = this.board.getAdjacentCells(row, col);
        let hitMine = false;

        adjacentCells.forEach(cell => {
            if (!cell.classList.contains("revealed") && cell.dataset.mark !== "flag") {
                if (cell.dataset.mine === "true") {
                    hitMine = true;
                    return;
                }
                const cellRow = parseInt(cell.dataset.row);
                const cellCol = parseInt(cell.dataset.col);
                if (this.board.revealCell(cellRow, cellCol)) {
                    this.revealAdjacentCells(cellRow, cellCol);
                }
            }
        });

        if (hitMine) {
            this.endGame(false);
        } else {
            this.checkWin();
        }
    }

    startNewGame() {
        try {
            const settings = this.getDifficultySettings();
            this.state = new MinesweeperState(
                validateBoardSize(settings.width, MAX_BOARD_SIZE),
                validateBoardSize(settings.height, MAX_BOARD_SIZE),
                validateMineCount(settings.mines, settings.width * settings.height)
            );
            this.resetGame();
            this.initBoard();
        } catch (error) {
            console.error('Failed to start new game:', error);
            alert('游戏启动失败，请重试');
        }
    }

    resetGame() {
        this.timer.reset();
        this.elements.board.innerHTML = "";
        this.state.gameOver = false;
        this.state.firstClick = true;
        this.state.gameWon = false;
        document.body.classList.remove('gameWon', 'gameLost');
        this.elements.message.classList.remove("visible", "hidden");
        if (this.board) {
            this.board.reset();
        }
    }

    initBoard() {
        const maxBoardSize = Math.min(
            (window.innerHeight - 200),
            (window.innerWidth - 400)
        );
        const cellSize = Math.floor(Math.min(
            Math.min(
                maxBoardSize / this.state.boardWidth,
                maxBoardSize / this.state.boardHeight
            ),
            40
        ));

        this.board = new GameBoard(
            this.state.boardWidth, 
            this.state.boardHeight, 
            cellSize
        );

        this.ui.updateBoard(
            this.state.boardWidth, 
            this.state.boardHeight, 
            cellSize
        );

        this.elements.board.innerHTML = '';
        const fragment = this.board.initializeBoard();
        this.elements.board.appendChild(fragment);
    }

    getDifficultySettings() {
        const difficulty = this.elements.difficulty.value;
        if (difficulty === 'custom') {
            return {
                width: parseInt(this.elements.customWidth.value) || 9,
                height: parseInt(this.elements.customHeight.value) || 9,
                mines: parseInt(this.elements.customMines.value) || 10
            };
        }
        return DIFFICULTY_SETTINGS[difficulty];
    }

    validateCustomInputs() {
        if (this.elements.difficulty.value !== 'custom') return;

        const width = parseInt(this.elements.customWidth.value);
        const height = parseInt(this.elements.customHeight.value);
        
        const validWidth = validateBoardSize(width, MAX_BOARD_SIZE);
        const validHeight = validateBoardSize(height, MAX_BOARD_SIZE);
        
        const maxMines = validWidth * validHeight - 1;
        const currentMines = parseInt(this.elements.customMines.value);
        const validMines = validateMineCount(currentMines, maxMines);

        this.elements.customWidth.value = validWidth;
        this.elements.customHeight.value = validHeight;
        this.elements.customMines.value = validMines;
        this.elements.customMines.max = maxMines;

        if (width > MAX_BOARD_SIZE || height > MAX_BOARD_SIZE) {
            alert(`宽度和高度的最大值为${MAX_BOARD_SIZE}`);
        }
    }

    endGame(won) {
        this.timer.stop();
        this.state.gameOver = true;
        this.state.gameWon = won;
        
        // 显示所有地雷
        this.board.minePositions.forEach(position => {
            const [row, col] = position.split(",").map(Number);
            const cell = this.board.cells[row][col];
            cell.classList.add(won ? "mine-win" : "mine");
            cell.textContent = "💣";
        });
        
        if (won) {
            const currentTime = this.timer.getCurrentTime();
            this.updateStats(currentTime);
        } else {
            this.updateStats(null);
        }

        this.ui.showMessage(
            won ? "恭喜你，你赢了！" : "游戏结束！", 
            won
        );

        setTimeout(() => this.ui.hideMessage(), 3000);
    }

    checkWin() {
        if (this.state.gameWon) return;

        const revealedCount = this.board.cells.flat()
            .filter(cell => cell.classList.contains("revealed"))
            .length;

        if (revealedCount === this.state.boardWidth * this.state.boardHeight - this.state.mineCount) {
            this.endGame(true);
        }
    }

    updateStats(time) {
        const difficulty = this.elements.difficulty.value;
        const stats = this.stats[difficulty];
        
        if (!stats) return;

        stats.gamesPlayed++;
        if (this.state.gameWon && time !== null) {
            stats.wins++;
            if (time < stats.bestTime || stats.bestTime === Infinity) {
                stats.bestTime = time;
            }
        }

        GameStorage.saveStats(this.stats);
        requestAnimationFrame(() => this.updateStatsDisplay());
    }

    updateStatsDisplay() {
        if (!this.elements.bestTime || !this.elements.winRate) return;

        const difficulty = this.elements.difficulty.value;
        const stats = this.stats[difficulty];
        
        if (!stats) {
            this.elements.bestTime.textContent = '-';
            this.elements.winRate.textContent = '0%';
            return;
        }

        this.elements.bestTime.textContent = stats.bestTime === Infinity ? 
            '-' : 
            stats.bestTime.toString() + '秒';

        const winRate = stats.gamesPlayed > 0 ? 
            Math.round((stats.wins / stats.gamesPlayed) * 100) : 
            0;
        this.elements.winRate.textContent = `${winRate}%`;
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    try {
        new Minesweeper();
    } catch (error) {
        console.error('Game initialization failed:', error);
        alert('游戏初始化失败：请确保所有必需的HTML元素都存在。请刷新页面重试。');
    }
});
