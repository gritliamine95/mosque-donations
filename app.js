
/* ================== Stockage ================== */
const STORAGE_KEY = 'mosque_simple_receipts';

function getReceipts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveReceipts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function addReceipt(entry) {
  const list = getReceipts();
  list.push(entry);
  saveReceipts(list);
}

/* ================== Formats ================== */
const CURRENCY = 'EUR'; // 👉 change en 'TND' si besoin
const fmtCurrency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: CURRENCY });
const fmtDateAr = new Intl.DateTimeFormat('ar', { dateStyle: 'medium' });
const fmtTimeAr = new Intl.DateTimeFormat('ar', { timeStyle: 'short' });

/* ================== Utilitaires ================== */
function topNByAmount(receipts, n = 3) {
  // Copie + tri décroissant par montant
  return receipts
    .slice()
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, n);
}

/* ================== Rendu Accueil ================== */
function renderIndex() {
  const receipts = getReceipts();

  // Total
  const total = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalEl = document.getElementById('totalAmount');
  if (totalEl) totalEl.textContent = fmtCurrency.format(total);

  // --- TOP 2 (plus grands dons) ---
  const topTwoEl = document.getElementById('topTwoList');
  if (topTwoEl) {
    topTwoEl.innerHTML = '';
    const top2 = topNByAmount(receipts, 3);
    if (top2.length === 0) {
      topTwoEl.innerHTML = '<li class="when">لا توجد تبرعات بعد.</li>';
    } else {
      top2.forEach((r) => {
        const li = document.createElement('li');

        const whoWhen = document.createElement('div');
        const dt = r.date ? new Date(r.date) : new Date();
        const donor = (r.name && r.name.trim()) ? r.name.trim() : 'متبرّع';
        const dateStr = fmtDateAr.format(dt);
        const timeStr = fmtTimeAr.format(dt);
        whoWhen.innerHTML = `
          <div class="who">${donor}</div>
          <div class="when">الوقت: ${timeStr} • التاريخ: ${dateStr}</div>
        `;

        const amt = document.createElement('div');
        amt.className = 'amt';
        amt.textContent = fmtCurrency.format(Number(r.amount) || 0);

        li.appendChild(whoWhen);
        li.appendChild(amt);
        topTwoEl.appendChild(li);
      });
    }
  }

  // --- Derniers 10 dons (avec compteur: 1=أقدم ... N=أحدث) ---
  const listEl = document.getElementById('lastTenList');
  if (!listEl) return;

  listEl.innerHTML = '';
  if (receipts.length === 0) {
    listEl.innerHTML = '<li class="datetime">لا توجد تبرعات بعد.</li>';
    return;
  }

  // On prend les 10 derniers par date (les plus récents à la fin)
  const lastTenChronoAsc = receipts.slice(-10); // déjà du plus ancien au plus récent
  lastTenChronoAsc.forEach((r, idx) => {
    const li = document.createElement('li');

    // Compteur 1..N (1 = plus ancien)
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = String(idx + 1);

    // Date + Heure + Nom (si présent)
    const dt = r.date ? new Date(r.date) : new Date();
    const dateStr = fmtDateAr.format(dt);
    const timeStr = fmtTimeAr.format(dt);
    const donor = (r.name && r.name.trim()) ? ` • المتبرّع: ${r.name.trim()}` : '';

    const dtBox = document.createElement('div');
    dtBox.className = 'datetime';
    dtBox.textContent = `الوقت: ${timeStr} • التاريخ: ${dateStr}${donor}`;

    // Montant
    const amt = document.createElement('div');
    amt.className = 'amount';
    amt.textContent = fmtCurrency.format(Number(r.amount) || 0);

    // Ordre (en RTL): [compteur] [texte] [montant]
    li.appendChild(badge);
    li.appendChild(dtBox);
    li.appendChild(amt);

    listEl.appendChild(li);
  });
}

/* ================== Rendu Page d'ajout ================== */
function renderAdd() {
  const form = document.getElementById('donForm');
  const message = document.getElementById('saveMessage');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const amount = Number(document.getElementById('amount').value);
    const name = (document.getElementById('name').value || '').trim();

    if (isNaN(amount) || amount < 0) {
      alert('يرجى إدخال مبلغ صالح (0 أو أكثر).');
      return;
    }

    const entry = {
      amount,
      name,
      date: new Date().toISOString(),
    };
    addReceipt(entry);

    form.reset();
    if (message) {
      message.style.display = 'block';
      setTimeout(() => (message.style.display = 'none'), 2000);
    }
  });
}

/* ================== Bootstrapping ================== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('lastTenList')) renderIndex();
  if (document.getElementById('donForm')) renderAdd();
});
