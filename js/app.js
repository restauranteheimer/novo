// ==================== APP.JS ====================
// Este arquivo conecta todos os módulos e inicializa a aplicação.
// Também gerencia eventos de UI, autenticação e estado global.

document.addEventListener('DOMContentLoaded', () => {
    // Event listeners dos botões principais
    document.getElementById('openMapBtn')?.addEventListener('click', initMapWithGPS);
    document.getElementById('closeMapModalBtn')?.addEventListener('click', () => document.getElementById('mapModal').style.display = 'none');
    document.getElementById('searchAddressBtn')?.addEventListener('click', searchAddress);
    document.getElementById('useLocationBtn')?.addEventListener('click', useLocationFromMap);
    document.getElementById('useGpsBtn')?.addEventListener('click', getCurrentLocationGPS);
    document.getElementById('addContactBtn')?.addEventListener('click', addContact);
    document.getElementById('sendWhatsappBtn')?.addEventListener('click', sendFromModal);
    document.getElementById('closeWhatsappModalBtn')?.addEventListener('click', () => document.getElementById('whatsappModal').style.display = 'none');
    document.getElementById('financialForm')?.addEventListener('submit', handleFinancialSubmit);
    document.getElementById('appointmentForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        let date = parseLocalDate(document.getElementById('transactionDate').value);
        items.push({
            id: Date.now(),
            type: 'appointment',
            title: document.getElementById('appointmentTitle').value,
            time: document.getElementById('appointmentTime').value,
            location: document.getElementById('appointmentLocation').value,
            date: formatDateKey(date)
        });
        saveData();
        closeModal();
        alert('Compromisso salvo');
    });
    document.getElementById('noteForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        let date = parseLocalDate(document.getElementById('transactionDate').value);
        items.push({
            id: Date.now(),
            type: 'note',
            title: document.getElementById('noteTitle').value,
            content: document.getElementById('noteContent').value,
            date: formatDateKey(date)
        });
        saveData();
        closeModal();
        alert('Anotação salva');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', function(){
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
        document.getElementById(this.dataset.tab+'Tab').classList.add('active');
    }));
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelAppointmentBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelNoteBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeDayModalBtn')?.addEventListener('click', closeDayModal);
    document.getElementById('closeInsightsModalBtn')?.addEventListener('click', closeInsightsModal);
    document.getElementById('closeReportModalBtn')?.addEventListener('click', closeReportModal);
    document.getElementById('closeMetaModalBtn')?.addEventListener('click', closeMetaModal);
    document.getElementById('saveMetaBtn')?.addEventListener('click', saveMeta);
    document.getElementById('editMetaBtn')?.addEventListener('click', editMeta);
    document.getElementById('addTransactionFromDayBtn')?.addEventListener('click', openNewTransactionFromModal);
    document.getElementById('deleteSelectedBtn')?.addEventListener('click', deleteSelectedItems);
    document.getElementById('deleteAllDataBtn')?.addEventListener('click', deleteAllData);
    document.getElementById('prevMonthBtn')?.addEventListener('click', prevMonth);
    document.getElementById('nextMonthBtn')?.addEventListener('click', nextMonth);
    document.querySelectorAll('.shortcut-item').forEach(el => el.addEventListener('click', () => {
        let a = el.dataset.action;
        if(a==='income') openNewTransaction(new Date(),'income');
        else if(a==='expense') openNewTransaction(new Date(),'expense');
        else if(a==='fullReport') openFullReport();
        else if(a==='weekReport') generateWeeklyReport();
        else if(a==='monthReport') generateMonthlyReport();
    }));
    document.getElementById('desktopFabBtn')?.addEventListener('click', () => openNewTransaction(new Date()));
    document.getElementById('fabBtn')?.addEventListener('click', () => openNewTransaction(new Date()));
    document.getElementById('insightsLamp')?.addEventListener('click', showInsightsModal);
    document.getElementById('loginBtn')?.addEventListener('click', login);
    document.getElementById('signupBtn')?.addEventListener('click', signup);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    const loginEmailField = document.getElementById('loginEmail');
    const loginPasswordField = document.getElementById('loginPassword');
    function handleLoginEnter(e) { if(e.key === 'Enter') login(); }
    loginEmailField?.addEventListener('keypress', handleLoginEnter);
    loginPasswordField?.addEventListener('keypress', handleLoginEnter);
    const darkToggle = document.getElementById('darkModeToggle');
    if(darkToggle) {
        if(localStorage.getItem('darkMode') === 'enabled') document.body.classList.add('dark-mode');
        darkToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
        });
    }
    window.onclick = (e) => {
        if(e.target === document.getElementById('modal')) closeModal();
        if(e.target === document.getElementById('reportModal')) closeReportModal();
        if(e.target === document.getElementById('metaModal')) closeMetaModal();
        if(e.target === document.getElementById('dayModal')) closeDayModal();
        if(e.target === document.getElementById('insightsModal')) closeInsightsModal();
        if(e.target === document.getElementById('mapModal')) document.getElementById('mapModal').style.display = 'none';
        if(e.target === document.getElementById('whatsappModal')) document.getElementById('whatsappModal').style.display = 'none';
    };
});

// Estado de autenticação
auth.onAuthStateChanged(async (user) => {
    if(user) {
        currentUser = user;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userEmail').textContent = user.email;
        await loadUserData(user.uid);
        document.body.classList.add('logged-in');
        document.getElementById('signupGuide').style.display = 'none';
    } else {
        currentUser = null;
        items = [];
        userSettings = { meta:0, contacts:[] };
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('userInfo').style.display = 'none';
        document.body.classList.remove('logged-in');
        document.getElementById('signupGuide').style.display = 'flex';
        refreshAllUI();
    }
});

refreshAllUI();
