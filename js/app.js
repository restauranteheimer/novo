// Variáveis globais
let currentUser = null;
let items = [];
let selectedDate = new Date();
let currentMonth = new Date();
let editingItemId = null;

// ========== FUNÇÕES AUXILIARES ==========
function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }
function formatDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function formatDateDisplay(date) { return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function getWeekRange() { const today=new Date(), start=new Date(today); start.setDate(today.getDate()-today.getDay()); const end=new Date(start); end.setDate(start.getDate()+6); return `${start.getDate()}/${start.getMonth()+1} a ${end.getDate()}/${end.getMonth()+1}`; }

// ========== FIREBASE ==========
async function saveToCloud() { if(!currentUser) return; await db.ref(`users/${currentUser.uid}/items`).set(items); }
async function loadUserData(uid) { showLoading(); const snap = await db.ref(`users/${uid}/items`).once('value'); items = snap.val() || []; if(!Array.isArray(items)) items = []; document.getElementById('syncStatus').textContent = `✅ ${items.length} itens carregados`; document.getElementById('syncStatus').classList.add('synced'); refreshAllUI(); hideLoading(); }

// ========== FUNÇÕES DE DADOS ==========
function getItemsForDate(date) { return items.filter(i => i.date === formatDateKey(date)); }
function getDaySummary(date) { let income=0, expense=0; getItemsForDate(date).forEach(i=>{ if(i.type==='income') income+=i.amount; if(i.type==='expense') expense+=i.amount; }); return { income, expense, balance: income-expense }; }
function getWeekBalance(date) { let income=0, expense=0, start=new Date(date); start.setDate(date.getDate()-date.getDay()); for(let i=0;i<7;i++){ let d=new Date(start); d.setDate(start.getDate()+i); getItemsForDate(d).forEach(i=>{ if(i.type==='income') income+=i.amount; if(i.type==='expense') expense+=i.amount; }); } return { balance: income-expense, income, expense }; }
function getMonthStats() { let income=0, expense=0, today=new Date(); for(let d=1;d<=31;d++){ let date=new Date(today.getFullYear(),today.getMonth(),d); if(date.getMonth()!==today.getMonth()) break; getItemsForDate(date).forEach(i=>{ if(i.type==='income') income+=i.amount; if(i.type==='expense') expense+=i.amount; }); } return { income, expense, balance: income-expense }; }

// ========== RENDERIZAÇÃO ==========
function renderWeekCalendar() {
    const today=new Date(), start=new Date(today); start.setDate(today.getDate()-today.getDay());
    const weekDays=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'], container=document.getElementById('weekDaysContainer'); container.innerHTML='';
    for(let i=0;i<7;i++){ let d=new Date(start); d.setDate(start.getDate()+i); let summary=getDaySummary(d); let isToday=d.toDateString()===today.toDateString(); let chip=document.createElement('div'); chip.className=`day-chip ${isToday?'today':''}`; chip.onclick=()=>selectDate(d); chip.innerHTML=`<div class="day-name">${weekDays[i]}</div><div class="day-number">${d.getDate()}</div><div class="day-amount ${summary.balance>=0?'amount-positive':'amount-negative'}">${summary.balance>=0?'+':'-'}R$ ${Math.abs(summary.balance).toFixed(2)}</div>`; container.appendChild(chip); }
    document.getElementById('currentMonthLabel').innerHTML=today.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
}

function renderMonthCalendar() {
    const year=currentMonth.getFullYear(), month=currentMonth.getMonth(), firstDay=new Date(year,month,1), lastDay=new Date(year,month+1,0), startDay=firstDay.getDay(), totalDays=lastDay.getDate(), today=new Date(), weekDays=['D','S','T','Q','Q','S','S'];
    document.getElementById('monthTitle').innerHTML=currentMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,l=>l.toUpperCase());
    const grid=document.getElementById('monthGrid'); grid.innerHTML='';
    weekDays.forEach(day=>{ let h=document.createElement('div'); h.className='weekday-header'; h.textContent=day; grid.appendChild(h); });
    for(let i=0;i<startDay;i++){ let e=document.createElement('div'); e.className='month-day'; e.style.background='transparent'; e.style.cursor='default'; e.style.minHeight='65px'; grid.appendChild(e); }
    for(let day=1;day<=totalDays;day++){ let d=new Date(year,month,day), summary=getDaySummary(d), isToday=d.toDateString()===today.toDateString(); let indicatorClass=''; if(summary.income>0&&summary.expense>0) indicatorClass='has-both'; else if(summary.income>0) indicatorClass='has-income'; else if(summary.expense>0) indicatorClass='has-expense'; let dayDiv=document.createElement('div'); dayDiv.className=`month-day ${isToday?'today':''} ${indicatorClass}`; let indicators=''; if(summary.income>0) indicators+=`<span class="indicator-up">↑${summary.income.toFixed(0)}</span>`; if(summary.expense>0) indicators+=`<span class="indicator-down">↓${summary.expense.toFixed(0)}</span>`; dayDiv.innerHTML=`<div class="day-number">${day}</div>${indicators?`<div class="day-indicators">${indicators}</div>`:''}`; dayDiv.onclick=()=>selectDate(d); grid.appendChild(dayDiv); }
}

