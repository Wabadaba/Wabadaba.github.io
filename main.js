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
];

const EVENT_SETTING_DEFAULTS = {
  "3x3": { timePerGroup: 20, localPercent: 100, regionalPercent: 100 },
  "2x2": { timePerGroup: 17, localPercent: 81, regionalPercent: 92 },
  pyra: { timePerGroup: 17, localPercent: 64, regionalPercent: 81 },
  skewb: { timePerGroup: 17, localPercent: 58, regionalPercent: 70 },
  "4x4": { timePerGroup: 25, localPercent: 60, regionalPercent: 70 },
  "5x5": { timePerGroup: 25, localPercent: 48, regionalPercent: 53 },
  "6x6": { timePerGroup: 25, localPercent: 32, regionalPercent: 36 },
  "7x7": { timePerGroup: 25, localPercent: 33, regionalPercent: 32 },
  oh: { timePerGroup: 20, localPercent: 60, regionalPercent: 64 },
  mega: { timePerGroup: 25, localPercent: 49, regionalPercent: 50 },
  sq1: { timePerGroup: 21, localPercent: 39, regionalPercent: 45 },
  clock: { timePerGroup: 21, localPercent: 56, regionalPercent: 53 },
  "3bld": { timePerGroup: 20, localPercent: 31, regionalPercent: 21 },
};

const INTERNAL_TIMING = {
  roundDecay: 0.75,
  finalSize: 16,
};

const GLOBAL_SETTING_DEFAULTS = {
  maxRatio: 2.1,
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

const DEFAULT_COMPETITION_INFO = {
  competitorCount: "",
  venueHours: 0,
  venueMinutes: 0,
  competitionType: "Local",
  stations: "",
  eventDays: 1,
  dayStartTimes: ["09:00"],
};

const state = {
  eventRounds: createDefaultEventRounds(),
  competitionInfo: createDefaultCompetitionInfo(),
  eventSettings: cloneEventSettingDefaults(),
  globalSettings: { ...GLOBAL_SETTING_DEFAULTS },
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
const generateGroupsBtn = document.getElementById("generate-groups");
const generateScheduleBtn = document.getElementById("generate-schedule-from-groups");
const addScheduleRowBtn = document.getElementById("add-schedule-row");
const clearScheduleBtn = document.getElementById("clear-schedule");
const specialBlockSelect = document.getElementById("special-block-select");
const addSpecialBlockBtn = document.getElementById("add-special-block");
const downloadScheduleBtn = document.getElementById("download-schedule-csv");
const eventSettingInputs = document.querySelectorAll("[data-event-setting-field]");
const globalSettingInputs = document.querySelectorAll("[data-global-setting]");
const resetSettingsBtn = document.getElementById("reset-settings");
const newScheduleBtn = document.getElementById("new-schedule-btn");

let draggedScheduleRowId = null;
let pendingGroupFocus = null;

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
});

dayStartTimesContainer?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-day-start]");
  if (!input) {
    return;
  }
  const dayIndex = Number(input.dataset.dayStart);
  if (Number.isNaN(dayIndex)) {
    return;
  }
  const value = input.value || "09:00";
  state.competitionInfo.dayStartTimes[dayIndex] = value;
  recalculateScheduleTimes();
  renderScheduleBuilder();
  persistAppState();
});

