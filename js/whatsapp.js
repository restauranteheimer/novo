// ==================== WHATSAPP.JS ====================
let lastSavedTransaction = null;

function sendWhatsAppMessageDirect(phoneNumber, transaction) {
    if (!transaction && lastSavedTransaction) transaction = lastSavedTransaction;
    if (!transaction) { alert("Nada para enviar."); return; }
    let raw = phoneNumber.toString().replace(/\D/g, '');
    if (!raw.startsWith('55')) raw = '55' + raw;
    const tipo = transaction.type === 'expense' ? '🔴 DESPESA' : '🟢 RECEITA';
    const msg = `💰 *${tipo}*\n📝 ${transaction.title}\n💵 R$ ${transaction.amount.toFixed(2)}\n📅 Data: ${transaction.date}\n⏳ Status: ${transaction.status === 'paid' ? 'Pago/Recebido' : 'Pendente'}`;
    window.open(`https://wa.me/${raw}?text=${encodeURIComponent(msg)}`, '_blank');
}

function openWhatsAppModal(transaction) {
    lastSavedTransaction = transaction;
    const preview = document.getElementById('whatsappMessagePreview');
    if(preview) preview.innerHTML = `<strong>📄 Transação:</strong> ${transaction.type === 'expense' ? '🔴 Despesa' : '🟢 Receita'}<br>${transaction.title}<br>R$ ${transaction.amount.toFixed(2)}<br>${transaction.date}`;
    document.getElementById('contactSelect').value = '';
    document.getElementById('dddInput').value = '81';
    document.getElementById('phoneNumberInput').value = '';
    const modal = document.getElementById('whatsappModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
    setTimeout(() => document.getElementById('dddInput').focus(), 50);
}

function sendFromModal() {
    let phone = '';
    const selectedContact = document.getElementById('contactSelect').value;
    if (selectedContact) {
        phone = selectedContact;
    } else {
        const ddd = document.getElementById('dddInput').value.trim();
        const numero = document.getElementById('phoneNumberInput').value.trim();
        if (!ddd || !numero) { alert('Preencha DDD e número'); return; }
        phone = `55${ddd}${numero.replace(/\D/g, '')}`;
    }
    if (phone.length < 12) { alert('Número inválido'); return; }
    sendWhatsAppMessageDirect(phone, lastSavedTransaction);
    document.getElementById('whatsappModal').style.display = 'none';
    lastSavedTransaction = null;
}
