// ==================== CONTACTS.JS ====================
function renderContacts() {
    let container = document.getElementById('contactsList');
    if (!container) return;
    container.innerHTML = '';
    (userSettings.contacts || []).forEach((c, idx) => {
        let div = document.createElement('div');
        div.className = 'contact-item';
        let formattedPhone = c.phone.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '$1 $2-$3');
        div.innerHTML = `<span><strong>${escapeHtml(c.name)}</strong><br><small>${formattedPhone}</small></span>
                         <div>
                            <button class="send-wa-contact" data-phone="${c.phone}">📲</button>
                            <button class="del-contact" data-idx="${idx}">🗑️</button>
                         </div>`;
        container.appendChild(div);
    });
    document.querySelectorAll('.send-wa-contact').forEach(btn => {
        btn.addEventListener('click', () => sendWhatsAppMessageDirect(btn.dataset.phone));
    });
    document.querySelectorAll('.del-contact').forEach(btn => {
        btn.addEventListener('click', () => {
            let idx = parseInt(btn.dataset.idx);
            userSettings.contacts.splice(idx, 1);
            if (currentUser) saveToCloud();
            renderContacts();
        });
    });
    let select = document.getElementById('contactSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Contato favorito --</option>';
        userSettings.contacts.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c.phone;
            opt.textContent = `${c.name} (${c.phone})`;
            select.appendChild(opt);
        });
    }
}

function addContact() {
    let name = document.getElementById('contactName').value.trim();
    let phone = document.getElementById('contactPhone').value.trim();
    if (!name || !phone) {
        alert('Preencha nome e número');
        return;
    }
    let rawPhone = phone.replace(/\D/g, '');
    if (!rawPhone.startsWith('55')) {
        rawPhone = '55' + rawPhone;
    }
    if (rawPhone.length < 12) {
        alert('Número inválido. Use DDD + número (ex: 81999999999). O código 55 será adicionado automaticamente.');
        return;
    }
    if (!userSettings.contacts) userSettings.contacts = [];
    userSettings.contacts.push({ name, phone: rawPhone });
    if (currentUser) saveToCloud();
    renderContacts();
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
}