function createDefaultCompetitionInfo() {
  return {
    ...DEFAULT_COMPETITION_INFO,
    dayStartTimes: [...DEFAULT_COMPETITION_INFO.dayStartTimes],
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
    if (name === "dayStartTimes") {
      return;
    }
    const control = elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      if (value === "") return;
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
    while (startTimes.length < days) {
      startTimes.push(startTimes[startTimes.length - 1] || "09:00");
    }
    if (startTimes.length > days) {
      startTimes.length = days;
    }
    state.competitionInfo.dayStartTimes = startTimes;
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
  const inputs = Array.from({ length: dayCount }, (_, index) => {
    const value = startTimes[index] || startTimes[0] || "09:00";
    return `
      <label>
        Day ${index + 1} Start Time
        <input
          type="time"
          value="${value}"
          data-day-start="${index}"
          required
        />
      </label>
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
    });
  });

  resetSettingsBtn?.addEventListener("click", () => {
    state.eventSettings = cloneEventSettingDefaults();
    hydrateEventSettingsTable();
    state.globalSettings = { ...GLOBAL_SETTING_DEFAULTS };
    hydrateGlobalSettingsControls();
    saveEventSettings();
    saveGlobalSettings();
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
    input.addEventListener("input", () => {
      const key = input.dataset.globalSetting;
      if (!key) return;
      const numericValue = Math.max(0, Number(input.value) || 0);
      state.globalSettings[key] = numericValue;
      saveGlobalSettings();
    });
  });
}

function hydrateGlobalSettingsControls() {
  globalSettingInputs.forEach((input) => {
    const key = input.dataset.globalSetting;
    if (!key) return;
    const value =
      state.globalSettings[key] ?? GLOBAL_SETTING_DEFAULTS[key] ?? GLOBAL_SETTING_DEFAULTS.maxRatio;
    input.value = String(value);
  });
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
    setActiveTab("rounds");
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
      <td class="number-cell">${formatNumber(row.ratio, 2)}</td>
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
  generateScheduleBtn?.addEventListener("click", () => {
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

  addScheduleRowBtn?.addEventListener("click", () => {
    if (!state.generatedGroups.length) {
      alert("Generate groups first.");
      return;
    }
    state.scheduleRows.push(createEventScheduleRow());
    persistAppState();
    recalculateScheduleTimes();
    renderScheduleBuilder();
  });

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
    state.scheduleRows.push(createSpecialScheduleRow(key));
    if (specialBlockSelect) {
      specialBlockSelect.value = "";
    }
    persistAppState();
    recalculateScheduleTimes();
    renderScheduleBuilder();
  });

  scheduleBuilderWrapper?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-schedule-select]");
    if (select) {
      handleScheduleSelectChange(select);
    }
  });

  scheduleBuilderWrapper?.addEventListener("click", (event) => {
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

function createEventScheduleRow() {
  return {
    id: generateId("event-slot"),
    type: "event",
    groupIndex: null,
    day: clampDay(1),
  };
}

function createSpecialScheduleRow(key) {
  const config = SPECIAL_BLOCKS[key] || { label: "Special", duration: 0 };
  return {
    id: generateId("special-slot"),
    type: "special",
    specialKey: key,
    label: config.label,
    durationMinutes: config.duration,
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
    const timeValue = startTimes[day - 1] || startTimes[0] || "09:00";
    cursors[day] = minutesFromTime(timeValue) ?? 9 * 60;
  }
  state.scheduleRows.forEach((row) => {
    row.day = clampDay(row.day);
    const duration = getScheduleRowDuration(row);
    const start = cursors[row.day] ?? cursors[1];
    row.startMinutes = start;
    row.endMinutes = start + duration;
    if (duration > 0) {
      cursors[row.day] = row.endMinutes;
    }
  });
}

function getScheduleRowDuration(row) {
  if (row.type === "special") {
    return Math.max(0, Number(row.durationMinutes) || 0);
  }
  const data = getScheduleRowData(row);
  return data?.timeTotal || 0;
}

function renderScheduleBuilder() {
  if (!scheduleBuilderWrapper) return;

  if (!state.scheduleRows.length) {
    scheduleBuilderWrapper.classList.add("collection-placeholder");
    scheduleBuilderWrapper.innerHTML = `<p>Add events to begin composing the schedule.</p>`;
    return;
  }

  scheduleBuilderWrapper.classList.remove("collection-placeholder");
  scheduleBuilderWrapper.innerHTML = `
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

  const tbody = scheduleBuilderWrapper.querySelector("tbody");
  attachScheduleRowDragHandlers(tbody);
  attachDayDropZones();
}

function renderScheduleRowsWithHeaders() {
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
      entries.forEach((row) => parts.push(renderScheduleRow(row)));
    }
  }
  return parts.join("");
}

function renderDayHeaderRow(day) {
  const startLabel = getDayStartLabel(day);
  return `
    <tr class="day-header" data-drop-day="${day}">
      <td colspan="12">Day ${day} · Start ${startLabel}</td>
    </tr>
  `;
}

function renderScheduleRow(row) {
  const startLabel =
    row.startMinutes !== undefined ? timeFromMinutes(row.startMinutes) : "—";
  const endLabel = row.endMinutes !== undefined ? timeFromMinutes(row.endMinutes) : "—";
  const classes = ["schedule-row"];
  let attr = "";
  let body = "";

  if (row.type === "special") {
    classes.push("special-row");
    const config = SPECIAL_BLOCKS[row.specialKey] || {
      label: row.label || "Special",
      duration: row.durationMinutes || 0,
    };
    body = `
      <td>${config.label}</td>
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
          value="${row.durationMinutes ?? config.duration}"
        />
      </td>
      <td class="readonly-cell">—</td>
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
      <td class="readonly-cell">${formatNumber(data?.ratio, 2)}</td>
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
  persistAppState();
  recalculateScheduleTimes();
  renderScheduleBuilder();
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
  const startTimes = state.competitionInfo.dayStartTimes;
  const value = startTimes[day - 1] || startTimes[0] || "09:00";
  return value;
}

function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "—";
  }
  return numeric.toFixed(fractionDigits);
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
    ];
  });
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

function hydrateAppState() {
  const saved = loadAppState();
  if (!saved) {
    return;
  }
  if (saved.eventRounds) {
    Object.assign(state.eventRounds, saved.eventRounds);
  }
  if (saved.competitionInfo) {
    Object.assign(state.competitionInfo, saved.competitionInfo);
    if (!Array.isArray(state.competitionInfo.dayStartTimes)) {
      state.competitionInfo.dayStartTimes = ["09:00"];
    }
    const days = Math.min(4, Math.max(1, Number(state.competitionInfo.eventDays) || 1));
    state.competitionInfo.eventDays = days;
    const startTimes = [...state.competitionInfo.dayStartTimes];
    while (startTimes.length < days) {
      startTimes.push(startTimes[startTimes.length - 1] || "09:00");
    }
    if (startTimes.length > days) {
      startTimes.length = days;
    }
    state.competitionInfo.dayStartTimes = startTimes;
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function generateId(prefix) {
  const hasCrypto = typeof crypto !== "undefined" && crypto.randomUUID;
  return hasCrypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
