// ==================== PREDICTOR.JS ====================
class FinancialPredictor {
    constructor(transactions, metaMensal = 0) {
        this.transactions = transactions.filter(t => t.type === 'expense' && t.amount > 0);
        this.metaMensal = metaMensal;
        this.dailyBudget = metaMensal > 0 ? metaMensal / 30 : 100;
    }
    getExpensesLastDays(days = 60) {
        const today = new Date();
        const cutoff = new Date();
        cutoff.setDate(today.getDate() - days);
        return this.transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= cutoff && tDate <= today;
        });
    }
    getPatternByWeekday() {
        const weekdaySum = [0,0,0,0,0,0,0];
        const weekdayCount = [0,0,0,0,0,0,0];
        this.getExpensesLastDays(90).forEach(t => {
            const d = new Date(t.date);
            const wd = d.getDay();
            weekdaySum[wd] += t.amount;
            weekdayCount[wd] += 1;
        });
        return weekdaySum.map((sum, i) => weekdayCount[i] ? sum / weekdayCount[i] : 0);
    }
    predictNext7Days() {
        const last30 = this.getExpensesLastDays(30);
        if (last30.length < 7) return { prediction: null, message: "Dados insuficientes (menos de 7 dias de despesas)" };
        const last7days = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dailyExp = last30.filter(t => t.date === d.toISOString().slice(0,10)).reduce((s, t) => s + t.amount, 0);
            last7days.push(dailyExp);
        }
        let weightedSum = 0, weightTotal = 0;
        for (let i = 0; i < last7days.length; i++) {
            const weight = i + 1;
            weightedSum += last7days[i] * weight;
            weightTotal += weight;
        }
        const baseline = weightedSum / weightTotal;
        const weekdayAvg = this.getPatternByWeekday();
        const today = new Date();
        let dailyPredictions = [];
        let totalPredicted = 0;
        for (let i = 1; i <= 7; i++) {
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + i);
            const wd = futureDate.getDay();
            const factor = weekdayAvg[wd] > 0 ? weekdayAvg[wd] / (weekdayAvg.reduce((a,b)=>a+b,0)/7) : 1;
            let predicted = baseline * factor;
            predicted = Math.max(0, Math.min(predicted, this.dailyBudget * 1.5));
            dailyPredictions.push(predicted);
            totalPredicted += predicted;
        }
        return { prediction: totalPredicted, dailyBreakdown: dailyPredictions, baselineAvg: baseline, message: `Projeção para 7 dias: R$ ${totalPredicted.toFixed(2)}` };
    }
    getAlert() {
        const pred = this.predictNext7Days();
        if (!pred.prediction) return null;
        const weeklyBudget = this.dailyBudget * 7;
        const percent = (pred.prediction / weeklyBudget) * 100;
        if (percent >= 80) {
            return { level: percent >= 100 ? 'critical' : 'warning', message: `⚠️ Previsão de gastos (R$ ${pred.prediction.toFixed(2)}) ocupa ${percent.toFixed(0)}% do orçamento semanal (R$ ${weeklyBudget.toFixed(2)}).`, suggestion: `Sugerimos reduzir despesas não essenciais.` };
        }
        return { level: 'ok', message: `✅ Dentro do esperado. Previsão: R$ ${pred.prediction.toFixed(2)}` };
    }
    suggestDailyLimit() {
        const last30 = this.getExpensesLastDays(30);
        if (last30.length === 0) return this.dailyBudget;
        const avgDaily = last30.reduce((s,t) => s + t.amount, 0) / 30;
        return Math.max(10, avgDaily * 0.9);
    }
}

async function updatePredictionCard() {
    const container = document.getElementById('predictionContent');
    if (!container) return;
    const meta = userSettings.meta || 0;
    const predictor = new FinancialPredictor(items, meta);
    const alertData = predictor.getAlert();
    const predResult = predictor.predictNext7Days();
    let html = '';
    if (!predResult.prediction) {
        html = `<div style="text-align:center; color: var(--text-gray);">🔍 ${predResult.message || 'Insira mais despesas nos últimos 30 dias.'}</div>`;
    } else {
        const alertClass = alertData.level === 'ok' ? 'ok' : (alertData.level === 'critical' ? 'critical' : 'warning');
        html = `<div class="prediction-alert ${alertClass}">${alertData.message}<br><small>${alertData.suggestion || ''}</small></div>`;
        html += `<div><strong>📈 Previsão diária (próximos 7 dias):</strong></div><div class="prediction-days">`;
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i + 1);
            html += `<div class="prediction-day-item"><strong>${d.toLocaleDateString('pt-BR', {weekday:'short'})}</strong><br>R$ ${predResult.dailyBreakdown[i].toFixed(2)}</div>`;
        }
        html += `</div><div style="margin-top:8px; font-size:0.7rem;">🎯 Orçamento semanal: R$ ${(predictor.dailyBudget * 7).toFixed(2)}</div>`;
    }
    container.innerHTML = html;
    const applyBtn = document.getElementById('applyAiSuggestionBtn');
    const suggestedLimit = predictor.suggestDailyLimit();
    if (applyBtn) {
        applyBtn.onclick = () => {
            const newMeta = suggestedLimit * 30;
            if (confirm(`Aplicar sugestão de economia: limite diário de R$ ${suggestedLimit.toFixed(2)} (meta mensal R$ ${newMeta.toFixed(2)})?`)) {
                userSettings.meta = newMeta;
                if (currentUser) saveToCloud();
                updateMetaUI();
                updatePredictionCard();
                alert('Meta ajustada com base na IA!');
            }
        };
    }
}
