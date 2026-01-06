(() => {
  const templateInput = document.getElementById("prompt-template");
  const languageSelect = document.getElementById("prompt-language");
  const temperatureSelect = document.getElementById("prompt-temperature");
  const saveBtn = document.getElementById("save-settings");
  const saveStatus = document.getElementById("save-status");
  const providerToggle = document.getElementById("provider-toggle");
  const providerMenu = document.getElementById("provider-menu");
  const fieldToggle = document.getElementById("field-toggle");
  const fieldMenu = document.getElementById("field-menu");
  const descriptionToggle = document.getElementById("description-toggle");
  const descriptionMenu = document.getElementById("description-menu");
  const descriptionRadios = document.querySelectorAll(
    "input[name='description-limit']"
  );
  const presetFieldsWrap = document.getElementById("preset-fields");
  const recentFieldsWrap = document.getElementById("recent-fields");
  const docsBtn = document.getElementById("docs-button");
  const reportBugBtn = document.getElementById("report-bug-button");
  const isPopup = window.location.pathname.includes("/popup/");
  let currentPresets = [];
  let cachedRecentFields = [];

  if (
    !templateInput ||
    !languageSelect ||
    !temperatureSelect ||
    !saveBtn ||
    !saveStatus ||
    !presetFieldsWrap ||
    !recentFieldsWrap
  ) {
    return;
  }

  const providerConfigs = [
    {
      id: "openai",
      label: "OpenAI",
      storageKey: "openaiApiKey",
      modelKey: "openaiModel",
      inputId: "api-key-openai",
      hintId: "api-key-hint-openai",
      indicatorId: "api-key-indicator-openai",
      makePrimaryId: "make-primary-openai",
      modelInputId: "model-openai",
      defaultModel: "gpt-4o-mini"
    },
    {
      id: "gemini",
      label: "Gemini",
      storageKey: "geminiApiKey",
      modelKey: "geminiModel",
      inputId: "api-key-gemini",
      hintId: "api-key-hint-gemini",
      indicatorId: "api-key-indicator-gemini",
      makePrimaryId: "make-primary-gemini",
      modelInputId: "model-gemini",
      defaultModel: "gemini-1.5-flash"
    },
    {
      id: "groq",
      label: "GroqCloud",
      storageKey: "groqApiKey",
      modelKey: "groqModel",
      inputId: "api-key-groq",
      hintId: "api-key-hint-groq",
      indicatorId: "api-key-indicator-groq",
      makePrimaryId: "make-primary-groq",
      modelInputId: "model-groq",
      defaultModel: "llama-3.1-8b-instant"
    },
    {
      id: "deepseek",
      label: "Deepseek",
      storageKey: "deepseekApiKey",
      modelKey: "deepseekModel",
      inputId: "api-key-deepseek",
      hintId: "api-key-hint-deepseek",
      indicatorId: "api-key-indicator-deepseek",
      makePrimaryId: "make-primary-deepseek",
      modelInputId: "model-deepseek",
      defaultModel: "deepseek-chat"
    }
  ];

  const providers = providerConfigs
    .map((config) => ({
      ...config,
      input: document.getElementById(config.inputId),
      hint: document.getElementById(config.hintId),
      indicator: document.getElementById(config.indicatorId),
      makePrimaryBtn: document.getElementById(config.makePrimaryId),
      badge: document.querySelector(`.primary-badge[data-provider="${config.id}"]`),
      modelSelect: document.getElementById(config.modelInputId)
    }))
    .filter(
      (provider) =>
        provider.input &&
        provider.indicator &&
        provider.makePrimaryBtn &&
        provider.modelSelect
    );

  if (providers.length !== providerConfigs.length) {
    return;
  }

  let storedPrimary = "";
  let selectedPrimary = "";

  function setStatus(message, isError = false) {
    if (!message) {
      saveStatus.classList.add("hidden");
      saveStatus.textContent = "";
      saveStatus.classList.remove("error");
      saveStatus.classList.remove("success");
      return;
    }
    saveStatus.textContent = message;
    saveStatus.classList.remove("hidden");
    saveStatus.classList.toggle("error", isError);
    saveStatus.classList.toggle("success", message === "Saved." && !isError);
  }

  function setKeyIndicator(provider, isValid) {
    if (!provider.indicator) return;
    provider.indicator.classList.toggle("ok", isValid);
  }

  function updatePrimaryUI(primaryId) {
    providers.forEach((provider) => {
      if (provider.badge) {
        provider.badge.classList.toggle("active", provider.id === primaryId);
      }
      if (provider.makePrimaryBtn) {
        provider.makePrimaryBtn.disabled = provider.id === primaryId;
      }
    });
  }

  function resolvePrimary(preferredPrimary, keyMap) {
    if (preferredPrimary && keyMap[preferredPrimary]) {
      return preferredPrimary;
    }
    for (const provider of providers) {
      if (keyMap[provider.id]) {
        return provider.id;
      }
    }
    return "";
  }

  function normalizeLabel(label) {
    return String(label || "").trim().toLowerCase();
  }

  function isPresetLabel(label) {
    const normalized = normalizeLabel(label);
    return currentPresets.some(
      (preset) => normalizeLabel(preset.label) === normalized
    );
  }

  function findPreset(label) {
    const normalized = normalizeLabel(label);
    return currentPresets.find(
      (preset) => normalizeLabel(preset.label) === normalized
    );
  }

  async function updatePresets(nextPresets) {
    currentPresets = nextPresets;
    await StorageUtil.updateSettings({ fieldPresets: currentPresets });
  }

  async function togglePreset(label) {
    const existing = findPreset(label);
    if (existing) {
      const next = currentPresets.filter(
        (preset) => normalizeLabel(preset.label) !== normalizeLabel(label)
      );
      await updatePresets(next);
    } else {
      const next = [{ label, maxLen: 60 }, ...currentPresets];
      await updatePresets(next);
    }
  }

  function createLimitSelect(value) {
    const select = document.createElement("select");
    select.className = "chip-select";
    for (let i = 10; i <= 100; i += 10) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = String(i);
      select.appendChild(option);
    }
    select.value = String(value);
    return select;
  }

  function renderPresetFields() {
    presetFieldsWrap.textContent = "";
    if (!currentPresets.length) {
      const empty = document.createElement("div");
      empty.className = "chip-button";
      empty.textContent = "No presets yet.";
      empty.style.cursor = "default";
      presetFieldsWrap.appendChild(empty);
      return;
    }
    currentPresets.forEach((preset) => {
      const item = document.createElement("div");
      item.className = "chip-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip-button active";
      button.textContent = preset.label;
      button.addEventListener("click", async () => {
        await togglePreset(preset.label);
        renderAllFields();
      });
      item.appendChild(button);
      const select = createLimitSelect(preset.maxLen || 60);
      select.addEventListener("change", async () => {
        const value = Number(select.value);
        const next = currentPresets.map((entry) =>
          normalizeLabel(entry.label) === normalizeLabel(preset.label)
            ? { ...entry, maxLen: value }
            : entry
        );
        await updatePresets(next);
        renderAllFields();
      });
      item.appendChild(select);
      presetFieldsWrap.appendChild(item);
    });
  }

  function renderRecentFields(fields) {
    recentFieldsWrap.textContent = "";
    const available = (fields || []).filter((label) => !isPresetLabel(label));
    if (!available || available.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chip-button";
      empty.textContent = "No recent fields yet.";
      empty.style.cursor = "default";
      recentFieldsWrap.appendChild(empty);
      return;
    }
    available.forEach((label) => {
      const item = document.createElement("div");
      item.className = "chip-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip-button accent";
      button.textContent = label;
      const preset = findPreset(label);
      if (preset) {
        button.classList.add("active");
      }
      button.addEventListener("click", async () => {
        await togglePreset(label);
        renderAllFields(fields);
      });
      item.appendChild(button);
      if (preset) {
        const select = createLimitSelect(preset.maxLen || 60);
        select.addEventListener("change", async () => {
          const value = Number(select.value);
          const next = currentPresets.map((entry) =>
            normalizeLabel(entry.label) === normalizeLabel(label)
              ? { ...entry, maxLen: value }
              : entry
          );
          await updatePresets(next);
          renderAllFields(fields);
        });
        item.appendChild(select);
      }
      recentFieldsWrap.appendChild(item);
    });
  }

  function renderAllFields(fields = cachedRecentFields) {
    renderPresetFields();
    renderRecentFields(fields);
  }

  async function loadSettings() {
    const settings = await StorageUtil.getSettings();
    const defaultTemplate = StorageUtil.defaultPromptTemplate();
    currentPresets = Array.isArray(settings.fieldPresets) ? settings.fieldPresets : [];
    const descriptionTier = settings.descriptionLimitTier || "small";
    providers.forEach((provider) => {
      const value = settings[provider.storageKey] || "";
      provider.input.value = value;
      if (provider.hint) {
        provider.hint.textContent = "";
      }
      setKeyIndicator(provider, Boolean(value));
      const storedModel = settings[provider.modelKey] || provider.defaultModel;
      provider.modelSelect.value = storedModel;
      if (provider.modelSelect.value !== storedModel) {
        provider.modelSelect.value = provider.defaultModel;
      }
    });
    templateInput.value = defaultTemplate;
    languageSelect.value = settings.language === "Russian" ? "Russian" : "English";
    temperatureSelect.value = String(
      settings.temperature ? Number(settings.temperature).toFixed(1) : "0.2"
    );
    descriptionRadios.forEach((radio) => {
      radio.checked = radio.value === descriptionTier;
    });
    cachedRecentFields = await StorageUtil.getRecentFields();
    renderAllFields(cachedRecentFields);
    storedPrimary = settings.primaryProvider || "";
    const keyMap = providers.reduce((acc, provider) => {
      acc[provider.id] = provider.input.value.trim();
      return acc;
    }, {});
    selectedPrimary = resolvePrimary(storedPrimary, keyMap);
    updatePrimaryUI(selectedPrimary);
  }

  async function validateProvider(provider, apiKey) {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "TEST_API_KEY", provider: provider.id, apiKey },
        (resp) => resolve(resp)
      );
    });
    if (!result || !result.ok) {
      const fallback = `${provider.label} API key validation failed.`;
      return { ok: false, error: result && result.error ? result.error : fallback };
    }
    return { ok: true };
  }

  async function saveSettings() {
    const language = languageSelect.value === "Russian" ? "Russian" : "English";
    const temperature = Number(temperatureSelect.value) || 0.2;
    const descriptionTier = Array.from(descriptionRadios).find((radio) => radio.checked)
      ?.value || "small";
    const tierLimits = { small: 200, medium: 300, large: 500 };
    const maxDescription = tierLimits[descriptionTier] || 200;
    const keyMap = {};
    const modelMap = {};
    providers.forEach((provider) => {
      keyMap[provider.id] = provider.input.value.trim();
      modelMap[provider.id] = provider.modelSelect.value || provider.defaultModel;
    });

    saveBtn.disabled = true;
    for (const provider of providers) {
      const apiKey = keyMap[provider.id];
      if (!apiKey) {
        setKeyIndicator(provider, false);
        continue;
      }
      setStatus(`Validating ${provider.label} API key...`);
      const result = await validateProvider(provider, apiKey);
      if (!result.ok) {
        setStatus(result.error, true);
        setKeyIndicator(provider, false);
        saveBtn.disabled = false;
        return;
      }
      setKeyIndicator(provider, true);
    }
    saveBtn.disabled = false;

    const primaryProvider = resolvePrimary(selectedPrimary || storedPrimary, keyMap);

    const previous = await StorageUtil.getSettings();
    await StorageUtil.updateSettings({
      openaiApiKey: keyMap.openai || "",
      geminiApiKey: keyMap.gemini || "",
      groqApiKey: keyMap.groq || "",
      deepseekApiKey: keyMap.deepseek || "",
      openaiModel: modelMap.openai || "gpt-4o-mini",
      geminiModel: modelMap.gemini || "gemini-1.5-flash",
      groqModel: modelMap.groq || "llama-3.1-8b-instant",
      deepseekModel: modelMap.deepseek || "deepseek-chat",
      primaryProvider,
      promptTemplate: StorageUtil.defaultPromptTemplate(),
      language,
      temperature,
      descriptionLimitTier: descriptionTier
    });
    const prevTier = previous.descriptionLimitTier || "small";
    const prevMax = tierLimits[prevTier] || 200;
    if (maxDescription < prevMax) {
      const projects = await StorageUtil.getProjects();
      const trimmed = projects.map((project) => {
        const desc = String(project.description || "");
        if (desc.length <= maxDescription) return project;
        return { ...project, description: desc.slice(0, maxDescription) };
      });
      await StorageUtil.saveProjects(trimmed);
    }
    storedPrimary = primaryProvider;
    selectedPrimary = primaryProvider;
    updatePrimaryUI(primaryProvider);

    setStatus("Saved.");
    setTimeout(() => setStatus(""), 1500);
  }

  providers.forEach((provider) => {
    provider.makePrimaryBtn.addEventListener("click", () => {
      const apiKey = provider.input.value.trim();
      if (!apiKey) {
        setStatus("Add the API key before setting a primary provider.", true);
        return;
      }
      selectedPrimary = provider.id;
      updatePrimaryUI(selectedPrimary);
      setStatus("Primary provider selected. Click Save to apply.");
    });
  });

  saveBtn.addEventListener("click", saveSettings);
  if (providerToggle && providerMenu) {
    providerToggle.addEventListener("click", () => {
      const isHidden = providerMenu.classList.toggle("hidden");
      providerToggle.setAttribute("aria-expanded", String(!isHidden));
    });
  }
  if (fieldToggle && fieldMenu) {
    fieldToggle.addEventListener("click", () => {
      const isHidden = fieldMenu.classList.toggle("hidden");
      fieldToggle.setAttribute("aria-expanded", String(!isHidden));
    });
  }
  if (descriptionToggle && descriptionMenu) {
    descriptionToggle.addEventListener("click", () => {
      const isHidden = descriptionMenu.classList.toggle("hidden");
      descriptionToggle.setAttribute("aria-expanded", String(!isHidden));
    });
  }
  if (docsBtn && !isPopup) {
    docsBtn.addEventListener("click", () => {
      const url = chrome.runtime.getURL("settings/docs.html");
      window.location.href = url;
    });
  }
  if (reportBugBtn) {
    reportBugBtn.addEventListener("click", () => {
      window.open("https://www.linkedin.com/in/e-shitin/", "_blank", "noopener");
    });
  }

  loadSettings();
})();
