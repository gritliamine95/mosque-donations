
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


/* ================== Formats & Constantes ================== */
const CURRENCY = 'EUR'; // ou 'TND'
const TARGET = 27000;

const fmtCurrency = new Intl.NumberFormat('fr-FR', { 
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});
const fmtDateAr = new Intl.DateTimeFormat('ar', { dateStyle: 'medium' });
const fmtTimeAr = new Intl.DateTimeFormat('ar', { timeStyle: 'short' });

/* ================== Utils ================== */
function topNByAmount(receipts, n = 3) {
  return receipts
    .slice()
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, n);
}

/* ================== Firestore helpers ================== */
// Retourne une promesse résolue quand _fb (auth + db) est prêt
function fbReady() {
  return window._fb?.authReady || Promise.reject(new Error('Firebase non initialisé'));
}

// Lecture des X derniers dons (les plus récents d’abord)
async function fetchLastDonations(limitCount = 200) {
  await fbReady();
  const { db } = window._fb;
  const { collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const q = query(collection(db, 'donations'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Ajout d’un don
async function addReceipt(entry) {
  await fbReady();
  const { db } = window._fb;
  const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const clean = {
    amount: Number(entry.amount) || 0,
    name: (entry.name || '').trim(),
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'donations'), clean);
}

/* ================== Rendu Accueil ================== */
async function renderIndex() {
  await fbReady();

  const totalEl = document.getElementById('totalAmount');
  const topTwoEl = document.getElementById('topTwoList');
  const listEl = document.getElementById('lastTenList');
  if (!listEl) return;

  const { db } = window._fb;
  const { collection, query, orderBy, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  // Écoute temps réel des 200 derniers dons (tri desc sur createdAt)
  const q = query(collection(db, 'donations'), orderBy('createdAt', 'desc'), limit(200));
  onSnapshot(q, (snap) => {
    // Convertit snapshot -> array
    const receipts = snap.docs.map(d => {
      const data = d.data();
      const dt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.date ? new Date(data.date) : new Date());
      return {
        id: d.id,
        amount: Number(data.amount) || 0,
        name: data.name || '',
        date: dt.toISOString(),
      };
    });

    // Calcul du “reste”
    const sum = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const remaining = Math.max(0, TARGET - sum);
    if (totalEl) totalEl.textContent = fmtCurrency.format(remaining);

    // TOP 3 par montant
    if (topTwoEl) {
      topTwoEl.innerHTML = '';
      const top3 = topNByAmount(receipts, 3);
      if (top3.length === 0) {
        topTwoEl.innerHTML = '<li class="when">لا توجد تبرعات بعد.</li>';
      } else {
        top3.forEach((r) => {
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

    // Derniers 10 dons (affichés du plus récent au plus ancien)
    listEl.innerHTML = '';
    if (receipts.length === 0) {
      listEl.innerHTML = '<li class="datetime">لا توجد تبرعات بعد.</li>';
      return;
    }

    // Les 10 derniers en ordre desc (déjà desc), mais compteur absolu = totalCount - idx
    const totalCount = receipts.length;
    receipts.slice(0, 10).forEach((r, idx) => {
      const li = document.createElement('li');

      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = String(totalCount - idx);

      const donorName = (r.name && r.name.trim()) ? r.name.trim() : 'متبرّع';
      const nameEl = document.createElement('div');
      nameEl.className = 'donor-name';
      nameEl.textContent = donorName;

      const dt = r.date ? new Date(r.date) : new Date();
      const dateStr = fmtDateAr.format(dt);
      const timeStr = fmtTimeAr.format(dt);
      const dtEl = document.createElement('div');
      dtEl.className = 'datetime';
      dtEl.textContent = `الوقت: ${timeStr} • التاريخ: ${dateStr}`;

      const infoBox = document.createElement('div');
      infoBox.className = 'info';
      infoBox.appendChild(nameEl);
      infoBox.appendChild(dtEl);

      const amt = document.createElement('div');
      amt.className = 'amount';
      amt.textContent = fmtCurrency.format(Number(r.amount) || 0);

      li.appendChild(badge);
      li.appendChild(infoBox);
      li.appendChild(amt);

      listEl.appendChild(li);
    });
  }, (err) => {
    console.error('Firestore listen error:', err);
    listEl.innerHTML = '<li class="datetime">حدث خطأ في الاتصال بقاعدة البيانات.</li>';
  });
}

/* ================== Rendu Page d'ajout ================== */
async function renderAdd() {
  await fbReady();

  const form = document.getElementById('donForm');
  const message = document.getElementById('saveMessage');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = Number(document.getElementById('amount').value);
    const name = (document.getElementById('name').value || '').trim();

    if (isNaN(amount) || amount < 0) {
      alert('يرجى إدخال مبلغ صالح (0 أو أكثر).');
      return;
    }

    try {
      await addReceipt({ amount, name });
      form.reset();
      if (message) {
        message.style.display = 'block';
        setTimeout(() => (message.style.display = 'none'), 2000);
      }
    } catch (err) {
      console.error('Add donation error:', err);
      alert('تعذر حفظ التبرع. حاول مرة أخرى.');
    }
  });
}

/* ================== Bootstrapping ================== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('lastTenList')) renderIndex();
  if (document.getElementById('donForm')) renderAdd();
});
