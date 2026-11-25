const EVENT_CONFIG = [
  { id: "3x3", label: "3x3" },
  { id: "2x2", label: "2x2" },
  { id: "pyra", label: "Pyra" },
  { id: "skewb", label: "Skewb" },
  { id: "4x4", label: "4x4" },
  { id: "5x5", label: "5x5" },
  { id: "6x6", label: "6x6" },
  { id: "7x7", label: "7x7" },
  { id: "oh", label: "OH" },
  { id: "mega", label: "Mega" },
  { id: "sq1", label: "SQ1" },
  { id: "clock", label: "Clock" },
  { id: "3bld", label: "3BLD" },
  { id: "fto", label: "FTO" },
];

const EVENT_SETTING_DEFAULTS = {
  "3x3": { timePerGroup: 20, localPercent: 100, regionalPercent: 100 },
  "2x2": { timePerGroup: 17, localPercent: 81, regionalPercent: 97 },
  pyra: { timePerGroup: 17, localPercent: 69, regionalPercent: 86 },
  skewb: { timePerGroup: 17, localPercent: 63, regionalPercent: 75 },
  "4x4": { timePerGroup: 25, localPercent: 65, regionalPercent: 75 },
  "5x5": { timePerGroup: 25, localPercent: 53, regionalPercent: 58 },
  "6x6": { timePerGroup: 30, localPercent: 37, regionalPercent: 41 },
  "7x7": { timePerGroup: 35, localPercent: 38, regionalPercent: 37 },
  oh: { timePerGroup: 20, localPercent: 65, regionalPercent: 69 },
  mega: { timePerGroup: 25, localPercent: 54, regionalPercent: 55 },
  sq1: { timePerGroup: 21, localPercent: 44, regionalPercent: 50 },
  clock: { timePerGroup: 21, localPercent: 61, regionalPercent: 58 },
  "3bld": { timePerGroup: 23, localPercent: 36, regionalPercent: 26 },
  fto: { timePerGroup: 30, localPercent: 55, regionalPercent: 55 },
};

const INTERNAL_TIMING = {
  roundDecay: 0.75,
  finalSize: 16,
};

const GLOBAL_SETTING_DEFAULTS = {
  maxRatio: 2.1,
  timeFormat: "ampm",
};

const SPECIAL_BLOCKS = {
  setup: { label: "Setup", duration: 60 },
  tutorial: { label: "Tutorial", duration: 25 },
  lunch: { label: "Lunch", duration: 60 },
  break: { label: "Break", duration: 20 },
  awards: { label: "Awards / Cleanup", duration: 60 },
};

const EVENT_SETTINGS_STORAGE_KEY = "schedule-event-settings";
const GLOBAL_SETTINGS_STORAGE_KEY = "schedule-global-settings";
const APP_STATE_STORAGE_KEY = "schedule-app-state-v1";
const SCHEDULE_CSV_VERSION = 1;
const SCHEDULE_MINUTES_PER_PIXEL = 3;
const MIN_SCHEDULE_ROW_DURATION = 5;

const DEFAULT_COMPETITION_INFO = {
  competitorCount: "",
  venueHours: 0,
  venueMinutes: 0,
  competitionType: "Local",
  stations: "",
  eventDays: 1,
  dayStartTimes: ["08:00"],
  dayEndTimes: ["19:00"],
};

const state = {
  eventRounds: createDefaultEventRounds(),
  competitionInfo: createDefaultCompetitionInfo(),
  eventSettings: loadEventSettings(),
  globalSettings: loadGlobalSettings(),
  generatedGroups: [],
  scheduleRows: [],
};

hydrateAppState();

const tabButtons = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");
const eventSelectors = document.querySelectorAll("[data-event-select]");
const competitionForm = document.getElementById("competition-form");
const groupsTable = document.getElementById("groups-table");
const dayStartTimesContainer = document.getElementById("day-start-times");
const settingsForm = document.getElementById("settings-form");
const scheduleBuilderWrapper = document.getElementById("schedule-table-wrapper");
const scheduleViewTabs = document.getElementById("schedule-view-tabs");
const generateGroupsBtn = document.getElementById("generate-groups");
const generateScheduleBtn = document.getElementById("generate-schedule-from-groups");
const generateEmptyScheduleBtn = document.getElementById("generate-empty-schedule-from-groups");
const clearScheduleBtn = document.getElementById("clear-schedule");
const specialBlockSelect = document.getElementById("special-block-select");
const addSpecialBlockBtn = document.getElementById("add-special-block");
const downloadScheduleBtn = document.getElementById("download-schedule-csv");
const eventSettingInputs = document.querySelectorAll("[data-event-setting-field]");
const globalSettingInputs = document.querySelectorAll("[data-global-setting]");
const resetSettingsBtn = document.getElementById("reset-settings");
const newScheduleBtn = document.getElementById("new-schedule-btn");
const uploadScheduleBtn = document.getElementById("upload-schedule-btn");
const uploadScheduleInput = document.getElementById("upload-schedule-input");

let draggedScheduleRowId = null;
let pendingGroupFocus = null;
let scheduleView = "table";
let activeScheduleInteraction = null;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initEventSelectors();
  initCompetitionForm();
  initEventSettingsControls();
  initGlobalSettingsControls();
  initGenerateGroupsButton();
  initScheduleBuilderControls();
  renderGroupsTable();
  newScheduleBtn?.addEventListener("click", resetAllData);
  initScheduleUploadControls();
});

dayStartTimesContainer?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-day-start]");
  if (input) {
    updateDayStartTime(Number(input.dataset.dayStart), input.value);
    return;
  }
  const endInput = event.target.closest("[data-day-end]");
  if (endInput) updateDayEndTime(Number(endInput.dataset.dayEnd), endInput.value);
});

function updateDayStartTime(dayIndex, value) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return;
  const previousValue = getDayStartInputValue(dayIndex + 1);
  const nextValue = value || "08:00";
  const previousMinutes = minutesFromTime(previousValue) ?? 0;
  const nextMinutes = minutesFromTime(nextValue) ?? previousMinutes;
  const minuteDelta = nextMinutes - previousMinutes;
  state.scheduleRows.forEach((row) => {
    if (clampDay(row.day) === dayIndex + 1 && Number.isFinite(row.startOverrideMinutes)) {
      row.startOverrideMinutes += minuteDelta;
    }
  });
  state.competitionInfo.dayStartTimes[dayIndex] = nextValue;
  recalculateScheduleTimes();
  renderScheduleBuilder();
  persistAppState();
}

function updateDayEndTime(dayIndex, value) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return;
  state.competitionInfo.dayEndTimes[dayIndex] = value || "19:00";
  renderScheduleBuilder();
  persistAppState();
}

function createDefaultCompetitionInfo() {
  return {
    ...DEFAULT_COMPETITION_INFO,
    dayStartTimes: [...DEFAULT_COMPETITION_INFO.dayStartTimes],
    dayEndTimes: [...DEFAULT_COMPETITION_INFO.dayEndTimes],
  };
}

function createDefaultEventRounds() {
  return EVENT_CONFIG.reduce((acc, event) => {
    acc[event.id] = 0;
    return acc;
  }, {});
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.tab;
      tabButtons.forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      tabPanels.forEach((panel) => {
        const isTarget = panel.id === targetId;
        panel.classList.toggle("active", isTarget);
        panel.hidden = !isTarget;
      });
    });
  });
}

function setActiveTab(id) {
  const button = Array.from(tabButtons).find((btn) => btn.dataset.tab === id);
  button?.click();
}

function resetAllData() {
  localStorage.removeItem(APP_STATE_STORAGE_KEY);
  localStorage.removeItem(EVENT_SETTINGS_STORAGE_KEY);
  localStorage.removeItem(GLOBAL_SETTINGS_STORAGE_KEY);

  state.eventRounds = createDefaultEventRounds();
  state.competitionInfo = createDefaultCompetitionInfo();
  state.eventSettings = cloneEventSettingDefaults();
  state.globalSettings = { ...GLOBAL_SETTING_DEFAULTS };
  state.generatedGroups = [];
  state.scheduleRows = [];

  resetEventSelectors();
  hydrateCompetitionForm();
  hydrateEventSettingsTable();
  hydrateGlobalSettingsControls();
  renderGroupsTable();
  persistAppState();
  setActiveTab("rounds");
}

function resetEventSelectors() {
  eventSelectors.forEach((select) => {
    const eventId = select.dataset.eventSelect;
    select.value = String(state.eventRounds[eventId] ?? 0);
  });
}

function initEventSelectors() {
  eventSelectors.forEach((select) => {
    const eventId = select.dataset.eventSelect;
    if (!eventId) return;
    select.value = String(state.eventRounds[eventId] ?? 0);
    select.addEventListener("change", () => {
      state.eventRounds[eventId] = Number(select.value) || 0;
      persistAppState();
    });
  });
}

function initCompetitionForm() {
  if (!competitionForm) return;
  hydrateCompetitionForm();
  competitionForm.addEventListener("input", handleCompetitionInput);
  competitionForm.addEventListener("change", handleCompetitionInput);
}

function hydrateCompetitionForm() {
  const elements = competitionForm.elements;
  Object.entries(state.competitionInfo).forEach(([name, value]) => {
    if (name === "dayStartTimes" || name === "dayEndTimes") {
      return;
    }
    const control = elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = String(value);
    }
  });
  renderDayStartTimeInputs();
}

function handleCompetitionInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
    return;
  }
  const { name, value } = target;
  if (!name) return;

  if (name === "competitionType") {
    state.competitionInfo[name] = value;
    persistAppState();
    return;
  }

  if (name === "eventDays") {
    const days = Math.min(4, Math.max(1, Number(value) || 1));
    state.competitionInfo.eventDays = days;
    const startTimes = [...state.competitionInfo.dayStartTimes];
    const endTimes = [...state.competitionInfo.dayEndTimes];
    while (startTimes.length < days) {
      startTimes.push(startTimes[startTimes.length - 1] || "08:00");
    }
    while (endTimes.length < days) {
      endTimes.push(endTimes[endTimes.length - 1] || "19:00");
    }
    if (startTimes.length > days) {
      startTimes.length = days;
    }
    if (endTimes.length > days) {
      endTimes.length = days;
    }
    state.competitionInfo.dayStartTimes = startTimes;
    state.competitionInfo.dayEndTimes = endTimes;
    renderDayStartTimeInputs();
    clampScheduleRowDays();
    recalculateScheduleTimes();
    renderScheduleBuilder();
    persistAppState();
    return;
  }

  const numericValue = Math.max(0, Number(value) || 0);
  state.competitionInfo[name] = numericValue;
  persistAppState();
}

function renderDayStartTimeInputs() {
  if (!dayStartTimesContainer) return;
  const dayCount = state.competitionInfo.eventDays || 1;
  const startTimes = state.competitionInfo.dayStartTimes;
  const endTimes = state.competitionInfo.dayEndTimes;
  const inputs = Array.from({ length: dayCount }, (_, index) => {
    const value = startTimes[index] || startTimes[0] || "08:00";
    const endValue = endTimes[index] || endTimes[endTimes.length - 1] || "19:00";
    return `
      <div class="day-time-pair">
        <label>
          Day ${index + 1} Start Time
          <input type="time" value="${value}" data-day-start="${index}" required />
        </label>
        <label>
          Day ${index + 1} End Time
          <input type="time" value="${endValue}" data-day-end="${index}" required />
        </label>
      </div>
    `;
  }).join("");
  dayStartTimesContainer.innerHTML = inputs;
}

function initEventSettingsControls() {
  if (!settingsForm) return;
  hydrateEventSettingsTable();
  eventSettingInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const eventId = input.dataset.eventId;
      const field = input.dataset.eventSettingField;
      if (!eventId || !field) return;
      const rawNumber = Number(input.value) || 0;
      const upperBound =
        field === "localPercent" || field === "regionalPercent" ? 100 : Number.MAX_SAFE_INTEGER;
      if (!state.eventSettings[eventId]) {
        state.eventSettings[eventId] = { ...EVENT_SETTING_DEFAULTS[eventId] };
      }
      state.eventSettings[eventId][field] = Math.max(0, Math.min(upperBound, rawNumber));
      saveEventSettings();
      renderScheduleBuilder();
    });
  });

  resetSettingsBtn?.addEventListener("click", () => {
    state.eventSettings = cloneEventSettingDefaults();
    hydrateEventSettingsTable();
    state.globalSettings = { ...GLOBAL_SETTING_DEFAULTS };
    hydrateGlobalSettingsControls();
    saveEventSettings();
    saveGlobalSettings();
    renderScheduleBuilder();
  });
}

function hydrateEventSettingsTable() {
  eventSettingInputs.forEach((input) => {
    const eventId = input.dataset.eventId;
    const field = input.dataset.eventSettingField;
    if (!eventId || !field) return;
    const fallback =
      EVENT_SETTING_DEFAULTS[eventId]?.[field] ?? EVENT_SETTING_DEFAULTS["3x3"][field] ?? 0;
    const value =
      state.eventSettings[eventId]?.[field] !== undefined
        ? state.eventSettings[eventId][field]
        : fallback;
    input.value = String(value);
  });
}

function initGlobalSettingsControls() {
  hydrateGlobalSettingsControls();
  globalSettingInputs.forEach((input) => {
    const applyChange = () => {
      const key = input.dataset.globalSetting;
      if (!key) return;
      const value = getGlobalSettingInputValue(input);
      state.globalSettings[key] = value;
      saveGlobalSettings();
      if (key === "timeFormat") {
        renderScheduleBuilder();
      }
    };
    if (input instanceof HTMLSelectElement) {
      input.addEventListener("change", applyChange);
    } else {
      input.addEventListener("input", applyChange);
    }
  });
}

function hydrateGlobalSettingsControls() {
  globalSettingInputs.forEach((input) => {
    const key = input.dataset.globalSetting;
    if (!key) return;
    const value =
      state.globalSettings[key] ?? GLOBAL_SETTING_DEFAULTS[key] ?? GLOBAL_SETTING_DEFAULTS.maxRatio;
    setGlobalSettingInputValue(input, value);
  });
}

function getGlobalSettingInputValue(input) {
  if (input instanceof HTMLInputElement) {
    if (input.type === "number") {
      const numericValue = Number(input.value);
      if (!Number.isFinite(numericValue)) {
        return 0;
      }
      return Math.max(0, numericValue);
    }
    if (input.type === "checkbox") {
      return input.checked;
    }
    return input.value;
  }
  if (input instanceof HTMLSelectElement) {
    return input.value;
  }
  return input.value;
}

function setGlobalSettingInputValue(input, value) {
  if (input instanceof HTMLInputElement) {
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
      return;
    }
    input.value = String(value);
    return;
  }
  if (input instanceof HTMLSelectElement) {
    input.value = String(value);
    return;
  }
  input.value = String(value);
}

function initGenerateGroupsButton() {
  generateGroupsBtn?.addEventListener("click", () => {
    const { competitorCount, stations } = state.competitionInfo;
    if (!competitorCount || competitorCount <= 0) {
      alert("Enter a competitor count before generating groups.");
      return;
    }
    if (!stations || stations <= 0) {
      alert("Enter a station count before generating groups.");
      return;
    }
    const rows = buildGroupRows();
    if (!rows.length) {
      alert("No events selected. Choose at least one round before generating.");
      return;
    }
    state.generatedGroups = rows;
    persistAppState();
    renderGroupsTable();
    setActiveTab("groups");
  });
}

function buildGroupRows() {
  const maxRatio = Number(state.globalSettings.maxRatio) || GLOBAL_SETTING_DEFAULTS.maxRatio;
  const stations = Number(state.competitionInfo.stations) || 0;
  const competitionType = state.competitionInfo.competitionType || "Local";
  const competitorLimit = Number(state.competitionInfo.competitorCount) || 0;
  const rows = [];

  Object.entries(state.eventRounds).forEach(([eventId, totalRounds]) => {
    const roundsCount = Number(totalRounds) || 0;
    if (roundsCount <= 0) return;

    const eventSetting = state.eventSettings[eventId] || EVENT_SETTING_DEFAULTS[eventId];
    const timePerGroup =
      eventSetting?.timePerGroup ||
      EVENT_SETTING_DEFAULTS[eventId]?.timePerGroup ||
      EVENT_SETTING_DEFAULTS["3x3"].timePerGroup;
    const localPercent = eventSetting?.localPercent ?? 0;
    const regionalPercent = eventSetting?.regionalPercent ?? 0;

    const percent =
      competitionType === "Local"
        ? localPercent
        : competitionType === "Regional"
        ? regionalPercent
        : null;

    let currentCompetitors =
      percent === null ? 0 : Math.round((competitorLimit * percent) / 100);
    const favoritesMode = competitionType === "Favorites";

    for (let roundIndex = 0; roundIndex < roundsCount; roundIndex += 1) {
      const isFinal = roundsCount === 1 || roundIndex === roundsCount - 1;
      let roundCompetitors = favoritesMode ? "" : currentCompetitors;

      if (isFinal && roundsCount > 1 && !favoritesMode) {
        roundCompetitors = INTERNAL_TIMING.finalSize;
      }

      const numericCompetitors =
        roundCompetitors === "" ? 0 : Math.max(0, Number(roundCompetitors) || 0);

      const calculatedGroups =
        stations > 0 && numericCompetitors > 0
          ? Math.max(1, Math.ceil(numericCompetitors / (maxRatio * stations)))
          : 0;

      const timeTotal = calculatedGroups * timePerGroup;
      const ratio =
        calculatedGroups > 0 && stations > 0
          ? numericCompetitors / (calculatedGroups * stations)
          : 0;
      const competitorsPerGroup =
        calculatedGroups > 0 ? numericCompetitors / calculatedGroups : 0;

      rows.push({
        eventId,
        eventName: getEventLabel(eventId),
        roundLabel: getRoundLabel(roundsCount, roundIndex),
        roundIndex,
        competitors: favoritesMode ? "" : numericCompetitors,
        groups: calculatedGroups,
        timePerGroup,
        timeTotal,
        ratio,
        competitorsPerGroup,
        stations,
      });

      if (!favoritesMode && !isFinal) {
        currentCompetitors = Math.round(currentCompetitors * INTERNAL_TIMING.roundDecay);
      }
    }
  });

  return rows;
}

