(async () => {
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get(
      { checkInline: true, checkExternal: true, checkDanger: true, showHighlights: true },
      resolve
    );
  });

  const MAX_SCRIPT_SIZE = 200_000;
  const FETCH_TIMEOUT = 5000;

  const RULES = [
  { name: "evalString", re: /eval\s*\(\s*['"`]/i, score: 5, desc: "eval(...) со строковым аргументом" },
  { name: "newFunction", re: /new\s+Function\s*\(/i, score: 5, desc: "new Function(...) — создание кода из строки" },
  { name: "documentWrite", re: /document\.write\s*\(/i, score: 3, desc: "document.write(...) — динамическая вставка HTML/JS" },
  { name: "setTimeoutString", re: /setTimeout\s*\(\s*['"`]/i, score: 3, desc: "setTimeout('...') — строковый код в таймере" },
  { name: "setIntervalString", re: /setInterval\s*\(\s*['"`]/i, score: 3, desc: "setInterval('...') — строковый код в интервале" },
  { name: "innerHTMLAssign", re: /(?:\.\s*)innerHTML\s*=/i, score: 2, desc: "Присвоение innerHTML — может внедрять HTML/скрипты" },
  { name: "outerHTMLAssign", re: /(?:\.\s*)outerHTML\s*=/i, score: 2, desc: "Присвоение outerHTML — изменение DOM" },
  { name: "fetchCall", re: /fetch\s*\(\s*['"`]?https?:\/\//i, score: 1, desc: "fetch(...) — сетевой запрос" },
  { name: "xhrCall", re: /XMLHttpRequest/i, score: 1, desc: "XMLHttpRequest — ручной HTTP-запрос" },
  { name: "base64Eval", re: /eval\s*\(\s*atob\s*\(/i, score: 4, desc: "eval(atob(...)) — код декодируется и выполняется" },
  { name: "iframeInjection", re: /<iframe[^>]+src=/i, score: 3, desc: "Создание iframe — возможно внедрение внешнего содержимого" },
  { name: "scriptInjection", re: /<script[^>]*>/i, score: 4, desc: "Создание <script> через строку — динамическая вставка скрипта" },
  { name: "localStorageAccess", re: /localStorage\s*\./i, score: 2, desc: "Доступ к localStorage — возможное сохранение данных" },
  { name: "cookieAccess", re: /document\.cookie/i, score: 3, desc: "Работа с cookie — возможна кража или подмена данных" },
  { name: "navigatorAccess", re: /navigator\.[a-z]+/i, score: 2, desc: "Доступ к navigator — может использоваться для fingerprinting" },
  { name: "windowOpen", re: /window\.open\s*\(/i, score: 2, desc: "window.open(...) — возможно открытие фишинговых окон" },
  { name: "cryptoMining", re: /CryptoJS|miner|WebAssembly\.instantiate/i, score: 4, desc: "Криптомайнинг или скрытые вычисления" },
  { name: "dynamicImport", re: /import\s*\(\s*['"`]/i, score: 3, desc: "Динамический импорт модулей — возможно подгрузка вредоносного кода" },
  { name: "blobExecution", re: /URL\.createObjectURL|Blob\s*\(/i, score: 3, desc: "Blob/URL.createObjectURL — возможно создание исполняемых объектов" },
  { name: "obfuscationHex", re: /\\x[0-9A-F]{2}/i, score: 4, desc: "Обфускация через шестнадцатеричные escape-последовательности" },
  { name: "obfuscationUnicode", re: /\\u[0-9A-F]{4}/i, score: 4, desc: "Обфускация через Unicode escape-последовательности" },
  { name: "hiddenNavigation", re: /window\.location\s*=/i, score: 3, desc: "Перенаправление window.location — возможно фишинг" },
  { name: "clipboardAccess", re: /navigator\.clipboard/i, score: 2, desc: "Доступ к буферу обмена — может красть данные" },
  { name: "postMessage", re: /postMessage\s*\(/i, score: 2, desc: "postMessage(...) — межфреймовое взаимодействие, возможно небезопасное" },
  { name: "regexSuspiciousDomain", re: /https?:\/\/(bit\.ly|tinyurl\.com|goo\.gl|iplogger|grabify)/i, score: 5, desc: "Подозрительная ссылка на сокращённый или трекинг-домен" },
  { name: "shadowDOM", re: /attachShadow\s*\(/i, score: 2, desc: "Создание теневого DOM — может использоваться для скрытия вредоносного контента" },
  { name: "wsConnection", re: /new\s+WebSocket\s*\(/i, score: 3, desc: "WebSocket — постоянное соединение, может использоваться для утечки данных" },
  { name: "dataURLexec", re: /data:text\/html;base64/i, score: 5, desc: "Встраивание base64 HTML через data URL — скрытый вредоносный код" }
];


  function analyzeContent(content) {
    if (!settings.checkDanger)
      return { findings: [], score: 0, level: "Отключено", color: "gray" };

    const findings = [];
    let score = 0;
    for (const r of RULES) {
      try {
        if (r.re.test(content)) {
          findings.push({ name: r.name, description: r.desc });
          score += r.score;
        }
      } catch {}
    }

    let level = "Безопасный", color = "green";
    if (score >= 8) { level = "Опасный"; color = "red"; }
    else if (score >= 3) { level = "Подозрительный"; color = "orange"; }

    return { findings, score, level, color };
  }

  async function safeFetch(url, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return { ok: false, status: resp.status, text: "" };
      const text = await resp.text();
      return { ok: true, text };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, error: e.message || "fetch error" };
    }
  }

  if (settings.showHighlights) {
    const style = document.createElement("style");
    style.textContent = `
      .mal-scan-badge {
        position: absolute;
        z-index: 999999;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 10px;
        color: #fff;
        font-family: sans-serif;
        background: rgba(0,0,0,0.6);
        cursor: default;
        pointer-events: none;
      }
      .mal-scan-frame-red { outline: 2px solid red; }
      .mal-scan-frame-orange { outline: 2px solid orange; }
      .mal-scan-frame-green { outline: 1px solid #3c3; }
    `;
    document.head.appendChild(style);
  }

  function highlightScript(node, level, color, findings) {
  }

  const nodes = Array.from(document.scripts || []);
  const results = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isExternal = !!node.src;
    const srcRaw = node.src || null;
    const rawText = node.textContent ? node.textContent.trim() : "";

    const obj = {
      index: i,
      type: isExternal ? "external" : "inline",
      src: srcRaw,
      snippet: "",
      level: "Не определён",
      color: "gray",
      findings: [],
      length: rawText.length || 0
    };

    if (!isExternal && !settings.checkInline) {
      obj.level = "Пропущено (inline отключён)";
      results.push(obj);
      continue;
    }
    if (isExternal && !settings.checkExternal) {
      obj.level = "Пропущено (external отключён)";
      obj.snippet = srcRaw || "";
      results.push(obj);
      continue;
    }

    if (!isExternal) {
      if (rawText.length > MAX_SCRIPT_SIZE) {
        obj.level = "Пропущен (слишком большой скрипт)";
        obj.color = "gray";
        results.push(obj);
        continue;
      }
      obj.snippet = rawText.slice(0, 800) + (rawText.length > 800 ? "..." : "");
      const analysis = analyzeContent(rawText);
      Object.assign(obj, { ...analysis });
      highlightScript(node, obj.level, obj.color, obj.findings);
      results.push(obj);
      continue;
    }

    const resp = await safeFetch(srcRaw);
    if (!resp.ok) {
      obj.level = "Не доступен";
      obj.color = "gray";
      obj.findings = [{ name: "load_error", description: resp.error || `HTTP ${resp.status}` }];
    } else {
      const code = resp.text;
      if (code.length > MAX_SCRIPT_SIZE) {
        obj.level = "Пропущен (слишком большой скрипт)";
        obj.color = "gray";
      } else {
        obj.snippet = code.slice(0, 800) + (code.length > 800 ? "..." : "");
        const analysis = analyzeContent(code);
        obj.level = analysis.level;
        obj.color = analysis.color;
        obj.findings = analysis.findings;
      }
    }
    highlightScript(node, obj.level, obj.color, obj.findings);
    results.push(obj);
  }

  const record = { url: location.href, date: new Date().toLocaleString(), results };
  const prev = (await chrome.storage.local.get("scanResults")).scanResults || [];
  prev.unshift(record);
  await chrome.storage.local.set({ scanResults: prev });

  try { chrome.runtime.sendMessage({ action: "scan_complete", url: location.href }); } catch {}
  console.log("content.js: scan saved", record.url, "scripts:", results.length);
})();
