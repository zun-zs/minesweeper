import { MinesweeperState } from './state.js';
import { MinesweeperUI } from './ui.js';
import { GameStorage } from './storage.js';
import { GameBoard } from './board.js';
import { GameTimer } from './timer.js';
import { DIFFICULTY_SETTINGS, MAX_BOARD_SIZE } from './constants.js';
import { debounce, validateBoardSize, validateMineCount } from './utils.js';
import { performanceMonitor } from './performance.js';
import { gameEventManager } from './event-manager.js';
import { cellPool } from './object-pool.js';

class Minesweeper {
    constructor() {
        // 性能监控：测量游戏初始化时间
        performanceMonitor.measureTime(() => {
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
        }, 'gameInitTime');
        
        // 开始性能监控
         performanceMonitor.startMonitoring();
         
         // 开发者工具：添加全局性能监控和内存池访问
         if (typeof window !== 'undefined') {
             window.minesweeperPerf = {
                 getReport: () => performanceMonitor.getReport(),
                 logReport: () => performanceMonitor.logReport(),
                 reset: () => performanceMonitor.reset()
             };
             
             window.minesweeperMemory = {
                 getCellPoolStats: () => cellPool.getStats(),
                 getEventStats: () => gameEventManager.getStats(),
                 cleanup: () => {
                     gameEventManager.cleanup();
                     cellPool.destroy();
                 }
             };
         }
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
        // 性能优化：使用事件管理器统一管理事件监听器
        if (this.elements.board) {
            gameEventManager.addBoardListeners(this.elements.board, {
                onClick: this.handleBoardClick.bind(this),
                onRightClick: this.handleBoardRightClick.bind(this),
                onMouseDown: this.handleBoardMouseDown.bind(this),
                onMouseUp: this.handleBoardMouseUp.bind(this),
                onMouseLeave: this.handleBoardMouseUp.bind(this),
                onTouchStart: (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const element = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (element && element.classList.contains('cell')) {
                        this.handleBoardClick({ target: element });
                    }
                }
            });
        }

        if (this.elements.difficulty) {
            gameEventManager.addEventListener(this.elements.difficulty, 'change', () => {
                if (this.elements.customSettings) {
                    this.elements.customSettings.style.display = 
                        this.elements.difficulty.value === 'custom' ? 'block' : 'none';
                }
                this.updateStatsDisplay();
            });
        }

        if (this.elements.newGameButton) {
            gameEventManager.addEventListener(this.elements.newGameButton, 'click', () => this.startNewGame());
        }
        // 重新开始按钮
        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            gameEventManager.addEventListener(restartBtn, 'click', () => {
                this.resetGame();
                this.initBoard();
            });
        }

        // 自定义设置事件监听（使用防抖）
        if (this.elements.customWidth) {
            gameEventManager.addEventListener(this.elements.customWidth, 'input', 
                gameEventManager.createDebouncedHandler(this.validateCustomInputs.bind(this), 300));
        }
        if (this.elements.customHeight) {
            gameEventManager.addEventListener(this.elements.customHeight, 'input', 
                gameEventManager.createDebouncedHandler(this.validateCustomInputs.bind(this), 300));
        }
        if (this.elements.customMines) {
            gameEventManager.addEventListener(this.elements.customMines, 'input', 
                gameEventManager.createDebouncedHandler(this.validateCustomInputs.bind(this), 300));
        }

        // 窗口事件
        gameEventManager.addWindowListeners({
            onResize: () => {
                if (!this.state.gameOver) {
                    this.resetGame();
                    this.initBoard();
                }
            },
            onVisibilityChange: () => {
                // 页面隐藏时暂停计时器，显示时恢复
                if (document.hidden && this.timer && !this.state.gameOver) {
                    this.timer.stop();
                } else if (!document.hidden && this.timer && !this.state.gameOver && !this.state.firstClick) {
                    this.timer.start();
                }
            },
            onBeforeUnload: () => {
                // 页面卸载前保存游戏状态
                if (!this.state.gameOver) {
                    GameStorage.saveGameState(this.state);
                }
            }
        });
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
            // 性能监控：测量单元格揭示时间
            performanceMonitor.measureTime(() => {
                const shouldRevealMore = this.board.revealCell(row, col, this.state);
                if (shouldRevealMore) {
                    this.revealAdjacentCells(row, col);
                }
            }, 'cellRevealTime');
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
        // 性能优化：使用迭代代替递归，避免栈溢出
        const queue = [[row, col]];
        let hitMine = false;
        
        while (queue.length > 0 && !hitMine) {
            const [currentRow, currentCol] = queue.shift();
            const adjacentCells = this.board.getAdjacentCells(currentRow, currentCol);
            
            for (const cell of adjacentCells) {
                if (!cell.classList.contains("revealed") && cell.dataset.mark !== "flag") {
                    if (cell.dataset.mine === "true") {
                        hitMine = true;
                        break;
                    }
                    const cellRow = parseInt(cell.dataset.row);
                    const cellCol = parseInt(cell.dataset.col);
                    if (this.board.revealCell(cellRow, cellCol, this.state)) {
                        queue.push([cellRow, cellCol]);
                    }
                }
            }
        }

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
            
            // 性能监控：测量棋盘渲染时间
            performanceMonitor.measureTime(() => {
                this.initBoard();
            }, 'boardRenderTime');
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
        this.state.revealedCount = 0; // 性能优化：重置计数器
        document.body.classList.remove('gameWon', 'gameLost');
        this.elements.message.classList.remove("visible", "hidden");
        if (this.board) {
            this.board.reset(); // 这会自动归还单元格到对象池
        }
        
        // 清理游戏相关事件（保留UI事件）
        gameEventManager.cleanupGameEvents();
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

        // 性能优化：使用计数器而不是遍历所有单元格
        if (this.state.revealedCount === this.state.boardWidth * this.state.boardHeight - this.state.mineCount) {
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