function renderGroupsTable() {
  if (!groupsTable) return;

  if (!state.generatedGroups.length) {
    groupsTable.classList.add("collection-placeholder");
    groupsTable.innerHTML = `<p>Click "Generate Groups" to build a schedule preview.</p>`;
    renderScheduleBuilder();
    return;
  }

  groupsTable.classList.remove("collection-placeholder");
  groupsTable.innerHTML = `
    <table class="groups-table">
      <colgroup>
        <col class="col-event" />
        <col class="col-round" />
        <col class="col-competitors" />
        <col class="col-groups" />
        <col class="col-time" />
        <col class="col-time-per-group" />
        <col class="col-ratio" />
        <col class="col-comp-per-group" />
        <col class="col-stations" />
      </colgroup>
      <thead>
        <tr>
          <th>Event</th>
          <th>Round</th>
          <th>Competitors</th>
          <th>Groups</th>
          <th>Time</th>
          <th>T/G</th>
          <th>Ratio</th>
          <th>C/G</th>
          <th>Stations</th>
        </tr>
      </thead>
      <tbody>
        ${state.generatedGroups.map((row, index) => renderGroupRow(row, index)).join("")}
      </tbody>
    </table>
  `;

  const editableInputs = groupsTable.querySelectorAll("[data-group-input]");
  editableInputs.forEach((input) =>
    input.addEventListener("input", handleGroupInputChange)
  );

  if (pendingGroupFocus) {
    const { rowIndex, field, caretPosition } = pendingGroupFocus;
    const nextInput = groupsTable.querySelector(
      `[data-group-input="${field}"][data-row-index="${rowIndex}"]`
    );
    if (nextInput instanceof HTMLInputElement) {
      nextInput.focus();
      const pos = Math.min(caretPosition, nextInput.value.length);
      nextInput.setSelectionRange(pos, pos);
    }
    pendingGroupFocus = null;
  }

  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function renderGroupRow(row, index) {
  const competitorValue = row.competitors === "" ? "" : Number(row.competitors) || 0;
  const groupsValue = Number(row.groups) || 0;
  const timePerGroupValue = Number(row.timePerGroup) || 0;
  const stationsValue = Number(row.stations) || 0;

  return `
    <tr class="event-row" data-event="${row.eventId}">
      <td>${row.eventName}</td>
      <td>${row.roundLabel}</td>
      <td>
        <input
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          data-group-input="competitors"
          data-row-index="${index}"
          value="${row.competitors === "" ? "" : competitorValue}"
        />
      </td>
      <td>
        <input
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          data-group-input="groups"
          data-row-index="${index}"
          value="${groupsValue}"
        />
      </td>
      <td class="number-cell">${formatNumber(row.timeTotal, 0)}</td>
      <td>
        <input
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          data-group-input="timePerGroup"
          data-row-index="${index}"
          value="${timePerGroupValue}"
        />
      </td>
      <td class="number-cell ratio-cell" style="color: ${getRatioColor(row.ratio)}">${formatNumber(
        row.ratio,
        2
      )}</td>
      <td class="number-cell">${formatNumber(row.competitorsPerGroup, 1)}</td>
      <td>
        <input
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          data-group-input="stations"
          data-row-index="${index}"
          value="${stationsValue}"
        />
      </td>
    </tr>
  `;
}

function handleGroupInputChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const field = target.dataset.groupInput;
  const rowIndex = Number(target.dataset.rowIndex);
  if (Number.isNaN(rowIndex) || !field) {
    return;
  }
  const row = state.generatedGroups[rowIndex];
  if (!row) {
    return;
  }

  const caretPosition = target.selectionStart ?? target.value.length;
  if (field === "competitors") {
    row.competitors = target.value === "" ? "" : Math.max(0, Number(target.value) || 0);
  } else {
    row[field] = Math.max(0, Number(target.value) || 0);
  }

  recalculateGroupRow(row);
  pendingGroupFocus = { rowIndex, field, caretPosition };
  persistAppState();
  renderGroupsTable();
}

function recalculateGroupRow(row) {
  const timePerGroup = Number(row.timePerGroup) || 0;
  const groups = Number(row.groups) || 0;
  const stations = Number(row.stations) || 0;
  const competitors = row.competitors === "" ? 0 : Math.max(0, Number(row.competitors) || 0);

  row.timeTotal = groups * timePerGroup;
  row.ratio = groups > 0 && stations > 0 ? competitors / (groups * stations) : 0;
  row.competitorsPerGroup = groups > 0 ? competitors / groups : 0;
}

function initScheduleBuilderControls() {
  scheduleBuilderWrapper?.addEventListener("pointerdown", handleScheduleInteractionStart);
  document.addEventListener("pointermove", handleScheduleInteractionMove);
  document.addEventListener("pointerup", handleScheduleInteractionEnd);
  document.addEventListener("pointercancel", handleScheduleInteractionEnd);

  scheduleViewTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-schedule-view]");
    if (!button) {
      return;
    }
    scheduleView = button.dataset.scheduleView;
    scheduleViewTabs.querySelectorAll("[data-schedule-view]").forEach((tab) => {
      const isActive = tab === button;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    renderScheduleBuilder();
  });

  generateEmptyScheduleBtn?.addEventListener("click", () => {
    if (!state.generatedGroups.length) {
      alert("Generate groups first.");
      return;
    }
    const dayCount = state.competitionInfo.eventDays || 1;
    const baseRows = [createSpecialScheduleRow("setup"), createSpecialScheduleRow("tutorial")];
    baseRows.forEach((row) => {
      row.day = clampDay(row.day || 1);
    });
    const slotCount = state.generatedGroups.length;
    const eventSlots = Array.from({ length: slotCount }, (_, index) => {
      const slot = createEventScheduleRow();
      slot.day = clampDay((index % dayCount) + 1);
      return slot;
    });
    state.scheduleRows = [...baseRows, ...eventSlots];
    clampScheduleRowDays();
    persistAppState();
    recalculateScheduleTimes();
    renderScheduleBuilder();
  });

  generateScheduleBtn?.addEventListener("click", generateSuggestedSchedule);

  clearScheduleBtn?.addEventListener("click", () => {
    state.scheduleRows = [];
    persistAppState();
    renderScheduleBuilder();
  });

  addSpecialBlockBtn?.addEventListener("click", () => {
    const key = specialBlockSelect?.value;
    if (!key) {
      alert("Select a special block to add.");
      return;
    }

    if (key === "custom") {
      const nameInput = prompt("Enter a name for this block:");
      if (nameInput === null) {
        return;
      }
      const label = nameInput.trim();
      if (!label) {
        alert("Custom blocks need a name.");
        return;
      }
      const durationInput = prompt("Enter the duration in minutes:");
      if (durationInput === null) {
        return;
      }
      const duration = Math.max(1, Math.round(Number(durationInput)));
      if (!Number.isFinite(duration)) {
        alert("Enter a valid duration in minutes.");
        return;
      }
      state.scheduleRows.push(createSpecialScheduleRow("custom", { label, duration }));
    } else {
      state.scheduleRows.push(createSpecialScheduleRow(key));
    }

    if (specialBlockSelect) {
      specialBlockSelect.value = "";
    }
    persistAppState();
    recalculateScheduleTimes();
    renderScheduleBuilder();
  });

  scheduleBuilderWrapper?.addEventListener("change", (event) => {
    const dayStartInput = event.target.closest("[data-schedule-day-start]");
    if (dayStartInput) {
      updateDayStartTime(Number(dayStartInput.dataset.scheduleDayStart), dayStartInput.value);
      return;
    }
    const dayEndInput = event.target.closest("[data-schedule-day-end]");
    if (dayEndInput) {
      updateDayEndTime(Number(dayEndInput.dataset.scheduleDayEnd), dayEndInput.value);
      return;
    }
    const select = event.target.closest("[data-schedule-select]");
    if (select) {
      handleScheduleSelectChange(select);
    }
  });

  scheduleBuilderWrapper?.addEventListener("click", (event) => {
    const addBtn = event.target.closest("[data-add-slot-day]");
    if (addBtn) {
      const dayValue = Number(addBtn.dataset.addSlotDay);
      handleAddEventSlot(dayValue);
      return;
    }
    const deleteBtn = event.target.closest("[data-delete-row]");
    if (deleteBtn) {
      const rowId = deleteBtn.dataset.deleteRow;
      state.scheduleRows = state.scheduleRows.filter((row) => row.id !== rowId);
      persistAppState();
      recalculateScheduleTimes();
      renderScheduleBuilder();
    }
  });

  scheduleBuilderWrapper?.addEventListener("input", (event) => {
    const durationInput = event.target.closest("[data-special-duration]");
    if (durationInput) {
      handleSpecialDurationChange(durationInput);
    }
  });

  downloadScheduleBtn?.addEventListener("click", () => {
    if (!state.scheduleRows.length) {
      alert("Build a schedule before downloading.");
      return;
    }
    const csv = buildScheduleCsv();
    downloadCsv(csv, "schedule.csv");
  });
}

