const STORAGE_KEY = "cypher-character-sheets-v1";

const sectionDefinitions = [
  { key: "identity", label: "Identity & Overview", fullWidth: true },
  { key: "stats", label: "Stats & Pools", fullWidth: true },
  { key: "recovery", label: "Injury and Recovery", fullWidth: true },
  { key: "details", label: "Character Details", fullWidth: true },
  { key: "skills", label: "Skills", fullWidth: false },
  { key: "powers", label: "Special Abilities", fullWidth: false },
  { key: "attacks", label: "Attacks", fullWidth: false },
  { key: "defenses", label: "Defenses", fullWidth: false },
  { key: "equipment", label: "Equipment", fullWidth: false },
  { key: "cypher-entries", label: "Cyphers", fullWidth: false },
  { key: "power-shifts", label: "Power Shifts", fullWidth: false },
  { key: "note-entries", label: "Notes", fullWidth: false },
];

const listDefinitions = {
  powerShifts: {
    title: "Shift",
    fields: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  powers: {
    title: "Power",
    fields: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "cost", label: "Cost" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  skills: {
    title: "Skill",
    fields: [
      { key: "name", label: "Name" },
      { key: "rank", label: "Rank" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  equipment: {
    title: "Equipment",
    fields: [
      { key: "name", label: "Name" },
      { key: "quantity", label: "Quantity" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  attacks: {
    title: "Attack",
    fields: [
      { key: "name", label: "Name" },
      { key: "range", label: "Range" },
      { key: "damage", label: "Damage" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  noteEntries: {
    title: "Note",
    fields: [
      { key: "title", label: "Name" },
      { key: "note", label: "Note", kind: "textarea" },
    ],
  },
  cypherEntries: {
    title: "Cypher",
    fields: [
      { key: "title", label: "Name" },
      { key: "level", label: "Level" },
      { key: "note", label: "Note", kind: "textarea" },
    ],
  },
  defenses: {
    title: "Defense",
    fields: [
      { key: "name", label: "Name" },
      { key: "rank", label: "Rank" },
      { key: "details", label: "Details", kind: "textarea" },
    ],
  },
};

const storageAdapter = {
  list() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Unable to parse saved sheets", error);
      return [];
    }
  },
  save(sheets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  },
};

let sheets = [];
let activeSheetId = null;
let activeSheet = null;
let draggedSectionKey = null;
let draggedListContext = null;
let pendingFocusCard = null;

function createBlankSheet() {
  return {
    id: crypto.randomUUID(),
    name: "New Character",
    player: "",
    campaign: "",
    descriptor: "",
    type: "",
    focus: "",
    tier: "",
    effort: "",
    xp: "",
    recovery: "",
    armor: "",
    speedValue: "",
    background: "",
    notes: "",
    mightPool: "",
    mightEdge: "",
    mightMax: "",
    speedPool: "",
    speedEdge: "",
    speedMax: "",
    intellectPool: "",
    intellectEdge: "",
    intellectMax: "",
    damageTrack: "",
    portraitImage: "",
    age: "",
    gender: "",
    species: "",
    origin: "",
    appearance: "",
    goals: "",
    flaws: "",
    connections: "",
    recoveryOptions: { action: false, tenMinutes: false, oneHour: false, tenHours: false },
    damageTrackSelection: "healthy",
    powerShifts: [],
    powers: [],
    skills: [],
    equipment: [],
    attacks: [],
    defenses: [],
    noteEntries: [],
    cypherEntries: [],
    viewSettings: {
      sectionOrder: sectionDefinitions.map((section) => section.key),
      collapsedSections: {},
    },
    sectionColors: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function initialize() {
  sheets = storageAdapter.list();
  if (!sheets.length) {
    const starterSheet = createBlankSheet();
    sheets = [starterSheet];
    storageAdapter.save(sheets);
  }

  activeSheetId = sheets[0].id;
  activeSheet = sheets[0];

  bindEvents();
  renderSheetList();
  renderEditor();
}

function bindEvents() {
  const sidebar = document.querySelector(".sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle-btn");

  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const collapsed = sidebar.classList.toggle("is-collapsed");
      const appShell = document.querySelector(".app-shell");
      appShell?.classList.toggle("is-sidebar-collapsed", collapsed);
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  document.getElementById("new-sheet-btn").addEventListener("click", createNewSheet);
  document.getElementById("save-btn").addEventListener("click", () => {
    persistCurrentSheet();
    setStatus("Character sheet saved locally.");
  });
  document.getElementById("export-btn").addEventListener("click", exportActiveSheet);
  document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", handleImport);

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-section-color-input]")) {
      activeSheet.sectionColors = activeSheet.sectionColors || {};
      activeSheet.sectionColors[target.dataset.sectionColorInput] = target.value;
      persistCurrentSheet();
      const swatch = target.closest(".section-color-picker")?.querySelector(".section-color-swatch");
      if (swatch) {
        swatch.style.setProperty("--section-color", target.value);
      }
      const panel = target.closest(".panel");
      if (panel) {
        applySectionColorStyle(panel, target.dataset.sectionColorInput);
      }
      return;
    }

    if (target.matches("[data-portrait-upload]")) {
      const file = target.files?.[0];
      if (!file) {
        activeSheet.portraitImage = "";
        persistCurrentSheet();
        syncPortraitPreview();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        activeSheet.portraitImage = reader.result;
        persistCurrentSheet();
        syncPortraitPreview();
      };
      reader.readAsDataURL(file);
      target.value = "";
      return;
    }

    if (target.matches("[data-list-input]")) {
      const { list, index, field } = target.dataset;
      if (activeSheet[list] && activeSheet[list][index]) {
        activeSheet[list][index][field] = target.value;
        persistCurrentSheet();
        if (field === "name" || field === "title") {
          syncListCardTitle(list, Number(index));
        }
        if (target.matches("textarea")) {
          requestAnimationFrame(() => syncTextarea(target));
        }
      }
      return;
    }

    if (target.matches("[data-field]")) {
      const field = target.dataset.field;
      activeSheet[field] = target.value;
      persistCurrentSheet();
      syncSectionSummaries();
      const title = document.getElementById("sheet-title");
      if (title && field === "name") {
        title.textContent = activeSheet.name || "No character selected";
      }
      if (target.matches("textarea")) {
        requestAnimationFrame(() => syncTextarea(target));
      }
      return;
    }

    if (target.matches("[data-recovery-option]")) {
      activeSheet.recoveryOptions = activeSheet.recoveryOptions || {};
      activeSheet.recoveryOptions[target.dataset.recoveryOption] = target.checked;
      persistCurrentSheet();
      syncSectionSummaries();
      return;
    }

    if (target.matches("[data-damage-option]")) {
      if (!target.checked) return;
      activeSheet.damageTrackSelection = target.dataset.damageOption;
      persistCurrentSheet();
      syncSectionSummaries();
    }
  });

  document.addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-toggle-panel]");
    if (toggleButton) {
      togglePanel(toggleButton.dataset.togglePanel);
      return;
    }

    const addButton = event.target.closest("[data-action='add']");
    if (addButton) {
      const listKey = addButton.dataset.list;
      addListItem(listKey);
      return;
    }

    const collapseAllButton = event.target.closest("[data-action='collapse-all']");
    if (collapseAllButton) {
      const listKey = collapseAllButton.dataset.list;
      collapseAllListCards(listKey);
      return;
    }

    const removeButton = event.target.closest("[data-action='remove']");
    if (removeButton) {
      const { list, index } = removeButton.dataset;
      removeListItem(list, Number(index));
      return;
    }

    const cardToggle = event.target.closest("[data-list-card-toggle]");
    if (cardToggle) {
      const { list, index } = cardToggle.dataset;
      toggleListCard(list, Number(index));
    }
  });

  document.addEventListener("dragstart", (event) => {
    const dragHandle = event.target.closest("[data-drag-handle]");
    if (!dragHandle) return;

    const cardHeader = dragHandle.closest(".list-card-header");
    if (cardHeader) {
      const card = cardHeader.closest(".list-card");
      if (card) {
        draggedListContext = {
          listKey: card.dataset.listKey,
          index: Number(card.dataset.index),
        };
        card.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", "move-card");
        }
      }
      return;
    }

    const panelTitle = dragHandle.closest(".section-heading");
    if (panelTitle) {
      const panel = panelTitle.closest(".panel");
      if (panel) {
        draggedSectionKey = panel.dataset.panelSection;
        panel.classList.add("dragging");
      }
    }
  });

  document.addEventListener("dragover", (event) => {
    const card = event.target.closest(".list-card");
    if (card && draggedListContext) {
      event.preventDefault();
      clearDropTargets();
      card.classList.add("drop-target");
      return;
    }

    const panel = event.target.closest(".panel");
    if (panel && draggedSectionKey) {
      event.preventDefault();
      clearDropTargets();
      panel.classList.add("drop-target");
    }
  });

  document.addEventListener("drop", (event) => {
    const panel = event.target.closest(".panel");
    const card = event.target.closest(".list-card");
    event.preventDefault();
    clearDropTargets();

    if (panel && draggedSectionKey) {
      reorderSections(draggedSectionKey, panel.dataset.panelSection);
    } else if (card && draggedListContext) {
      reorderListCards(draggedListContext.listKey, draggedListContext.index, card.dataset.listKey, Number(card.dataset.index));
    }

    draggedSectionKey = null;
    draggedListContext = null;
  });

  document.addEventListener("dragend", () => {
    document.querySelectorAll(".panel.dragging, .list-card.dragging").forEach((element) => element.classList.remove("dragging"));
    draggedSectionKey = null;
    draggedListContext = null;
    clearDropTargets();
  });
}

function createNewSheet() {
  const sheet = createBlankSheet();
  sheets.unshift(sheet);
  activeSheetId = sheet.id;
  activeSheet = sheet;
  storageAdapter.save(sheets);
  renderSheetList();
  renderEditor();
  setStatus("New character sheet created.");
}

function renderSheetList() {
  const container = document.getElementById("sheet-list");
  container.innerHTML = "";

  sheets.forEach((sheet) => {
    const entry = document.createElement("div");
    entry.className = "sheet-entry";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `sheet-item${sheet.id === activeSheetId ? " active" : ""}`;
    const descriptor = sheet.descriptor?.trim();
    const type = sheet.type?.trim();
    const focus = sheet.focus?.trim();
    const subtitleParts = [descriptor, type, focus].filter(Boolean);
    const subtitle = subtitleParts.length ? `${descriptor || ""} ${type || ""}${focus ? ` who ${focus}` : ""}`.trim() : "No type entered";
    button.innerHTML = `<strong>${escapeHtml(sheet.name || "Untitled Character")}</strong><span>${escapeHtml(subtitle)}</span>`;
    button.addEventListener("click", () => {
      activeSheetId = sheet.id;
      activeSheet = sheets.find((item) => item.id === sheet.id);
      renderEditor();
      renderSheetList();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "sheet-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSheet(sheet.id);
    });

    entry.append(button, deleteButton);
    container.appendChild(entry);
  });
}

function renderEditor() {
  const title = document.getElementById("sheet-title");
  title.textContent = activeSheet?.name || "No character selected";

  const form = document.getElementById("sheet-form");
  form.innerHTML = buildFormMarkup();

  document.querySelectorAll("[data-field]").forEach((element) => {
    const field = element.dataset.field;
    element.value = activeSheet?.[field] ?? "";
  });

  document.querySelectorAll("[data-recovery-option]").forEach((element) => {
    const key = element.dataset.recoveryOption;
    element.checked = Boolean(activeSheet?.recoveryOptions?.[key]);
  });

  document.querySelectorAll("[data-damage-option]").forEach((element) => {
    const selectedValue = activeSheet?.damageTrackSelection || "healthy";
    element.checked = selectedValue === element.dataset.damageOption;
  });

  syncPortraitPreview();
  syncSectionColorPickers();

  Object.keys(listDefinitions).forEach((listKey) => {
    renderListSection(listKey);
  });

  syncSectionSummaries();
  applyViewSettings();
  enhanceTextareas();
  requestAnimationFrame(() => focusPendingCard());
}

function getSectionPanelColors(sectionKey) {
  const color = activeSheet?.sectionColors?.[sectionKey] || "#8fa7c8";

  const hex = color.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  const blend = (channel) => Math.round(channel * 0.68 + 255 * 0.32);
  const pastelR = blend(r);
  const pastelG = blend(g);
  const pastelB = blend(b);
  const start = `rgba(${pastelR}, ${pastelG}, ${pastelB}, 0.24)`;
  const end = `rgba(${pastelR}, ${pastelG}, ${pastelB}, 0.08)`;
  const overlay = `rgba(${pastelR}, ${pastelG}, ${pastelB}, 0.16)`;

  return {
    panelBg: `linear-gradient(145deg, ${start} 0%, ${end} 48%, rgba(8, 15, 27, 0.95) 100%)`,
    beforeBg: `linear-gradient(135deg, ${overlay} 0%, transparent 55%, rgba(255,255,255,0.04) 100%)`,
  };
}

function getSectionPanelStyle(sectionKey) {
  const colors = getSectionPanelColors(sectionKey);
  return `style="--section-panel-bg:${colors.panelBg}; --section-before-bg:${colors.beforeBg};"`;
}

function applySectionColorStyle(panel, sectionKey) {
  if (!panel) return;
  const colors = getSectionPanelColors(sectionKey);
  panel.style.setProperty("--section-panel-bg", colors.panelBg);
  panel.style.setProperty("--section-before-bg", colors.beforeBg);
}

function getSectionColorValue(sectionKey) {
  return activeSheet?.sectionColors?.[sectionKey] || "#8fa7c8";
}

function syncSectionColorPickers() {
  document.querySelectorAll("[data-section-color-input]").forEach((input) => {
    const sectionKey = input.dataset.sectionColorInput;
    const swatch = input.closest(".section-color-picker")?.querySelector(".section-color-swatch");
    const value = getSectionColorValue(sectionKey);
    input.value = value;
    if (swatch) {
      swatch.style.setProperty("--section-color", value);
    }
    const panel = input.closest(".panel");
    if (panel) {
      applySectionColorStyle(panel, sectionKey);
    }
  });
}

function buildFormMarkup() {
  const order = activeSheet?.viewSettings?.sectionOrder || sectionDefinitions.map((section) => section.key);
  return order.map((key) => {
    const definition = sectionDefinitions.find((section) => section.key === key);
    if (!definition) return "";

    const panelClass = `panel${definition.fullWidth ? " full-width" : " half-width"}`;
    const collapsedClass = activeSheet?.viewSettings?.collapsedSections?.[key] ? " collapsed" : "";
    const expanded = activeSheet?.viewSettings?.collapsedSections?.[key] ? "false" : "true";
    const collapsedSummary = getSectionCollapsedSummary(key);
    const sectionStyle = getSectionPanelStyle(key);

    if (key === "identity") {
      return `
        <section class="${panelClass}${collapsedClass}" data-panel-section="${key}"${sectionStyle}>
          <div class="section-heading">
            <div class="section-title-row">
              <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag section" draggable="true">⋮⋮</button>
              <label class="section-color-picker" title="Choose section color">
                <input type="color" data-section-color-input="${key}" />
                <span class="section-color-swatch" style="--section-color: ${getSectionColorValue(key)}"></span>
              </label>
              <button class="section-toggle" type="button" data-toggle-panel="${key}" aria-expanded="${expanded}">
                <h3>Identity & Overview</h3>
                <span class="section-meta"${collapsedSummary ? "" : ' style="display: none;"'}>${collapsedSummary || ""}</span>
                <span class="toggle-indicator">▾</span>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="grid three-up compact-grid">
              <label><span>Character name</span><input data-field="name" type="text" placeholder="Astra, the Sky Rider" /></label>
              <label><span>Player</span><input data-field="player" type="text" /></label>
              <label><span>Campaign</span><input data-field="campaign" type="text" /></label>
              <label><span>Descriptor</span><input data-field="descriptor" type="text" /></label>
              <label><span>Type</span><input data-field="type" type="text" /></label>
              <label><span>Focus</span><input data-field="focus" type="text" /></label>
            </div>
            <div class="field-divider"></div>
            <div class="grid four-up compact-grid identity-inline-grid">
              <label><span>Tier</span><input data-field="tier" type="number" min="1" max="10" /></label>
              <label><span>Effort</span><input data-field="effort" type="number" min="0" max="6" /></label>
              <label><span>XP</span><input data-field="xp" type="number" min="0" /></label>
              <label><span>Armor</span><input data-field="armor" type="number" min="0" /></label>
            </div>
            <div class="grid two-up compact-grid">
              <label><span>Background</span><textarea data-field="background" rows="4"></textarea></label>
              <label><span>Notes</span><textarea data-field="notes" rows="4"></textarea></label>
            </div>
          </div>
        </section>
      `;
    }

    if (key === "stats") {
      return `
        <section class="${panelClass}${collapsedClass}" data-panel-section="${key}"${sectionStyle}>
          <div class="section-heading">
            <div class="section-title-row">
              <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag section" draggable="true">⋮⋮</button>
              <label class="section-color-picker" title="Choose section color">
                <input type="color" data-section-color-input="${key}" />
                <span class="section-color-swatch" style="--section-color: ${getSectionColorValue(key)}"></span>
              </label>
              <button class="section-toggle" type="button" data-toggle-panel="${key}" aria-expanded="${expanded}">
                <h3>Stats & Pools</h3>
                <span class="section-meta"${collapsedSummary ? "" : ' style="display: none;"'}>${collapsedSummary || ""}</span>
                <span class="toggle-indicator">▾</span>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="stats-stack">
              <div class="stat-group"><h4>Might</h4><label><span>Pool</span><input data-field="mightPool" type="number" min="0" /></label><label><span>Edge</span><input data-field="mightEdge" type="number" min="0" /></label><label><span>Pool Max</span><input data-field="mightMax" type="number" min="0" /></label></div>
              <div class="stat-group"><h4>Speed</h4><label><span>Pool</span><input data-field="speedPool" type="number" min="0" /></label><label><span>Edge</span><input data-field="speedEdge" type="number" min="0" /></label><label><span>Pool Max</span><input data-field="speedMax" type="number" min="0" /></label></div>
              <div class="stat-group"><h4>Intellect</h4><label><span>Pool</span><input data-field="intellectPool" type="number" min="0" /></label><label><span>Edge</span><input data-field="intellectEdge" type="number" min="0" /></label><label><span>Pool Max</span><input data-field="intellectMax" type="number" min="0" /></label></div>
            </div>
          </div>
        </section>
      `;
    }

    if (key === "recovery") {
      return `
        <section class="${panelClass}${collapsedClass}" data-panel-section="${key}"${sectionStyle}>
          <div class="section-heading">
            <div class="section-title-row">
              <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag section" draggable="true">⋮⋮</button>
              <label class="section-color-picker" title="Choose section color">
                <input type="color" data-section-color-input="${key}" />
                <span class="section-color-swatch" style="--section-color: ${getSectionColorValue(key)}"></span>
              </label>
              <button class="section-toggle" type="button" data-toggle-panel="${key}" aria-expanded="${expanded}">
                <h3>Injury and Recovery</h3>
                <span class="section-meta"${collapsedSummary ? "" : ' style="display: none;"'}>${collapsedSummary || ""}</span>
                <span class="toggle-indicator">▾</span>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="recovery-grid">
              <div class="recovery-card">
                <h4>Injury</h4>
                <div class="checkbox-list">
                  <label class="checkbox-item" title="Healthy: no damage has been taken."><input type="radio" name="damage-track" data-damage-option="healthy" /><span>Healthy</span></label>
                  <label class="checkbox-item" title="Impaired: the character is carrying damage and is less effective."><input type="radio" name="damage-track" data-damage-option="impaired" /><span>Impaired</span></label>
                  <label class="checkbox-item" title="Debilitated: the character is severely harmed and may be incapacitated."><input type="radio" name="damage-track" data-damage-option="debilitated" /><span>Debilitated</span></label>
                  <label class="checkbox-item" title="Dead: the character has been taken out of the scene."><input type="radio" name="damage-track" data-damage-option="dead" /><span>Dead</span></label>
                </div>
              </div>
              <div class="recovery-card">
                <h4>Recovery</h4>
                <div class="recovery-roll-row">
                  <label class="recovery-roll-label" for="recovery-roll-input"><span>Recovery Rolls</span></label>
                  <input id="recovery-roll-input" class="recovery-roll-input" data-field="recovery" type="text" placeholder="1d6 + 2" />
                </div>
                <div class="checkbox-list">
                  <label class="checkbox-item"><input type="checkbox" data-recovery-option="action" /><span>Action</span></label>
                  <label class="checkbox-item"><input type="checkbox" data-recovery-option="tenMinutes" /><span>Ten Minutes</span></label>
                  <label class="checkbox-item"><input type="checkbox" data-recovery-option="oneHour" /><span>One Hour</span></label>
                  <label class="checkbox-item"><input type="checkbox" data-recovery-option="tenHours" /><span>Ten Hours</span></label>
                </div>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    if (key === "details") {
      return `
        <section class="${panelClass}${collapsedClass}" data-panel-section="${key}"${sectionStyle}>
          <div class="section-heading">
            <div class="section-title-row">
              <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag section" draggable="true">⋮⋮</button>
              <label class="section-color-picker" title="Choose section color">
                <input type="color" data-section-color-input="${key}" />
                <span class="section-color-swatch" style="--section-color: ${getSectionColorValue(key)}"></span>
              </label>
              <button class="section-toggle" type="button" data-toggle-panel="${key}" aria-expanded="${expanded}">
                <h3>Character Details</h3>
                <span class="toggle-indicator">▾</span>
              </button>
            </div>
          </div>
          <div class="section-content">
            <div class="portrait-layout">
              <div class="portrait-card">
                <div class="portrait-preview-shell">
                  <img data-portrait-preview class="portrait-preview" alt="Character portrait" />
                  <span class="portrait-placeholder">Portrait</span>
                </div>
                <label class="portrait-upload">
                  <span>Portrait image</span>
                  <input type="file" accept="image/*" data-portrait-upload />
                </label>
              </div>
              <div class="grid two-up compact-grid">
              <label><span>Age</span><input data-field="age" type="text" /></label>
              <label><span>Gender</span><input data-field="gender" type="text" /></label>
              <label><span>Species / Race</span><input data-field="species" type="text" /></label>
              <label><span>Home / Origin</span><input data-field="origin" type="text" /></label>
              <label><span>Appearance</span><textarea data-field="appearance" rows="3"></textarea></label>
              <label><span>Goals</span><textarea data-field="goals" rows="3"></textarea></label>
              <label><span>Flaws</span><textarea data-field="flaws" rows="3"></textarea></label>
              <label><span>Connections</span><textarea data-field="connections" rows="3"></textarea></label>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    const listKey = key === "power-shifts" ? "powerShifts" : key === "note-entries" ? "noteEntries" : key === "cypher-entries" ? "cypherEntries" : key;
    const addLabel = key === "power-shifts" ? "Add shift" : key === "powers" ? "Add ability" : key === "skills" ? "Add skill" : key === "equipment" ? "Add item" : key === "attacks" ? "Add attack" : key === "note-entries" ? "Add note" : key === "cypher-entries" ? "Add cypher" : "Add defense";
    return `
      <section class="${panelClass}${collapsedClass} list-panel" data-panel-section="${key}"${sectionStyle}>
        <div class="section-heading">
          <div class="section-title-row">
            <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag section" draggable="true">⋮⋮</button>
            <label class="section-color-picker" title="Choose section color">
              <input type="color" data-section-color-input="${key}" />
              <span class="section-color-swatch" style="--section-color: ${getSectionColorValue(key)}"></span>
            </label>
            <button class="section-toggle" type="button" data-toggle-panel="${key}" aria-expanded="${expanded}">
              <h3>${definition.label}</h3>
              <span class="toggle-indicator">▾</span>
            </button>
          </div>
          <div class="section-actions">
            <button type="button" data-action="collapse-all" data-list="${listKey}">Collapse all</button>
            <button type="button" data-action="add" data-list="${listKey}">${addLabel}</button>
          </div>
        </div>
        <div class="section-content">
          <div id="${listKey}-list" class="list-stack"></div>
        </div>
      </section>
    `;
  }).join("");
}

function renderListSection(listKey) {
  const container = document.getElementById(`${listKey === "powerShifts" ? "powerShifts" : listKey}-list`);
  if (!container) return;

  const items = activeSheet?.[listKey] ?? [];
  const definition = listDefinitions[listKey];

  container.innerHTML = items.length
    ? items.map((item, index) => {
        const titleField = listKey === "noteEntries" || listKey === "cypherEntries" ? "title" : "name";
        const cardTitle = item[titleField]?.trim() || `${definition.title} ${index + 1}`;
        const collapsedClass = item.collapsed ? " collapsed" : "";
        const expanded = item.collapsed ? "false" : "true";
        const collapsedAnnotation = getCollapsedCardAnnotation(listKey, item);
        return `
          <article class="list-card${collapsedClass}" data-list-key="${listKey}" data-index="${index}">
            <div class="list-card-header">
              <button class="drag-handle" type="button" data-drag-handle="true" aria-label="Drag card" draggable="true">⋮⋮</button>
              <button class="list-card-toggle" type="button" data-list-card-toggle="true" data-list="${listKey}" data-index="${index}" aria-expanded="${expanded}">
                <span class="toggle-indicator">▾</span>
                <span class="list-card-title">${escapeHtml(cardTitle)}</span>
                ${collapsedAnnotation ? `<span class="list-card-meta">${collapsedAnnotation}</span>` : ""}
              </button>
              <button class="remove-btn" type="button" data-action="remove" data-list="${listKey}" data-index="${index}">Remove</button>
            </div>
            <div class="list-card-body">
              <div class="list-grid">
                ${definition.fields.map((field) => {
                  const fieldClass =
                    listKey === "equipment" && field.key === "name"
                      ? "field field--wide"
                      : listKey === "equipment" && field.key === "quantity"
                        ? "field field--compact"
                        : field.kind === "textarea"
                          ? "field field--wide"
                          : "field";
                  const control = field.kind === "textarea"
                    ? `<textarea data-list-input="true" data-list="${listKey}" data-index="${index}" data-field="${field.key}" rows="3">${escapeHtml(item[field.key] ?? "")}</textarea>`
                    : `<input data-list-input="true" data-list="${listKey}" data-index="${index}" data-field="${field.key}" type="text" value="${escapeHtml(item[field.key] ?? "")}" />`;
                  return `<label class="${fieldClass}"><span>${escapeHtml(field.label)}</span>${control}</label>`;
                }).join("")}
              </div>
            </div>
          </article>
        `;
      }).join("")
    : `<p>No ${definition.title.toLowerCase()} entries yet.</p>`;

  enhanceTextareas();
}

function getSectionCollapsedSummary(sectionKey) {
  if (!activeSheet) return "";

  if (sectionKey === "identity") {
    const parts = [];
    if (activeSheet.tier !== "" && activeSheet.tier !== null && activeSheet.tier !== undefined) parts.push(`T ${activeSheet.tier}`);
    if (activeSheet.effort !== "" && activeSheet.effort !== null && activeSheet.effort !== undefined) parts.push(`E ${activeSheet.effort}`);
    if (activeSheet.xp !== "" && activeSheet.xp !== null && activeSheet.xp !== undefined) parts.push(`XP ${activeSheet.xp}`);
    if (activeSheet.armor !== "" && activeSheet.armor !== null && activeSheet.armor !== undefined) parts.push(`A ${activeSheet.armor}`);
    return parts.join(" • ");
  }

  if (sectionKey === "stats") {
    const parts = [];
    if (activeSheet.mightPool !== "" && activeSheet.mightPool !== null && activeSheet.mightPool !== undefined) {
      const edge = activeSheet.mightEdge !== "" && activeSheet.mightEdge !== null && activeSheet.mightEdge !== undefined ? ` (E ${activeSheet.mightEdge})` : "";
      const maxPool = activeSheet.mightMax !== "" && activeSheet.mightMax !== null && activeSheet.mightMax !== undefined ? ` / MP ${activeSheet.mightMax}` : "";
      parts.push(`Might P ${activeSheet.mightPool}${maxPool}${edge}`);
    }
    if (activeSheet.speedPool !== "" && activeSheet.speedPool !== null && activeSheet.speedPool !== undefined) {
      const edge = activeSheet.speedEdge !== "" && activeSheet.speedEdge !== null && activeSheet.speedEdge !== undefined ? ` (E ${activeSheet.speedEdge})` : "";
      const maxPool = activeSheet.speedMax !== "" && activeSheet.speedMax !== null && activeSheet.speedMax !== undefined ? ` / MP ${activeSheet.speedMax}` : "";
      parts.push(`Speed P ${activeSheet.speedPool}${maxPool}${edge}`);
    }
    if (activeSheet.intellectPool !== "" && activeSheet.intellectPool !== null && activeSheet.intellectPool !== undefined) {
      const edge = activeSheet.intellectEdge !== "" && activeSheet.intellectEdge !== null && activeSheet.intellectEdge !== undefined ? ` (E ${activeSheet.intellectEdge})` : "";
      const maxPool = activeSheet.intellectMax !== "" && activeSheet.intellectMax !== null && activeSheet.intellectMax !== undefined ? ` / MP ${activeSheet.intellectMax}` : "";
      parts.push(`Intellect P ${activeSheet.intellectPool}${maxPool}${edge}`);
    }
    return parts.join(" • ");
  }

  if (sectionKey === "recovery") {
    const injury = activeSheet.damageTrackSelection || "healthy";
    const injuryLabel = injury.charAt(0).toUpperCase() + injury.slice(1);
    const optionMeta = [
      { key: "action", label: "A", checked: Boolean(activeSheet.recoveryOptions?.action) },
      { key: "tenMinutes", label: "TM", checked: Boolean(activeSheet.recoveryOptions?.tenMinutes) },
      { key: "oneHour", label: "OH", checked: Boolean(activeSheet.recoveryOptions?.oneHour) },
      { key: "tenHours", label: "TH", checked: Boolean(activeSheet.recoveryOptions?.tenHours) },
    ];
    const recoverySummary = optionMeta.map((option) => `${option.label}${option.checked ? " ⬩✕" : " ☐"}`).join(" • ");
    return `${injuryLabel} • ${recoverySummary}`;
  }

  return "";
}

function syncSectionSummaries() {
  const form = document.getElementById("sheet-form");
  if (!form) return;

  form.querySelectorAll(".panel").forEach((panel) => {
    const sectionKey = panel.dataset.panelSection;
    const summaryNode = panel.querySelector(".section-meta");
    if (!summaryNode) return;
    const summary = getSectionCollapsedSummary(sectionKey);
    summaryNode.textContent = summary;
    summaryNode.style.display = summary ? "inline-flex" : "none";
  });
}

function getCollapsedCardAnnotation(listKey, item) {
  if (!item?.collapsed) return "";

  if (listKey === "skills") {
    return item.rank ? `Rank ${escapeHtml(item.rank)}` : "";
  }
  if (listKey === "powers") {
    return item.cost ? `Cost ${escapeHtml(item.cost)}` : "";
  }
  if (listKey === "equipment") {
    return item.quantity ? `(x${escapeHtml(item.quantity)})` : "";
  }
  if (listKey === "attacks") {
    const range = item.range?.trim();
    const damage = item.damage?.trim();
    if (range || damage) {
      return [range ? `Range ${range}` : "", damage ? `Damage ${damage}` : ""].filter(Boolean).join(" • ");
    }
    return "";
  }
  if (listKey === "defenses") {
    return item.rank ? `Rank ${escapeHtml(item.rank)}` : "";
  }
  if (listKey === "cypherEntries") {
    return item.level ? `Level ${escapeHtml(item.level)}` : "";
  }

  return "";
}

function addListItem(listKey) {
  if (!activeSheet) return;
  if (!activeSheet[listKey]) activeSheet[listKey] = [];
  const sectionKey = listKey === "powerShifts" ? "power-shifts" : listKey === "noteEntries" ? "note-entries" : listKey === "cypherEntries" ? "cypher-entries" : listKey;
  const newIndex = activeSheet[listKey].length;
  activeSheet[listKey].push(getEmptyListItem(listKey));
  ensureViewSettings();
  activeSheet.viewSettings.collapsedSections[sectionKey] = false;
  pendingFocusCard = { listKey, index: newIndex };
  persistCurrentSheet();
  renderEditor();
}

function collapseAllListCards(listKey) {
  if (!activeSheet?.[listKey]) return;
  activeSheet[listKey] = activeSheet[listKey].map((item) => ({ ...item, collapsed: true }));
  persistCurrentSheet();
  renderListSection(listKey);
}

function toggleListCard(listKey, index) {
  if (!activeSheet?.[listKey]?.[index]) return;
  activeSheet[listKey][index].collapsed = !activeSheet[listKey][index].collapsed;
  persistCurrentSheet();
  renderListSection(listKey);
}

function removeListItem(listKey, index) {
  if (!activeSheet?.[listKey]) return;
  activeSheet[listKey].splice(index, 1);
  persistCurrentSheet();
  renderListSection(listKey);
  enhanceTextareas();
}

function getEmptyListItem(listKey) {
  const base = {};
  listDefinitions[listKey].fields.forEach((field) => {
    base[field.key] = "";
  });
  base.collapsed = false;
  return base;
}

function persistCurrentSheet() {
  if (!activeSheet) return;
  activeSheet.updatedAt = new Date().toISOString();
  const index = sheets.findIndex((sheet) => sheet.id === activeSheet.id);
  if (index >= 0) {
    sheets[index] = activeSheet;
    storageAdapter.save(sheets);
    renderSheetList();
  }
}

function ensureViewSettings() {
  activeSheet.viewSettings = activeSheet.viewSettings || { sectionOrder: [], collapsedSections: {} };
}

function deleteSheet(sheetId) {
  if (!sheetId) return;
  if (sheets.length === 1) {
    setStatus("At least one character sheet must remain.", true);
    return;
  }
  if (!window.confirm("Delete this character sheet?")) return;

  sheets = sheets.filter((sheet) => sheet.id !== sheetId);
  if (activeSheetId === sheetId) {
    activeSheet = sheets[0];
    activeSheetId = activeSheet?.id || null;
  }
  storageAdapter.save(sheets);
  renderSheetList();
  renderEditor();
  setStatus("Character sheet deleted.");
}

function togglePanel(panelKey) {
  const panel = document.querySelector(`[data-panel-section="${panelKey}"]`);
  if (!panel) return;
  const button = panel.querySelector("[data-toggle-panel]");
  panel.classList.toggle("collapsed");
  const isCollapsed = panel.classList.contains("collapsed");
  ensureViewSettings();
  activeSheet.viewSettings.collapsedSections[panelKey] = isCollapsed;
  if (button) button.setAttribute("aria-expanded", String(!isCollapsed));
  persistCurrentSheet();
}

function applyViewSettings() {
  const form = document.getElementById("sheet-form");
  if (!form) return;
  const panels = Array.from(form.querySelectorAll(".panel"));
  const order = activeSheet?.viewSettings?.sectionOrder || sectionDefinitions.map((section) => section.key);
  const seen = new Set();
  order.forEach((key) => {
    const panel = panels.find((entry) => entry.dataset.panelSection === key);
    if (panel) {
      form.appendChild(panel);
      seen.add(key);
    }
  });
  panels.forEach((panel) => {
    if (!seen.has(panel.dataset.panelSection)) form.appendChild(panel);
  });
  panels.forEach((panel) => {
    const key = panel.dataset.panelSection;
    const collapsed = Boolean(activeSheet?.viewSettings?.collapsedSections?.[key]);
    panel.classList.toggle("collapsed", collapsed);
    const button = panel.querySelector("[data-toggle-panel]");
    if (button) button.setAttribute("aria-expanded", String(!collapsed));
  });
}

function reorderSections(fromKey, toKey) {
  if (!activeSheet?.viewSettings) return;
  const order = [...(activeSheet.viewSettings.sectionOrder || sectionDefinitions.map((section) => section.key))];
  const fromIndex = order.indexOf(fromKey);
  const toIndex = order.indexOf(toKey);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  order.splice(fromIndex, 1);
  order.splice(toIndex, 0, fromKey);
  activeSheet.viewSettings.sectionOrder = order;
  persistCurrentSheet();
  renderEditor();
}

function reorderListCards(fromListKey, fromIndex, toListKey, toIndex) {
  if (!activeSheet || !activeSheet[fromListKey] || fromListKey !== toListKey) return;
  const items = [...activeSheet[fromListKey]];
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex || fromIndex >= items.length || toIndex >= items.length) return;
  const [movedItem] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, movedItem);
  activeSheet[fromListKey] = items;
  persistCurrentSheet();
  renderListSection(fromListKey);
}

function clearDropTargets() {
  document.querySelectorAll(".panel.drop-target, .list-card.drop-target").forEach((element) => element.classList.remove("drop-target"));
}

function syncPortraitPreview() {
  const preview = document.querySelector("[data-portrait-preview]");
  if (!preview) return;
  const hasImage = Boolean(activeSheet?.portraitImage);
  preview.src = activeSheet?.portraitImage || "";
  preview.classList.toggle("is-hidden", !hasImage);
  const placeholder = preview.parentElement?.querySelector(".portrait-placeholder");
  if (placeholder) {
    placeholder.style.display = hasImage ? "none" : "flex";
  }
}

function syncListCardTitle(listKey, index) {
  const card = document.querySelector(`.list-card[data-list-key="${listKey}"][data-index="${index}"]`);
  if (!card) return;
  const titleElement = card.querySelector(".list-card-title");
  const item = activeSheet?.[listKey]?.[index];
  if (!titleElement || !item) return;
  const titleField = listKey === "noteEntries" || listKey === "cypherEntries" ? "title" : "name";
  const titleValue = item[titleField]?.trim() || `${listDefinitions[listKey].title} ${index + 1}`;
  titleElement.textContent = titleValue;
}

function focusPendingCard() {
  if (!pendingFocusCard) return;
  const { listKey, index } = pendingFocusCard;
  const card = document.querySelector(`.list-card[data-list-key="${listKey}"][data-index="${index}"]`);
  if (!card) return;
  const focusTarget = card.querySelector(".list-card-toggle") || card.querySelector("input, textarea, button") || card;
  focusTarget.focus();
  pendingFocusCard = null;
}

function enhanceTextareas() {
  document.querySelectorAll("textarea").forEach((textarea) => {
    if (textarea.dataset.expandReady === "true") return;
    const shell = document.createElement("div");
    shell.className = "textarea-shell";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "textarea-toggle is-hidden";
    toggle.innerHTML = "↧";
    toggle.setAttribute("aria-label", "Expand text area");
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      const expanded = textarea.classList.toggle("expanded");
      toggle.innerHTML = expanded ? "↥" : "↧";
      syncTextarea(textarea);
    });
    const parent = textarea.parentNode;
    parent.insertBefore(shell, textarea);
    shell.appendChild(textarea);
    shell.appendChild(toggle);
    textarea.dataset.expandReady = "true";
    textarea.addEventListener("input", () => syncTextarea(textarea, toggle));
    textarea.addEventListener("change", () => syncTextarea(textarea, toggle));
    syncTextarea(textarea, toggle);
  });
}

