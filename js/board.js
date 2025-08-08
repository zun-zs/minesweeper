import { cellPool } from './object-pool.js';

export class GameBoard {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cells = [];
        this.minePositions = new Set();
        this.cellCache = new WeakMap();
        this.adjacentCellsCache = new Map();
        this.pooledCells = []; // 跟踪从对象池获取的元素
    }

    initializeBoard() {
        // 性能优化：使用对象池复用DOM元素
        const fragment = document.createDocumentFragment();
        this.cells = Array(this.height).fill().map(() => Array(this.width).fill(null));
        this.pooledCells = [];

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                // 从对象池获取单元格元素
                const cell = cellPool.acquire();
                cellPool.configureCell(cell, row, col, false);
                
                this.cells[row][col] = cell;
                this.pooledCells.push(cell);
                fragment.appendChild(cell);
            }
        }

        return fragment;
    }

    createCell(row, col) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = row;
        cell.dataset.col = col;
        return cell;
    }

    placeMines(mineCount, excludeRow, excludeCol) {
        while (this.minePositions.size < mineCount) {
            const row = Math.floor(Math.random() * this.height);
            const col = Math.floor(Math.random() * this.width);
            const position = `${row},${col}`;

            if (!this.minePositions.has(position) &&
                (row !== excludeRow || col !== excludeCol)) {
                this.minePositions.add(position);
                this.cells[row][col].dataset.mine = "true";
            }
        }
    }

    getAdjacentCells(row, col) {
        const key = `${row},${col}`;
        if (this.adjacentCellsCache.has(key)) {
            return this.adjacentCellsCache.get(key);
        }

        const cells = [];
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newRow = row + i;
                const newCol = col + j;
                if (this.isValidCell(newRow, newCol)) {
                    cells.push(this.cells[newRow][newCol]);
                }
            }
        }
        this.adjacentCellsCache.set(key, cells);
        return cells;
    }

    isValidCell(row, col) {
        return row >= 0 && row < this.height &&
               col >= 0 && col < this.width;
    }

    countAdjacentMines(row, col) {
        return this.getAdjacentCells(row, col)
            .filter(cell => cell.dataset.mine === "true")
            .length;
    }

    revealCell(row, col, gameState = null) {
        const cell = this.cells[row][col];
        if (cell.classList.contains("revealed") || cell.dataset.mark) return false;

        cell.classList.add("revealed");
        
        // 性能优化：更新揭示计数
        if (gameState) {
            gameState.revealedCount++;
        }
        
        let mineCount = this.cellCache.get(cell);

        if (mineCount === undefined) {
            mineCount = this.countAdjacentMines(row, col);
            this.cellCache.set(cell, mineCount);
        }

        if (mineCount > 0) {
            cell.textContent = mineCount;
            cell.classList.add(`text-${mineCount}`);
        }

        return mineCount === 0;
    }

    reset() {
        this.minePositions.clear();
        this.adjacentCellsCache.clear();
        this.cellCache = new WeakMap();
        
        // 性能优化：将使用的单元格归还到对象池
        this.pooledCells.forEach(cell => {
            cellPool.release(cell);
        });
        this.pooledCells = [];
    }
}
