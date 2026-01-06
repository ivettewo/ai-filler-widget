(() => {
  const statusEl = document.getElementById("status");
  const projectListEl = document.getElementById("project-list");
  const newProjectBtn = document.getElementById("new-project");
  const projectFormEl = document.getElementById("project-form");
  const saveProjectBtn = document.getElementById("save-project");
  const cancelProjectBtn = document.getElementById("cancel-project");
  const nameInput = document.getElementById("project-name");
  const descInput = document.getElementById("project-description");
  const descCounter = document.getElementById("description-counter");
  const openSettingsBtn = document.getElementById("open-settings");
  const openProjectsBtn = document.getElementById("open-projects");
  const titleEl = document.querySelector(".app-header .title");
  const appEl = document.querySelector(".app");
  const settingsPanel = document.getElementById("settings-panel");
  const docsPanel = document.getElementById("docs-panel");
  const docsBtn = document.getElementById("docs-button");
  const docsToggleLabels = document.getElementById("docs-toggle-labels");
  const docsMenuLabels = document.getElementById("docs-menu-labels");
  const docsToggleVariation = document.getElementById("docs-toggle-variation");
  const docsMenuVariation = document.getElementById("docs-menu-variation");
  let currentView = "projects";
  let editingProjectId = null;
  const DESCRIPTION_LIMITS = { small: 200, medium: 300, large: 500 };
  let descriptionMaxLen = DESCRIPTION_LIMITS.small;

  function applyDescriptionLimit(settings) {
    const tier = settings && settings.descriptionLimitTier ? settings.descriptionLimitTier : "small";
    const maxLen = DESCRIPTION_LIMITS[tier] || 200;
    descriptionMaxLen = maxLen;
    if (descInput) {
      descInput.maxLength = maxLen;
      updateDescCount();
    }
  }

  function setStatus(message, isError = false) {
    if (!message) {
      statusEl.classList.add("hidden");
      statusEl.textContent = "";
      statusEl.classList.remove("error");
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove("hidden");
    statusEl.classList.toggle("error", isError);
  }

  function resetForm() {
    nameInput.value = "";
    descInput.value = "";
    saveProjectBtn.textContent = "Save";
    editingProjectId = null;
    updateDescCount();
  }

  function openForm(project = null) {
    projectFormEl.classList.remove("hidden");
    if (project) {
      editingProjectId = project.id;
      nameInput.value = project.name;
      descInput.value = project.description;
      saveProjectBtn.textContent = "Update";
    } else {
      resetForm();
    }
    nameInput.focus();
    updateDescCount();
  }

  function closeForm() {
    projectFormEl.classList.add("hidden");
    resetForm();
  }

  function updateDescCount() {
    if (!descCounter) return;
    const current = descInput.value.length;
    descCounter.textContent = `${current}/${descriptionMaxLen}`;
    const meta = descCounter.parentElement;
    if (meta) {
      meta.classList.toggle("limit", current >= descriptionMaxLen);
    }
  }

  async function moveProject(projectId, direction) {
    const projects = await StorageUtil.getProjects();
    const index = projects.findIndex((project) => project.id === projectId);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= projects.length) return;
    const next = [...projects];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await StorageUtil.saveProjects(next);
    await loadProjects();
  }

  function renderProjects(projects) {
    projectListEl.textContent = "";
    if (!projects.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent =
        "To get started, create your first project.\nClick the “+” button to add one.";
      projectListEl.appendChild(empty);
      return;
    }

    projects.forEach((project, index) => {
      const card = document.createElement("div");
      card.className = "project-card";

      const header = document.createElement("div");
      header.className = "project-header";

      const name = document.createElement("div");
      name.className = "project-name";
      name.textContent = project.name;

      const actions = document.createElement("div");
      actions.className = "project-actions";

      const moveActions = document.createElement("div");
      moveActions.className = "move-actions";

      const moveUpBtn = document.createElement("button");
      moveUpBtn.className = "btn btn-ghost btn-icon";
      moveUpBtn.title = "Move up";
      moveUpBtn.setAttribute("aria-label", "Move project up");
      moveUpBtn.disabled = index === 0;
      moveUpBtn.innerHTML =
        "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 14l5-5 5 5H7z\"/></svg>";
      moveUpBtn.addEventListener("click", () => {
        moveProject(project.id, -1);
      });

      const moveDownBtn = document.createElement("button");
      moveDownBtn.className = "btn btn-ghost btn-icon";
      moveDownBtn.title = "Move down";
      moveDownBtn.setAttribute("aria-label", "Move project down");
      moveDownBtn.disabled = index === projects.length - 1;
      moveDownBtn.innerHTML =
        "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 10l5 5 5-5H7z\"/></svg>";
      moveDownBtn.addEventListener("click", () => {
        moveProject(project.id, 1);
      });

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-icon";
      editBtn.title = "Edit project";
      editBtn.setAttribute("aria-label", "Edit project");
      editBtn.innerHTML =
        "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm18.37-11.62c.39-.39.39-1.02 0-1.41l-2.59-2.59a.996.996 0 0 0-1.41 0l-2.11 2.11 3.75 3.75 2.36-2.36z\"/></svg>";
      editBtn.addEventListener("click", () => {
        setStatus("");
        openForm(project);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-icon";
      deleteBtn.title = "Delete project";
      deleteBtn.setAttribute("aria-label", "Delete project");
      deleteBtn.innerHTML =
        "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 9h2v8H7zm4 0h2v8h-2zm4 0h2v8h-2zM9 4h6l1 2h4v2H4V6h4l1-2zm1 6h6v10H10V10z\"/></svg>";
      deleteBtn.addEventListener("click", async () => {
        await StorageUtil.removeProject(project.id);
        await loadProjects();
      });

      const desc = document.createElement("div");
      desc.className = "project-description";
      desc.textContent = project.description;

      const fillBtn = document.createElement("button");
      fillBtn.className = "btn btn-primary";
      fillBtn.textContent = "Fill field";
      fillBtn.addEventListener("click", () => startFill(project));

      moveActions.appendChild(moveUpBtn);
      moveActions.appendChild(moveDownBtn);
      actions.appendChild(moveActions);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      header.appendChild(name);
      header.appendChild(actions);
      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(fillBtn);

      projectListEl.appendChild(card);
    });
  }

  async function loadProjects() {
    const projects = await StorageUtil.getProjects();
    renderProjects(projects);
  }

  async function saveProject() {
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    if (!name || !description) {
      setStatus("Name and description are required.", true);
      return;
    }
    if (description.length > descriptionMaxLen) {
      setStatus(`Description exceeds the limit (${descriptionMaxLen}).`, true);
      return;
    }

    if (editingProjectId) {
      await StorageUtil.updateProject(editingProjectId, {
        name,
        description,
        updatedAt: Date.now()
      });
    } else {
      const project = {
        id: StorageUtil.generateId(),
        name,
        description,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await StorageUtil.addProject(project);
    }

    closeForm();
    setStatus("");
    await loadProjects();
  }

  async function startFill(project) {
    const settings = await StorageUtil.getSettings();
    const primary = resolvePrimaryProvider(settings);
    if (!primary) {
      setStatus("Please add an API key in Settings first.", true);
      return;
    }

    setStatus("Click a field to fill on the page.");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        setStatus("No active tab available.", true);
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { type: "START_FIELD_PICK", project },
        () => {
          if (chrome.runtime.lastError) {
            setStatus("Unable to reach the page. Try reloading.", true);
          }
        }
      );
    });
  }

  function resolvePrimaryProvider(settings) {
    const order = ["openai", "gemini", "groq"];
    const keys = {
      openai: (settings.openaiApiKey || "").trim(),
      gemini: (settings.geminiApiKey || "").trim(),
      groq: (settings.groqApiKey || "").trim()
    };
    const preferred = settings.primaryProvider;
    if (preferred && keys[preferred]) {
      return preferred;
    }
    return order.find((provider) => keys[provider]) || "";
  }

  function collapseSettingsMenus() {
    const menus = [
      { toggle: document.getElementById("provider-toggle"), menu: document.getElementById("provider-menu") },
      { toggle: document.getElementById("field-toggle"), menu: document.getElementById("field-menu") },
      { toggle: document.getElementById("description-toggle"), menu: document.getElementById("description-menu") }
    ];
    menus.forEach(({ toggle, menu }) => {
      if (!toggle || !menu) return;
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function applyView(nextView) {
    currentView = nextView;
    const isSettings = currentView === "settings";
    const isDocs = currentView === "docs";
    appEl.classList.toggle("view-settings", isSettings);
    appEl.classList.toggle("view-docs", isDocs);
    if (settingsPanel) settingsPanel.classList.toggle("hidden", !isSettings);
    if (docsPanel) docsPanel.classList.toggle("hidden", !isDocs);
    openSettingsBtn.textContent = isSettings || isDocs ? "Back" : "Settings";
    openSettingsBtn.title = isDocs ? "Back to settings" : isSettings ? "Back to projects" : "Settings";
    if (openProjectsBtn) {
      openProjectsBtn.classList.toggle("hidden", !isDocs);
    }
    if (titleEl) {
      titleEl.textContent = isDocs ? "Docs" : isSettings ? "Settings" : "Projects";
    }
    if (isSettings || isDocs) {
      setStatus("");
    }
    if (isSettings) {
      collapseSettingsMenus();
    }
  }

  function toggleSettings() {
    if (currentView === "docs") {
      applyView("settings");
    } else if (currentView === "settings") {
      applyView("projects");
    } else {
      applyView("settings");
    }
  }

  newProjectBtn.addEventListener("click", () => openForm());
  cancelProjectBtn.addEventListener("click", closeForm);
  saveProjectBtn.addEventListener("click", saveProject);
  openSettingsBtn.addEventListener("click", toggleSettings);
  if (openProjectsBtn) {
    openProjectsBtn.addEventListener("click", () => applyView("projects"));
  }
  if (docsBtn) {
    docsBtn.addEventListener("click", () => applyView("docs"));
  }
  if (docsToggleLabels && docsMenuLabels) {
    docsToggleLabels.addEventListener("click", () => {
      const isHidden = docsMenuLabels.classList.toggle("hidden");
      docsToggleLabels.setAttribute("aria-expanded", String(!isHidden));
    });
  }
  if (docsToggleVariation && docsMenuVariation) {
    docsToggleVariation.addEventListener("click", () => {
      const isHidden = docsMenuVariation.classList.toggle("hidden");
      docsToggleVariation.setAttribute("aria-expanded", String(!isHidden));
    });
  }
  descInput.addEventListener("input", updateDescCount);

  updateDescCount();
  StorageUtil.getSettings().then(applyDescriptionLimit);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) {
      applyDescriptionLimit(changes.settings.newValue || {});
    }
  });
  loadProjects();
})();
