// --- Gestion du mode sombre (avec localStorage) ---
const THEME_KEY = "nts_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  const iconMobile = document.getElementById("themeIconMobile");
  const iconDesktop = document.getElementById("themeIconDesktop");
  const icon = theme === "dark" ? "☀️" : "🌙";
  if (iconMobile) iconMobile.textContent = icon;
  if (iconDesktop) iconDesktop.textContent = icon;
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "light";
  const newTheme = current === "dark" ? "light" : "dark";
  applyTheme(newTheme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

// --- Gestion des onglets (sidebar + mobile-nav) ---
function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabs.forEach(tab => tab.classList.remove("active"));
      buttons.forEach(b => b.classList.remove("active"));
      document.getElementById(target).classList.add("active");

      // Active tous les boutons liés au même onglet
      document.querySelectorAll(`.tab-btn[data-tab="${target}"]`).forEach(b => b.classList.add("active"));
    });
  });
}

// --- Headers dynamiques ---
function addHeaderRow(key = "", value = "") {
  const list = document.getElementById("headersList");
  const tpl = document.getElementById("headerItemTemplate");
  const node = tpl.content.cloneNode(true);
  const row = node.querySelector(".header-item");
  row.querySelector(".header-key").value = key;
  row.querySelector(".header-value").value = value;
  row.querySelector(".remove-header").addEventListener("click", () => row.remove());
  list.appendChild(node);
}

function collectHeaders() {
  const headers = {};
  document.querySelectorAll(".header-item").forEach(row => {
    const key = row.querySelector(".header-key").value.trim();
    const value = row.querySelector(".header-value").value.trim();
    if (key) headers[key] = value;
  });
  return headers;
}

// --- Historique (avec localStorage) ---
const HISTORY_KEY = "nts_api_history";

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(entry) {
  const history = getHistory();
  history.unshift({ ...entry, date: new Date().toLocaleString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;

  const history = getHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Aucune requête dans l\'historique</p></div>';
    return;
  }

  list.innerHTML = "";
  history.forEach((item, idx) => {
    const statusBadge = item.status === "error"
      ? '<span class="badge error">❌ Erreur</span>'
      : `<span class="badge success">✅ ${item.status}</span>`;

    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <h4>${item.method} ${item.url} ${statusBadge}</h4>
      <small>${item.date}</small>
      <pre>${JSON.stringify(item.headers, null, 2)}</pre>
      ${item.body ? `<pre>${item.body}</pre>` : ''}
      <div class="history-actions">
        <button type="button" data-idx="${idx}" class="replay">🔄 Rejouer</button>
        <button type="button" data-idx="${idx}" class="delete">🗑️ Supprimer</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".replay").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const item = getHistory()[idx];
      document.getElementById("method").value = item.method;
      document.getElementById("url").value = item.url;

      const listEl = document.getElementById("headersList");
      listEl.innerHTML = "";
      Object.entries(item.headers || {}).forEach(([k, v]) => addHeaderRow(k, v));
      if (!listEl.children.length) addHeaderRow();

      document.getElementById("bodyInput").value = item.body || "";

      // Switch vers l’onglet Requête
      document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      document.getElementById("request").classList.add("active");
      document.querySelectorAll('[data-tab="request"]').forEach(b => b.classList.add("active"));
    });
  });

  list.querySelectorAll(".delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const history = getHistory();
      history.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    });
  });
}

// --- Loader ---
function showLoader() {
  const btn = document.querySelector('#request button[onclick="sendRequest()"]');
  btn.disabled = true;
  btn.innerHTML = '⏳ Envoi en cours...';
}

function hideLoader() {
  const btn = document.querySelector('#request button[onclick="sendRequest()"]');
  btn.disabled = false;
  btn.innerHTML = '🚀 Envoyer la requête';
}

// --- Envoi de requêtes ---
async function sendRequest() {
  const method = document.getElementById("method").value;
  const url = document.getElementById("url").value.trim();
  const body = document.getElementById("bodyInput").value;
  const headers = collectHeaders();

  if (!url) {
    alert("⚠️ Veuillez entrer une URL valide.");
    return;
  }

  showLoader();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && body ? body : undefined
    });

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
      renderResultJSON(data);
      window.lastResponse = data;
    } else {
      const text = await response.text();
      const codeEl = document.getElementById("result");
      codeEl.textContent = text;
      window.lastResponse = text;
    }

    saveToHistory({ method, url, headers, body, status: response.status });

    // Switch vers l’onglet Réponse
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("response").classList.add("active");
    document.querySelectorAll('[data-tab="response"]').forEach(b => b.classList.add("active"));

  } catch (err) {
    document.getElementById("result").textContent = "❌ Erreur : " + err.message;
    saveToHistory({ method, url, headers, body, status: "error" });
  } finally {
    hideLoader();
  }
}

// --- Affichage JSON ---
function renderResultJSON(obj) {
  const codeEl = document.getElementById("result");
  const pretty = JSON.stringify(obj, null, 2);
  codeEl.textContent = pretty;
  if (window.Prism) {
    Prism.highlightElement(codeEl);
  }
}

// --- Téléchargement ---
function downloadResponse() {
  if (!window.lastResponse) return;
  const content = typeof window.lastResponse === 'string'
    ? window.lastResponse
    : JSON.stringify(window.lastResponse, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "response.json";
  link.click();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  // Initialisation du thème
  initTheme();

  // Initialisation des onglets (sidebar + mobile-nav)
  initTabs();

  // Rendu de l’historique
  renderHistory();

  // Bouton "Ajouter un header"
  document.getElementById("addHeaderBtn").addEventListener("click", () => addHeaderRow());

  // Headers courants
  document.getElementById("commonHeaders").addEventListener("change", (e) => {
    if (e.target.value) {
      const [key, value] = e.target.value.split(":").map(s => s.trim());
      addHeaderRow(key, value);
      e.target.value = "";
    }
  });

  // Ajout d’un header vide par défaut
  addHeaderRow();
});

// --- Service Worker ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(console.error);
}
