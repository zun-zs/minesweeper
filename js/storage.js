export class GameStorage {
    static saveGameState(state, minePositions, cells) {
        const gameState = {
            state: state,
            minePositions: Array.from(minePositions),
            revealed: cells.map(row => 
                row.map(cell => ({
                    isRevealed: cell.classList.contains('revealed'),
                    mark: cell.dataset.mark || '',
                    content: cell.textContent
                }))
            )
        };
        
        try {
            localStorage.setItem('minesweeper-state', JSON.stringify(gameState));
        } catch (e) {
            console.warn('Failed to save game state:', e);
        }
    }

    static loadGameState() {
        try {
            const savedState = localStorage.getItem('minesweeper-state');
            return savedState ? JSON.parse(savedState) : null;
        } catch (e) {
            console.warn('Failed to load game state:', e);
            return null;
        }
    }

    static saveStats(stats) {
        localStorage.setItem('minesweeper-stats', JSON.stringify(stats));
    }

    static loadStats() {
        const saved = localStorage.getItem('minesweeper-stats');
        return saved ? JSON.parse(saved) : null;
    }
}
