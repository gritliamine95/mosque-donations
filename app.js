


/* ================== Formats & Constantes ================== */
const CURRENCY = 'EUR'; // ou 'TND'
const TARGET = 85000;


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
  if (window._fb?.authReady) return window._fb.authReady;
  return Promise.reject(new Error('Firebase non initialisé'));
}
``


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

// Ajout d’un don — retourne l’ID pour permettre d’annuler/supprimer ensuite
async function addReceipt(entry) {
  await fbReady();
  const { db } = window._fb;
  const { collection, addDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const clean = {
    amount: Number(entry.amount) || 0,
    // nom par défaut si vide
    name: (entry.name && entry.name.trim()) ? entry.name.trim() : 'فاعل خير',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'donations'), clean);
  return { id: docRef.id, ...clean };
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
    

    
// ----- Déjà dans ton code -----
// const sum = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
// const remaining = Math.max(0, TARGET - sum);
// if (totalEl) totalEl.textContent = fmtCurrency.format(remaining);

// ----- Mise à jour de la jauge -----
const TargetTotal = 270000;
const paid = Math.max(0, Math.min(TargetTotal, sum + 185000)); // borne entre 0 et TARGET
const pct  = TARGET > 0 ? Math.round((paid / TargetTotal) * 100) : 0;

// DOM refs
const barEl   = document.getElementById('progressBar');
const pctEl   = document.getElementById('progressPercent');
const progressPaidEl   = document.getElementById('progressPaid');
const trackEl = document.querySelector('.progress-track');

// Applique la largeur (avec transition CSS)
if (barEl) {
  barEl.style.width = pct + '%';
}

// Met à jour les libellés
if (pctEl)  pctEl.textContent  = `${pct}%`;
if (progressPaidEl ) progressPaidEl .textContent = fmtCurrency.format(paid);

// Accessibilité (ARIA)
if (trackEl) {
  trackEl.setAttribute('aria-valuenow', String(pct));
}


const paidEl = document.getElementById('paidText');
if (paidEl) {
  // Si ton objectif réel est 270000, assure-toi d’avoir TARGET = 270000
  const paid = Math.max(0, TARGET - remaining + 185000); // équivaut à sum, borné à 0
  paidEl.textContent = `${fmtCurrency.format(paid)}`;
}

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

document.addEventListener('DOMContentLoaded', async () => {
  // Si Firebase n'est pas injecté, affiche un message utile
  if (!window._fb || !window._fb.authReady) {
    console.error('Firebase non initialisé : vérifie le bloc <script type="module"> avant app.js sur cette page.');
    const listEl = document.getElementById('lastTenList');
    if (listEl) listEl.innerHTML = '<li class="datetime">تعذر الاتصال بقاعدة البيانات (تهيئة مفقودة).</li>';
    return;
  }

  try {
    // ⚠️ Attend l’auth anonyme avant d’appeler renderIndex / renderAdd
    await window._fb.authReady;

    if (document.getElementById('lastTenList')) {
      await renderIndex();
    }
    if (document.getElementById('donForm')) {
      await renderAdd();
    }
  } catch (e) {
    console.error('Erreur d’initialisation Firebase:', e);
  }
});



  // === Réglages ===
  // "ar" pour arabe (chiffres arabes, ordre de date), "fr-FR" pour français, etc.
  const CLOCK_LOCALE = "ar";

  // Afficher date + heure (true) ou seulement l'heure (false)
  const SHOW_DATE = true;

  // Formats
  const fmtDate = new Intl.DateTimeFormat(CLOCK_LOCALE, { dateStyle: 'medium' });
  const fmtTime = new Intl.DateTimeFormat(CLOCK_LOCALE, { timeStyle: 'medium' }); // "short" si tu préfères HH:MM

  function updateNowElement() {
    const el = document.getElementById('nowTime');
    if (!el) return;
    const now = new Date();
    el.textContent = SHOW_DATE
      ? `${fmtDate.format(now)} • ${fmtTime.format(now)}`
      : fmtTime.format(now);
  }

  function startClock() {
    // Evite de démarrer plusieurs fois (si scripts chargés en double)
    if (window._clockStarted) return;
    window._clockStarted = true;

    // Mise à jour immédiate
    updateNowElement();

    // Aligne sur la prochaine seconde pour une cadence propre
    const msToNextSecond = 1000 - (Date.now() % 1000);
    setTimeout(() => {
      updateNowElement();
      setInterval(updateNowElement, 1000);
    }, msToNextSecond);
  }

  // Lance dès que le DOM est prêt
  document.addEventListener('DOMContentLoaded', startClock);

