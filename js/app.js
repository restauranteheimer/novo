// ============ VARIÁVEIS GLOBAIS ============
let currentUser = null;
let items = [];
let currentDate = new Date();
let selectedDate = null;
let weeklyChart = null;
let monthlyChart = null;
let currentWeekStart = new Date();

// ============ FUNÇÕES AUXILIARES ============
function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isCurrentWeek(date) {
    const today = new Date();
    const startWeek = new Date(today);
    startWeek.setDate(today.getDate() - today.getDay());
    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 6);
    return date >= startWeek && date <= endWeek;
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
}

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length === 12) return cleaned;
    if (cleaned.length === 11) return '55' + cleaned;
    if (cleaned.length === 10) return '55' + cleaned;
    return cleaned;
}

// ============ FUNÇÕES DO BANCO DE DADOS ============
async function loadUserData(uid) {
    if (!uid) return;
    showLoading();
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.textContent = '🔄 Carregando da nuvem...';
    statusDiv.className = 'sync-status syncing';
    try {
        const snapshot = await db.ref(`users/${uid}/items`).once('value');
        if (snapshot.exists()) {
            items = snapshot.val() || [];
            if (!Array.isArray(items)) items = [];
            statusDiv.textContent = `✅ ${items.length} itens carregados`;
        } else {
            items = [];
            statusDiv.textContent = '✅ Pronto para salvar!';
        }
        statusDiv.className = 'sync-status synced';
        renderCalendar();
        updateCharts();
        updateDayItemsList();
        updateMobileTotals();
        renderMobileWeek();
        updateUpcomingBills();
        updateEconomyAndComparison();
    } catch (error) {
        console.error('Erro:', error);
        statusDiv.textContent = '⚠️ Erro ao carregar: ' + error.message;
        statusDiv.className = 'sync-status';
    } finally {
        hideLoading();
    }
}

async function saveToCloud() {
    if (!currentUser) return;
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.textContent = '🔄 Salvando na nuvem...';
    statusDiv.className = 'sync-status syncing';
    try {
        await db.ref(`users/${currentUser.uid}/items`).set(items);
        statusDiv.textContent = '✅ Dados salvos na nuvem';
        statusDiv.className = 'sync-status synced';
        setTimeout(() => {
            if (currentUser) statusDiv.textContent = '✅ Sincronizado';
        }, 2000);
    } catch (error) {
        console.error('Erro:', error);
        statusDiv.textContent = '⚠️ Erro ao salvar: ' + error.message;
        statusDiv.className = 'sync-status';
    }
}

function saveData() {
    renderCalendar();
    updateCharts();
    updateDayItemsList();
    updateMobileTotals();
    renderMobileWeek();
    updateUpcomingBills();
    updateEconomyAndComparison();
    if (currentUser) saveToCloud();
}

// ============ FUNÇÕES DE DADOS ============
function getItemsForDate(date) {
    if (!date) return [];
    const dateKey = formatDateKey(date);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    return items.filter(item => {
        if (item.recurrence === 'unique') return item.date === dateKey;
        if (item.recurrence === 'weekly') return item.dayOfWeek === dayOfWeek;
        if (item.recurrence === 'monthly') return item.dayOfMonth === dayOfMonth;
        return false;
    });
}

function getMonthBalance(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    let totalIncome = 0, totalExpense = 0;
    for (let day = 1; day <= 31; day++) {
        const currentDateObj = new Date(year, month, day);
        if (currentDateObj.getMonth() !== month) break;
        getItemsForDate(currentDateObj).forEach(item => {
            if (item.type === 'income') totalIncome += item.amount;
            if (item.type === 'expense') totalExpense += item.amount;
        });
    }
    return totalIncome - totalExpense;
}

function getWeekBalance(date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    let totalIncome = 0, totalExpense = 0;
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        getItemsForDate(currentDay).forEach(item => {
            if (item.type === 'income') totalIncome += item.amount;
            if (item.type === 'expense') totalExpense += item.amount;
        });
    }
    return totalIncome - totalExpense;
}

