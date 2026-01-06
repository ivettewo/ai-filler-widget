(() => {
  const DEFAULT_TEMPLATE =
    "Product description: {{description}}\n" +
    "Field label: {{fieldLabel}}\n" +
    "Field placeholder: {{fieldPlaceholder}}, use for context only, do not copy into the text.\n" +
    "Current value: {{fieldValue}}, If similar to a recent answer, rephrase or pick a different angle.\n" +
    "\n" +
    "Instructions:\n" +
    "- Output only the final text for the field. No explanations.\n" +
    "- Language: {{language}}.\n" +
    "- Target length: 30-100 characters.\n" +
    "- Hard limit: 200 characters.";

  function storageGet(defaults) {
    return new Promise((resolve) => {
      chrome.storage.local.get(defaults, (result) => resolve(result));
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, () => resolve());
    });
  }

  async function getProjects() {
    const result = await storageGet({ projects: [] });
    return result.projects || [];
  }

  async function saveProjects(projects) {
    await storageSet({ projects });
  }

  async function addProject(project) {
    const projects = await getProjects();
    projects.push(project);
    await saveProjects(projects);
    return projects;
  }

  async function updateProject(projectId, updates) {
    const projects = await getProjects();
    const next = projects.map((project) =>
      project.id === projectId ? { ...project, ...updates } : project
    );
    await saveProjects(next);
    return next;
  }

  async function removeProject(projectId) {
    const projects = await getProjects();
    const next = projects.filter((project) => project.id !== projectId);
    await saveProjects(next);
    return next;
  }

  async function getSettings() {
    const result = await storageGet({
      settings: {
        openaiApiKey: "",
        geminiApiKey: "",
        groqApiKey: "",
        deepseekApiKey: "",
        openaiModel: "gpt-4o-mini",
        geminiModel: "gemini-1.5-flash",
        groqModel: "llama-3.1-8b-instant",
        deepseekModel: "deepseek-chat",
        primaryProvider: "",
        language: "English",
        temperature: 0.2,
        descriptionLimitTier: "small",
        fieldPresets: [],
        promptTemplate: DEFAULT_TEMPLATE
      }
    });
    return result.settings || {};
  }

  async function getRecentFields() {
    const result = await storageGet({ recentFields: [] });
    return Array.isArray(result.recentFields) ? result.recentFields : [];
  }

  async function saveRecentFields(recentFields) {
    await storageSet({ recentFields });
  }

  async function updateSettings(partial) {
    const settings = await getSettings();
    const next = { ...settings, ...partial };
    await storageSet({ settings: next });
    return next;
  }

  function defaultPromptTemplate() {
    return DEFAULT_TEMPLATE;
  }

  function generateId() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.StorageUtil = {
    getProjects,
    saveProjects,
    addProject,
    updateProject,
    removeProject,
    getSettings,
    getRecentFields,
    saveRecentFields,
    updateSettings,
    defaultPromptTemplate,
    generateId
  };
})();
