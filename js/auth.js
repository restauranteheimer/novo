// ==================== AUTENTICAÇÃO ====================
async function login() {
    let email = document.getElementById('loginEmail').value;
    let pass = document.getElementById('loginPassword').value;
    if (!email || !pass) { alert('Preencha e-mail e senha'); return; }
    showLoading();
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        alert('✅ Login realizado!');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch(e) { alert('❌ '+e.message); }
    finally { hideLoading(); }
}

async function signup() {
    let email = document.getElementById('loginEmail').value;
    let pass = document.getElementById('loginPassword').value;
    if (!email || pass.length < 6) { alert('E-mail inválido ou senha com menos de 6 caracteres'); return; }
    showLoading();
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        alert('✅ Conta criada! Faça login.');
        document.getElementById('loginPassword').value = '';
    } catch(e) { alert('❌ '+e.message); }
    finally { hideLoading(); }
}

async function logout() {
    try { await auth.signOut(); }
    catch(e) { alert(e.message); }
}
