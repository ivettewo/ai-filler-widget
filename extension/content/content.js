(() => {
  let pickActive = false;
  let pickProject = null;
  let rootEl = null;
  let badgeEl = null;
  let uiContainer = null;
  let exitBtn = null;
  let debugBtn = null;
  let statusBadge = null;
  let debugPanel = null;
  let debugActive = false;
  let requestInFlight = false;

  const BADGE_OFFSET_X = 14;
  const BADGE_OFFSET_Y = 16;

  function isFillable(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  function escapeSelector(value) {
    if (window.CSS && CSS.escape) {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  const DATA_LABEL_KEYS = [
    "data-label",
    "data-field-label",
    "data-title",
    "data-name",
    "data-placeholder",
    "data-testid",
    "data-qa",
    "data-test"
  ];

  function cleanLabelText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s*\*+\s*/g, " ")
      .replace(/\s*(required|optional)\s*$/i, "")
      .trim();
  }

  function getAriaLabelledByText(el) {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (!labelledBy) return "";
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const parts = ids
      .map((id) => {
        const node = document.getElementById(id);
        return node && node.textContent ? node.textContent.trim() : "";
      })
      .filter(Boolean);
    return parts.join(" ").trim();
  }

  function getDataLabel(el) {
    for (const key of DATA_LABEL_KEYS) {
      const value = el.getAttribute(key);
      if (value) return value.trim();
    }
    return "";
  }

  function getNearbyLabelText(el) {
    const maxLen = 160;
    const container =
      el.closest(
        "fieldset, .form-group, .field, .input-group, .form-field, [role='group'], [data-field], [data-form-field]"
      ) || el.parentElement;
    if (!container) return "";

    const selectors = [
      "label",
      "legend",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      ".label",
      ".field-label",
      ".input-label",
      ".help-text",
      ".hint",
      ".description",
      "small"
    ];
    const nodes = container.querySelectorAll(selectors.join(","));
    for (const node of nodes) {
      if (!node || node === el) continue;
      const text = cleanLabelText(node.textContent);
      if (text && text.length <= maxLen) return text;
    }

    const sibling = el.previousElementSibling;
    if (sibling && sibling !== el) {
      const text = cleanLabelText(sibling.textContent);
      if (text && text.length <= maxLen) return text;
    }

    return "";
  }

  function getFieldMeta(el) {
    if (!el) return { fieldLabel: "", sources: [], signals: {} };

    const sources = [];
    const addSource = (type, value) => {
      const cleaned = cleanLabelText(value);
      if (cleaned) sources.push({ type, value: cleaned });
    };

    if (el.id) {
      const selector = `label[for="${escapeSelector(el.id)}"]`;
      const label = document.querySelector(selector);
      if (label && label.textContent) {
        addSource("label-for", label.textContent);
      }
    }

    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent) {
      addSource("label-parent", parentLabel.textContent);
    }

    addSource("aria-label", el.getAttribute("aria-label"));
    addSource("aria-labelledby", getAriaLabelledByText(el));
    addSource("placeholder", el.getAttribute("placeholder"));
    addSource("title", el.getAttribute("title"));
    addSource("name", el.getAttribute("name"));
    addSource("id", el.getAttribute("id"));
    addSource("data", getDataLabel(el));
    addSource("nearby", getNearbyLabelText(el));

    const fieldLabel = sources.length ? sources[0].value : "";
    const signals = {
      inputType: el.getAttribute("type") || "",
      autocomplete: el.getAttribute("autocomplete") || "",
      inputMode: el.getAttribute("inputmode") || "",
      maxLength: el.getAttribute("maxlength") || "",
      pattern: el.getAttribute("pattern") || ""
    };

    return { fieldLabel, sources, signals };
  }

  function getFieldValue(el) {
    if (!el) return "";
    if (el.isContentEditable) {
      return String(el.textContent || "").trim();
    }
    if ("value" in el) {
      return String(el.value || "").trim();
    }
    return "";
  }

  function getFieldPlaceholder(el) {
    if (!el || el.isContentEditable) return "";
    return String(el.getAttribute("placeholder") || "").trim();
  }

  function isUiElement(el) {
    if (!el) return false;
    if (rootEl && rootEl.contains(el)) return true;
    return false;
  }

  function insertText(el, text) {
    if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    el.focus();
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function stopPick() {
    pickActive = false;
    pickProject = null;
    debugActive = false;
    requestInFlight = false;
    window.removeEventListener("click", handleClick, true);
    window.removeEventListener("mousemove", handleMouseMove, true);
    if (uiContainer && uiContainer.parentNode) {
      uiContainer.parentNode.removeChild(uiContainer);
    }
    if (badgeEl && badgeEl.parentNode) {
      badgeEl.parentNode.removeChild(badgeEl);
    }
    if (debugPanel && debugPanel.parentNode) {
      debugPanel.parentNode.removeChild(debugPanel);
    }
    if (rootEl && rootEl.parentNode) {
      rootEl.parentNode.removeChild(rootEl);
    }
    rootEl = null;
    uiContainer = null;
    exitBtn = null;
    debugBtn = null;
    statusBadge = null;
    badgeEl = null;
    debugPanel = null;
  }

  function handleMouseMove(event) {
    if (!badgeEl) return;
    badgeEl.style.left = `${event.clientX + BADGE_OFFSET_X}px`;
    badgeEl.style.top = `${event.clientY + BADGE_OFFSET_Y}px`;
  }

  function handleClick(event) {
    if (!pickActive) return;
    if (requestInFlight) return;

    const target = event.target;
    if (isUiElement(target)) {
      return;
    }
    if (!isFillable(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const fieldMeta = getFieldMeta(target);
    const fieldValue = getFieldValue(target);
    const fieldPlaceholder = getFieldPlaceholder(target);

    if (debugActive && debugPanel) {
      debugPanel.textContent = "Request in progress...";
    }

    requestInFlight = true;
    setStatusText("Requesting...");

    chrome.runtime.sendMessage(
      {
        type: "GET_FILL_TEXT",
        project: pickProject,
        fieldLabel: fieldMeta.fieldLabel,
        fieldMeta,
        fieldValue,
        fieldPlaceholder,
        debug: debugActive
      },
      (response) => {
        requestInFlight = false;
        setStatusText("");
        if (!response || !response.ok) {
          if (debugActive && debugPanel) {
            updateDebugPanel({
              prompt: response && response.prompt,
              requestJson: response && response.request,
              responseJson: response && response.response,
              error: response && response.error ? response.error : "Request failed."
            });
          }
          return;
        }
        insertText(target, response.text || "");
        if (debugActive && debugPanel) {
          updateDebugPanel({
            prompt: response.prompt,
            response: response.text,
            requestJson: response.request,
            responseJson: response.response
          });
        }
        if (debugActive) {
          setBadgeText(formatUsage(response.usage));
        }
      }
    );
  }

  function createBadge() {
    const badge = document.createElement("div");
    badge.textContent = "AI Fill mode";
    badge.style.position = "fixed";
    badge.style.zIndex = "2147483647";
    badge.style.padding = "6px 10px";
    badge.style.borderRadius = "10px";
    badge.style.background = "rgba(0, 0, 0, 0.55)";
    badge.style.color = "#ffffff";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "Manrope, Segoe UI, Arial, sans-serif";
    badge.style.letterSpacing = "0.2px";
    badge.style.pointerEvents = "none";
    badge.style.backdropFilter = "blur(6px)";
    return badge;
  }

  function createRootContainer() {
    const root = document.createElement("div");
    root.id = "ai-filler-root";
    root.style.position = "fixed";
    root.style.top = "0";
    root.style.left = "0";
    root.style.zIndex = "2147483647";
    return root;
  }

  function createUiContainer() {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "16px";
    container.style.right = "16px";
    container.style.zIndex = "2147483647";
    container.style.display = "flex";
    container.style.gap = "8px";
    return container;
  }

  function createStatusBadge() {
    const badge = document.createElement("div");
    badge.textContent = "";
    badge.style.padding = "8px 10px";
    badge.style.borderRadius = "10px";
    badge.style.border = "1px solid #2a2d34";
    badge.style.background = "rgba(17, 18, 22, 0.9)";
    badge.style.color = "#cdd5e2";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "Manrope, Segoe UI, Arial, sans-serif";
    badge.style.pointerEvents = "none";
    badge.style.minWidth = "120px";
    badge.style.textAlign = "center";
    badge.style.opacity = "0.4";
    return badge;
  }

  function setStatusText(text) {
    if (!statusBadge) return;
    statusBadge.textContent = text || "";
    statusBadge.style.opacity = text ? "1" : "0.4";
  }

  function createExitButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Exit AI Filler";
    button.style.padding = "8px 12px";
    button.style.borderRadius = "10px";
    button.style.border = "1px solid #2d6bff";
    button.style.background = "#2d6bff";
    button.style.color = "#ffffff";
    button.style.fontSize = "12px";
    button.style.fontFamily = "Manrope, Segoe UI, Arial, sans-serif";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => stopPick());
    return button;
  }

  function createDebugButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Debug";
    button.style.padding = "8px 12px";
    button.style.borderRadius = "10px";
    button.style.border = "1px solid #d0342c";
    button.style.background = "#d0342c";
    button.style.color = "#ffffff";
    button.style.fontSize = "12px";
    button.style.fontFamily = "Manrope, Segoe UI, Arial, sans-serif";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => toggleDebug());
    return button;
  }

  function createDebugPanel() {
    const panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.left = "16px";
    panel.style.right = "16px";
    panel.style.bottom = "16px";
    panel.style.zIndex = "2147483647";
    panel.style.maxHeight = "40vh";
    panel.style.overflow = "auto";
    panel.style.whiteSpace = "pre-wrap";
    panel.style.background = "rgba(17, 18, 22, 0.9)";
    panel.style.border = "1px solid #2a2d34";
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px";
    panel.style.fontSize = "12px";
    panel.style.color = "#ffffff";
    panel.style.fontFamily = "Manrope, Segoe UI, Arial, sans-serif";
    panel.textContent = "Debug panel is active.";
    return panel;
  }

  function updateDebugPanel({ prompt, response, error, requestJson, responseJson }) {
    if (!debugPanel) return;
    const lines = [];
    if (prompt) {
      lines.push("PROMPT");
      lines.push("-----");
      lines.push(prompt);
    }
    if (requestJson) {
      lines.push("REQUEST JSON");
      lines.push("------------");
      lines.push(JSON.stringify(requestJson, null, 2));
    }
    if (responseJson) {
      lines.push("RESPONSE JSON");
      lines.push("-------------");
      lines.push(JSON.stringify(responseJson, null, 2));
    }
    if (response) {
      lines.push("RESPONSE");
      lines.push("--------");
      lines.push(response);
    }
    if (error) {
      lines.push("ERROR");
      lines.push("-----");
      lines.push(error);
    }
    debugPanel.textContent = lines.join("\n");
  }

  function setBadgeText(text) {
    if (!badgeEl) return;
    badgeEl.textContent = text;
  }

  function setBadgeForMode() {
    if (!badgeEl) return;
    if (debugActive) {
      setBadgeText("Request cost: —");
    } else {
      setBadgeText("AI Fill mode");
    }
  }

  function formatUsage(usage) {
    if (!usage) return "Request cost: no data";
    const total = Number.isFinite(usage.totalTokens) ? usage.totalTokens : null;
    const prompt = Number.isFinite(usage.promptTokens) ? usage.promptTokens : null;
    const completion = Number.isFinite(usage.completionTokens)
      ? usage.completionTokens
      : null;
    const fallbackTotal = prompt !== null && completion !== null ? prompt + completion : null;
    const value = total !== null ? total : fallbackTotal;
    if (value === null) return "Request cost: no data";
    return `Request cost: ${value} tokens`;
  }

  function toggleDebug() {
    debugActive = !debugActive;
    if (debugActive) {
      if (!debugPanel) {
        debugPanel = createDebugPanel();
        if (rootEl) {
          rootEl.appendChild(debugPanel);
        } else {
          document.body.appendChild(debugPanel);
        }
      }
      debugBtn.style.background = "#a82c27";
      setBadgeForMode();
    } else {
      if (debugPanel && debugPanel.parentNode) {
        debugPanel.parentNode.removeChild(debugPanel);
      }
      debugPanel = null;
      debugBtn.style.background = "#d0342c";
      setBadgeForMode();
    }
  }

  function startPick(project) {
    if (pickActive) {
      pickProject = project;
      return;
    }
    pickActive = true;
    pickProject = project;
    window.addEventListener("click", handleClick, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    rootEl = createRootContainer();
    badgeEl = createBadge();
    uiContainer = createUiContainer();
    statusBadge = createStatusBadge();
    exitBtn = createExitButton();
    debugBtn = createDebugButton();
    uiContainer.appendChild(statusBadge);
    uiContainer.appendChild(debugBtn);
    uiContainer.appendChild(exitBtn);
    rootEl.appendChild(badgeEl);
    rootEl.appendChild(uiContainer);
    document.body.appendChild(rootEl);
    setBadgeForMode();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "START_FIELD_PICK") {
      startPick(message.project);
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
})();
