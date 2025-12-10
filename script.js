
    // --- Gestion du mode sombre (sans localStorage) ---
    const THEME_STATE = { current: 'light' };

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      THEME_STATE.current = theme;
      const iconMobile = document.getElementById("themeIconMobile");
      const iconDesktop = document.getElementById("themeIconDesktop");
      const icon = theme === "dark" ? "☀️" : "🌙";
      if (iconMobile) iconMobile.textContent = icon;
      if (iconDesktop) iconDesktop.textContent = icon;
    }

    function toggleTheme() {
      const newTheme = THEME_STATE.current === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    }

    function initTheme() {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }

    // --- Gestion de la sidebar (onglets) ---
    function initTabs() {
      const buttons = document.querySelectorAll(".tab-btn");
      const tabs = document.querySelectorAll(".tab");

      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.tab;
          
          // Remove active from all tabs and buttons
          tabs.forEach(tab => tab.classList.remove("active"));
          buttons.forEach(b => b.classList.remove("active"));
          
          // Add active to clicked
          document.getElementById(target).classList.add("active");
          btn.classList.add("active");
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

    // --- Historique (en mémoire) ---
    const HISTORY_STATE = { items: [] };

    function saveToHistory(entry) {
      HISTORY_STATE.items.unshift({ ...entry, date: new Date().toISOString() });
      HISTORY_STATE.items = HISTORY_STATE.items.slice(0, 50);
      renderHistory();
    }

    function renderHistory() {
      const list = document.getElementById("historyList");
      if (!list) return;
      
      if (HISTORY_STATE.items.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>Aucune requête dans l\'historique</p></div>';
        return;
      }
      
      list.innerHTML = "";
      HISTORY_STATE.items.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
          <h4>${item.method} ${item.url}</h4>
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
          const item = HISTORY_STATE.items[idx];
          document.getElementById("method").value = item.method;
          document.getElementById("url").value = item.url;

          const listEl = document.getElementById("headersList");
          listEl.innerHTML = "";
          Object.entries(item.headers || {}).forEach(([k, v]) => addHeaderRow(k, v));
          if (!listEl.children.length) addHeaderRow();

          document.getElementById("bodyInput").value = item.body || "";
          
          // Switch to request tab
          document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
          document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
          document.getElementById("request").classList.add("active");
          document.querySelector('[data-tab="request"]').classList.add("active");
        });
      });

      list.querySelectorAll(".delete").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = +btn.dataset.idx;
          HISTORY_STATE.items.splice(idx, 1);
          renderHistory();
        });
      });
    }

    // --- Envoi de requêtes ---
    async function sendRequest() {
      const method = document.getElementById("method").value;
      const url = document.getElementById("url").value.trim();
      const body = document.getElementById("bodyInput").value;
      const headers = collectHeaders();

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

        saveToHistory({ method, url, headers, body });

        // Switch to response tab
        document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        document.getElementById("response").classList.add("active");
        document.querySelector('[data-tab="response"]').classList.add("active");

      } catch (err) {
        document.getElementById("result").textContent = "❌ Erreur : " + err.message;
        
        // Switch to response tab
        document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        document.getElementById("response").classList.add("active");
        document.querySelector('[data-tab="response"]').classList.add("active");
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
      initTheme();
      initTabs();
      renderHistory();
      
      // Add header button
      document.getElementById("addHeaderBtn").addEventListener("click", () => addHeaderRow());
      
      // Common headers select
      document.getElementById("commonHeaders").addEventListener("change", (e) => {
        if (e.target.value) {
          const [key, value] = e.target.value.split(":").map(s => s.trim());
          addHeaderRow(key, value);
          e.target.value = "";
        }
      });
      
      // Add default empty header
      addHeaderRow();
    });
 