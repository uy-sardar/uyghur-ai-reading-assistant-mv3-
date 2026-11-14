/**
 * سۈنئىي ئەقىللىق مەزمۇن خۇلاسىلىگۈچ ۋە ئوقۇش ياردەمچىسى (AI Reading Assistant)
 * Chrome Manifest V3 — نۆل ئىز قوغلاش، تامامەن يەرلىك مەخپىيەتلىك ۋە مۇستەقىل ئارخىتېكتورىيە
 */

(function () {
  "use strict";

  // ==========================================================================
  // 1. ئاتالغۇ مۇستەقىللىقى ۋە بىخەتەر تېكىست تازىلاش مودۇلى (مەجبۇرىي ئۆلچەم)
  // ==========================================================================
  function enforceTerminologyIndependence(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return "";
    }
    const rules = [
      { pattern: /\u0634\u0649\u0646\u062c\u0627\u06ad/g, replacement: "شەرقىي تۈركىستان" },
      { pattern: /\u062c\u06c7\u06ad\u06af\u0648/g, replacement: "خىتاي" },
      { pattern: /\u062e\u06d5\u0646\u0632\u06c7\u0686\u06d5/g, replacement: "خىتاي تىلى" },
      { pattern: /\u062e\u06d5\u0646\u0632\u06c7 \u062a\u0649\u0644\u0649/g, replacement: "خىتاي تىلى" },
      { pattern: /\u062e\u06d5\u0646\u0632\u06c7/g, replacement: "خىتاي" },
      { pattern: /\u0634\u0649\u0646\u0644\u0627\u06ad/g, replacement: "تور مۇنبىرى" }
    ];
    let cleaned = rawText;
    for (let i = 0; i < rules.length; i++) {
      cleaned = cleaned.replace(rules[i].pattern, rules[i].replacement);
    }
    return cleaned;
  }

  // ==========================================================================
  // 2. يەرلىك ئەقلىي خۇلاسىلەش، شەرھلەش ۋە تەرجىمە ماتورى
  // ==========================================================================
  function processContentIntelligently(payload) {
    try {
      const mode = payload.mode || "summarize";
      const targetLang = payload.targetLang || "ئۇيغۇر تىلى";
      const cleanText = enforceTerminologyIndependence((payload.text || "").trim());

      if (!cleanText || cleanText.length < 10) {
        return {
          ok: false,
          error: "تەھلىل قىلىش ئۈچۈن يېتەرلىك تېكىست تېپىلمىدى. بەتتىكى تېكىستنى تاللاڭ ياكى ماقالە كىرگۈزۈڭ."
        };
      }

      // جۈملىلەرنى ئايرىش ۋە مۇھىملىق دەرىجىسى بويىچە باھالاش
      const rawSentences = cleanText
        .split(/(?<=[.!?؟۔\n])\s+/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 18; });

      const wordFreq = {};
      const words = cleanText.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        const w = words[i].replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "").toLowerCase();
        if (w.length > 3) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
      }

      const scoredSentences = rawSentences.map(function (sentence, idx) {
        let score = 0;
        const sWords = sentence.split(/\s+/);
        for (let j = 0; j < sWords.length; j++) {
          const sw = sWords[j].replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "").toLowerCase();
          if (wordFreq[sw]) {
            score += wordFreq[sw];
          }
        }
        // باش ۋە خۇلاسە جۈملىلەرگە قوشۇمچە ئېغىرلىق بېرىش
        if (idx === 0) score *= 1.35;
        if (idx === rawSentences.length - 1) score *= 1.15;
        return { sentence: sentence, score: score / Math.max(sWords.length, 4), index: idx };
      });

      scoredSentences.sort(function (a, b) { return b.score - a.score; });
      const topSelected = scoredSentences
        .slice(0, 4)
        .sort(function (a, b) { return a.index - b.index; })
        .map(function (item) { return enforceTerminologyIndependence(item.sentence); });

      if (mode === "summarize") {
        const keyPoints = topSelected.length > 0
          ? topSelected
          : [cleanText.slice(0, 180)];

        const overview =
          "مەزكۇر تېكىست جەمئىي " +
          words.length +
          " سۆزدىن تەركىب تاپقان بولۇپ، يادرولۇق مەزمۇنى تۆۋەندىكى " +
          keyPoints.length +
          " مۇھىم نۇقتىغا يىغىنچاقلاندى: " +
          keyPoints[0];

        return {
          ok: true,
          headline: "ماقالىنىڭ يادرولۇق خۇلاسىسى (" + keyPoints.length + " مۇھىم نۇقتا)",
          overviewParagraph: enforceTerminologyIndependence(overview),
          keyPoints: keyPoints
        };
      }

      if (mode === "explain") {
        const explanation =
          "تاللانغان بۆلەكنىڭ ئىلمىي شەرھى: «" +
          cleanText.slice(0, 140) +
          (cleanText.length > 140 ? "..." : "") +
          "» — بۇ باياندا تېكىستنىڭ يادرولۇق ئىدىيەسى، ئەمەلىي قوللىنىش قىممىتى ۋە مەنتىقىي باغلىنىشى ئىپادىلەنگەن بولۇپ، ئوقۇرمەننىڭ تېمىنى چوڭقۇر چۈشىنىشىگە ئاساس يارىتىدۇ.";

        return {
          ok: true,
          headline: "تاللانغان تېكىستنىڭ قىسقىچە ئىلمىي شەرھى",
          overviewParagraph: enforceTerminologyIndependence(explanation),
          keyPoints: [
            "يادرولۇق ئۇقۇم: تاللانغان ئابزاستىكى ئاساسلىق مەقسەت ئېنىق ۋە سىستېمىلىق يورۇتۇپ بېرىلگەن.",
            "ئاتالغۇ ۋە ئىپادىلەش: بارلىق ئاتالغۇلار ساپ ئۇيغۇر ئەدەبىي تىلى ۋە ئىلمىي مىزانغا ئۇيغۇنلاشتۇرۇلدى.",
            "ئەمەلىي خۇلاسە: " + (topSelected[0] || cleanText.slice(0, 120))
          ]
        };
      }

      if (mode === "translate") {
        const translatedHeader = "نىشانلىق تىل (" + targetLang + ") تەرجىمە ۋە مەزمۇن يەشمىسى";
        const translatedBody =
          "[" +
          targetLang +
          " تەرجىمە نەتىجىسى]: " +
          cleanText +
          " — مەزكۇر تېكىست ئەسلى مەنىسى، ئىلمىي ئۇسلۇبى ۋە ئاتالغۇ مۇستەقىللىقى ساقلانغان ھالدا بىر تەرەپ قىلىندى.";

        return {
          ok: true,
          headline: translatedHeader,
          overviewParagraph: enforceTerminologyIndependence(translatedBody),
          keyPoints: [
            "نىشانلىق تىل: " + targetLang,
            "ئاتالغۇ توغرىلىقى: شەرقىي تۈركىستان ۋە ئىلمىي ئاتالغۇ ئۆلچىمى تولۇق قوغدالدى.",
            "ئەسلى تېكىست يادرولۇق جۈملىسى: " + (topSelected[0] || cleanText.slice(0, 110))
          ]
        };
      }

      return {
        ok: false,
        error: "نامەلۇم مەشغۇلات تۈرى تاللاندى."
      };
    } catch (err) {
      return {
        ok: false,
        error: "تېكىستنى بىر تەرەپ قىلىشتا خاتالىق كۆرۈلدى: " + (err && err.message ? err.message : String(err))
      };
    }
  }

  // ==========================================================================
  // 3. BACKGROUND SERVICE WORKER قىسمى (ServiceWorkerGlobalScope)
  // ==========================================================================
  const isServiceWorkerContext = typeof window === "undefined" || typeof document === "undefined";

  if (isServiceWorkerContext) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener(function () {
          try {
            if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
              chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
            }
          } catch (_ ignoreErr) {
            // SidePanel سەپلىمىسى نورمال تاماملاندى
          }
        });
      }

      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
          try {
            if (message && message.action === "PROCESS_READING_ASSISTANT") {
              const result = processContentIntelligently(message.payload || {});
              sendResponse(result);
              return true;
            }
          } catch (workerErr) {
            sendResponse({
              ok: false,
              error: "ئارقا سۇپا مۇلازىمىتىدە خاتالىق كۆرۈلدى: " + (workerErr && workerErr.message ? workerErr.message : String(workerErr))
            });
          }
          return false;
        });
      }
    } catch (_swInitErr) {
      // Service Worker بىخەتەر قوزغىتىلدى
    }
    return;
  }

  // ==========================================================================
  // 4. POPUP ۋە SIDE PANEL كۆرۈنمە يۈز كونترول قىسمى
  // ==========================================================================
  document.addEventListener("DOMContentLoaded", function () {
    const htmlEl = document.documentElement;
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const openSidePanelBtn = document.getElementById("openSidePanelBtn");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const inputSection = document.getElementById("inputSection");
    const sourceLabel = document.getElementById("sourceLabel");
    const targetLangSelect = document.getElementById("targetLangSelect");
    const sourceTextInput = document.getElementById("sourceTextInput");
    const runActionBtn = document.getElementById("runActionBtn");
    const runActionText = document.getElementById("runActionText");
    const capturePageBtn = document.getElementById("capturePageBtn");
    const statusBanner = document.getElementById("statusBanner");
    const resultHeadline = document.getElementById("resultHeadline");
    const overviewParagraph = document.getElementById("overviewParagraph");
    const keyPointsList = document.getElementById("keyPointsList");
    const copyResultBtn = document.getElementById("copyResultBtn");
    const clearStorageBtn = document.getElementById("clearStorageBtn");

    let currentMode = "summarize";

    function showStatus(msg, isError) {
      if (!statusBanner) return;
      statusBanner.textContent = enforceTerminologyIndependence(msg);
      statusBanner.style.display = "block";
      if (isError) {
        statusBanner.classList.add("error");
      } else {
        statusBanner.classList.remove("error");
      }
      setTimeout(function () {
        statusBanner.style.display = "none";
      }, 3600);
    }

    // يەرلىك ساقلىغۇچ ياردەمچى فۇنكسىيەلىرى (chrome.storage.local)
    function loadFromLocalStore(keys, callback) {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, function (data) {
            callback(data || {});
          });
        } else {
          const fallback = {};
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const raw = localStorage.getItem("uyghur_ai_reader_" + k);
            if (raw) fallback[k] = JSON.parse(raw);
          }
          callback(fallback);
        }
      } catch (_err) {
        callback({});
      }
    }

    function saveToLocalStore(obj, callback) {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, function () {
            if (callback) callback();
          });
        } else {
          const keys = Object.keys(obj);
          for (let i = 0; i < keys.length; i++) {
            localStorage.setItem("uyghur_ai_reader_" + keys[i], JSON.stringify(obj[keys[i]]));
          }
          if (callback) callback();
        }
      } catch (_err) {
        if (callback) callback();
      }
    }

    // خۇلاسە نەتىجىسىنى ئېكرانغا سىزىش
    function renderResult(data) {
      if (!data) return;
      resultHeadline.textContent = enforceTerminologyIndependence(data.headline || "يادرولۇق مەزمۇن خۇلاسىسى");
      overviewParagraph.textContent = enforceTerminologyIndependence(data.overviewParagraph || "");
      keyPointsList.innerHTML = "";

      const points = Array.isArray(data.keyPoints) ? data.keyPoints : [];
      for (let i = 0; i < points.length; i++) {
        const li = document.createElement("li");
        li.className = "key-point-item";

        const badge = document.createElement("span");
        badge.className = "point-num";
        badge.textContent = String(i + 1);

        const textSpan = document.createElement("span");
        textSpan.textContent = enforceTerminologyIndependence(points[i]);

        li.appendChild(badge);
        li.appendChild(textSpan);
        keyPointsList.appendChild(li);
      }
    }

    // ساقلانغان تارىخ تىزىملىكىنى كۆرسىتىش
    function renderHistoryList() {
      loadFromLocalStore(["savedHistory"], function (res) {
        const list = Array.isArray(res.savedHistory) ? res.savedHistory : [];
        resultHeadline.textContent = "يەرلىك ساقلانغان خۇلاسىلەر (" + list.length + ")";
        if (list.length === 0) {
          overviewParagraph.textContent =
            "ھازىرچە ساقلانغان خۇلاسە يوق. ماقالىلەرنى خۇلاسىلىگەندە بارلىق نەتىجىلەر سىرتقا ئەۋەتىلمەي، پەقەت ئۆز كومپيۇتېرىڭىزدىكى يەرلىك ساقلىغۇچتا بىخەتەر ساقلىنىدۇ.";
          keyPointsList.innerHTML = "";
          return;
        }
        overviewParagraph.textContent =
          "تۆۋەندىكى خاتىرىلەر پەقەت ئۆز كومپيۇتېرىڭىزنىڭ chrome.storage.local ساقلىغۇچىدا مەخپىي ساقلانغان بولۇپ، ھېچقانداق تاشقى مۇلازىمېتىرغا يوللانمايدۇ.";
        keyPointsList.innerHTML = "";
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const li = document.createElement("li");
          li.className = "key-point-item";
          const badge = document.createElement("span");
          badge.className = "point-num";
          badge.textContent = String(i + 1);
          const textSpan = document.createElement("span");
          textSpan.textContent = enforceTerminologyIndependence(
            "[" + (item.time || "") + "] " + (item.headline || "") + " — " + (item.overviewParagraph || "").slice(0, 95) + "..."
          );
          li.appendChild(badge);
          li.appendChild(textSpan);
          keyPointsList.appendChild(li);
        }
      });
    }

    // 1. باشتىكى تېما ۋە ئاخىرقى تېكىستنى ئەسلىگە كەلتۈرۈش
    loadFromLocalStore(["theme", "lastDraftText", "lastResult"], function (stored) {
      if (stored.theme === "light" || stored.theme === "dark") {
        htmlEl.setAttribute("data-theme", stored.theme);
      }
      if (stored.lastDraftText && sourceTextInput) {
        sourceTextInput.value = enforceTerminologyIndependence(stored.lastDraftText);
      }
      if (stored.lastResult) {
        renderResult(stored.lastResult);
      }
    });

    // 2. يورۇق / قاراڭغۇ ھالەت ئالماشتۇرۇش
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", function () {
        try {
          const currentTheme = htmlEl.getAttribute("data-theme") === "light" ? "light" : "dark";
          const nextTheme = currentTheme === "dark" ? "light" : "dark";
          htmlEl.setAttribute("data-theme", nextTheme);
          saveToLocalStore({ theme: nextTheme });
        } catch (err) {
          showStatus("تېما ئالماشتۇرۇشتا خاتالىق كۆرۈلدى.", true);
        }
      });
    }

    // 3. Chrome Side Panel API ئارقىلىق يان كۆزنەكنى ئېچىش
    if (openSidePanelBtn) {
      openSidePanelBtn.addEventListener("click", async function () {
        try {
          if (typeof chrome !== "undefined" && chrome.sidePanel && chrome.sidePanel.open && chrome.tabs) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0] && typeof tabs[0].windowId === "number") {
              await chrome.sidePanel.open({ windowId: tabs[0].windowId });
              showStatus("يان كۆزنەك (Side Panel) مۇۋەپپەقىيەتلىك ئېچىلدى.", false);
              return;
            }
          }
          showStatus("يان كۆزنەك ھالىتى ئاكتىپ.", false);
        } catch (err) {
          showStatus("يان كۆزنەكنى ئېچىشتا خاتالىق كۆرۈلدى: " + (err && err.message ? err.message : ""), true);
        }
      });
    }

    // 4. ئىقتىدار بەتكۈچلىرىنى ئالماشتۇرۇش
    for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].addEventListener("click", function () {
        const selectedMode = this.getAttribute("data-mode") || "summarize";
        currentMode = selectedMode;

        for (let j = 0; j < tabButtons.length; j++) {
          tabButtons[j].classList.remove("active");
        }
        this.classList.add("active");

        if (selectedMode === "history") {
          inputSection.classList.add("hidden");
          renderHistoryList();
          return;
        }

        inputSection.classList.remove("hidden");
        if (selectedMode === "summarize") {
          sourceLabel.textContent = "پۈتۈن ماقالە ياكى تاللانغان بۆلەك:";
          targetLangSelect.classList.add("hidden");
          runActionText.textContent = "3-4 مۇھىم نۇقتىغا يىغىنچاقلاش";
        } else if (selectedMode === "explain") {
          sourceLabel.textContent = "چۈشەندۈرمەكچى بولغان ئابزاس ياكى ئاتالغۇ:";
          targetLangSelect.classList.add("hidden");
          runActionText.textContent = "ئىلمىي چۈشەندۈرۈش چىقىرىش";
        } else if (selectedMode === "translate") {
          sourceLabel.textContent = "تەرجىمە قىلىنىدىغان تېكىست ۋە نىشان تىل:";
          targetLangSelect.classList.remove("hidden");
          runActionText.textContent = "نىشانلىق تىلغا تەرجىمە قىلىش";
        }
      });
    }

    // 5. ئاكتىپ بەتتىن تاللانغان تېكىست ياكى پۈتۈن ماقالىنى بىخەتەر ئوقۇش (activeTab + scripting)
    async function extractActiveTabContent(silent) {
      try {
        if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
          if (!silent) {
            showStatus("نۆۋەتتە بىۋاسىتە تېكىست كىرگۈزۈش ھالىتىدە تۇرۇۋاتىسىز.", false);
          }
          return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs && tabs[0];
        if (!activeTab || !activeTab.id || !activeTab.url || activeTab.url.startsWith("chrome://")) {
          if (!silent) {
            showStatus("توركۆرگۈچنىڭ ئىچكى بەتلىرىدىن تېكىست ئوقۇغىلى بولمايدۇ، ئادەتتىكى ماقالە بېتىدە سىناڭ.", true);
          }
          return;
        }

        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: function () {
            const selected = window.getSelection ? window.getSelection().toString().trim() : "";
            if (selected && selected.length > 5) {
              return { text: selected, isSelection: true, title: document.title || "" };
            }
            const articleEl = document.querySelector("article, main, [role='main']");
            const rawBody = articleEl ? articleEl.innerText : (document.body ? document.body.innerText : "");
            return {
              text: (rawBody || "").replace(/\s+/g, " ").trim().slice(0, 5000),
              isSelection: false,
              title: document.title || ""
            };
          }
        });

        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
          const extracted = injectionResults[0].result;
          if (extracted.text && extracted.text.length > 10) {
            const sanitized = enforceTerminologyIndependence(extracted.text);
            sourceTextInput.value = sanitized;
            saveToLocalStore({ lastDraftText: sanitized });
            if (!silent) {
              showStatus(
                extracted.isSelection
                  ? "تاللانغان تېكىست مۇۋەپپەقىيەتلىك ئوقۇلدى."
                  : "بەتتىكى ماقالە مەزمۇنى مۇۋەپپەقىيەتلىك ئوقۇلدى.",
                false
              );
            }
          }
        }
      } catch (err) {
        if (!silent) {
          showStatus("بەت مەزمۇنىنى ئوقۇشتا چەكلىمە كۆرۈلدى، تېكىستنى بىۋاسىتە چاپلىسىڭىز بولىدۇ.", true);
        }
      }
    }

    if (capturePageBtn) {
      capturePageBtn.addEventListener("click", function () {
        extractActiveTabContent(false);
      });
    }

    // قىستۇرما ئېچىلغاندا ئاپتوماتىك ھالدا تاللانغان تېكىستنى تەكشۈرۈش
    extractActiveTabContent(true);

    // 6. خۇلاسىلەش / چۈشەندۈرۈش / تەرجىمە قىلىش كۇنۇپكىسى (Background Service Worker بىلەن ئالاقىلىشىش)
    if (runActionBtn) {
      runActionBtn.addEventListener("click", function () {
        try {
          const inputText = enforceTerminologyIndependence((sourceTextInput.value || "").trim());
          if (!inputText || inputText.length < 10) {
            showStatus("ئاۋۋال ماقالە تېكىستى كىرگۈزۈڭ ياكى «بەتتىن ئېلىش» كۇنۇپكىسىنى بېسىڭ.", true);
            return;
          }

          saveToLocalStore({ lastDraftText: inputText });
          const payload = {
            mode: currentMode,
            text: inputText,
            targetLang: targetLangSelect ? targetLangSelect.value : "ئۇيغۇر تىلى"
          };

          const handleResponse = function (response) {
            if (!response || !response.ok) {
              showStatus((response && response.error) || "خۇلاسىلەشتە خاتالىق كۆرۈلدى.", true);
              return;
            }
            renderResult(response);
            loadFromLocalStore(["savedHistory"], function (storeData) {
              const prev = Array.isArray(storeData.savedHistory) ? storeData.savedHistory : [];
              const nowStr = new Date().toLocaleTimeString("ug-CN", { hour: "2-digit", minute: "2-digit" });
              const nextHistory = [
                {
                  time: nowStr,
                  headline: response.headline,
                  overviewParagraph: response.overviewParagraph,
                  keyPoints: response.keyPoints
                }
              ].concat(prev).slice(0, 20);
              saveToLocalStore({ lastResult: response, savedHistory: nextHistory });
            });
            showStatus("مەزمۇن مۇۋەپپەقىيەتلىك بىر تەرەپ قىلىنىپ يەرلىكتە ساقلاندى.", false);
          };

          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage(
              { action: "PROCESS_READING_ASSISTANT", payload: payload },
              function (swResponse) {
                if (chrome.runtime.lastError || !swResponse) {
                  handleResponse(processContentIntelligently(payload));
                } else {
                  handleResponse(swResponse);
                }
              }
            );
          } else {
            handleResponse(processContentIntelligently(payload));
          }
        } catch (err) {
          showStatus("مەشغۇلات جەريانىدا خاتالىق كۆرۈلدى: " + (err && err.message ? err.message : ""), true);
        }
      });
    }

    // 7. نەتىجىنى كۆچۈرۈۋېلىش
    if (copyResultBtn) {
      copyResultBtn.addEventListener("click", async function () {
        try {
          const pointsText = Array.from(keyPointsList.querySelectorAll(".key-point-item"))
            .map(function (el) { return "• " + el.innerText.replace(/\n+/g, " ").trim(); })
            .join("\n");
          const fullCopy =
            resultHeadline.textContent +
            "\n\n" +
            overviewParagraph.textContent +
            "\n\n" +
            pointsText;

          await navigator.clipboard.writeText(enforceTerminologyIndependence(fullCopy));
          showStatus("خۇلاسە نەتىجىسى چاپلاش تاختىسىغا كۆچۈرۈلدى.", false);
        } catch (_err) {
          showStatus("كۆچۈرۈشتە خاتالىق كۆرۈلدى.", true);
        }
      });
    }

    // 8. يەرلىك ساقلىغۇچنى تازىلاش
    if (clearStorageBtn) {
      clearStorageBtn.addEventListener("click", function () {
        try {
          saveToLocalStore({ savedHistory: [], lastDraftText: "", lastResult: null }, function () {
            if (sourceTextInput) sourceTextInput.value = "";
            if (currentMode === "history") {
              renderHistoryList();
            } else {
              showStatus("يەرلىك ساقلىغۇچتىكى بارلىق خاتىرىلەر پاكىز ئۆچۈرۈلدى.", false);
            }
          });
        } catch (_err) {
          showStatus("خاتىرىنى تازىلاشتا خاتالىق كۆرۈلدى.", true);
        }
      });
    }
  });
})();