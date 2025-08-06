export class GameBoard {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cells = [];
        this.minePositions = new Set();
        this.cellCache = new WeakMap();
        this.adjacentCellsCache = new Map();
    }

    initializeBoard() {
        const fragment = document.createDocumentFragment();
        this.cells = Array(this.height).fill().map(() => Array(this.width).fill(null));

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const cell = this.createCell(row, col);
                this.cells[row][col] = cell;
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

    revealCell(row, col) {
        const cell = this.cells[row][col];
        if (cell.classList.contains("revealed") || cell.dataset.mark) return false;

        cell.classList.add("revealed");
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
    }
}