function generateSuggestedSchedule() {
  if (!state.generatedGroups.length) {
    alert("Generate groups first.");
    return;
  }

  const groupedEvents = new Map();
  state.generatedGroups.forEach((group, groupIndex) => {
    const entries = groupedEvents.get(group.eventId) || [];
    entries.push({ group, groupIndex });
    groupedEvents.set(group.eventId, entries);
  });
  const eventOrder = Array.from(groupedEvents.keys());
  const threeByThreeRounds = groupedEvents.get("3x3") || [];
  const threeByThreeFirst = threeByThreeRounds.find(
    ({ group }) => group.roundIndex === 0 && (group.roundLabel !== "Final" || threeByThreeRounds.length === 1)
  );
  if (!threeByThreeFirst) {
    alert("The suggested schedule needs at least one 3x3 round.");
    return;
  }

  const preferredEventIds = ["2x2", "pyra", "4x4"];
  const firstRoundByEvent = new Map();
  groupedEvents.forEach((entries, eventId) => {
    const firstRound = entries.find(
      ({ group }) => group.roundIndex === 0 && (group.roundLabel !== "Final" || entries.length === 1)
    );
    if (firstRound) firstRoundByEvent.set(eventId, firstRound);
  });

  const preferredFirstId = preferredEventIds.find(
    (eventId) => firstRoundByEvent.has(eventId) && eventId !== "3x3"
  );
  const firstRoundOrder = [
    threeByThreeFirst,
    ...(preferredFirstId ? [firstRoundByEvent.get(preferredFirstId)] : []),
    ...eventOrder
      .filter((eventId) => eventId !== "3x3" && eventId !== preferredFirstId)
      .map((eventId) => firstRoundByEvent.get(eventId))
      .filter(Boolean),
  ];
  const lunchBoundary = chooseSuggestedLunchBoundary(firstRoundOrder, preferredEventIds);
  const firstRoundsBeforeLunch = firstRoundOrder.slice(0, lunchBoundary.count);
  let firstRoundsAfterLunch = firstRoundOrder.slice(lunchBoundary.count);
  const preferredAfterLunch = preferredEventIds.find((eventId) =>
    firstRoundsAfterLunch.some(({ group }) => group.eventId === eventId)
  );
  if (preferredAfterLunch) {
    const preferredIndex = firstRoundsAfterLunch.findIndex(
      ({ group }) => group.eventId === preferredAfterLunch
    );
    firstRoundsAfterLunch = [
      firstRoundsAfterLunch[preferredIndex],
      ...firstRoundsAfterLunch.filter((_, index) => index !== preferredIndex),
    ];
  }

  const scheduledFirstRounds = [...firstRoundsBeforeLunch, ...firstRoundsAfterLunch];
  const scheduledEventOrder = scheduledFirstRounds.map(({ group }) => group.eventId);
  const scheduleRows = [
    createSpecialScheduleRow("setup", { duration: 45 }),
    createSpecialScheduleRow("tutorial", { duration: 25, label: "New Competitor Tutorial" }),
    ...firstRoundsBeforeLunch.map(({ groupIndex }) => createSuggestedEventRow(groupIndex)),
  ];
  const lunchRow = createSpecialScheduleRow("lunch", { duration: 60 });
  lunchRow.targetDay = 1;
  if (Number.isFinite(lunchBoundary.startOverrideMinutes)) {
    lunchRow.startOverrideMinutes = lunchBoundary.startOverrideMinutes;
  }
  scheduleRows.push(
    lunchRow,
    ...firstRoundsAfterLunch.map(({ groupIndex }) => createSuggestedEventRow(groupIndex))
  );
  for (let day = 2; day <= (state.competitionInfo.eventDays || 1); day += 1) {
    const additionalLunch = createSpecialScheduleRow("lunch", { duration: 60 });
    additionalLunch.targetDay = day;
    scheduleRows.push(additionalLunch);
  }

  const nonFinalRoundIndexes = state.generatedGroups
    .filter((group) => group.roundLabel !== "Final")
    .map((group) => group.roundIndex)
    .filter((roundIndex) => roundIndex > 0);
  const lastNonFinalRound = Math.max(0, ...nonFinalRoundIndexes);
  for (let roundIndex = 1; roundIndex <= lastNonFinalRound; roundIndex += 1) {
    scheduledEventOrder.forEach((eventId) => {
      const entry = (groupedEvents.get(eventId) || []).find(
        ({ group }) => group.roundIndex === roundIndex && group.roundLabel !== "Final"
      );
      if (entry) scheduleRows.push(createSuggestedEventRow(entry.groupIndex));
    });
  }

  eventOrder
    .filter((eventId) => eventId !== "3x3")
    .concat("3x3")
    .forEach((eventId) => {
      const entries = groupedEvents.get(eventId) || [];
      if (entries.length === 1) return;
      const final = entries.find(
        ({ group }) => group.roundLabel === "Final"
      );
      if (final) scheduleRows.push(createSuggestedEventRow(final.groupIndex));
    });
  scheduleRows.push(createSpecialScheduleRow("awards", { duration: 45 }));

  assignSuggestedScheduleDays(scheduleRows);
  positionAdditionalDayLunches(scheduleRows);
  state.scheduleRows = scheduleRows;
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function assignSuggestedScheduleDays(rows) {
  const dayCount = state.competitionInfo.eventDays || 1;
  const cursors = {};
  for (let day = 1; day <= dayCount; day += 1) {
    cursors[day] = minutesFromTime(getDayStartInputValue(day)) ?? 8 * 60;
  }

  const awardsRow = rows.find((row) => row.type === "special" && row.specialKey === "awards");
  let currentDay = 1;
  rows.filter((row) => row !== awardsRow).forEach((row) => {
    const staysOnFirstDay = row.specialKey === "setup" || row.specialKey === "tutorial";
    const targetDay = Number.isInteger(row.targetDay) ? row.targetDay : null;
    const pinnedToDay = staysOnFirstDay || targetDay !== null;
    let day = staysOnFirstDay ? 1 : targetDay ?? currentDay;
    let cursor = cursors[day] ?? cursors[1];
    let start = Number.isFinite(row.startOverrideMinutes)
      ? Math.max(cursor, row.startOverrideMinutes)
      : cursor;
    const duration = getScheduleRowDuration(row);

    while (!pinnedToDay && day < dayCount && start + duration > getDayEndMinutes(day)) {
      day += 1;
      cursor = cursors[day] ?? (minutesFromTime(getDayStartInputValue(day)) ?? 8 * 60);
      start = Number.isFinite(row.startOverrideMinutes)
        ? Math.max(cursor, row.startOverrideMinutes)
        : cursor;
    }

    row.day = day;
    if (Number.isFinite(row.startOverrideMinutes)) {
      row.startOverrideMinutes = start;
    }
    delete row.targetDay;
    cursors[day] = start + duration;
    if (!staysOnFirstDay) currentDay = Math.max(currentDay, day);
  });

  if (awardsRow) {
    awardsRow.day = dayCount;
    const cursor = cursors[dayCount] ?? (minutesFromTime(getDayStartInputValue(dayCount)) ?? 8 * 60);
    awardsRow.startOverrideMinutes = cursor;
  }
}

function positionAdditionalDayLunches(rows) {
  const dayCount = state.competitionInfo.eventDays || 1;
  for (let day = 2; day <= dayCount; day += 1) {
    const lunch = rows.find(
      (row) => row.type === "special" && row.specialKey === "lunch" && row.day === day
    );
    if (!lunch) continue;

    const dayEvents = rows.filter((row) => row.type === "event" && row.day === day);
    const placement = chooseDailyLunchPlacement(day, dayEvents);
    rows.splice(rows.indexOf(lunch), 1);
    const nextEvent = dayEvents[placement.count];
    let insertIndex;
    if (nextEvent) {
      insertIndex = rows.indexOf(nextEvent);
    } else if (dayEvents.length) {
      insertIndex = rows.indexOf(dayEvents[dayEvents.length - 1]) + 1;
    } else {
      const awardsIndex = rows.findIndex(
        (row) => row.type === "special" && row.specialKey === "awards"
      );
      insertIndex = awardsIndex === -1 ? rows.length : awardsIndex;
    }
    lunch.startOverrideMinutes = placement.startMinutes;
    rows.splice(insertIndex, 0, lunch);
  }

  const awardsRow = rows.find((row) => row.type === "special" && row.specialKey === "awards");
  if (awardsRow) delete awardsRow.startOverrideMinutes;
}

function chooseDailyLunchPlacement(day, dayEvents) {
  const dayStart = minutesFromTime(getDayStartInputValue(day)) ?? 8 * 60;
  const boundaries = [{ count: 0, time: dayStart }];
  let time = dayStart;
  dayEvents.forEach((row, index) => {
    time += getScheduleRowDuration(row);
    boundaries.push({ count: index + 1, time });
  });

  const chooseClosestToMidpoint = (candidates) =>
    [...candidates].sort(
      (a, b) => Math.abs(a.time - 12.5 * 60) - Math.abs(b.time - 12.5 * 60)
    )[0];
  const midday = boundaries.filter((boundary) => boundary.time >= 12 * 60 && boundary.time <= 13 * 60);
  let boundary;
  if (midday.length) {
    boundary = chooseClosestToMidpoint(midday);
  } else if (dayStart < 9 * 60) {
    const beforeNoon = boundaries.filter((entry) => entry.time < 12 * 60);
    boundary = beforeNoon.sort((a, b) => b.time - a.time)[0];
  } else {
    const afterOne = boundaries.filter((entry) => entry.time > 13 * 60);
    boundary = afterOne.sort((a, b) => a.time - b.time)[0];
  }

  boundary ||= chooseClosestToMidpoint(boundaries);
  let startMinutes = boundary.time;
  if (!dayEvents.length) {
    startMinutes = Math.max(startMinutes, 12 * 60);
  } else if (!midday.length && dayStart < 9 * 60 && startMinutes < 12 * 60) {
    startMinutes = Math.max(startMinutes, 11 * 60 + 30);
  } else if (!midday.length && dayStart >= 9 * 60 && startMinutes < 13 * 60) {
    startMinutes = 13 * 60;
  }
  return { count: boundary.count, startMinutes };
}

function chooseSuggestedLunchBoundary(firstRounds, preferredEventIds) {
  const startTime = minutesFromTime(getDayStartInputValue(1)) ?? 8 * 60;
  const boundaries = [];
  let time = startTime + 45 + 25;
  firstRounds.forEach((entry, index) => {
    time += Math.max(0, Number(entry.group.timeTotal) || 0);
    boundaries.push({ count: index + 1, time });
  });

  const hasPreferredAfter = (boundary) =>
    firstRounds.slice(boundary.count).some(({ group }) =>
      preferredEventIds.includes(group.eventId)
    );
  const chooseClosestToLunchMidpoint = (candidates) =>
    [...candidates].sort(
      (a, b) =>
        Math.abs(a.time - 12.5 * 60) - Math.abs(b.time - 12.5 * 60) ||
        a.count - b.count
    )[0];

  const midday = boundaries.filter((boundary) => boundary.time >= 12 * 60 && boundary.time <= 13 * 60);
  if (midday.length) {
    const withPreferredAfter = midday.filter(hasPreferredAfter);
    return chooseClosestToLunchMidpoint(withPreferredAfter.length ? withPreferredAfter : midday);
  }

  const preferredBoundaries = boundaries.filter(hasPreferredAfter);
  if (startTime < 9 * 60) {
    const beforeNoon = boundaries.filter((boundary) => boundary.time < 12 * 60);
    const preferredBeforeNoon = beforeNoon.filter(hasPreferredAfter);
    const candidates = preferredBeforeNoon.length ? preferredBeforeNoon : beforeNoon;
    if (candidates.length) {
      return candidates.sort((a, b) => b.time - a.time)[0];
    }
  } else {
    const afterOne = boundaries.filter((boundary) => boundary.time > 13 * 60);
    const preferredAfterOne = afterOne.filter(hasPreferredAfter);
    const candidates = preferredAfterOne.length ? preferredAfterOne : afterOne;
    if (candidates.length) {
      return candidates.sort((a, b) => a.time - b.time)[0];
    }
  }

  const fallback = chooseClosestToLunchMidpoint(preferredBoundaries.length ? preferredBoundaries : boundaries);
  if (fallback && startTime >= 9 * 60 && fallback.time < 13 * 60) {
    return { ...fallback, startOverrideMinutes: 13 * 60 };
  }
  return fallback || { count: firstRounds.length, time };
}

function createSuggestedEventRow(groupIndex) {
  const row = createEventScheduleRow();
  row.groupIndex = groupIndex;
  return row;
}

function initScheduleUploadControls() {
  if (!uploadScheduleBtn || !uploadScheduleInput) {
    return;
  }
  uploadScheduleBtn.addEventListener("click", () => {
    uploadScheduleInput.value = "";
    uploadScheduleInput.click();
  });
  uploadScheduleInput.addEventListener("change", () => {
    const file = uploadScheduleInput.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        importScheduleFromCsv(text);
      } catch (error) {
        console.error("Failed to import schedule CSV.", error);
        alert(
          error instanceof Error
            ? error.message
            : "Unable to import this CSV. Please ensure it was exported from this tool."
        );
      } finally {
        uploadScheduleInput.value = "";
      }
    });
    reader.addEventListener("error", () => {
      console.error("Failed to read uploaded CSV file.");
      alert("Unable to read the selected file. Please try again.");
      uploadScheduleInput.value = "";
    });
    reader.readAsText(file);
  });
}