function syncTextarea(textarea, toggle = textarea.parentNode?.querySelector(".textarea-toggle")) {
  if (!textarea) return;
  const isExpanded = textarea.classList.contains("expanded");
  if (toggle) {
    const shouldShowToggle = textarea.scrollHeight > 110;
    toggle.classList.toggle("is-hidden", !shouldShowToggle);
    toggle.innerHTML = isExpanded ? "↥" : "↧";
  }
  if (isExpanded) {
    textarea.style.height = `${Math.max(textarea.scrollHeight, 92)}px`;
  } else {
    textarea.style.height = "78px";
  }
}

function exportActiveSheet() {
  if (!activeSheet) return;
  const sheetToExport = {
    ...activeSheet,
    viewSettings: {
      sectionOrder: activeSheet.viewSettings?.sectionOrder || sectionDefinitions.map((section) => section.key),
      collapsedSections: activeSheet.viewSettings?.collapsedSections || {},
    },
  };
  const blob = new Blob([JSON.stringify(sheetToExport, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(activeSheet.name || "character")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Character sheet exported as JSON.");
}

function handleImport(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedSheet = normalizeSheet(parsed);
      if (!importedSheet) throw new Error("The imported file did not contain a valid sheet.");
      sheets.unshift(importedSheet);
      activeSheetId = importedSheet.id;
      activeSheet = importedSheet;
      storageAdapter.save(sheets);
      renderSheetList();
      renderEditor();
      setStatus("Character sheet imported successfully.");
    } catch (error) {
      console.error(error);
      setStatus("Import failed. Please choose a valid character sheet JSON file.", true);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function normalizeSheet(value) {
  if (!value || typeof value !== "object") return null;
  const sheet = createBlankSheet();
  Object.assign(sheet, value, { id: value.id || crypto.randomUUID(), createdAt: value.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  sheet.recoveryOptions = value.recoveryOptions || { action: false, tenMinutes: false, oneHour: false, tenHours: false };
  sheet.damageTrackSelection = value.damageTrackSelection || "";
  sheet.viewSettings = {
    sectionOrder: Array.isArray(value.viewSettings?.sectionOrder) && value.viewSettings.sectionOrder.length ? value.viewSettings.sectionOrder : sectionDefinitions.map((section) => section.key),
    collapsedSections: value.viewSettings?.collapsedSections || {},
  };
  sheet.powerShifts = Array.isArray(value.powerShifts) ? value.powerShifts : [];
  sheet.powers = Array.isArray(value.powers) ? value.powers : [];
  sheet.skills = Array.isArray(value.skills) ? value.skills : [];
  sheet.equipment = Array.isArray(value.equipment) ? value.equipment : [];
  sheet.attacks = Array.isArray(value.attacks) ? value.attacks : [];
  sheet.defenses = Array.isArray(value.defenses) ? value.defenses : [];
  sheet.noteEntries = Array.isArray(value.noteEntries) ? value.noteEntries : [];
  sheet.cypherEntries = Array.isArray(value.cypherEntries) ? value.cypherEntries : [];
  return sheet;
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status-message");
  status.textContent = message;
  status.style.color = isError ? "#ff5c7a" : "#4dc4ff";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

initialize();
