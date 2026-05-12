// ==================== FINANCE.JS ====================
let items = [];
let editingItemId = null;
let userSettings = { meta: 0, contacts: [] };
let currentUser = null;

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

function formatDateKey(d) {
    let dd = new Date(d);
    return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
}

function parseLocalDate(str) {
    let [y,m,d] = str.split('-');
    return new Date(y, m-1, d);
}

function formatDateDisplay(d) {
    return new Date(d).toLocaleDateString('pt-BR');
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
}

async function saveToCloud() {
    if(!currentUser) return;
    await db.ref(`users/${currentUser.uid}/items`).set(items);
    await db.ref(`users/${currentUser.uid}/settings`).set(userSettings);
}

async function loadUserData(uid) {
    showLoading();
    try {
        const snapItems = await db.ref(`users/${uid}/items`).once('value');
        items = snapItems.val() || [];
        const snapSettings = await db.ref(`users/${uid}/settings`).once('value');
        const settings = snapSettings.val() || {};
        userSettings = { meta: settings.meta || 0, contacts: settings.contacts || [] };
        updateDescriptionDatalist();
        updateMetaUI();
        renderContacts();
        document.getElementById('syncStatus').textContent = `✅ ${items.length} itens carregados`;
        document.getElementById('syncStatus').classList.add('synced');
        refreshAllUI();
        if (typeof updatePredictionCard === 'function') updatePredictionCard();
    } catch(e) { console.error(e); }
    finally { hideLoading(); }
}

function getDescriptionSuggestions() {
    let freq = new Map();
    items.filter(i => i.type === 'income' || i.type === 'expense').forEach(t => freq.set(t.title, (freq.get(t.title)||0)+1));
    return Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(a=>a[0]).slice(0,10);
}

function updateDescriptionDatalist() {
    let dl = document.getElementById('descSuggestions');
    if(dl) {
        dl.innerHTML = '';
        getDescriptionSuggestions().forEach(d => {
            let opt = document.createElement('option');
            opt.value = d;
            dl.appendChild(opt);
        });
    }
}

function suggestAmountByDescription(desc) {
    let matches = items.filter(i => (i.type === 'income' || i.type === 'expense') && i.title === desc);
    if(matches.length) {
        let freq = new Map();
        matches.forEach(m => freq.set(m.amount, (freq.get(m.amount)||0)+1));
        let most = [...freq.entries()].sort((a,b)=>b[1]-a[1])[0][0];
        document.getElementById('amount').value = most;
    }
}

function updateMetaUI() {
    let meta = userSettings.meta || 0;
    document.getElementById('metaValueDisplay').innerHTML = `R$ ${meta.toFixed(2)}`;
    if(meta === 0) {
        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('metaStatus').innerHTML = 'Defina uma meta';
        return;
    }
    let gastos = getMonthStats().expense;
    let percent = Math.min(100, (gastos/meta)*100);
    document.getElementById('progressBar').style.width = `${percent}%`;
    document.getElementById('metaStatus').innerHTML = percent >= 100 ? '⚠️ Meta estourada' : `${percent.toFixed(0)}% da meta`;
}

function editMeta() {
    document.getElementById('metaModal').style.display = 'flex';
    document.getElementById('metaAmountInput').value = userSettings.meta;
}

function closeMetaModal() {
    document.getElementById('metaModal').style.display = 'none';
}

function saveMeta() {
    let v = parseFloat(document.getElementById('metaAmountInput').value);
    if(!isNaN(v) && v>=0) {
        userSettings.meta = v;
        if(currentUser) saveToCloud();
        updateMetaUI();
        closeMetaModal();
        if (typeof updatePredictionCard === 'function') updatePredictionCard();
    }
}

function getFinancialItemsForDate(d) {
    let key = formatDateKey(d);
    return items.filter(i => i.date === key && (i.type === 'income' || i.type === 'expense'));
}

function getItemsForDate(d) {
    return items.filter(i => i.date === formatDateKey(d));
}

function getDaySummary(d) {
    let inc=0, exp=0;
    getFinancialItemsForDate(d).forEach(i => {
        if(i.type === 'income') inc += i.amount;
        else exp += i.amount;
    });
    return { balance: inc-exp, income: inc, expense: exp };
}

function getWeekBalance(date) {
    let inc=0, exp=0, start=new Date(date);
    start.setDate(date.getDate()-date.getDay());
    for(let i=0;i<7;i++){
        let d=new Date(start);
        d.setDate(start.getDate()+i);
        getFinancialItemsForDate(d).forEach(i=>{
            if(i.type==='income') inc+=i.amount;
            else exp+=i.amount;
        });
    }
    return { balance: inc-exp, income: inc, expense: exp };
}

function getMonthStats() {
    let inc=0, exp=0, today=new Date();
    for(let d=1;d<=31;d++){
        let date=new Date(today.getFullYear(), today.getMonth(), d);
        if(date.getMonth()!==today.getMonth()) break;
        getFinancialItemsForDate(date).forEach(i=>{
            if(i.type==='income') inc+=i.amount;
            else exp+=i.amount;
        });
    }
    return { income: inc, expense: exp, balance: inc-exp };
}

function updateBalances() {
    let week = getWeekBalance(new Date());
    let month = getMonthStats();
    document.getElementById('mainBalance').innerHTML = `R$ ${month.balance.toFixed(2)}`;
    document.getElementById('monthIncome').innerHTML = `R$ ${month.income.toFixed(2)}`;
    document.getElementById('monthExpense').innerHTML = `R$ ${month.expense.toFixed(2)}`;
    document.getElementById('weekIncome').innerHTML = `R$ ${week.income.toFixed(2)}`;
    document.getElementById('weekExpense').innerHTML = `R$ ${week.expense.toFixed(2)}`;
    document.getElementById('totalExpense').innerHTML = `R$ ${week.expense.toFixed(2)}`;
    document.getElementById('totalIncome').innerHTML = `R$ ${week.income.toFixed(2)}`;
    document.getElementById('totalBalance').innerHTML = `R$ ${week.balance.toFixed(2)}`;
    updateMetaUI();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    editingItemId = null;
}