function createEventScheduleRow() {
  return {
    id: generateId("event-slot"),
    type: "event",
    groupIndex: null,
    day: clampDay(1),
  };
}

function handleAddEventSlot(day) {
  if (!state.generatedGroups.length) {
    alert("Generate groups first.");
    return;
  }
  const slot = createEventScheduleRow();
  slot.day = clampDay(day);
  state.scheduleRows.push(slot);
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function createSpecialScheduleRow(key, overrides = {}) {
  const config = SPECIAL_BLOCKS[key] || {};
  const label = overrides.label ?? config.label ?? "Special";
  const duration = overrides.duration ?? config.duration ?? 0;
  return {
    id: generateId("special-slot"),
    type: "special",
    specialKey: key,
    label,
    durationMinutes: duration,
    day: clampDay(1),
  };
}

function clampDay(value) {
  const max = state.competitionInfo.eventDays || 1;
  return Math.min(max, Math.max(1, Number(value) || 1));
}

function clampScheduleRowDays() {
  state.scheduleRows.forEach((row) => {
    row.day = clampDay(row.day);
  });
}

function recalculateScheduleTimes() {
  const dayCount = state.competitionInfo.eventDays || 1;
  const cursors = {};
  const startTimes = state.competitionInfo.dayStartTimes;
  for (let day = 1; day <= dayCount; day += 1) {
    const timeValue = startTimes[day - 1] || startTimes[0] || "08:00";
    cursors[day] = minutesFromTime(timeValue) ?? 8 * 60;
  }
  state.scheduleRows.forEach((row) => {
    row.day = clampDay(row.day);
    const duration = getScheduleRowDuration(row);
    const dayCursor = cursors[row.day] ?? cursors[1];
    const start = Number.isFinite(row.startOverrideMinutes)
      ? row.startOverrideMinutes
      : dayCursor;
    row.startMinutes = start;
    row.endMinutes = start + duration;
    cursors[row.day] = Math.max(dayCursor, row.endMinutes);
  });
}

function getScheduleRowDuration(row) {
  if (row.type === "special") {
    return Math.max(0, Number(row.durationMinutes) || 0);
  }
  if (Number.isFinite(row.durationOverrideMinutes)) {
    return Math.max(0, row.durationOverrideMinutes);
  }
  const data = getScheduleRowData(row);
  return data?.timeTotal || 0;
}

function renderScheduleBuilder() {
  if (!scheduleBuilderWrapper) return;

  if (!state.scheduleRows.length) {
    const hasCalendarLanes = scheduleView === "schedule";
    scheduleBuilderWrapper.classList.toggle("collection-placeholder", !hasCalendarLanes);
    scheduleBuilderWrapper.innerHTML = hasCalendarLanes
      ? renderScheduleTimeline()
      : `<p>Add events to begin composing the schedule.</p>`;
    return;
  }

  scheduleBuilderWrapper.classList.remove("collection-placeholder");
  scheduleBuilderWrapper.innerHTML = scheduleView === "schedule"
    ? renderScheduleTimeline()
    : `
    <table class="schedule-table">
      <colgroup>
        <col class="col-start" />
        <col class="col-end" />
        <col class="col-event" />
        <col class="col-round" />
        <col class="col-competitors" />
        <col class="col-groups" />
        <col class="col-time" />
        <col class="col-tg" />
        <col class="col-ratio" />
        <col class="col-cg" />
        <col class="col-stations" />
        <col class="col-delete" />
      </colgroup>
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Event</th>
          <th>Round</th>
          <th>Competitors</th>
          <th>Groups</th>
          <th>Time</th>
          <th>T/G</th>
          <th>Ratio</th>
          <th>C/G</th>
          <th>Stations</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${renderScheduleRowsWithHeaders()}
      </tbody>
    </table>
  `;

  attachScheduleRowDragHandlers(scheduleBuilderWrapper);
  attachDayDropZones();
}

function renderScheduleTimeline() {
  const dayCount = state.competitionInfo.eventDays || 1;
  const rowsByDay = Array.from({ length: dayCount }, () => []);
  state.scheduleRows.forEach((row) => {
    rowsByDay[clampDay(row.day) - 1].push(row);
  });

  return `
    <div class="schedule-timeline">
      ${rowsByDay.map((rows, index) => {
        const day = index + 1;
        const startTime = minutesFromTime(getDayStartLabel(day)) ?? 8 * 60;
        const firstEventTime = rows.length
          ? Math.min(...rows.map((row) => row.startMinutes))
          : startTime;
        const timelineStart = Math.min(startTime, firstEventTime);
        const lastEventTime = rows.length
          ? Math.max(...rows.map((row) => row.endMinutes))
          : startTime;
        const hourCount = Math.max(8, Math.ceil((lastEventTime - timelineStart) / 60));
        const timelineHeight = hourCount * 60 * SCHEDULE_MINUTES_PER_PIXEL;
        const calendarRows = arrangeCalendarRows(rows);
        return `
          <section class="schedule-day-lane" data-drop-day="${day}" aria-label="Day ${day} schedule">
            <h4>
              <span>Day ${day} start</span>
              <input type="time" class="calendar-day-start-input" data-schedule-day-start="${day - 1}" value="${getDayStartInputValue(day)}" aria-label="Day ${day} start time" />
              <span>End</span>
              <input type="time" class="calendar-day-end-input" data-schedule-day-end="${day - 1}" value="${getDayEndInputValue(day)}" aria-label="Day ${day} end time" />
              <button type="button" class="calendar-add-slot-btn" data-add-slot-day="${day}" aria-label="Add event slot to Day ${day}">+</button>
            </h4>
            <div class="calendar-scroll">
              <div class="calendar-day-grid" data-start-minutes="${timelineStart}" style="height: ${timelineHeight}px">
                <div class="calendar-time-axis">
                  ${Array.from({ length: hourCount + 1 }, (_, hour) => `
                    <span style="top: ${hour * 60 * SCHEDULE_MINUTES_PER_PIXEL}px">${timeFromMinutes(timelineStart + hour * 60)}</span>
                  `).join("")}
                </div>
                <div class="calendar-event-layer">
                  ${calendarRows.map(({ row, column, columnCount }) => renderScheduleCard(row, timelineStart, column, columnCount)).join("")}
                </div>
              </div>
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function arrangeCalendarRows(rows) {
  const sortedRows = [...rows].sort((a, b) => a.startMinutes - b.startMinutes);
  const layouts = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const addCluster = () => {
    const columnEnds = [];
    const placed = cluster.map(({ row, displayEnd }) => {
      let column = columnEnds.findIndex((end) => end <= row.startMinutes);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = displayEnd;
      return { row, column };
    });
    placed.forEach((entry) => {
      layouts.push({ ...entry, columnCount: columnEnds.length });
    });
    cluster = [];
    clusterEnd = -Infinity;
  };

  sortedRows.forEach((row) => {
    const unassignedEvent = row.type === "event" && !getScheduleRowData(row);
    const displayDuration = unassignedEvent ? 32 : MIN_SCHEDULE_ROW_DURATION;
    const displayEnd = Math.max(row.endMinutes, row.startMinutes + displayDuration);
    if (cluster.length && row.startMinutes >= clusterEnd) {
      addCluster();
    }
    cluster.push({ row, displayEnd });
    clusterEnd = Math.max(clusterEnd, displayEnd);
  });
  if (cluster.length) addCluster();

  return layouts;
}

function renderScheduleCard(row, timelineStart, column, columnCount) {
  const data = getScheduleRowData(row);
  const isSpecial = row.type === "special";
  const startLabel = Number.isFinite(row.startMinutes)
    ? timeFromMinutes(row.startMinutes)
    : "—";
  const endLabel = Number.isFinite(row.endMinutes)
    ? timeFromMinutes(row.endMinutes)
    : "—";
  const title = isSpecial
    ? row.label || SPECIAL_BLOCKS[row.specialKey]?.label || "Special"
    : data
      ? `${data.eventName} ${data.roundLabel}`
      : "Unassigned event";
  const detail = isSpecial ? "Special block" : "Event slot";
  const eventAttribute = data?.eventId ? ` data-event="${data.eventId}"` : "";
  const duration = getScheduleRowDuration(row);
  const top = Math.max(0, (row.startMinutes - timelineStart) * SCHEDULE_MINUTES_PER_PIXEL);
  const isUnassignedEvent = row.type === "event" && !data;
  const height = Math.max(isUnassignedEvent ? 96 : 24, duration * SCHEDULE_MINUTES_PER_PIXEL);
  const timingRedAlpha = getScheduleTimingRedAlpha(data, row);
  const left = (column / columnCount) * 100;
  const right = ((columnCount - column - 1) / columnCount) * 100;
  const assignmentControl = isUnassignedEvent
    ? `
      <select class="calendar-event-select" data-schedule-select data-row-id="${row.id}" aria-label="Assign event to schedule block">
        <option value="">Select event</option>
        ${getGroupOptions(row)
          .map((option) => `<option value="${option.value}">${option.label}</option>`)
          .join("")}
      </select>
    `
    : "";

  return `
    <article class="calendar-event${isSpecial ? " special-card" : ""}" data-row-id="${row.id}" data-day="${row.day}"${eventAttribute} style="--event-top: ${top}px; --event-height: ${height}px; --event-left: ${left}%; --event-right: ${right}%; --timing-red-alpha: ${timingRedAlpha}" aria-label="${title}, ${startLabel} to ${endLabel}">
      <button type="button" class="calendar-resize-handle top" data-resize-edge="start" aria-label="Adjust ${title} start time"></button>
      <button type="button" class="calendar-delete-btn" data-delete-row="${row.id}" aria-label="Remove ${title}">×</button>
      <div class="calendar-event-content">
        <strong>${title}</strong>
        ${assignmentControl}
        <span class="calendar-event-time">${startLabel} - ${endLabel}</span>
        <span class="calendar-event-duration">${detail} · ${formatNumber(duration, 0)} min</span>
      </div>
      <button type="button" class="calendar-resize-handle bottom" data-resize-edge="end" aria-label="Adjust ${title} end time"></button>
    </article>
  `;
}

function getScheduleTimingRedAlpha(group, row) {
  let alpha = 0;
  if (group?.eventId && group.roundLabel !== "Final") {
    const recommended = Number(
      state.eventSettings[group.eventId]?.timePerGroup ??
        EVENT_SETTING_DEFAULTS[group.eventId]?.timePerGroup
    );
    const current = Number(group.timePerGroup);
    if (recommended > 0 && current >= 0 && current < recommended) {
      const shortfallBeyondBuffer = recommended - current - 3;
      if (shortfallBeyondBuffer > 0) {
        const maximumShortfall = Math.max(1, recommended - 3);
        alpha = Math.min(1, shortfallBeyondBuffer / maximumShortfall) * 0.16;
      }
    }
  }

  if (
    row &&
    Number.isFinite(row.endMinutes) &&
    row.endMinutes > getDayEndMinutes(row.day)
  ) {
    alpha = Math.max(alpha, 0.58);
  }
  return alpha.toFixed(3);
}

function handleScheduleInteractionStart(event) {
  const handle = event.target.closest("[data-resize-edge]");
  const card = event.target.closest(".calendar-event");
  if (!card || event.target.closest("[data-delete-row], [data-schedule-select]")) return;

  const row = state.scheduleRows.find((entry) => entry.id === card.dataset.rowId);
  const grid = card.closest(".calendar-day-grid");
  if (!row || !grid) return;

  event.preventDefault();
  const duration = Math.max(MIN_SCHEDULE_ROW_DURATION, getScheduleRowDuration(row));
  activeScheduleInteraction = {
    pointerId: event.pointerId,
    rowId: row.id,
    mode: handle ? "resize" : "move",
    edge: handle?.dataset.resizeEdge,
    initialY: event.clientY,
    initialX: event.clientX,
    initialStart: row.startMinutes,
    initialDuration: duration,
    initialDay: row.day,
    timelineStart: Number(grid.dataset.startMinutes),
  };
  card.setPointerCapture(event.pointerId);
}

function handleScheduleInteractionMove(event) {
  if (!activeScheduleInteraction || activeScheduleInteraction.pointerId !== event.pointerId) return;

  const interaction = activeScheduleInteraction;
  const delta = Math.round(((event.clientY - interaction.initialY) / SCHEDULE_MINUTES_PER_PIXEL) / 5) * 5;
  const duration = interaction.mode === "resize"
    ? interaction.edge === "start"
      ? Math.max(MIN_SCHEDULE_ROW_DURATION, interaction.initialDuration - delta)
      : Math.max(MIN_SCHEDULE_ROW_DURATION, interaction.initialDuration + delta)
    : interaction.initialDuration;
  let start = interaction.initialStart + delta;
  if (interaction.mode === "resize") {
    start = interaction.edge === "start"
      ? interaction.initialStart + interaction.initialDuration - duration
      : interaction.initialStart;
  }
  let day = interaction.previewDay || interaction.initialDay;
  let timelineStart = interaction.timelineStart;

  if (interaction.mode === "move") {
    const targetLane = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest(".schedule-day-lane");
    if (targetLane) {
      day = Number(targetLane.dataset.dropDay);
      const targetGrid = targetLane.querySelector(".calendar-day-grid");
      timelineStart = Number(targetGrid?.dataset.startMinutes) || timelineStart;
    }
    start = Math.max(timelineStart, start);
  }

  const card = Array.from(scheduleBuilderWrapper.querySelectorAll(".calendar-event"))
    .find((element) => element.dataset.rowId === interaction.rowId);
  if (!card) return;

  if (interaction.mode === "move") {
    const targetLane = document.querySelector(`.schedule-day-lane[data-drop-day="${day}"]`);
    const targetLayer = targetLane?.querySelector(".calendar-event-layer");
    if (targetLayer && card.parentElement !== targetLayer) {
      targetLayer.append(card);
    }
    card.style.setProperty("--event-left", "0%");
    card.style.setProperty("--event-right", "0%");
  }
  card.style.setProperty("--event-top", `${Math.max(0, (start - timelineStart) * SCHEDULE_MINUTES_PER_PIXEL)}px`);
  card.style.setProperty("--event-height", `${Math.max(24, duration * SCHEDULE_MINUTES_PER_PIXEL)}px`);
  card.querySelector(".calendar-event-time").textContent = `${timeFromMinutes(start)} - ${timeFromMinutes(start + duration)}`;
  card.querySelector(".calendar-event-duration").textContent = `${duration} min`;
  interaction.previewStart = start;
  interaction.previewDuration = duration;
  interaction.previewDay = day;
}

function handleScheduleInteractionEnd(event) {
  if (!activeScheduleInteraction || activeScheduleInteraction.pointerId !== event.pointerId) return;

  const interaction = activeScheduleInteraction;
  activeScheduleInteraction = null;
  if (!Number.isFinite(interaction.previewStart)) return;

  const row = state.scheduleRows.find((entry) => entry.id === interaction.rowId);
  if (!row) return;
  row.day = clampDay(interaction.previewDay);
  row.startOverrideMinutes = interaction.previewStart;
  if (interaction.mode === "resize") {
    if (row.type === "special") {
      row.durationMinutes = interaction.previewDuration;
    } else {
      const group = getScheduleRowData(row);
      if (group && Number(group.groups) > 0) {
        group.timePerGroup = interaction.previewDuration / Number(group.groups);
        recalculateGroupRow(group);
        delete row.durationOverrideMinutes;
      } else {
        row.durationOverrideMinutes = interaction.previewDuration;
      }
    }
  }

  persistAppState();
  recalculateScheduleTimes();
  if (row.type === "event") {
    renderGroupsTable();
  } else {
    renderScheduleBuilder();
  }
}

function getOutOfOrderScheduleRowIds() {
  const perEvent = new Map();
  const invalid = new Set();

  state.scheduleRows.forEach((row, index) => {
    if (row.type !== "event") {
      return;
    }
    const data = getScheduleRowData(row);
    if (!data || data.roundIndex === undefined || data.roundIndex === null) {
      return;
    }
    const entries = perEvent.get(data.eventId) || [];
    entries.push({
      rowId: row.id,
      roundIndex: data.roundIndex,
      day: clampDay(row.day),
      startMinutes: Number.isFinite(row.startMinutes) ? row.startMinutes : 0,
      order: index,
    });
    perEvent.set(data.eventId, entries);
  });

  perEvent.forEach((records) => {
    records.sort((a, b) => {
      if (a.day !== b.day) {
        return a.day - b.day;
      }
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return a.order - b.order;
    });
    const seen = [];
    records.forEach((entry) => {
      const conflicts = seen.filter((record) => record.roundIndex > entry.roundIndex);
      if (conflicts.length) {
        conflicts.forEach((record) => invalid.add(record.rowId));
        invalid.add(entry.rowId);
      }
      seen.push(entry);
    });
  });

  return invalid;
}

function renderScheduleRowsWithHeaders() {
  const invalidRowIds = getOutOfOrderScheduleRowIds();
  const totalDays = state.competitionInfo.eventDays || 1;
  const rowsByDay = Array.from({ length: totalDays }, () => []);
  state.scheduleRows.forEach((row) => {
    const day = clampDay(row.day);
    row.day = day;
    rowsByDay[day - 1].push(row);
  });

  const parts = [];
  for (let day = 1; day <= totalDays; day += 1) {
    parts.push(renderDayHeaderRow(day));
    const entries = rowsByDay[day - 1];
    if (!entries.length) {
      parts.push(
        `<tr class="day-empty" data-drop-day="${day}"><td colspan="12">No items planned for this day.</td></tr>`
      );
    } else {
      entries.forEach((row) => parts.push(renderScheduleRow(row, invalidRowIds)));
    }
  }
  return parts.join("");
}

function renderDayHeaderRow(day) {
  return `
    <tr class="day-header" data-drop-day="${day}">
      <td colspan="11">
        <div class="day-start-cell">
          <span>Day ${day} start</span>
          <input type="time" class="schedule-day-start-input" data-schedule-day-start="${day - 1}" value="${getDayStartInputValue(day)}" aria-label="Day ${day} start time" />
          <span>End</span>
          <input type="time" class="schedule-day-end-input" data-schedule-day-end="${day - 1}" value="${getDayEndInputValue(day)}" aria-label="Day ${day} end time" />
        </div>
      </td>
      <td class="delete-cell">
        <button
          type="button"
          class="add-day-slot-btn"
          aria-label="Add event slot for Day ${day}"
          data-add-slot-day="${day}"
        >
          +
        </button>
      </td>
    </tr>
  `;
}

function renderScheduleRow(row, invalidRowIds) {
  const startLabel =
    row.startMinutes !== undefined ? timeFromMinutes(row.startMinutes) : "—";
  const endLabel = row.endMinutes !== undefined ? timeFromMinutes(row.endMinutes) : "—";
  const classes = ["schedule-row"];
  if (invalidRowIds?.has(row.id)) {
    classes.push("out-of-order-row");
  }
  if (isScheduleRowPastEnd(row)) {
    classes.push("after-day-end-row");
  }
  let attr = "";
  let body = "";

  if (row.type === "special") {
    classes.push("special-row");
    const fallbackConfig = SPECIAL_BLOCKS[row.specialKey] || {};
    const label = row.label || fallbackConfig.label || "Special";
    const durationValue = row.durationMinutes ?? fallbackConfig.duration ?? 0;
    body = `
      <td>${label}</td>
      <td class="readonly-cell">—</td>
      <td class="readonly-cell">—</td>
      <td class="readonly-cell">—</td>
      <td>
        <input
          type="number"
          min="1"
          step="5"
          data-special-duration
          data-row-id="${row.id}"
          value="${durationValue}"
        />
      </td>
      <td class="readonly-cell">—</td>
      <td class="readonly-cell">—</td>
      <td class="readonly-cell">—</td>
      <td class="readonly-cell">—</td>
    `;
  } else {
    const data = getScheduleRowData(row);
    if (data && data.eventId) {
      attr = ` data-event="${data.eventId}"`;
      classes.push("event-row");
    } else {
      classes.push("event-row");
    }
    const groupOptions = getGroupOptions(row);
    body = `
      <td>
        <select data-schedule-select data-row-id="${row.id}">
          <option value="">Select event</option>
          ${groupOptions
            .map(
              (option) => `
              <option value="${option.value}" ${
                row.groupIndex === option.index ? "selected" : ""
              }>
                ${option.label}
              </option>
            `
            )
            .join("")}
        </select>
      </td>
      <td>${data?.roundLabel ?? "—"}</td>
      <td class="readonly-cell">${data?.competitors ?? "—"}</td>
      <td class="readonly-cell">${data?.groups ?? "—"}</td>
      <td class="readonly-cell">${formatNumber(data?.timeTotal, 0)}</td>
      <td class="readonly-cell">${formatNumber(data?.timePerGroup, 0)}</td>
      <td class="readonly-cell ratio-cell" style="color: ${getRatioColor(data?.ratio)}">${formatNumber(
        data?.ratio,
        2
      )}</td>
      <td class="readonly-cell">${formatNumber(data?.competitorsPerGroup, 1)}</td>
      <td class="readonly-cell">${data?.stations ?? "—"}</td>
    `;
  }

  return `
    <tr
      class="${classes.join(" ")}"
      draggable="true"
      data-row-id="${row.id}"
      data-day="${row.day}"
      ${attr}
    >
      <td class="readonly-cell">${startLabel}</td>
      <td class="readonly-cell">${endLabel}</td>
      ${body}
      <td class="delete-cell">
        <button
          type="button"
          class="delete-btn"
          aria-label="Remove row"
          data-delete-row="${row.id}"
        >
          ×
        </button>
      </td>
    </tr>
  `;
}

function getScheduleRowData(row) {
  if (row.type !== "event" || row.groupIndex === null || row.groupIndex === undefined) {
    return null;
  }
  return state.generatedGroups[row.groupIndex] || null;
}

function isScheduleRowPastEnd(row) {
  return Number.isFinite(row.endMinutes) &&
    row.endMinutes > getDayEndMinutes(row.day);
}

function getGroupOptions(currentRow) {
  const used = new Set(
    state.scheduleRows
      .filter(
        (row) =>
          row.type === "event" && row.groupIndex !== null && row.id !== currentRow?.id
      )
      .map((row) => row.groupIndex)
  );
  return state.generatedGroups
    .map((group, index) => ({
      value: String(index),
      index,
      label: `${group.eventName} ${group.roundLabel}`,
    }))
    .filter((option) => !used.has(option.index) || currentRow?.groupIndex === option.index);
}

function handleScheduleSelectChange(select) {
  const rowId = select.dataset.rowId;
  const selectedValue = select.value;
  const row = state.scheduleRows.find((entry) => entry.id === rowId);
  if (!row || row.type !== "event") {
    return;
  }
  row.groupIndex = selectedValue === "" ? null : Number(selectedValue);
  const group = getScheduleRowData(row);
  if (group && Number(group.groups) > 0 && Number.isFinite(row.durationOverrideMinutes)) {
    group.timePerGroup = row.durationOverrideMinutes / Number(group.groups);
    recalculateGroupRow(group);
    delete row.durationOverrideMinutes;
  }
  persistAppState();
  recalculateScheduleTimes();
  renderGroupsTable();
}

function handleSpecialDurationChange(input) {
  const rowId = input.dataset.rowId;
  const row = state.scheduleRows.find((entry) => entry.id === rowId);
  if (!row || row.type !== "special") {
    return;
  }
  row.durationMinutes = Math.max(0, Number(input.value) || 0);
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function attachScheduleRowDragHandlers(tbody) {
  if (!tbody) return;
  const rows = tbody.querySelectorAll(".schedule-row");
  rows.forEach((row) => {
    row.addEventListener("dragstart", handleScheduleDragStart);
    row.addEventListener("dragend", handleScheduleDragEnd);
    row.addEventListener("dragover", handleScheduleDragOver);
    row.addEventListener("drop", handleScheduleDrop);
  });
}

function attachDayDropZones() {
  const dropZones = scheduleBuilderWrapper?.querySelectorAll("[data-drop-day]");
  dropZones?.forEach((zone) => {
    zone.addEventListener("dragover", handleScheduleDragOver);
    zone.addEventListener("drop", handleScheduleDropOnDay);
  });
}

function handleScheduleDragStart(event) {
  const row = event.currentTarget;
  draggedScheduleRowId = row.dataset.rowId;
  row.classList.add("dragging");
}

function handleScheduleDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  draggedScheduleRowId = null;
}

function handleScheduleDragOver(event) {
  event.preventDefault();
}

function handleScheduleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const targetRowId = event.currentTarget.dataset.rowId;
  if (!draggedScheduleRowId || !targetRowId) {
    return;
  }
  const targetRow = state.scheduleRows.find((row) => row.id === targetRowId);
  const sourceRow = state.scheduleRows.find((row) => row.id === draggedScheduleRowId);
  if (!targetRow || !sourceRow) {
    return;
  }
  sourceRow.day = clampDay(targetRow.day);
  reorderScheduleRows(draggedScheduleRowId, targetRowId);
}

function handleScheduleDropOnDay(event) {
  event.preventDefault();
  if (!draggedScheduleRowId) {
    return;
  }
  const day = Number(event.currentTarget.dataset.dropDay);
  if (!day) {
    return;
  }
  moveRowToDayEnd(draggedScheduleRowId, day);
}

function reorderScheduleRows(sourceId, targetId) {
  if (sourceId === targetId) {
    return;
  }
  const currentIndex = state.scheduleRows.findIndex((row) => row.id === sourceId);
  const targetIndex = state.scheduleRows.findIndex((row) => row.id === targetId);
  if (currentIndex === -1 || targetIndex === -1) {
    return;
  }
  const [moved] = state.scheduleRows.splice(currentIndex, 1);
  state.scheduleRows.splice(targetIndex, 0, moved);
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function moveRowToDayEnd(rowId, day) {
  const index = state.scheduleRows.findIndex((row) => row.id === rowId);
  if (index === -1) {
    return;
  }
  const [row] = state.scheduleRows.splice(index, 1);
  row.day = clampDay(day);
  let insertIndex = state.scheduleRows.findIndex((entry) => entry.day > row.day);
  if (insertIndex === -1) {
    state.scheduleRows.push(row);
  } else {
    state.scheduleRows.splice(insertIndex, 0, row);
  }
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
}

function getEventLabel(id) {
  return EVENT_CONFIG.find((event) => event.id === id)?.label || id;
}

function getRoundLabel(totalRounds, index) {
  if (totalRounds === 1 || index === totalRounds - 1) {
    return "Final";
  }
  return `Round ${index + 1}`;
}

function getDayStartLabel(day) {
  const value = getDayStartInputValue(day);
  const minutes = minutesFromTime(value);
  if (minutes === null) {
    return value;
  }
  return timeFromMinutes(minutes);
}

function getDayStartInputValue(day) {
  const startTimes = state.competitionInfo.dayStartTimes;
  return startTimes[day - 1] || startTimes[0] || "08:00";
}

function getDayEndInputValue(day) {
  const endTimes = state.competitionInfo.dayEndTimes || [];
  return endTimes[day - 1] || endTimes[endTimes.length - 1] || "19:00";
}

function getDayEndMinutes(day) {
  return minutesFromTime(getDayEndInputValue(day)) ?? 19 * 60;
}

function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "—";
  }
  return numeric.toFixed(fractionDigits);
}

