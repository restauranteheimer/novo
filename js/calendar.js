// ==================== CALENDAR.JS ====================
let currentMonth = new Date();

function renderWeekCalendar() {
    let today = new Date(), start = new Date(today);
    start.setDate(today.getDate()-today.getDay());
    let weekDays = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    let container = document.getElementById('weekDaysContainer');
    container.innerHTML = '';
    for(let i=0;i<7;i++){
        let d = new Date(start);
        d.setDate(start.getDate()+i);
        let sum = getDaySummary(d);
        let isToday = d.toDateString() === today.toDateString();
        let chip = document.createElement('div');
        chip.className = `day-chip ${isToday ? 'today' : ''}`;
        chip.onclick = () => showDayModal(d);
        chip.innerHTML = `<div class="day-name">${weekDays[i]}</div><div class="day-number">${d.getDate()}</div><div class="day-amount ${sum.balance>=0?'amount-positive':'amount-negative'}">${sum.balance>=0?'+':'-'}R$ ${Math.abs(sum.balance).toFixed(2)}</div>`;
        container.appendChild(chip);
    }
    document.getElementById('currentMonthLabel').innerHTML = today.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
}

function renderMonthCalendar() {
    let year = currentMonth.getFullYear(), month = currentMonth.getMonth();
    let firstDay = new Date(year,month,1), lastDay = new Date(year,month+1,0);
    let startDay = firstDay.getDay(), totalDays = lastDay.getDate(), today = new Date();
    document.getElementById('monthTitle').innerHTML = currentMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./, l=>l.toUpperCase());
    let grid = document.getElementById('monthGrid');
    grid.innerHTML = '';
    ['D','S','T','Q','Q','S','S'].forEach(day => {
        let h = document.createElement('div');
        h.className = 'weekday-header';
        h.textContent = day;
        grid.appendChild(h);
    });
    for(let i=0;i<startDay;i++){
        let e = document.createElement('div');
        e.className = 'month-day';
        e.style.background = 'transparent';
        e.style.cursor = 'default';
        grid.appendChild(e);
    }
    for(let day=1;day<=totalDays;day++){
        let d = new Date(year,month,day);
        let dayItems = getItemsForDate(d);
        let inc=0, exp=0, allPaid=true;
        dayItems.forEach(i=>{
            if(i.type==='income') inc+=i.amount;
            if(i.type==='expense') exp+=i.amount;
            if(i.status !== 'paid') allPaid=false;
        });
        let isToday = d.toDateString() === today.toDateString();
        let indicatorClass = '';
        if(inc>0 && exp>0) indicatorClass = 'has-both';
        else if(inc>0) indicatorClass = 'has-income';
        else if(exp>0) indicatorClass = 'has-expense';
        let hasApp = dayItems.some(i=>i.type==='appointment');
        let hasNote = dayItems.some(i=>i.type==='note');
        if(hasApp) indicatorClass += ' has-appointment';
        if(hasNote) indicatorClass += ' has-note';
        let dayDiv = document.createElement('div');
        dayDiv.className = `month-day ${isToday?'today':''} ${indicatorClass}`;
        let indicators = '';
        if(inc>0) indicators += `<span class="indicator-up ${allPaid?'paid':''}">↑${inc.toFixed(0)}</span>`;
        if(exp>0) indicators += `<span class="indicator-down ${allPaid?'paid':''}">↓${exp.toFixed(0)}</span>`;
        if(hasApp) indicators += `📅`;
        if(hasNote) indicators += `📝`;
        dayDiv.innerHTML = `<div class="day-number">${day}</div>${indicators?`<div class="day-indicators">${indicators}</div>`:''}`;
        dayDiv.onclick = () => showDayModal(d);
        grid.appendChild(dayDiv);
    }
}

function showDayModal(date) {
    currentDayModalDate = date;
    document.getElementById('dayModalTitle').innerHTML = formatDateDisplay(date);
    let container = document.getElementById('dayModalContent');
    container.innerHTML = '';
    let dayItems = getItemsForDate(date);
    if(dayItems.length === 0) container.innerHTML = '<div style="padding:16px;text-align:center;">Nenhum item neste dia</div>';
    else {
        dayItems.forEach(item => {
            let globalIndex = items.findIndex(i => i.id === item.id);
            let icon = item.type==='expense'?'💸':(item.type==='income'?'💰':(item.type==='appointment'?'📅':'📝'));
            let div = document.createElement('div');
            div.className = 'day-modal-item';
            div.innerHTML = `<input type="checkbox" class="day-item-checkbox" data-global-index="${globalIndex}" style="margin-right:8px;">
                             <div class="day-modal-icon">${icon}</div>
                             <div class="day-modal-info">
                                <div class="day-modal-title">${escapeHtml(item.title || (item.type==='appointment'?item.title:item.type))}</div>
                                <div class="day-modal-detail">${item.amount ? `R$ ${item.amount.toFixed(2)}` : ''} ${item.time ? `🕒 ${item.time}` : ''} ${item.location ? `📍 ${item.location}` : ''}</div>
                             </div>`;
            container.appendChild(div);
        });
    }
    document.getElementById('dayModal').style.display = 'flex';
}

function closeDayModal() {
    document.getElementById('dayModal').style.display = 'none';
    currentDayModalDate = null;
}

function openNewTransactionFromModal() {
    if(currentDayModalDate) openNewTransaction(currentDayModalDate);
    closeDayModal();
}

function deleteSelectedItems() {
    let checkboxes = document.querySelectorAll('#dayModalContent .day-item-checkbox:checked');
    if(checkboxes.length === 0) { alert('Nenhum item selecionado'); return; }
    if(!confirm(`Excluir ${checkboxes.length} item(ns) permanentemente?`)) return;
    let indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.globalIndex));
    indices.sort((a,b)=>b-a);
    for(let idx of indices) items.splice(idx,1);
    saveData();
    if(currentDayModalDate) showDayModal(currentDayModalDate);
    else closeDayModal();
}

function deleteAllData() {
    if(!confirm('⚠️ ATENÇÃO: isso apagará TODOS os dados (transações, compromissos, anotações). Digite "APAGAR" para confirmar.')) return;
    let confirmText = prompt('Digite APAGAR para confirmar a exclusão total:');
    if(confirmText !== 'APAGAR') { alert('Exclusão cancelada'); return; }
    items = [];
    if(currentUser) saveToCloud();
    refreshAllUI();
    alert('Todos os dados foram removidos.');
    if(currentDayModalDate) showDayModal(currentDayModalDate);
    else closeDayModal();
}

function prevMonth() {
    currentMonth.setMonth(currentMonth.getMonth()-1);
    renderMonthCalendar();
}

function nextMonth() {
    currentMonth.setMonth(currentMonth.getMonth()+1);
    renderMonthCalendar();
}

function refreshAllUI() {
    renderWeekCalendar();
    renderMonthCalendar();
    updateBalances();
    updateDescriptionDatalist();
    if (typeof updatePredictionCard === 'function') updatePredictionCard();
}