function getLast4WeeksBalances() {
    const today = new Date();
    const balances = [], weekLabels = [];
    for (let i = 3; i >= 0; i--) {
        const weekDate = new Date(today);
        weekDate.setDate(today.getDate() - (i * 7));
        balances.push(getWeekBalance(weekDate));
        const weekStart = new Date(weekDate);
        weekStart.setDate(weekDate.getDate() - weekDate.getDay());
        weekLabels.push(`${weekStart.getDate()}/${weekStart.getMonth()+1}`);
    }
    return { balances, weekLabels };
}

function getLast6MonthsBalances() {
    const today = new Date();
    const balances = [], monthLabels = [];
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        balances.push(getMonthBalance(monthDate));
        monthLabels.push(monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    }
    return { balances, monthLabels };
}

// ============ ECONOMIA E COMPARAÇÃO ============
function updateEconomyAndComparison() {
    const currentMonthBalance = getMonthBalance(new Date());
    const lastMonthBalance = getMonthBalance(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    
    // Economia (baseado em despesas planejadas vs reais)
    const plannedExpenses = items.filter(i => i.type === 'expense' && i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
    const actualExpenses = items.filter(i => i.type === 'expense' && i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const economy = plannedExpenses - actualExpenses;
    
    const economyDiv = document.getElementById('economyValue');
    if (economyDiv) {
        economyDiv.innerHTML = economy >= 0 ? 
            `<div class="balance-positive">🎉 R$ ${economy.toFixed(2)} economizados</div>` :
            `<div class="balance-negative">⚠️ R$ ${Math.abs(economy).toFixed(2)} acima do orçamento</div>`;
    }
    
    // Comparação mês a mês
    const comparison = currentMonthBalance - lastMonthBalance;
    const comparisonDiv = document.getElementById('comparisonValue');
    if (comparisonDiv) {
        const percent = lastMonthBalance !== 0 ? (comparison / Math.abs(lastMonthBalance)) * 100 : comparison * 100;
        comparisonDiv.innerHTML = comparison >= 0 ?
            `<div class="balance-positive">▲ R$ ${comparison.toFixed(2)} (${percent.toFixed(1)}%) melhor que mês passado</div>` :
            `<div class="balance-negative">▼ R$ ${Math.abs(comparison).toFixed(2)} (${Math.abs(percent).toFixed(1)}%) pior que mês passado</div>`;
    }
}

// ============ CONTAS A VENCER ============
function updateUpcomingBills() {
    const today = new Date();
    const upcoming = [];
    
    for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dayItems = getItemsForDate(checkDate);
        dayItems.forEach(item => {
            if (item.type === 'expense' && item.status !== 'paid') {
                upcoming.push({
                    title: item.title,
                    amount: item.amount,
                    date: new Date(checkDate),
                    daysUntil: i
                });
            }
        });
    }
    
    const container = document.getElementById('upcomingList');
    if (!container) return;
    
    if (upcoming.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; text-align:center;">✨ Nenhuma conta a vencer nos próximos 7 dias</p>';
        return;
    }
    
    container.innerHTML = upcoming.map(bill => `
        <div class="upcoming-item">
            <div>
                <div class="upcoming-title">${bill.title}</div>
                <div class="upcoming-date">${bill.date.toLocaleDateString('pt-BR')} ${bill.daysUntil === 1 ? '(Amanhã!)' : `(em ${bill.daysUntil} dias)`}</div>
            </div>
            <div class="upcoming-amount">R$ ${bill.amount.toFixed(2)}</div>
        </div>
    `).join('');
}

// ============ MOBILE: SALDO E TOTAIS ============
function updateMobileTotals() {
    const totalExpense = items.filter(i => i.type === 'expense' && i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
    const totalIncome = items.filter(i => i.type === 'income' && i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
    const currentBalance = totalIncome - totalExpense;
    const monthBalance = getMonthBalance(new Date());
    
    const balanceEl = document.getElementById('mobileBalanceValue');
    const variationEl = document.getElementById('mobileVariation');
    const incomeEl = document.getElementById('mobileIncomeTotal');
    const expenseEl = document.getElementById('mobileExpenseTotal');
    
    if (balanceEl) balanceEl.textContent = `R$ ${currentBalance.toFixed(2)}`;
    if (variationEl) variationEl.textContent = `Saldo do mês: ${monthBalance >= 0 ? '+' : '-'} R$ ${Math.abs(monthBalance).toFixed(2)}`;
    if (incomeEl) incomeEl.textContent = `R$ ${totalIncome.toFixed(2)}`;
    if (expenseEl) expenseEl.textContent = `R$ ${totalExpense.toFixed(2)}`;
}

// ============ MOBILE: CALENDÁRIO SEMANAL ============
function renderMobileWeek() {
    const container = document.getElementById('mobileWeekGrid');
    if (!container) return;
    
    const weekDays = [];
    const startOfWeek = new Date(currentWeekStart);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        weekDays.push(day);
    }
    
    const weekRange = `${weekDays[0].toLocaleDateString('pt-BR')} - ${weekDays[6].toLocaleDateString('pt-BR')}`;
    const weekRangeEl = document.getElementById('weekRange');
    if (weekRangeEl) weekRangeEl.textContent = weekRange;
    
    container.innerHTML = weekDays.map(day => {
        const dayItems = getItemsForDate(day);
        const dayExpense = dayItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
        const dayIncome = dayItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
        const balance = dayIncome - dayExpense;
        const isTodayDate = isToday(day);
        
        return `
            <div class="mobile-week-day ${isTodayDate ? 'today' : ''}" onclick="openModal(new Date(${day.getFullYear()}, ${day.getMonth()}, ${day.getDate()}))">
                <div class="day-name">${day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div>
                <div class="day-number">${day.getDate()}</div>
                <div class="day-balance ${balance >= 0 ? 'positive' : 'negative'}">${balance >= 0 ? '+' : '-'}R$ ${Math.abs(balance).toFixed(0)}</div>
            </div>
        `;
    }).join('');
}

function previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderMobileWeek();
}

function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderMobileWeek();
}

function quickAddTransaction() {
    const today = new Date();
    openModal(today);
}

// ============ GRÁFICOS ============
function updateCharts() {
    const weeklyData = getLast4WeeksBalances();
    const monthlyData = getLast6MonthsBalances();
    
    if (weeklyChart) weeklyChart.destroy();
    if (monthlyChart) monthlyChart.destroy();
    
    const ctx1 = document.getElementById('weeklyChart');
    if (ctx1) {
        weeklyChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: weeklyData.weekLabels,
                datasets: [{ label: 'Saldo Semanal (R$)', data: weeklyData.balances, backgroundColor: weeklyData.balances.map(b => b >= 0 ? '#10b981' : '#ef4444'), borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    const ctx2 = document.getElementById('monthlyChart');
    if (ctx2) {
        monthlyChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: monthlyData.monthLabels,
                datasets: [{ label: 'Saldo Mensal (R$)', data: monthlyData.balances, backgroundColor: 'rgba(102,126,234,0.1)', borderColor: '#667eea', borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: monthlyData.balances.map(b => b >= 0 ? '#10b981' : '#ef4444'), pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5 }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    const weekBalance = getWeekBalance(new Date());
    const monthBalance = getMonthBalance(new Date());
    
    const weekDiv = document.getElementById('weekBalanceValue');
    if (weekDiv) weekDiv.innerHTML = `<div class="${weekBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${weekBalance >= 0 ? '▲' : '▼'} R$ ${Math.abs(weekBalance).toFixed(2)}</div>`;
    
    const weeklyAlert = document.getElementById('weeklyAlert');
    if (weeklyAlert) weeklyAlert.innerHTML = weekBalance < 0 ? '<div class="alert">⚠️ Alerta: Semana com saldo negativo!</div>' : '';
    
    const monthDiv = document.getElementById('monthBalanceValue');
    if (monthDiv) monthDiv.innerHTML = `<div class="${monthBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${monthBalance >= 0 ? '▲' : '▼'} R$ ${Math.abs(monthBalance).toFixed(2)}</div>`;
    
    const monthlyAlert = document.getElementById('monthlyAlert');
    if (monthlyAlert) monthlyAlert.innerHTML = monthBalance < 0 ? '<div class="alert">⚠️ Alerta: Mês com saldo negativo!</div>' : '';
}

// ============ RELATÓRIOS ============
function generateWeeklyReport() {
    const today = new Date();
    const weekBalance = getWeekBalance(today);
    const weekItems = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - today.getDay() + i);
        weekItems.push(...getItemsForDate(day));
    }
    const expenses = weekItems.filter(i => i.type === 'expense');
    const incomes = weekItems.filter(i => i.type === 'income');
    const appointments = weekItems.filter(i => i.type === 'appointment');
    
    let report = '<h4>📊 Relatório da Semana</h4>';
    const startWeek = new Date(today);
    startWeek.setDate(today.getDate() - today.getDay());
    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 6);
    report += `<p><strong>📅 Período:</strong> ${startWeek.toLocaleDateString()} a ${endWeek.toLocaleDateString()}</p>`;
    report += `<p><strong>💰 Saldo:</strong> ${weekBalance >= 0 ? '+' : '-'} R$ ${Math.abs(weekBalance).toFixed(2)}</p>`;
    report += `<p><strong>🟢 Receitas:</strong> R$ ${incomes.reduce((s, i) => s + i.amount, 0).toFixed(2)}</p>`;
    report += `<p><strong>🔴 Despesas:</strong> R$ ${expenses.reduce((s, i) => s + i.amount, 0).toFixed(2)}</p>`;
    report += `<p><strong>📅 Compromissos:</strong> ${appointments.length}</p>`;
    document.getElementById('reportContent').innerHTML = report;
}

function generateMonthlyReport() {
    const today = new Date();
    const monthBalance = getMonthBalance(today);
    const monthItems = [];
    for (let day = 1; day <= 31; day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        if (date.getMonth() !== today.getMonth()) break;
        monthItems.push(...getItemsForDate(date));
    }
    const expenses = monthItems.filter(i => i.type === 'expense');
    const incomes = monthItems.filter(i => i.type === 'income');
    const appointments = monthItems.filter(i => i.type === 'appointment');
    
    let report = '<h4>📈 Relatório do Mês</h4>';
    report += `<p><strong>📅 Mês:</strong> ${today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>`;
    report += `<p><strong>💰 Saldo:</strong> ${monthBalance >= 0 ? '+' : '-'} R$ ${Math.abs(monthBalance).toFixed(2)}</p>`;
    report += `<p><strong>🟢 Receitas:</strong> R$ ${incomes.reduce((s, i) => s + i.amount, 0).toFixed(2)}</p>`;
    report += `<p><strong>🔴 Despesas:</strong> R$ ${expenses.reduce((s, i) => s + i.amount, 0).toFixed(2)}</p>`;
    report += `<p><strong>📅 Compromissos:</strong> ${appointments.length}</p>`;
    document.getElementById('reportContent').innerHTML = report;
}

function generateComparisonReport() {
    const weeklyData = getLast4WeeksBalances();
    const monthlyData = getLast6MonthsBalances();
    let report = '<h4>📊 Relatório Comparativo</h4>';
    report += '<h5>📅 Últimas 4 Semanas:</h5>';
    weeklyData.weekLabels.forEach((label, i) => { report += `<p>📌 Semana ${label}: R$ ${weeklyData.balances[i].toFixed(2)}</p>`; });
    report += '<h5>📆 Últimos 6 Meses:</h5>';
    monthlyData.monthLabels.forEach((label, i) => { report += `<p>📌 ${label}: R$ ${monthlyData.balances[i].toFixed(2)}</p>`; });
    document.getElementById('reportContent').innerHTML = report;
}

// ============ CALENDÁRIO DESKTOP ============
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    document.getElementById('currentMonth').textContent = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('calendarGridDesktop');
    if (!grid) return;
    grid.innerHTML = `<div class="weekday">Dom</div><div class="weekday">Seg</div><div class="weekday">Ter</div><div class="weekday">Qua</div><div class="weekday">Qui</div><div class="weekday">Sex</div><div class="weekday">Sáb</div>`;
    
    for (let i = 0; i < startDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day';
        emptyDiv.style.background = '#f1f5f9';
        emptyDiv.style.opacity = '0.5';
        grid.appendChild(emptyDiv);
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dayItems = getItemsForDate(date);
        const weekBalance = getWeekBalance(date);
        const isNegativeWeek = weekBalance < 0;
        const inCurrentWeek = isCurrentWeek(date);
        const isTodayDate = isToday(date);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (isTodayDate) dayDiv.classList.add('today');
        else if (inCurrentWeek) dayDiv.classList.add('current-week');
        if (isNegativeWeek && !isTodayDate) dayDiv.classList.add('negative-week');
        
        const displayItems = dayItems.slice(0, 4);
        let itemsHtml = '';
        displayItems.forEach(item => {
            const isPaid = item.status === 'paid';
            const statusIcon = isPaid ? ' ✅' : '';
            const paidClass = isPaid ? 'paid' : '';
            
            if (item.type === 'expense') {
                itemsHtml += `<div class="day-expense ${paidClass}">🔴 ${item.title}: R$ ${item.amount.toFixed(2)}${statusIcon}</div>`;
            } else if (item.type === 'income') {
                itemsHtml += `<div class="day-income ${paidClass}">🟢 ${item.title}: R$ ${item.amount.toFixed(2)}${statusIcon}</div>`;
            } else if (item.type === 'appointment') {
                itemsHtml += `<div class="day-appointment">📅 ${item.title}${item.time ? ' - ' + item.time : ''}</div>`;
            } else if (item.type === 'note') {
                itemsHtml += `<div class="day-note">📝 ${item.title}</div>`;
            }
        });
        
        dayDiv.innerHTML = `<div class="day-number">${day}</div>${itemsHtml}`;
        dayDiv.onclick = (function(d) { return function() { openModal(d); }; })(date);
        grid.appendChild(dayDiv);
    }
    updateCharts();
}

// ============ LISTA DE ITENS DO DIA ============
function updateDayItemsList() {
    const listDiv = document.getElementById('dayItemsList');
    const dateDisplay = document.getElementById('selectedDateDisplay');
    if (!selectedDate) {
        if (dateDisplay) dateDisplay.innerHTML = '';
        if (listDiv) listDiv.innerHTML = '<p style="text-align:center; color:#94a3b8;">📌 Clique em um dia</p>';
        return;
    }
    if (dateDisplay) dateDisplay.innerHTML = `<div class="selected-date">📅 ${selectedDate.toLocaleDateString('pt-BR')}</div>`;
    const dayItems = getItemsForDate(selectedDate);
    if (dayItems.length === 0) {
        if (listDiv) listDiv.innerHTML = '<p style="text-align:center; color:#94a3b8;">✨ Nenhum item</p>';
        return;
    }
    if (!listDiv) return;
    listDiv.innerHTML = '';
    dayItems.forEach(item => {
        const globalIndex = items.findIndex(i => i.id === item.id);
        const isPaid = item.status === 'paid';
        const itemDiv = document.createElement('div');
        let className = '', icon = '', details = '';
        
        if (item.type === 'expense') {
            className = `expense ${isPaid ? 'paid' : ''}`;
            icon = isPaid ? '✅' : '🔴';
            details = `Valor: R$ ${item.amount.toFixed(2)}`;
            if (isPaid) details += ` - Pago em ${new Date(item.paidDate).toLocaleDateString('pt-BR')}`;
            else details += ` - ⏳ Pendente`;
        } else if (item.type === 'income') {
            className = `income ${isPaid ? 'paid' : ''}`;
            icon = isPaid ? '✅' : '🟢';
            details = `Valor: R$ ${item.amount.toFixed(2)}`;
            if (isPaid) details += ` - Recebido em ${new Date(item.paidDate).toLocaleDateString('pt-BR')}`;
            else details += ` - ⏳ Pendente`;
        } else if (item.type === 'appointment') {
            className = 'appointment';
            icon = '📅';
            details = `${item.time || ''} ${item.location || ''}`;
        } else {
            className = 'note';
            icon = '📝';
            details = item.content ? item.content.substring(0, 50) : '';
        }
        
        itemDiv.className = `item-card ${className}`;
        itemDiv.innerHTML = `
            <div class="item-info">
                <div class="item-title">${icon} ${item.title}</div>
                <div class="item-details">${details}</div>
            </div>
            <div>
                ${!isPaid && (item.type === 'expense' || item.type === 'income') ? `<button class="mark-paid-btn" onclick="markAsPaid(${globalIndex})">✅ Marcar como ${item.type === 'expense' ? 'Pago' : 'Recebido'}</button>` : ''}
                <button class="edit-btn" onclick="editItem(${globalIndex})">✏️</button>
                <button class="delete-btn" onclick="deleteItem(${globalIndex})">🗑️</button>
            </div>
        `;
        listDiv.appendChild(itemDiv);
    });
}

// ============ MODAL ============
function openModal(date) {
    selectedDate = new Date(date);
    const modalDate = document.getElementById('modalDate');
    if (modalDate) modalDate.textContent = selectedDate.toLocaleDateString('pt-BR');
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
    
    const financialForm = document.getElementById('financialForm');
    const appointmentForm = document.getElementById('appointmentForm');
    const noteForm = document.getElementById('noteForm');
    if (financialForm) financialForm.reset();
    if (appointmentForm) appointmentForm.reset();
    if (noteForm) noteForm.reset();
    
    const dayOfWeekGroup = document.getElementById('dayOfWeekGroup');
    const dayOfMonthGroup = document.getElementById('dayOfMonthGroup');
    if (dayOfWeekGroup) dayOfWeekGroup.style.display = 'none';
    if (dayOfMonthGroup) dayOfMonthGroup.style.display = 'none';
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
    updateDayItemsList();
}

function openGoogleMaps() {
    const loc = document.getElementById('appointmentLocation').value;
    if (loc && loc.trim()) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`, '_blank');
    } else {
        alert('📍 Digite um local primeiro!');
    }
}

// ============ CRUD ============
async function markAsPaid(index) {
    const item = items[index];
    if (!item) return;
    
    if (confirm(`✅ Confirmar ${item.type === 'expense' ? 'pagamento' : 'recebimento'} de "${item.title}" (R$ ${item.amount.toFixed(2)})?`)) {
        item.status = 'paid';
        item.paidDate = new Date().toISOString();
        items[index] = item;
        saveData();
        alert(`✅ ${item.type === 'expense' ? 'Pagamento' : 'Recebimento'} registrado com sucesso!`);
    }
}

function editItem(index) {
    const item = items[index];
    if (!item) return;
    selectedDate = new Date(item.date);
    openModal(selectedDate);
    setTimeout(() => {
        if (item.type === 'expense' || item.type === 'income') {
            const financialTab = document.querySelector('[data-tab="financial"]');
            if (financialTab) financialTab.click();
            
            const typeSelect = document.getElementById('type');
            const descriptionInput = document.getElementById('description');
            const amountInput = document.getElementById('amount');
            const statusSelect = document.getElementById('status');
            const recurrenceSelect = document.getElementById('recurrence');
            
            if (typeSelect) typeSelect.value = item.type;
            if (descriptionInput) descriptionInput.value = item.title;
            if (amountInput) amountInput.value = item.amount;
            if (statusSelect) statusSelect.value = item.status || 'pending';
            if (recurrenceSelect) recurrenceSelect.value = item.recurrence;
            
            if (item.recurrence === 'weekly') {
                const dayOfWeekGroup = document.getElementById('dayOfWeekGroup');
                const dayOfWeekSelect = document.getElementById('dayOfWeek');
                if (dayOfWeekGroup) dayOfWeekGroup.style.display = 'block';
                if (dayOfWeekSelect) dayOfWeekSelect.value = item.dayOfWeek;
            }
            if (item.recurrence === 'monthly') {
                const dayOfMonthGroup = document.getElementById('dayOfMonthGroup');
                const dayOfMonthInput = document.getElementById('dayOfMonth');
                if (dayOfMonthGroup) dayOfMonthGroup.style.display = 'block';
                if (dayOfMonthInput) dayOfMonthInput.value = item.dayOfMonth;
            }
            items.splice(index, 1);
            saveData();
        } else if (item.type === 'appointment') {
            const appointmentTab = document.querySelector('[data-tab="appointment"]');
            if (appointmentTab) appointmentTab.click();
            
            const titleInput = document.getElementById('appointmentTitle');
            const timeInput = document.getElementById('appointmentTime');
            const locationInput = document.getElementById('appointmentLocation');
            const descriptionInput = document.getElementById('appointmentDescription');
            const recurrenceSelect = document.getElementById('appointmentRecurrence');
            
            if (titleInput) titleInput.value = item.title;
            if (timeInput) timeInput.value = item.time || '';
            if (locationInput) locationInput.value = item.location || '';
            if (descriptionInput) descriptionInput.value = item.description || '';
            if (recurrenceSelect) recurrenceSelect.value = item.recurrence;
            items.splice(index, 1);
            saveData();
        } else if (item.type === 'note') {
            const noteTab = document.querySelector('[data-tab="note"]');
            if (noteTab) noteTab.click();
            
            const titleInput = document.getElementById('noteTitle');
            const contentInput = document.getElementById('noteContent');
            const colorSelect = document.getElementById('noteColor');
            
            if (titleInput) titleInput.value = item.title;
            if (contentInput) contentInput.value = item.content || '';
            if (colorSelect) colorSelect.value = item.color || '#f59e0b';
            items.splice(index, 1);
            saveData();
        }
    }, 100);
}

function deleteItem(index) {
    if (confirm('🗑️ Excluir permanentemente?')) {
        items.splice(index, 1);
        saveData();
    }
}

// ============ AUTENTICAÇÃO ============
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('⚠️ Preencha o email e a senha!');
        return;
    }

    showLoading();

    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert('✅ Login realizado com sucesso!');
    } catch (error) {
        let mensagem = '';

        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            mensagem = '❌ Email ou senha incorretos!';
        } else if (error.code === 'auth/invalid-email') {
            mensagem = '❌ Email inválido!';
        } else if (error.code === 'auth/too-many-requests') {
            mensagem = '⚠️ Muitas tentativas. Tente novamente mais tarde.';
        } else if (error.code === 'auth/network-request-failed') {
            mensagem = '🌐 Erro de conexão. Verifique sua internet.';
        } else {
            mensagem = '❌ Não foi possível entrar. Tente novamente.';
        }

        alert(mensagem);
    } finally {
        hideLoading();
    }
}

async function signup() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password || password.length < 6) { 
        alert('Email e senha (mínimo 6 caracteres) obrigatórios!'); 
        return; 
    }
    showLoading();
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        alert('✅ Conta criada! Faça login.');
    } catch (error) { 
        alert('❌ Erro: ' + error.message); 
    }
    finally { 
        hideLoading(); 
    }
}

async function logout() {
    showLoading();
    try { 
        await auth.signOut(); 
    }
    catch (error) { 
        alert('Erro ao sair: ' + error.message); 
    }
    finally { 
        hideLoading(); 
    }
}

// ============ NOTIFICAÇÕES WHATSAPP ============
function sendNotification() {
    let phone = document.getElementById('