function getRatioColor(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio <= 1.8) {
    return "#ffffff";
  }
  if (ratio >= 2.3) {
    return "#ff4d4f";
  }
  const factor = (ratio - 1.8) / 0.5;
  const startColor = [255, 255, 255];
  const endColor = [255, 77, 79];
  const channels = startColor.map((start, index) =>
    Math.round(start + (endColor[index] - start) * factor)
  );
  return `rgb(${channels.join(",")})`;
}

function buildScheduleCsv() {
  const header = [
    "Start",
    "End",
    "Day",
    "Event",
    "Round",
    "Competitors",
    "Groups",
    "Time",
    "T/G",
    "Ratio",
    "C/G",
    "Stations",
    "RowType",
    "EventId",
    "RoundIndex",
    "GroupIndex",
    "SpecialKey",
    "DurationMinutes",
    "Metadata",
  ];
  const rows = state.scheduleRows.map((row) => {
    const start =
      row.startMinutes !== undefined ? timeFromMinutes(row.startMinutes) : "";
    const end =
      row.endMinutes !== undefined ? timeFromMinutes(row.endMinutes) : "";
    const dayLabel = `Day ${row.day || 1}`;
    if (row.type === "special") {
      const label = SPECIAL_BLOCKS[row.specialKey]?.label || row.label || "Special";
      return [
        start,
        end,
        dayLabel,
        label,
        "",
        "",
        "",
        row.durationMinutes || "",
        "",
        "",
        "",
        "",
        "special",
        "",
        "",
        "",
        row.specialKey || "",
        row.durationMinutes || "",
        "",
      ];
    }
    const data = getScheduleRowData(row);
    return [
      start,
      end,
      dayLabel,
      data?.eventName || "",
      data?.roundLabel || "",
      data?.competitors ?? "",
      data?.groups ?? "",
      data?.timeTotal ?? "",
      data?.timePerGroup ?? "",
      data ? data.ratio?.toFixed(2) : "",
      data ? data.competitorsPerGroup?.toFixed(1) : "",
      data?.stations ?? "",
      "event",
      data?.eventId || "",
      data?.roundIndex ?? "",
      row.groupIndex ?? "",
      "",
      data?.timeTotal ?? "",
      "",
    ];
  });
  const metadata = {
    version: SCHEDULE_CSV_VERSION,
    eventRounds: state.eventRounds,
    competitionInfo: state.competitionInfo,
    eventSettings: state.eventSettings,
    globalSettings: state.globalSettings,
    generatedGroups: state.generatedGroups,
    scheduleRows: state.scheduleRows,
  };
  rows.push([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "meta",
    "",
    "",
    "",
    "",
    "",
    JSON.stringify(metadata),
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((value) => escapeCsvValue(String(value ?? ""))).join(","))
    .join("\n");
}

function escapeCsvValue(value) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importScheduleFromCsv(content) {
  if (!content) {
    throw new Error("The uploaded CSV is empty.");
  }
  const rows = parseCsv(content);
  if (!rows.length) {
    throw new Error("The uploaded CSV did not contain any rows.");
  }
  const header = rows[0];
  const rowTypeIndex = header.indexOf("RowType");
  const metadataIndex = header.indexOf("Metadata");
  if (rowTypeIndex === -1 || metadataIndex === -1) {
    throw new Error("This CSV was generated by an older version and cannot be imported.");
  }
  let metadata = null;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowType = (row[rowTypeIndex] || "").trim().toLowerCase();
    if (rowType !== "meta") {
      continue;
    }
    const payload = row[metadataIndex] || "";
    if (!payload.trim()) {
      continue;
    }
    try {
      metadata = JSON.parse(payload);
    } catch (error) {
      console.warn("Failed to parse CSV metadata.", error);
      throw new Error("Unable to read schedule data from this CSV.");
    }
    break;
  }
  if (!metadata) {
    throw new Error("This CSV did not include embedded schedule data.");
  }
  if (metadata.version && metadata.version > SCHEDULE_CSV_VERSION) {
    console.warn("CSV version is newer than supported.", metadata.version);
  }
  applyImportedScheduleMetadata(metadata);
}

