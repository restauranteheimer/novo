// ==================== GESTURES.JS ====================
let touchStartX = null;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});

document.addEventListener('touchend', (e) => {
    if (!touchStartX) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 80 && document.getElementById('dayModal').style.display === 'flex') {
        const checkboxes = document.querySelectorAll('#dayModalContent .day-item-checkbox');
        if (checkboxes.length > 0) {
            checkboxes[0].click();
            deleteSelectedItems();
        }
    }
    touchStartX = null;
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch(e.key.toLowerCase()) {
        case 'i': openNewTransaction(new Date(), 'income'); break;
        case 'e': openNewTransaction(new Date(), 'expense'); break;
        case 'r': openFullReport(); break;
        case 'm': document.getElementById('metaModal').style.display = 'flex'; break;
        default: break;
    }
});
