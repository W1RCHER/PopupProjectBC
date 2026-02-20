document.querySelectorAll(".tab-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

document.getElementById("analyze").addEventListener("click", () => {
  const status = document.getElementById("status");
  status.textContent = "🔄 Запрос на запуск анализа...";
  chrome.runtime.sendMessage({ action: "analyze" }, resp => {
    if (!resp) { status.textContent = "❌ Нет ответа от фонового скрипта."; return; }
    if (resp.status === "no_tab") { status.textContent = "❌ Нет активной вкладки."; return; }
    if (resp.status === "error") { status.textContent = `❌ Ошибка: ${resp.message}`; return; }
    if (resp.status === "injected") {
      status.textContent = "🟢 content.js внедрён — анализ выполняется...";
      setTimeout(async () => {
        await loadResults();
        status.textContent = "✅ Анализ завершён. Перейдите во вкладку Результаты.";
      }, 1000);
    }
  });
});

async function loadResults() {
  const data = await chrome.storage.local.get("scanResults");
  const container = document.getElementById("resultList");
  container.innerHTML = "";
  const filter = document.getElementById("levelFilter").value;

  (data.scanResults || []).forEach(entry => {
    const filteredScripts = filter === "all"
      ? entry.results
      : entry.results.filter(r =>
          (filter === "green" && r.color === "green") ||
          (filter === "orange" && r.color === "orange") ||
          (filter === "red" && r.color === "red")
        );

    if (filteredScripts.length === 0) return;

    const card = document.createElement("div");
    card.className = "entry-card";

    const header = document.createElement("div");
    header.className = "entry-header";
    header.textContent = `${entry.date} — ${entry.url} — найдено: ${filteredScripts.length}`;
    card.appendChild(header);

    const listDiv = document.createElement("div");
    listDiv.className = "script-list";

    filteredScripts.forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "script-entry";

      const title = document.createElement("b");
      title.textContent = `Script ${i + 1}: `;
      const level = document.createElement("span");
      level.style.color = r.color;
      level.textContent = r.level;

      const src = document.createElement("div");
      src.style.fontSize = "11px";
      src.textContent = r.src || "";

      const pre = document.createElement("pre");
      pre.textContent = r.snippet || "";

      item.appendChild(title);
      item.appendChild(level);
      item.appendChild(document.createElement("br"));
      item.appendChild(src);
      item.appendChild(pre);
      listDiv.appendChild(item);
    });

    listDiv.style.display = "none";
    header.addEventListener("click", () => {
      listDiv.style.display = listDiv.style.display === "none" ? "block" : "none";
    });

    card.appendChild(listDiv);
    container.appendChild(card);
  });
}

document.getElementById("levelFilter").addEventListener("change", loadResults);

document.getElementById("clearResults").addEventListener("click", async () => {
  await chrome.storage.local.remove("scanResults");
  loadResults();
});

const checkInline = document.getElementById("checkInline");
const checkExternal = document.getElementById("checkExternal");
const checkDanger = document.getElementById("checkDanger");
const saveSettings = document.getElementById("saveSettings");

chrome.storage.sync.get(
  { checkInline: true, checkExternal: true, checkDanger: true },
  data => {
    checkInline.checked = data.checkInline;
    checkExternal.checked = data.checkExternal;
    checkDanger.checked = data.checkDanger;
  }
);

saveSettings.addEventListener("click", () => {
  chrome.storage.sync.set({
    checkInline: checkInline.checked,
    checkExternal: checkExternal.checked,
    checkDanger: checkDanger.checked
  }, () => alert("✅ Настройки сохранены!"));
});