function selectDate(date) { selectedDate=date; document.getElementById('selectedDateTitle').innerHTML=formatDateDisplay(date); updateSelectedDateTransactions(); }

function updateSelectedDateTransactions() {
    let dayItems=getItemsForDate(selectedDate), container=document.getElementById('selectedDateTransactions');
    if(dayItems.length===0){ container.innerHTML='<div class="empty-transactions">Nenhuma transação neste dia</div>'; return; }
    container.innerHTML='';
    dayItems.forEach(item=>{ let globalIndex=items.findIndex(i=>i.id===item.id); let amountClass=item.type==='expense'?'amount-negative':'amount-positive'; let signal=item.type==='expense'?'-':'+'; let icon=item.type==='expense'?'💸':'💰'; let div=document.createElement('div'); div.className='transaction-item'; div.innerHTML=`<div class="transaction-icon">${icon}</div><div class="transaction-info"><div class="transaction-title">${item.title}</div><div class="transaction-date">${item.time||formatDateDisplay(selectedDate)}</div></div><div class="transaction-amount ${amountClass}">${signal} R$ ${item.amount.toFixed(2)}</div><button class="edit-transaction" onclick="editTransaction(${globalIndex})">✏️</button><button class="delete-transaction" onclick="deleteItem(${globalIndex})">🗑️</button>`; container.appendChild(div); });
}

function editTransaction(index) { let item=items[index]; if(!item) return; editingItemId=item.id; selectedDate=new Date(item.date); document.getElementById('modalTitle').innerHTML='Editar transação'; document.getElementById('modalDateInfo').innerHTML=`📅 ${formatDateDisplay(selectedDate)}`; document.getElementById('modal').style.display='flex'; document.querySelector('[data-tab="financial"]').click(); document.getElementById('type').value=item.type; document.getElementById('description').value=item.title; document.getElementById('amount').value=item.amount; document.getElementById('status').value=item.status||'pending'; items.splice(index,1); }

function openNewTransaction(date, presetType=null) { editingItemId=null; selectedDate=date; document.getElementById('modalTitle').innerHTML='Nova transação'; document.getElementById('modalDateInfo').innerHTML=`📅 ${formatDateDisplay(date)}`; document.getElementById('modal').style.display='flex'; document.getElementById('financialForm').reset(); if(presetType) document.getElementById('type').value=presetType; }

