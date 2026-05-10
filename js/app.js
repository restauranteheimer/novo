let currentUser = null;
        let items = [];
        let currentDate = new Date();
        let selectedDate = null;
        let weeklyChart = null;
        let monthlyChart = null;

        function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
        function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

        function formatDateKey(date) {
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

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
            if (currentUser) saveToCloud();
        }

        // Marcar como pago/recebido
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

        async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Preencha email e senha!');
        return;
    }

    showLoading();

    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert('✅ Login realizado com sucesso!');
    } catch (error) {

        let mensagem = 'Erro ao fazer login.';

        switch (error.code) {

            case 'auth/wrong-password':
                mensagem = '❌ Senha incorreta!';
                break;

            case 'auth/user-not-found':
                mensagem = '❌ Usuário não encontrado!';
                break;

            case 'auth/invalid-email':
                mensagem = '❌ Email inválido!';
                break;

            case 'auth/too-many-requests':
                mensagem = '⚠️ Muitas tentativas. Tente novamente mais tarde!';
                break;

            case 'auth/network-request-failed':
                mensagem = '🌐 Sem conexão com a internet!';
                break;

            case 'auth/invalid-credential':
                mensagem = '❌ Email ou senha incorretos!';
                break;

            default:
                mensagem = '❌ Erro: ' + error.message;
        }

        alert(mensagem);

    } finally {
        hideLoading();
    }
}

        async function signup() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            if (!email || !password || password.length < 6) { alert('Email e senha (mínimo 6 caracteres) obrigatórios!'); return; }
            showLoading();
            try {
                await auth.createUserWithEmailAndPassword(email, password);
                alert('✅ Conta criada! Faça login.');
            } catch (error) { alert('❌ Erro: ' + error.message); }
            finally { hideLoading(); }
        }

        async function logout() {
            showLoading();
            try { await auth.signOut(); }
            catch (error) { alert('Erro ao sair: ' + error.message); }
            finally { hideLoading(); }
        }

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

        function updateCharts() {
            const weeklyData = getLast4WeeksBalances();
            const monthlyData = getLast6MonthsBalances();
            
            if (weeklyChart) weeklyChart.destroy();
            if (monthlyChart) monthlyChart.destroy();
            
            const ctx1 = document.getElementById('weeklyChart').getContext('2d');
            weeklyChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: weeklyData.weekLabels,
                    datasets: [{ label: 'Saldo Semanal (R$)', data: weeklyData.balances, backgroundColor: weeklyData.balances.map(b => b >= 0 ? '#10b981' : '#ef4444'), borderRadius: 8 }]
                },
                options: { responsive: true, maintainAspectRatio: true }
            });
            
            const ctx2 = document.getElementById('monthlyChart').getContext('2d');
            monthlyChart = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: monthlyData.monthLabels,
                    datasets: [{ label: 'Saldo Mensal (R$)', data: monthlyData.balances, backgroundColor: 'rgba(102,126,234,0.1)', borderColor: '#667eea', borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: monthlyData.balances.map(b => b >= 0 ? '#10b981' : '#ef4444'), pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5 }]
                },
                options: { responsive: true, maintainAspectRatio: true }
            });
            
            const weekBalance = getWeekBalance(new Date());
            const monthBalance = getMonthBalance(new Date());
            
            document.getElementById('weekBalanceValue').innerHTML = `<div class="${weekBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${weekBalance >= 0 ? '▲' : '▼'} R$ ${Math.abs(weekBalance).toFixed(2)}</div>`;
            document.getElementById('weeklyAlert').innerHTML = weekBalance < 0 ? '<div class="alert">⚠️ Alerta: Semana com saldo negativo!</div>' : '';
            document.getElementById('monthBalanceValue').innerHTML = `<div class="${monthBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${monthBalance >= 0 ? '▲' : '▼'} R$ ${Math.abs(monthBalance).toFixed(2)}</div>`;
            document.getElementById('monthlyAlert').innerHTML = monthBalance < 0 ? '<div class="alert">⚠️ Alerta: Mês com saldo negativo!</div>' : '';
        }

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
            return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        }

        function renderCalendar() {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDay = firstDay.getDay();
            const totalDays = lastDay.getDate();
            
            document.getElementById('currentMonth').textContent = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const grid = document.getElementById('calendarGrid');
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

        function updateDayItemsList() {
            const listDiv = document.getElementById('dayItemsList');
            const dateDisplay = document.getElementById('selectedDateDisplay');
            if (!selectedDate) {
                dateDisplay.innerHTML = '';
                listDiv.innerHTML = '<p style="text-align:center; color:#94a3b8;">📌 Clique em um dia</p>';
                return;
            }
            dateDisplay.innerHTML = `<div class="selected-date">📅 ${selectedDate.toLocaleDateString('pt-BR')}</div>`;
            const dayItems = getItemsForDate(selectedDate);
            if (dayItems.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center; color:#94a3b8;">✨ Nenhum item</p>';
                return;
            }
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

        function openModal(date) {
            selectedDate = new Date(date);
            document.getElementById('modalDate').textContent = selectedDate.toLocaleDateString('pt-BR');
            document.getElementById('modal').style.display = 'flex';
            document.getElementById('financialForm').reset();
            document.getElementById('appointmentForm').reset();
            document.getElementById('noteForm').reset();
            document.getElementById('dayOfWeekGroup').style.display = 'none';
            document.getElementById('dayOfMonthGroup').style.display = 'none';
        }

        function closeModal() {
            document.getElementById('modal').style.display = 'none';
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

        function editItem(index) {
            const item = items[index];
            if (!item) return;
            selectedDate = new Date(item.date);
            openModal(selectedDate);
            if (item.type === 'expense' || item.type === 'income') {
                document.querySelector('[data-tab="financial"]').click();
                document.getElementById('type').value = item.type;
                document.getElementById('description').value = item.title;
                document.getElementById('amount').value = item.amount;
                document.getElementById('status').value = item.status || 'pending';
                document.getElementById('recurrence').value = item.recurrence;
                if (item.recurrence === 'weekly') {
                    document.getElementById('dayOfWeekGroup').style.display = 'block';
                    document.getElementById('dayOfWeek').value = item.dayOfWeek;
                }
                if (item.recurrence === 'monthly') {
                    document.getElementById('dayOfMonthGroup').style.display = 'block';
                    document.getElementById('dayOfMonth').value = item.dayOfMonth;
                }
                items.splice(index, 1);
                saveData();
            } else if (item.type === 'appointment') {
                document.querySelector('[data-tab="appointment"]').click();
                document.getElementById('appointmentTitle').value = item.title;
                document.getElementById('appointmentTime').value = item.time || '';
                document.getElementById('appointmentLocation').value = item.location || '';
                document.getElementById('appointmentDescription').value = item.description || '';
                document.getElementById('appointmentRecurrence').value = item.recurrence;
                items.splice(index, 1);
                saveData();
            } else if (item.type === 'note') {
                document.querySelector('[data-tab="note"]').click();
                document.getElementById('noteTitle').value = item.title;
                document.getElementById('noteContent').value = item.content || '';
                document.getElementById('noteColor').value = item.color || '#f59e0b';
                items.splice(index, 1);
                saveData();
            }
        }

        function deleteItem(index) {
            if (confirm('🗑️ Excluir permanentemente?')) {
                items.splice(index, 1);
                saveData();
            }
        }

        // WhatsApp
        function formatPhoneNumber(phone) {
            let cleaned = phone.replace(/\D/g, '');
            if (cleaned.startsWith('55') && cleaned.length === 12) return cleaned;
            if (cleaned.length === 11) return '55' + cleaned;
            if (cleaned.length === 10) return '55' + cleaned;
            return cleaned;
        }

        function sendNotification() {
            let phone = document.getElementById('whatsappNumber').value;
            if (!phone) { alert('📱 Insira seu número!'); return; }
            phone = formatPhoneNumber(phone);
            const weekBalance = getWeekBalance(new Date());
            const monthBalance = getMonthBalance(new Date());
            const weeklyData = getLast4WeeksBalances();
            
            let msg = `📊 *DINHEIRO EM DIA* 📊\n\n📅 ${new Date().toLocaleDateString('pt-BR')}\n💰 Semana: ${weekBalance >= 0 ? '+' : '-'} R$ ${Math.abs(weekBalance).toFixed(2)}\n📈 Mês: ${monthBalance >= 0 ? '+' : '-'} R$ ${Math.abs(monthBalance).toFixed(2)}\n\n📊 *Últimas 4 semanas:*\n`;
            weeklyData.weekLabels.forEach((label, i) => { msg += `• Semana ${label}: ${weeklyData.balances[i] >= 0 ? '+' : '-'} R$ ${Math.abs(weeklyData.balances[i]).toFixed(2)}\n`; });
            msg += `\n🔔 Acesse o app para mais detalhes!`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            alert('✅ Notificação preparada! O WhatsApp será aberto para confirmar.');
        }

        function scheduleNotification() {
            const frequency = document.getElementById('notificationFrequency').value;
            if ('Notification' in window) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        alert(`✅ Notificações ${frequency === 'weekly' ? 'semanais' : 'mensais'} agendadas!`);
                        localStorage.setItem('notificationsScheduled', 'true');
                        localStorage.setItem('lastScheduleDate', new Date().toISOString());
                        localStorage.setItem('scheduleFrequency', frequency);
                    } else { alert('⚠️ Permita notificações do navegador.'); }
                });
            } else { alert('⚠️ Use "Enviar Agora"'); }
        }

        // Event Listeners
        document.getElementById('financialForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const item = {
                id: Date.now(),
                type: document.getElementById('type').value,
                title: document.getElementById('description').value,
                amount: parseFloat(document.getElementById('amount').value),
                status: document.getElementById('status').value,
                recurrence: document.getElementById('recurrence').value,
                date: formatDateKey(selectedDate)
            };
            if (item.recurrence === 'weekly') item.dayOfWeek = parseInt(document.getElementById('dayOfWeek').value);
            if (item.recurrence === 'monthly') item.dayOfMonth = parseInt(document.getElementById('dayOfMonth').value);
            items.push(item);
            saveData();
            closeModal();
        });

        document.getElementById('appointmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const item = {
                id: Date.now(),
                type: 'appointment',
                title: document.getElementById('appointmentTitle').value,
                time: document.getElementById('appointmentTime').value,
                location: document.getElementById('appointmentLocation').value,
                description: document.getElementById('appointmentDescription').value,
                recurrence: document.getElementById('appointmentRecurrence').value,
                date: formatDateKey(selectedDate)
            };
            if (item.recurrence === 'weekly') item.dayOfWeek = selectedDate.getDay();
            if (item.recurrence === 'monthly') item.dayOfMonth = selectedDate.getDate();
            items.push(item);
            saveData();
            closeModal();
        });

        document.getElementById('noteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            items.push({
                id: Date.now(),
                type: 'note',
                title: document.getElementById('noteTitle').value,
                content: document.getElementById('noteContent').value,
                color: document.getElementById('noteColor').value,
                recurrence: 'unique',
                date: formatDateKey(selectedDate)
            });
            saveData();
            closeModal();
        });

        document.getElementById('recurrence').addEventListener('change', (e) => {
            document.getElementById('dayOfWeekGroup').style.display = e.target.value === 'weekly' ? 'block' : 'none';
            document.getElementById('dayOfMonthGroup').style.display = e.target.value === 'monthly' ? 'block' : 'none';
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(this.dataset.tab + 'Tab').classList.add('active');
            });
        });

        document.getElementById('prevMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
        document.getElementById('nextMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

        window.login = login;
        window.signup = signup;
        window.logout = logout;
        window.editItem = editItem;
        window.deleteItem = deleteItem;
        window.markAsPaid = markAsPaid;
        window.closeModal = closeModal;
        window.openGoogleMaps = openGoogleMaps;
        window.generateWeeklyReport = generateWeeklyReport;
        window.generateMonthlyReport = generateMonthlyReport;
        window.generateComparisonReport = generateComparisonReport;
        window.sendNotification = sendNotification;
        window.scheduleNotification = scheduleNotification;

        const savedNumber = localStorage.getItem('whatsappNumber');
        const savedFreq = localStorage.getItem('notificationFrequency');
        if (savedNumber) document.getElementById('whatsappNumber').value = savedNumber;
        if (savedFreq) document.getElementById('notificationFrequency').value = savedFreq;

        document.getElementById('whatsappNumber')?.addEventListener('change', () => { localStorage.setItem('whatsappNumber', document.getElementById('whatsappNumber').value); });
        document.getElementById('notificationFrequency')?.addEventListener('change', () => { localStorage.setItem('notificationFrequency', document.getElementById('notificationFrequency').value); });

        window.onclick = (e) => { if (e.target === document.getElementById('modal')) closeModal(); };

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('authSection').style.display = 'none';
                document.getElementById('userInfo').style.display = 'flex';
                document.getElementById('userEmail').textContent = user.email;
                await loadUserData(user.uid);
            } else {
                currentUser = null;
                items = [];
                document.getElementById('authSection').style.display = 'flex';
                document.getElementById('userInfo').style.display = 'none';
                document.getElementById('syncStatus').textContent = '🔓 Faça login para salvar na nuvem';
                document.getElementById('syncStatus').className = 'sync-status';
                renderCalendar();
                updateCharts();
                updateDayItemsList();
            }
        });

        renderCalendar();

        setInterval(() => {
            const scheduled = localStorage.getItem('notificationsScheduled');
            const lastDate = localStorage.getItem('lastScheduleDate');
            const frequency = localStorage.getItem('scheduleFrequency');
            if (scheduled === 'true' && lastDate && frequency) {
                const last = new Date(lastDate);
                const now = new Date();
                const daysDiff = Math.floor((now - last) / (1000 * 60 * 60 * 24));
                if ((frequency === 'weekly' && daysDiff >= 7) || (frequency === 'monthly' && daysDiff >= 30)) {
                    sendNotification();
                    localStorage.setItem('lastScheduleDate', now.toISOString());
                }
            }
        }, 21600000);
