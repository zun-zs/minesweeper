export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function validateBoardSize(size, maxSize) {
    return Math.max(5, Math.min(size, maxSize));
}

export function validateMineCount(count, maxCount) {
    return Math.max(1, Math.min(count, maxCount - 1));
}