function applyImportedScheduleMetadata(metadata) {
  if (!Array.isArray(metadata.generatedGroups)) {
    throw new Error("The CSV is missing generated group data.");
  }
  if (!Array.isArray(metadata.scheduleRows)) {
    throw new Error("The CSV is missing schedule rows.");
  }
  state.eventRounds = normalizeEventRounds(metadata.eventRounds);
  state.competitionInfo = normalizeCompetitionInfo(metadata.competitionInfo);
  state.eventSettings = mergeEventSettingsFromMetadata(metadata.eventSettings);
  state.globalSettings = {
    ...GLOBAL_SETTING_DEFAULTS,
    ...(metadata.globalSettings || {}),
  };
  state.generatedGroups = Array.isArray(metadata.generatedGroups)
    ? metadata.generatedGroups.map((group) => ({ ...group }))
    : [];
  state.scheduleRows = Array.isArray(metadata.scheduleRows)
    ? metadata.scheduleRows.map((row) => ({
        ...row,
        id:
          row.id ||
          generateId(row.type === "special" ? "special-slot" : "event-slot"),
      }))
    : [];
  clampScheduleRowDays();
  resetEventSelectors();
  hydrateCompetitionForm();
  hydrateEventSettingsTable();
  hydrateGlobalSettingsControls();
  renderGroupsTable();
  saveEventSettings();
  saveGlobalSettings();
  persistAppState();
  setActiveTab("groups");
}

