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
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

// --- Gestion des onglets (sidebar + mobile-nav) ---
function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabs.forEach((tab) => tab.classList.remove("active"));
      buttons.forEach((b) => b.classList.remove("active"));
      document.getElementById(target).classList.add("active");

      // Active tous les boutons liés au même onglet
      document
        .querySelectorAll(`.tab-btn[data-tab="${target}"]`)
        .forEach((b) => b.classList.add("active"));
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
  row
    .querySelector(".remove-header")
    .addEventListener("click", () => row.remove());
  list.appendChild(node);
}

function collectHeaders() {
  const headers = {};
  document.querySelectorAll(".header-item").forEach((row) => {
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
    list.innerHTML =
      '<div class="empty-state"><p>Aucune requête dans l\'historique</p></div>';
    return;
  }

  list.innerHTML = "";

  history.forEach((item, idx) => {
    const status = item.status;
    const statusText = item.statusText || "";
    // Déterminer type de badge
    let badgeClass = "success";
    let badgeLabel = "";

    if (status === "network-error") {
      badgeClass = "error";
      badgeLabel = "❌ Network Error";
    } else if (typeof status === "number") {
      if (status >= 200 && status < 300) {
        badgeClass = "success";
        badgeLabel = `✅ ${status} ${statusText || "OK"}`;
      } else if (status >= 300 && status < 400) {
        badgeClass = "warning";
        badgeLabel = `⚠️ ${status} ${statusText || "Redirect"}`;
      } else if (status >= 400) {
        badgeClass = "error";
        badgeLabel = `❌ ${status} ${statusText || "Error"}`;
      }
    } else {
      // fallback si status est une string inattendue
      badgeClass = "warning";
      badgeLabel = `⚠️ ${String(status)}`;
    }

    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <h4>
        ${item.method} ${item.url}
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </h4>
      <small>${item.date}</small>
      <pre>${JSON.stringify(item.headers, null, 2)}</pre>
      ${item.body ? `<pre>${item.body}</pre>` : ""}
      <div class="history-actions">
        <button type="button" data-idx="${idx}" class="replay">🔄 Rejouer</button>
        <button type="button" data-idx="${idx}" class="delete">🗑️ Supprimer</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".replay").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const item = getHistory()[idx];
      document.getElementById("method").value = item.method;
      document.getElementById("url").value = item.url;

      const listEl = document.getElementById("headersList");
      listEl.innerHTML = "";
      Object.entries(item.headers || {}).forEach(([k, v]) =>
        addHeaderRow(k, v)
      );
      if (!listEl.children.length) addHeaderRow();

      document.getElementById("bodyInput").value = item.body || "";

      document
        .querySelectorAll(".tab")
        .forEach((tab) => tab.classList.remove("active"));
      document
        .querySelectorAll(".tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
      document.getElementById("request").classList.add("active");
      document
        .querySelectorAll('[data-tab="request"]')
        .forEach((b) => b.classList.add("active"));
    });
  });

  list.querySelectorAll(".delete").forEach((btn) => {
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
  const btn = document.querySelector(
    '#request button[onclick="sendRequest()"]'
  );
  btn.disabled = true;
  btn.innerHTML = "⏳ Envoi en cours...";
}

function hideLoader() {
  const btn = document.querySelector(
    '#request button[onclick="sendRequest()"]'
  );
  btn.disabled = false;
  btn.innerHTML = "🚀 Envoyer la requête";
}

// --- Envoi de requêtes ---
// --- Envoi de requêtes amélioré ---
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
      body: method !== "GET" && body ? body : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    let output;

    if (response.ok) {
      // Succès (200, 201, 204, etc.)
      if (response.status === 204) {
        // Pas de contenu
        document.getElementById(
          "result"
        ).textContent = `✅ ${response.status} ${response.statusText} (No Content)`;
        window.lastResponse = `No Content`;
      } else if (contentType.includes("application/json")) {
        const data = await response.json();
        const output = {
          status: response.status,
          statusText: response.statusText,
          body: data,
        };
        renderResultJSON(output);
        window.lastResponse = output;
      } else {
        const text = await response.text();
        const output = `✅ ${response.status} ${response.statusText}\n${text}`;
        document.getElementById("result").textContent = output;
        window.lastResponse = output;
      }

      // Succès ou erreur HTTP (réponse du serveur)
      saveToHistory({
        method,
        url,
        headers,
        body,
        status: response.status,
        statusText: response.statusText,
      });
    } else {
     
      // Erreur HTTP (400, 404, 500, etc.)
      if (contentType.includes("application/json")) {
        const errorData = await response.json();
        const output = {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        };
        renderResultJSON(output);
        window.lastResponse = output;
      } else {
        const errorText = await response.text();
        const output = `❌ Erreur ${response.status} ${response.statusText}\n${errorText}`;
        document.getElementById("result").textContent = output;
        window.lastResponse = output;
      }

      // Sauvegarder le vrai code HTTP
      saveToHistory({
        method,
        url,
        headers,
        body,
        status: response.status,
        statusText: response.statusText,
      });
    }

    // Switch vers l’onglet Réponse
    document
      .querySelectorAll(".tab")
      .forEach((tab) => tab.classList.remove("active"));
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document.getElementById("response").classList.add("active");
    document
      .querySelectorAll('[data-tab="response"]')
      .forEach((b) => b.classList.add("active"));
  } catch (err) {
    // Cas erreur réseau (pas de réponse du serveur)
    const errorMsg = `❌ Erreur réseau : ${err.message}`;
    document.getElementById("result").textContent = errorMsg;
    window.lastResponse = errorMsg;
    saveToHistory({ method, url, headers, body, status: "network-error" });
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
  const content =
    typeof window.lastResponse === "string"
      ? window.lastResponse
      : JSON.stringify(window.lastResponse, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "response.json";
  link.click();
}

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Affiche les boutons install
  const btnMobile = document.getElementById("installBtnMobile");
  const btnDesktop = document.getElementById("installBtnDesktop");
  if (btnMobile) btnMobile.style.display = "inline-block";
  if (btnDesktop) btnDesktop.style.display = "inline-block";

  function handleInstallClick() {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === "accepted") {
        console.log("✅ Installation acceptée");
      } else {
        console.log("❌ Installation refusée");
      }
      deferredPrompt = null;
      if (btnMobile) btnMobile.style.display = "none";
      if (btnDesktop) btnDesktop.style.display = "none";
    });
  }

  if (btnMobile) btnMobile.addEventListener("click", handleInstallClick);
  if (btnDesktop) btnDesktop.addEventListener("click", handleInstallClick);
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  // Initialisation du thème
  initTheme();

  // Initialisation des onglets (sidebar + mobile-nav)
  initTabs();

  // Rendu de l’historique
  renderHistory();

  // Bouton "Ajouter un header"
  document
    .getElementById("addHeaderBtn")
    .addEventListener("click", () => addHeaderRow());

  // Headers courants
  document.getElementById("commonHeaders").addEventListener("change", (e) => {
    if (e.target.value) {
      const [key, value] = e.target.value.split(":").map((s) => s.trim());
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