function updateBalances() { let week=getWeekBalance(new Date()), month=getMonthStats(); document.getElementById('mainBalance').innerHTML=`R$ ${week.balance.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; document.getElementById('monthIncome').innerHTML=`R$ ${month.income.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; document.getElementById('monthExpense').innerHTML=`R$ ${month.expense.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; document.getElementById('weekIncome').innerHTML=`R$ ${week.income.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; document.getElementById('weekExpense').innerHTML=`R$ ${week.expense.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; document.getElementById('totalExpense').innerHTML=`R$ ${week.expense.toFixed(2)}`; document.getElementById('totalIncome').innerHTML=`R$ ${week.income.toFixed(2)}`; document.getElementById('totalBalance').innerHTML=`R$ ${week.balance.toFixed(2)}`; }

function refreshAllUI() { renderWeekCalendar(); renderMonthCalendar(); if(selectedDate){ document.getElementById('selectedDateTitle').innerHTML=formatDateDisplay(selectedDate); updateSelectedDateTransactions(); } updateBalances(); }
function saveData() { refreshAllUI(); if(currentUser) saveToCloud(); }
function closeModal() { document.getElementById('modal').style.display='none'; editingItemId=null; refreshAllUI(); }
function deleteItem(index) { if(confirm('Excluir esta transação?')){ items.splice(index,1); saveData(); } }

// ========== RELATÓRIOS ==========
function generateWeeklyReport() { let week=getWeekBalance(new Date()); let report=document.getElementById('reportContent'); report.innerHTML=`<strong>📊 RELATÓRIO DA SEMANA</strong><br><br>📅 Período: ${getWeekRange()}<br>🟢 Receitas: R$ ${week.income.toFixed(2)}<br>🔴 Despesas: R$ ${week.expense.toFixed(2)}<br>💰 Saldo: ${week.balance>=0?'+':'-'} R$ ${Math.abs(week.balance).toFixed(2)}`; report.classList.add('show'); setTimeout(()=>report.classList.remove('show'),5000); }
function generateMonthlyReport() { let month=getMonthStats(); let report=document.getElementById('reportContent'); report.innerHTML=`<strong>📅 RELATÓRIO DO MÊS</strong><br><br>📆 ${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}<br>🟢 Receitas: R$ ${month.income.toFixed(2)}<br>🔴 Despesas: R$ ${month.expense.toFixed(2)}<br>💰 Saldo: ${month.balance>=0?'+':'-'} R$ ${Math.abs(month.balance).toFixed(2)}`; report.classList.add('show'); setTimeout(()=>report.classList.remove('show'),5000); }
function generateComparisonReport() { generateWeeklyReport(); }
function prevMonth() { currentMonth.setMonth(currentMonth.getMonth()-1); renderMonthCalendar(); }
function nextMonth() { currentMonth.setMonth(currentMonth.getMonth()+1); renderMonthCalendar(); }

// ========== WHATSAPP ==========
function sendTransactionViaWhatsApp() {
    const phone = prompt('📱 Digite seu número do WhatsApp com DDD:\n\nExemplo: 5511999999999', '');
    if(!phone) return;
    const valor = prompt('💰 Digite o valor (R$):', '');
    if(!valor || isNaN(parseFloat(valor))) return;
    const descricao = prompt('📝 Digite a descrição:', '');
    if(!descricao) return;
    const tipo = confirm('🔴 OK = DESPESA | 🟢 Cancelar = RECEITA') ? 'expense' : 'income';
    const tipoTexto = tipo === 'expense' ? 'DESPESA' : 'RECEITA';
    const tipoEmoji = tipo === 'expense' ? '🔴' : '🟢';
    const transacao = { id: Date.now(), type: tipo, title: descricao, amount: parseFloat(valor), status: 'pending', date: formatDateKey(new Date()) };
    items.push(transacao); saveData();
    const msg = `✅ *TRANSACÃO REGISTRADA!*\n\n${tipoEmoji} ${tipoTexto}\n📝 ${descricao}\n💰 R$ ${parseFloat(valor).toFixed(2)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    alert('✅ Transação registrada!');
}

function sendWeeklyReportToWhatsApp() {
    const phone = prompt('📱 Digite seu WhatsApp:', '');
    if(!phone) return;
    const week = getWeekBalance(new Date());
    const month = getMonthStats();
    const relatorio = `📊 *RELATÓRIO FINANCEIRO*\n\n📅 Semana:\n💰 Saldo: ${week.balance>=0?'+':'-'} R$ ${Math.abs(week.balance).toFixed(2)}\n🟢 + R$ ${week.income.toFixed(2)}\n🔴 - R$ ${week.expense.toFixed(2)}\n\n📆 Mês:\n💰 Saldo: ${month.balance>=0?'+':'-'} R$ ${Math.abs(month.balance).toFixed(2)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(relatorio)}`, '_blank');
}

// ========== AUTENTICAÇÃO ==========
async function login() { const email=document.getElementById('loginEmail').value, password=document.getElementById('loginPassword').value; if(!email||!password){ alert('📧 Preencha email e senha'); return; } showLoading(); try{ await auth.signInWithEmailAndPassword(email,password); alert('✅ Login realizado!'); } catch(error){ let msg=''; switch(error.code){ case 'auth/wrong-password': msg='❌ Senha incorreta.'; break; case 'auth/user-not-found': msg='❌ Email não cadastrado. Crie uma conta.'; break; default: msg='❌ Erro: '+error.message; } alert(msg); } finally{ hideLoading(); } }

async function signup() { const email=document.getElementById('loginEmail').value, password=document.getElementById('loginPassword').value; if(!email){ alert('📧 Digite seu email'); return; } if(password.length<6){ alert('❌ Senha deve ter 6+ caracteres'); return; } showLoading(); try{ await auth.createUserWithEmailAndPassword(email,password); alert('✅ Conta criada! Faça login.'); document.getElementById('loginPassword').value=''; } catch(error){ let msg=''; switch(error.code){ case 'auth/email-already-in-use': msg='❌ Email já cadastrado.'; break; default: msg='❌ Erro: '+error.message; } alert(msg); } finally{ hideLoading(); } }

async function logout() { showLoading(); try{ await auth.signOut(); } catch(e){ alert(e.message); } finally{ hideLoading(); } }

// ========== EVENTOS ==========
auth.onAuthStateChanged(async (user)=>{ if(user){ currentUser=user; document.getElementById('authSection').style.display='none'; document.getElementById('userInfo').style.display='flex'; document.getElementById('userEmail').textContent=user.email; await loadUserData(user.uid); } else { currentUser=null; items=[]; document.getElementById('authSection').style.display='flex'; document.getElementById('userInfo').style.display='none'; document.getElementById('syncStatus').textContent='🔐 Faça login para salvar'; document.getElementById('syncStatus').classList.remove('synced'); refreshAllUI(); } });

document.getElementById('financialForm').addEventListener('submit',(e)=>{ e.preventDefault(); items.push({ id:editingItemId||Date.now(), type:document.getElementById('type').value, title:document.getElementById('description').value, amount:parseFloat(document.getElementById('amount').value), status:document.getElementById('status').value, date:formatDateKey(selectedDate) }); saveData(); closeModal(); });
document.getElementById('appointmentForm').addEventListener('submit',(e)=>{ e.preventDefault(); items.push({ id:Date.now(), type:'appointment', title:document.getElementById('appointmentTitle').value, time:document.getElementById('appointmentTime').value, location:document.getElementById('appointmentLocation').value, date:formatDateKey(selectedDate) }); saveData(); closeModal(); });
document.getElementById('noteForm').addEventListener('submit',(e)=>{ e.preventDefault(); items.push({ id:Date.now(), type:'note', title:document.getElementById('noteTitle').value, content:document.getElementById('noteContent').value, date:formatDateKey(selectedDate) }); saveData(); closeModal(); });
document.querySelectorAll('.tab-btn').forEach(btn=>{ btn.addEventListener('click',function(){ document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); document.getElementById(this.dataset.tab+'Tab').classList.add('active'); }); });
window.onclick=(e)=>{ if(e.target===document.getElementById('modal')) closeModal(); };

// ========== EXPORTAÇÕES ==========
window.login=login; window.signup=signup; window.logout=logout; window.openNewTransaction=openNewTransaction; window.editTransaction=editTransaction; window.closeModal=closeModal; window.deleteItem=deleteItem; window.generateWeeklyReport=generateWeeklyReport; window.generateMonthlyReport=generateMonthlyReport; window.generateComparisonReport=generateComparisonReport; window.prevMonth=prevMonth; window.nextMonth=nextMonth; window.selectDate=selectDate; window.sendTransactionViaWhatsApp=sendTransactionViaWhatsApp; window.sendWeeklyReportToWhatsApp=sendWeeklyReportToWhatsApp;

// ========== INICIALIZAÇÃO ==========
selectedDate=new Date(); refreshAllUI(); document.getElementById('selectedDateTitle').innerHTML=formatDateDisplay(selectedDate);