function normalizeEventRounds(values) {
  const defaults = createDefaultEventRounds();
  if (!values || typeof values !== "object") {
    return defaults;
  }
  Object.entries(values).forEach(([eventId, count]) => {
    defaults[eventId] = Math.max(0, Number(count) || 0);
  });
  return defaults;
}

function mergeEventSettingsFromMetadata(values) {
  const defaults = cloneEventSettingDefaults();
  if (!values || typeof values !== "object") {
    return defaults;
  }
  Object.entries(values).forEach(([eventId, config]) => {
    if (!defaults[eventId]) {
      defaults[eventId] = { ...config };
    } else {
      defaults[eventId] = { ...defaults[eventId], ...config };
    }
  });
  return defaults;
}

function normalizeCompetitionInfo(info) {
  const defaults = createDefaultCompetitionInfo();
  const merged = {
    ...defaults,
    ...(info || {}),
  };
  if (!Array.isArray(merged.dayStartTimes)) {
    merged.dayStartTimes = [...defaults.dayStartTimes];
  } else {
    merged.dayStartTimes = [...merged.dayStartTimes];
  }
  const days = Math.min(4, Math.max(1, Number(merged.eventDays) || 1));
  merged.eventDays = days;
  while (merged.dayStartTimes.length < days) {
    merged.dayStartTimes.push(merged.dayStartTimes[merged.dayStartTimes.length - 1] || "08:00");
  }
  if (merged.dayStartTimes.length > days) {
    merged.dayStartTimes.length = days;
  }
  if (!Array.isArray(merged.dayEndTimes)) {
    merged.dayEndTimes = [...defaults.dayEndTimes];
  } else {
    merged.dayEndTimes = [...merged.dayEndTimes];
  }
  while (merged.dayEndTimes.length < days) {
    merged.dayEndTimes.push(merged.dayEndTimes[merged.dayEndTimes.length - 1] || "19:00");
  }
  if (merged.dayEndTimes.length > days) {
    merged.dayEndTimes.length = days;
  }
  return merged;
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  rows.push(row);
  return rows.filter((entry) => entry.some((cell) => cell !== ""));
}

function hydrateAppState() {
  const saved = loadAppState();
  if (!saved) {
    return;
  }
  if (saved.eventRounds) {
    Object.assign(state.eventRounds, saved.eventRounds);
  }
  if (saved.competitionInfo) {
    state.competitionInfo = normalizeCompetitionInfo(saved.competitionInfo);
  }
  if (Array.isArray(saved.generatedGroups)) {
    state.generatedGroups = saved.generatedGroups;
  }
  if (Array.isArray(saved.scheduleRows)) {
    state.scheduleRows = saved.scheduleRows.map((row) => ({
      ...row,
      day: clampDay(row.day || 1),
    }));
  }
}

function loadAppState() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to load app state.", error);
    return null;
  }
}

function persistAppState() {
  if (typeof localStorage === "undefined") {
    return;
  }
  const payload = {
    eventRounds: state.eventRounds,
    competitionInfo: {
      ...state.competitionInfo,
      dayStartTimes: [...state.competitionInfo.dayStartTimes],
      dayEndTimes: [...state.competitionInfo.dayEndTimes],
    },
    generatedGroups: state.generatedGroups,
    scheduleRows: state.scheduleRows,
  };
  localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(payload));
}

function cloneEventSettingDefaults() {
  return Object.fromEntries(
    Object.entries(EVENT_SETTING_DEFAULTS).map(([eventId, values]) => [
      eventId,
      { ...values },
    ])
  );
}

function loadEventSettings() {
  if (typeof localStorage === "undefined") {
    return cloneEventSettingDefaults();
  }
  try {
    const raw = localStorage.getItem(EVENT_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return cloneEventSettingDefaults();
    }
    const parsed = JSON.parse(raw);
    const merged = cloneEventSettingDefaults();
    Object.entries(parsed).forEach(([eventId, values]) => {
      if (merged[eventId]) {
        merged[eventId] = { ...merged[eventId], ...values };
      }
    });
    return merged;
  } catch (error) {
    console.warn("Failed to load event settings, using defaults.", error);
    return cloneEventSettingDefaults();
  }
}

function saveEventSettings() {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(EVENT_SETTINGS_STORAGE_KEY, JSON.stringify(state.eventSettings));
}

function loadGlobalSettings() {
  if (typeof localStorage === "undefined") {
    return { ...GLOBAL_SETTING_DEFAULTS };
  }
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...GLOBAL_SETTING_DEFAULTS };
    }
    const parsed = JSON.parse(raw);
    return { ...GLOBAL_SETTING_DEFAULTS, ...parsed };
  } catch (error) {
    console.warn("Failed to load global settings, using defaults.", error);
    return { ...GLOBAL_SETTING_DEFAULTS };
  }
}

function saveGlobalSettings() {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(state.globalSettings));
}

function minutesFromTime(value) {
  if (!value || !value.includes(":")) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60) % 24;
  const minutes = safeMinutes % 60;
  const format = state.globalSettings?.timeFormat || GLOBAL_SETTING_DEFAULTS.timeFormat;
  if (format === "ampm") {
    const isPm = hours >= 12;
    const twelveHour = hours % 12 || 12;
    return `${twelveHour}:${String(minutes).padStart(2, "0")} ${isPm ? "PM" : "AM"}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function generateId(prefix) {
  const hasCrypto = typeof crypto !== "undefined" && crypto.randomUUID;
  return hasCrypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