function saveData() {
    refreshAllUI();
    if(currentUser) saveToCloud();
}

function handleFinancialSubmit(e) {
    e.preventDefault();
    let dateInput = document.getElementById('transactionDate');
    let selectedDate = parseLocalDate(dateInput.value);
    let newTransaction = {
        id: editingItemId || Date.now(),
        type: document.getElementById('type').value,
        title: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        status: document.getElementById('status').value,
        date: formatDateKey(selectedDate)
    };
    if(editingItemId) {
        let idx = items.findIndex(i => i.id === editingItemId);
        if(idx !== -1) items[idx] = newTransaction;
        else items.push(newTransaction);
    } else {
        items.push(newTransaction);
    }
    saveData();
    closeModal();
    setTimeout(() => {
        if(confirm('Deseja enviar esta transação via WhatsApp?')) openWhatsAppModal(newTransaction);
    }, 100);
}

function openNewTransaction(date, presetType = null) {
    editingItemId = null;
    let targetDate = date || new Date();
    openModalWithDate(targetDate, 'financial');
    document.getElementById('financialForm').reset();
    if(presetType) document.getElementById('type').value = presetType;
    document.getElementById('modalTitle').innerHTML = 'Nova transação';
    document.getElementById('description').oninput = function() { suggestAmountByDescription(this.value); };
}

function openModalWithDate(date, tab) {
    document.getElementById('modalDateInfo').innerHTML = `<div class="date-selector"><span>📅 Data:</span><input type="date" id="transactionDate" value="${formatDateKey(date)}"></div>`;
    document.getElementById('modal').style.display = 'flex';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

function editTransaction(index) {
    let item = items[index];
    if(!item) return;
    editingItemId = item.id;
    let editDate = parseLocalDate(item.date);
    openModalWithDate(editDate, 'financial');
    document.getElementById('type').value = item.type;
    document.getElementById('description').value = item.title;
    document.getElementById('amount').value = item.amount;
    document.getElementById('status').value = item.status || 'pending';
    document.getElementById('modalTitle').innerHTML = 'Editar transação';
}

function repeatTransaction(index) {
    let original = items[index];
    if(!original) return;
    editingItemId = null;
    let today = new Date();
    openModalWithDate(today, 'financial');
    document.getElementById('type').value = original.type;
    document.getElementById('description').value = original.title;
    document.getElementById('amount').value = original.amount;
    document.getElementById('status').value = original.status || 'pending';
    document.getElementById('modalTitle').innerHTML = 'Repetir transação';
}

function deleteItem(index) {
    if(confirm('Excluir este item?')) {
        items.splice(index,1);
        saveData();
    }
}

function openFullReport() {
    let week = getWeekBalance(new Date()), month = getMonthStats();
    let total=0, rec=0, desp=0;
    items.filter(i=>i.type==='income'||i.type==='expense').forEach(i=>{
        if(i.type==='income'){ total+=i.amount; rec++; }
        else { total-=i.amount; desp++; }
    });
    let html = `<div><strong>📊 RESUMO COMPLETO</strong><br><div style="background:var(--primary-soft);padding:12px;border-radius:16px;margin-bottom:16px">💰 SALDO TOTAL: ${total>=0?'+':'-'} R$ ${Math.abs(total).toFixed(2)}</div><div>🟢 Receitas mês: R$ ${month.income.toFixed(2)} (${rec} transações)</div><div>🔴 Despesas mês: R$ ${month.expense.toFixed(2)} (${desp} transações)</div><div>📆 Semana: Saldo ${week.balance>=0?'+':'-'} R$ ${Math.abs(week.balance).toFixed(2)}</div></div>`;
    document.getElementById('reportModalContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function generateWeeklyReport() {
    let week = getWeekBalance(new Date());
    document.getElementById('reportModalContent').innerHTML = `<strong>📊 RELATÓRIO DA SEMANA</strong><br>Receitas: R$ ${week.income.toFixed(2)}<br>Despesas: R$ ${week.expense.toFixed(2)}<br>Saldo: ${week.balance>=0?'+':'-'} R$ ${Math.abs(week.balance).toFixed(2)}`;
    document.getElementById('reportModal').style.display = 'flex';
}

function generateMonthlyReport() {
    let month = getMonthStats();
    document.getElementById('reportModalContent').innerHTML = `<strong>📅 RELATÓRIO DO MÊS</strong><br>Receitas: R$ ${month.income.toFixed(2)}<br>Despesas: R$ ${month.expense.toFixed(2)}<br>Saldo: ${month.balance>=0?'+':'-'} R$ ${Math.abs(month.balance).toFixed(2)}`;
    document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

function showInsightsModal() {
    let monthStats = getMonthStats();
    let pending = items.filter(i=>(i.type==='income'||i.type==='expense')&&i.status==='pending').length;
    let html = `<div>💰 Saldo do mês: ${monthStats.balance>=0?'positivo':'negativo'} (R$ ${Math.abs(monthStats.balance).toFixed(2)})</div><div>${pending>0?`⏳ ${pending} transação(ões) pendente(s)`:'✅ Todas as transações estão em dia'}</div>`;
    document.getElementById('insightsModalContent').innerHTML = html;
    document.getElementById('insightsModal').style.display = 'flex';
}

function closeInsightsModal() {
    document.getElementById('insightsModal').style.display = 'none';
}
