const LS_KEY = 'localMemories';

const els = {
  authArea: document.getElementById('authArea'),
  modeNote: document.getElementById('modeNote'),
  memoryForm: document.getElementById('memoryForm'),
  title: document.getElementById('title'),
  date: document.getElementById('date'),
  mood: document.getElementById('mood'),
  text: document.getElementById('text'),
  formMsg: document.getElementById('formMsg'),
  memoriesList: document.getElementById('memoriesList'),
  emptyMsg: document.getElementById('emptyMsg'),
  filterMood: document.getElementById('filterMood'),
  authModal: document.getElementById('authModal'),
  authForm: document.getElementById('authForm'),
  authUsername: document.getElementById('authUsername'),
  authPassword: document.getElementById('authPassword'),
  authMsg: document.getElementById('authMsg'),
  authSubmit: document.getElementById('authSubmit'),
};

let user = null;
let memories = [];
let authMode = 'login';

function getLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function setLocal(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
  return data;
}

function escapeHTML(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('ar', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function renderAuthArea() {
  if (user) {
    els.authArea.innerHTML = `
      <div class="user-chip">
        <span>👤 ${escapeHTML(user)}</span>
        <button class="btn ghost" id="logoutBtn">خروج</button>
      </div>`;
    document.getElementById('logoutBtn').addEventListener('click', logout);
    els.modeNote.textContent = `مرحبًا ${user}! ذكرياتك محفوظة بأمان على السيرفر ☁️`;
  } else {
    els.authArea.innerHTML = `
      <div class="user-chip">
        <span class="mode-note">وضع الزائر (محلي)</span>
        <button class="btn primary" id="loginBtn">تسجيل الدخول</button>
      </div>`;
    document.getElementById('loginBtn').addEventListener('click', openModal);
    els.modeNote.textContent = 'أنت في وضع الزائر: تُحفظ ذكرياتك في هذا المتصفح فقط. سجّل الدخول لحفظها على السيرفر.';
  }
}

function renderMemories() {
  const filter = els.filterMood.value;
  const list = filter ? memories.filter((m) => m.mood === filter) : memories;
  els.memoriesList.innerHTML = list
    .map(
      (m) => `
      <article class="card memory-card" data-id="${m.id}">
        <h4>${escapeHTML(m.title)}</h4>
        <div class="memory-meta">
          <span>📅 ${formatDate(m.date)}</span>
          <span>${escapeHTML(m.mood)}</span>
        </div>
        <p class="memory-text">${escapeHTML(m.text)}</p>
        <button class="btn danger" data-delete>حذف</button>
      </article>`
    )
    .join('');
  els.emptyMsg.classList.toggle('hidden', list.length > 0);
}

async function refresh() {
  if (user) {
    try {
      const data = await api('/api/memories');
      memories = data.memories;
    } catch {
      user = null;
      memories = getLocal();
      renderAuthArea();
    }
  } else {
    memories = getLocal();
  }
  renderMemories();
}

els.memoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formMsg.textContent = '';
  els.formMsg.className = 'form-msg';
  const memory = {
    title: els.title.value.trim(),
    date: els.date.value,
    mood: els.mood.value,
    text: els.text.value.trim(),
  };
  if (!memory.title || !memory.text) return;

  if (user) {
    try {
      const data = await api('/api/memories', {
        method: 'POST',
        body: JSON.stringify(memory),
      });
      memories.unshift(data.memory);
    } catch (err) {
      els.formMsg.textContent = err.message;
      els.formMsg.classList.add('error');
      return;
    }
  } else {
    memory.id = crypto.randomUUID();
    memory.createdAt = Date.now();
    const local = getLocal();
    local.unshift(memory);
    setLocal(local);
    memories = local;
  }
  els.memoryForm.reset();
  els.formMsg.textContent = 'تم حفظ الذكرى ✅';
  els.formMsg.classList.add('ok');
  setTimeout(() => (els.formMsg.textContent = ''), 2500);
  renderMemories();
});

els.memoriesList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-delete]');
  if (!btn) return;
  const card = btn.closest('.memory-card');
  const id = card.dataset.id;
  if (!confirm('هل تريد حذف هذه الذكرى؟')) return;

  if (user) {
    try {
      await api(`/api/memories/${id}`, { method: 'DELETE' });
    } catch (err) {
      alert(err.message);
      return;
    }
  } else {
    setLocal(getLocal().filter((m) => m.id !== id));
  }
  memories = memories.filter((m) => m.id !== id);
  renderMemories();
});

els.filterMood.addEventListener('change', renderMemories);

function openModal() {
  els.authModal.classList.remove('hidden');
  els.authMsg.textContent = '';
  setAuthMode('login');
  els.authUsername.focus();
}

function closeModal() {
  els.authModal.classList.add('hidden');
  els.authForm.reset();
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === mode);
  });
  els.authSubmit.textContent = mode === 'login' ? 'دخول' : 'إنشاء الحساب';
  els.authPassword.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.tab));
});

els.authModal.addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-close')) closeModal();
});

els.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.authMsg.textContent = '';
  els.authMsg.className = 'form-msg';
  els.authSubmit.disabled = true;
  const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        username: els.authUsername.value.trim(),
        password: els.authPassword.value,
      }),
    });
    user = data.user;
    closeModal();
    renderAuthArea();
    await refresh();
  } catch (err) {
    els.authMsg.textContent = err.message;
    els.authMsg.classList.add('error');
  } finally {
    els.authSubmit.disabled = false;
  }
});

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {}
  user = null;
  memories = getLocal();
  renderAuthArea();
  renderMemories();
}

async function init() {
  els.date.value = new Date().toISOString().slice(0, 10);
  try {
    const data = await api('/api/me');
    user = data.user;
  } catch {}
  renderAuthArea();
  await refresh();
}

init();
