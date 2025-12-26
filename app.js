(function() {
  'use strict';

  const STORAGE_KEY = 'zeit.entries.v1';
  const SETTINGS_KEY = 'zeit.settings.v1';
  const HOLIDAY_CACHE_PREFIX = 'zeit.holidays.'; // zeit.holidays.{state}.{year}

  const DEFAULT_SETTINGS = {
    location: '',
    stateCode: 'nw',
    hoursPerDay: 8.5,
    defaultPauseMinutes: 0,

    dienstbeginnEnabled: false,
    dienstbeginnTime: '08:00',
    dienstbeginnEarlyMinutes: 20,

    surchargeEnabled: true,
    surchargeNightFrom: '22:00',
    surchargeNightTo: '05:00',
    surchargeSundayHoliday: true,

    // current behavior: subtract public holidays from expected target time
    excludePublicHolidaysFromExpected: true
  };
  /** @type {HTMLButtonElement} */
  const toggleBtn = document.getElementById('toggleBtn');
  /** @type {HTMLDivElement} */
  const statusRow = document.getElementById('statusRow');
  /** @type {HTMLUListElement} */
  const todayList = document.getElementById('todayList');
  /** @type {HTMLSpanElement} */
  const todaySum = document.getElementById('todaySum');
  /** @type {HTMLButtonElement} */
  const addManualBtn = document.getElementById('addManualBtn');
  /** @type {HTMLInputElement} */
  const monthInput = document.getElementById('monthInput');
  /** @type {HTMLButtonElement} */
  const exportBtn = document.getElementById('exportBtn');
  /** @type {HTMLButtonElement} */
  const importBtn = document.getElementById('importBtn');
  /** @type {HTMLInputElement} */
  const importFile = document.getElementById('importFile');
  /** @type {HTMLButtonElement} */
  const backupJsonBtn = document.getElementById('backupJsonBtn');
  /** @type {HTMLButtonElement} */
  const restoreJsonBtn = document.getElementById('restoreJsonBtn');
  /** @type {HTMLInputElement} */
  const restoreJsonFile = document.getElementById('restoreJsonFile');
  /** @type {HTMLDivElement} */
  const nowTime = document.getElementById('nowTime');
  /** @type {HTMLDivElement} */
  const nowDate = document.getElementById('nowDate');
  /** @type {HTMLButtonElement} */
  const installBtn = document.getElementById('installBtn');
  /** @type {HTMLButtonElement} */
  const settingsBtn = document.getElementById('settingsBtn');
  /** @type {HTMLUListElement} */
  const monthList = document.getElementById('monthList');
  /** @type {HTMLSpanElement} */
  const monthSum = document.getElementById('monthSum');
  /** @type {HTMLSpanElement} */
  const surchargeSum = document.getElementById('surchargeSum');
  /** @type {HTMLSpanElement} */
  const expectedSum = document.getElementById('expectedSum');
  /** @type {HTMLSpanElement} */
  const deltaSum = document.getElementById('deltaSum');
  /** @type {HTMLSpanElement|null} */
  const expectedLabel = document.getElementById('expectedLabel');

  /** @type {HTMLDialogElement} */
  const editDialog = document.getElementById('editDialog');
  /** @type {HTMLSelectElement} */
  const typeInput = document.getElementById('typeInput');
  /** @type {HTMLInputElement} */
  const dateInput = document.getElementById('dateInput');
  /** @type {HTMLInputElement} */
  const fromInput = document.getElementById('fromInput');
  /** @type {HTMLInputElement} */
  const toInput = document.getElementById('toInput');
  /** @type {HTMLInputElement} */
  const pauseInput = document.getElementById('pauseInput');
  /** @type {HTMLInputElement} */
  const overdriveInput = document.getElementById('overdriveInput');
  /** @type {HTMLElement} */
  const dateRow = document.getElementById('dateRow');
  /** @type {HTMLElement} */
  const fromRow = document.getElementById('fromRow');
  /** @type {HTMLElement} */
  const toRow = document.getElementById('toRow');
  /** @type {HTMLElement} */
  const pauseRow = document.getElementById('pauseRow');
  /** @type {HTMLElement} */
  const overdriveRow = document.getElementById('overdriveRow');
  /** @type {HTMLButtonElement} */
  const deleteEntryBtn = document.getElementById('deleteEntryBtn');
  /** @type {HTMLButtonElement} */
  const saveEntryBtn = document.getElementById('saveEntryBtn');
  /** @type {HTMLFormElement} */
  const editForm = document.getElementById('editForm');
  editForm.addEventListener('submit', (ev) => ev.preventDefault());

  /** @type {{id:string, start:string, end?:string, type?:'work'|'u'|'f', pauseMin?:number, overdrive?:boolean}[]} */
  let entries = loadEntries();
  /** @type {typeof DEFAULT_SETTINGS} */
  let settings = loadSettings();
  /** @type {string|null} */
  let editingId = null;

  // Clock
  setInterval(updateClock, 1000);
  updateClock();

  function updateClock() {
    const now = new Date();
    nowTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    nowDate.textContent = now.toLocaleDateString();
  }

  // Install prompt handling
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    // Silently handle the install prompt
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    installBtn.hidden = true;
    deferredPrompt = null;
  });

  // Initial UI state
  refreshUI();

  // Settings dialog
  /** @type {HTMLDialogElement} */
  const settingsDialog = document.getElementById('settingsDialog');
  /** @type {HTMLFormElement} */
  const settingsForm = document.getElementById('settingsForm');
  /** @type {HTMLInputElement} */
  const settingLocation = document.getElementById('settingLocation');
  /** @type {HTMLSelectElement} */
  const settingState = document.getElementById('settingState');
  /** @type {HTMLInputElement} */
  const settingHoursPerDay = document.getElementById('settingHoursPerDay');
  /** @type {HTMLInputElement} */
  const settingDefaultPause = document.getElementById('settingDefaultPause');
  /** @type {HTMLInputElement} */
  const settingDienstbeginnEnabled = document.getElementById('settingDienstbeginnEnabled');
  /** @type {HTMLInputElement} */
  const settingDienstbeginnTime = document.getElementById('settingDienstbeginnTime');
  /** @type {HTMLInputElement} */
  const settingDienstbeginnEarly = document.getElementById('settingDienstbeginnEarly');
  /** @type {HTMLInputElement} */
  const settingSurchargeEnabled = document.getElementById('settingSurchargeEnabled');
  /** @type {HTMLInputElement} */
  const settingNightFrom = document.getElementById('settingNightFrom');
  /** @type {HTMLInputElement} */
  const settingNightTo = document.getElementById('settingNightTo');
  /** @type {HTMLInputElement} */
  const settingSundayHoliday = document.getElementById('settingSundayHoliday');
  /** @type {HTMLInputElement} */
  const settingExcludeHolidaysFromExpected = document.getElementById('settingExcludeHolidaysFromExpected');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openSettings();
    });
  }

  settingsForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
  });

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  saveSettingsBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    settings = readSettingsFromForm();
    saveSettings(settings);
    announce('Einstellungen gespeichert');
    try { settingsDialog.close(); } catch {}
    refreshUI();
  });

  toggleBtn.addEventListener('click', () => {
    const running = getRunningEntry();
    if (running) {
      running.end = new Date().toISOString();
      saveEntries(entries);
      announce('Stopp gespeichert');
    } else {
      const now = new Date();
      const rounded = applyDienstbeginnRounding(now, settings, false);
      entries.push({ id: crypto.randomUUID(), start: rounded.toISOString(), type: 'work' });
      saveEntries(entries);
      announce('Start gespeichert');
    }
    refreshUI();
  });

  addManualBtn.addEventListener('click', () => {
    openEditor({
      id: crypto.randomUUID(),
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      type: 'work'
    }, true);
  });

  monthInput.addEventListener('change', () => {
    refreshUI();
  });

  exportBtn.addEventListener('click', () => {
    const { year, month } = getSelectedMonth();
    const csv = buildMonthlyCsv(entries, year, month);
    // Add UTF-8 BOM for proper encoding
    const csvWithBom = '\uFEFF' + csv;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbeitszeiten_${year}-${String(month+1).padStart(2,'0')}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  });

  importBtn.addEventListener('click', () => {
    importFile.value = '';
    importFile.click();
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseCsvToEntries(text);
      if (!imported.length) {
        announce('Keine gültigen Einträge gefunden');
        return;
      }
      const replace = confirm('Bestehende Einträge ersetzen?\nOK = Ersetzen, Abbrechen = Anhängen');
      if (replace) {
        entries = imported;
      } else {
        entries = entries.concat(imported);
      }
      saveEntries(entries);
      refreshUI();
      announce('Import abgeschlossen');
    } catch (e) {
      console.error(e);
      announce('Import fehlgeschlagen');
    }
  });

  backupJsonBtn.addEventListener('click', () => {
    try {
      const payload = { version: 2, exportedAt: new Date().toISOString(), settings, entries };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wlog-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      announce('Backup fehlgeschlagen');
    }
  });

  restoreJsonBtn.addEventListener('click', () => {
    restoreJsonFile.value = '';
    restoreJsonFile.click();
  });

  restoreJsonFile.addEventListener('change', async () => {
    const file = restoreJsonFile.files && restoreJsonFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const normalized = normalizeBackupData(data);
      const imported = normalized.entries;
      if (!imported.length) {
        announce('Keine gültigen Einträge in JSON');
        return;
      }
      const replace = confirm('Bestehende Einträge ersetzen?\nOK = Ersetzen, Abbrechen = Anhängen');
      if (replace) {
        entries = imported;
      } else {
        entries = entries.concat(imported);
      }
      saveEntries(entries);

      if (normalized.settings) {
        const apply = confirm('Einstellungen aus dem Backup übernehmen?');
        if (apply) {
          settings = normalized.settings;
          saveSettings(settings);
        }
      }

      refreshUI();
      announce('Wiederherstellung abgeschlossen');
    } catch (e) {
      console.error(e);
      announce('Wiederherstellung fehlgeschlagen');
    }
  });

  deleteEntryBtn.addEventListener('click', () => {
    if (!editingId) return;
    entries = entries.filter(e => e.id !== editingId);
    saveEntries(entries);
    closeEditor();
    refreshUI();
  });

  saveEntryBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const type = /** @type {'work'|'u'|'f'} */ (typeInput.value || 'work');

    let start = null;
    let end = null;
    let pauseMin = undefined;
    let overdrive = false;

    if (type === 'work') {
      if (!fromInput.value) return;
      start = new Date(fromInput.value);
      end = toInput.value ? new Date(toInput.value) : null;
      if (end && end < start) {
        toInput.setCustomValidity('Ende liegt vor Start');
        toInput.reportValidity();
        return;
      } else {
        toInput.setCustomValidity('');
      }
      const pauseRaw = (pauseInput.value || '').trim();
      if (pauseRaw !== '') {
        const n = Number(pauseRaw);
        if (!Number.isFinite(n) || n < 0) {
          pauseInput.setCustomValidity('Ungültige Pause');
          pauseInput.reportValidity();
          return;
        }
        pauseInput.setCustomValidity('');
        pauseMin = Math.round(n);
      } else {
        pauseInput.setCustomValidity('');
      }
      overdrive = !!overdriveInput.checked;
      start = applyDienstbeginnRounding(start, settings, overdrive);
    } else {
      if (!dateInput.value) return;
      start = parseLocalDate(dateInput.value);
      end = null;
    }

    if (editingId) {
      const idx = entries.findIndex(e => e.id === editingId);
      if (idx >= 0) {
        entries[idx] = {
          id: editingId,
          type,
          start: start.toISOString(),
          end: end ? end.toISOString() : undefined,
          pauseMin,
          overdrive: type === 'work' ? overdrive : undefined
        };
      }
    } else {
      entries.push({
        id: crypto.randomUUID(),
        type,
        start: start.toISOString(),
        end: end ? end.toISOString() : undefined,
        pauseMin,
        overdrive: type === 'work' ? overdrive : undefined
      });
    }
    saveEntries(entries);
    closeEditor();
    refreshUI();
  });

  function refreshUI() {
    renderStatus();
    renderToday();
    ensureMonthDefault();
    renderMonth();
  }

  function renderStatus() {
    const running = getRunningEntry();
    if (running) {
      toggleBtn.textContent = 'Stop';
      const start = new Date(running.start);
      statusRow.textContent = `Läuft seit ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      toggleBtn.textContent = 'Start';
      statusRow.textContent = '';
    }
  }

  function renderToday() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate()+1);

    const todays = entries
      .filter(e => new Date(e.start) >= today && new Date(e.start) < tomorrow)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    todayList.innerHTML = '';
    let totalMs = 0;
    for (const e of todays) {
      const li = document.createElement('li');
      const start = new Date(e.start);
      const end = e.end ? new Date(e.end) : null;
      const durationMs = getEntryNetMs(e, settings, start, end);
      totalMs += durationMs;

      const title = document.createElement('div');
      title.className = 'row-strong';
      const type = e.type || 'work';
      if (type === 'u') {
        li.classList.add('daytype-u');
        title.textContent = `U (Urlaub)`;
      } else if (type === 'f') {
        li.classList.add('daytype-f');
        title.textContent = `F (Frei/Feiertag)`;
      } else {
        title.textContent = `${fmtTime(start)}${end ? ' – ' + fmtTime(end) : ' – …'}`;
      }

      const meta = document.createElement('div');
      meta.className = 'row-meta';
      const pauseInfo = (type === 'work' && end) ? formatPauseInfo(e, settings) : '';
      meta.textContent = `${start.toLocaleDateString()} • ${fmtDuration(durationMs)}${pauseInfo}`;

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Bearbeiten';
      edit.addEventListener('click', () => openEditor(e, false));

      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(edit);
      todayList.appendChild(li);
    }
    todaySum.textContent = fmtDuration(totalMs);
  }

  function renderMonth() {
    const { year, month } = getSelectedMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    const monthEntries = entries
      .filter(e => new Date(e.start) >= start && new Date(e.start) < end)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    monthList.innerHTML = '';
    let totalMs = 0;
    let surchargeMs = 0;
    const holidaySet = getHolidaySetSync(year, settings.stateCode);

    for (const e of monthEntries) {
      const li = document.createElement('li');
      const startTime = new Date(e.start);
      const endTime = e.end ? new Date(e.end) : null;
      const durationMs = getEntryNetMs(e, settings, startTime, endTime);
      totalMs += durationMs;

      // Calculate surcharge time
      const surcharge = calculateSurcharge(startTime, endTime, settings);
      surchargeMs += surcharge;
      
      
      // Add surcharge class if applicable
      if (surcharge > 0) {
        li.classList.add('surcharge');
      }
      const holidayKey = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate()).getTime();
      const isHoliday = holidaySet.has(holidayKey);
      if (isHoliday) {
        li.classList.add('holiday');
      }

      const title = document.createElement('div');
      title.className = 'row-strong';
      const type = e.type || 'work';
      if (type === 'u') {
        li.classList.add('daytype-u');
        title.textContent = `U (Urlaub)`;
      } else if (type === 'f') {
        li.classList.add('daytype-f');
        title.textContent = `F (Frei/Feiertag)`;
      } else {
        title.textContent = `${fmtTime(startTime)}${endTime ? ' – ' + fmtTime(endTime) : ' – …'}`;
      }

      const meta = document.createElement('div');
      meta.className = 'row-meta';
      const dayName = startTime.toLocaleDateString('de-DE', { weekday: 'long' });
      const holidayEmoji = isHoliday ? '🎉 ' : '';
      const pauseInfo = (type === 'work' && endTime) ? formatPauseInfo(e, settings) : '';
      meta.textContent = `${startTime.toLocaleDateString()} (${holidayEmoji}${dayName}) • ${fmtDuration(durationMs)}${pauseInfo}`;

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Bearbeiten';
      edit.addEventListener('click', () => openEditor(e, false));

      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(edit);
      monthList.appendChild(li);
    }
    
    monthSum.textContent = fmtDuration(totalMs);
    surchargeSum.textContent = fmtDuration(surchargeMs);

    // Expected working time: start with nationwide holidays for quick display
    const nationwideExpectedMs = calculateExpectedMonthMs(year, month, getGermanPublicHolidaySet(year), settings);
    expectedSum.textContent = fmtDuration(nationwideExpectedMs);
    deltaSum.textContent = fmtSignedDuration(totalMs - nationwideExpectedMs);
    if (expectedLabel) {
      expectedLabel.textContent = `Erwartet (${String(settings.hoursPerDay).replace('.', ',')}h/Werktag)`;
    }

    // Refine asynchronously using state-specific holidays
    loadStateHolidaySet(year, settings.stateCode).then((stateHolidaySet) => {
      if (!stateHolidaySet) return;
      const refinedExpected = calculateExpectedMonthMs(year, month, stateHolidaySet, settings);
      expectedSum.textContent = fmtDuration(refinedExpected);
      deltaSum.textContent = fmtSignedDuration(totalMs - refinedExpected);
    }).catch(() => {
      // ignore errors and keep nationwide result
    });
  }

  function calculateExpectedMonthMs(year, month, holidaySetOptional, settingsObj) {
    const msPerHour = 60 * 60 * 1000;
    const hoursPerDay = Number(settingsObj && settingsObj.hoursPerDay) || DEFAULT_SETTINGS.hoursPerDay;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const holidays = holidaySetOptional || getGermanPublicHolidaySet(year);

    // Cap to today if selected month is current month
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const capEnd = isCurrentMonth ? new Date(Math.min(end.getTime(), new Date(today.getFullYear(), today.getMonth(), today.getDate()+1).getTime())) : end;

    let expectedDays = 0;
    for (let d = new Date(start); d < capEnd; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      if (weekday >= 1 && weekday <= 5) {
        if (settingsObj && settingsObj.excludePublicHolidaysFromExpected) {
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          if (!holidays.has(key)) expectedDays += 1;
        } else {
          expectedDays += 1;
        }
      }
    }
    return expectedDays * hoursPerDay * msPerHour;
  }

  // Load state-specific holidays from API and return a Set keyed by midnight timestamps
  async function loadStateHolidaySet(year, state) {
    const cacheKey = `${HOLIDAY_CACHE_PREFIX}${state}.${year}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.dates)) {
          return datesArrayToSet(parsed.dates);
        }
      }
    } catch {}

    try {
      const url = `https://get.api-feiertage.de?states=${encodeURIComponent(state)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const dates = [];
      if (data && Array.isArray(data.feiertage)) {
        for (const f of data.feiertage) {
          if (!f || typeof f.date !== 'string') continue;
          // keep only requested year
          const y = Number(f.date.slice(0,4));
          if (y === year) dates.push(f.date);
        }
      }
      try { localStorage.setItem(cacheKey, JSON.stringify({ dates })); } catch {}
      return datesArrayToSet(dates);
    } catch {
      return null;
    }
  }

  function datesArrayToSet(dateStrings) {
    const set = new Set();
    for (const s of dateStrings) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        set.add(key);
      }
    }
    return set;
  }

  // Get holiday Set synchronously: prefer cached API data for state; fallback to nationwide calculation
  function getHolidaySetSync(year, state) {
    const cacheKey = `${HOLIDAY_CACHE_PREFIX}${state}.${year}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.dates)) {
          return datesArrayToSet(parsed.dates);
        }
      }
    } catch {}
    return getGermanPublicHolidaySet(year);
  }

  // Returns a Set of midnight timestamps for bundesweite Feiertage (Germany) for a given year.
  function getGermanPublicHolidaySet(year) {
    const dates = [];
    // Fixed nationwide holidays
    dates.push(new Date(year, 0, 1));   // Neujahr 01.01.
    dates.push(new Date(year, 4, 1));   // Tag der Arbeit 01.05.
    dates.push(new Date(year, 9, 3));   // Tag der Deutschen Einheit 03.10.
    dates.push(new Date(year, 11, 25)); // 1. Weihnachtstag 25.12.
    dates.push(new Date(year, 11, 26)); // 2. Weihnachtstag 26.12.

    // Movable feasts (nationwide): Karfreitag, Ostermontag, Christi Himmelfahrt, Pfingstmontag
    const easter = calculateEasterSunday(year);
    dates.push(addDays(easter, -2)); // Karfreitag
    dates.push(addDays(easter, 1));  // Ostermontag
    dates.push(addDays(easter, 39)); // Christi Himmelfahrt
    dates.push(addDays(easter, 50)); // Pfingstmontag

    const set = new Set();
    for (const d of dates) {
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      set.add(key);
    }
    return set;
  }

  // Anonymous Gregorian algorithm for Easter Sunday
  function calculateEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(0,0,0,0);
    return d;
  }

  function fmtSignedDuration(ms) {
    const sign = ms >= 0 ? '+' : '-';
    const abs = Math.abs(ms);
    const totalMinutes = Math.round(abs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${sign}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  function calculateSurcharge(startTime, endTime, settingsObj) {
    if (!endTime) return 0;
    if (!settingsObj || !settingsObj.surchargeEnabled) return 0;
    
    let surchargeMs = 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Check if work spans multiple days
    const current = new Date(start);
    current.setHours(0, 0, 0, 0); // Start at beginning of day
    // Prepare holiday sets for involved years (sync: uses cache if available, else nationwide)
    const holidaySetByYear = new Map();
    const ensureHolidaySet = (year) => {
      if (!holidaySetByYear.has(year)) {
        holidaySetByYear.set(year, getHolidaySetSync(year, settingsObj.stateCode));
      }
      return holidaySetByYear.get(year);
    };
    
    while (current < end) {
      const nextDay = new Date(current);
      nextDay.setDate(current.getDate() + 1);
      
      // Get the actual work period for this day
      const dayStart = new Date(Math.max(current.getTime(), start.getTime()));
      const dayEnd = new Date(Math.min(nextDay.getTime(), end.getTime()));
      
      // Check if it's Sunday (0 = Sunday) or state/nationwide holiday
      const isSunday = current.getDay() === 0;
      const y = current.getFullYear();
      const set = ensureHolidaySet(y);
      const key = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
      const isHoliday = set.has(key);
      
      if (settingsObj.surchargeSundayHoliday && (isSunday || isHoliday)) {
        // Full day surcharge for Sunday or public holiday
        surchargeMs += dayEnd - dayStart;
      } else {
        // Check for night work (configurable)
        const nightFrom = parseTimeHHMM(settingsObj.surchargeNightFrom || DEFAULT_SETTINGS.surchargeNightFrom);
        const nightTo = parseTimeHHMM(settingsObj.surchargeNightTo || DEFAULT_SETTINGS.surchargeNightTo);
        if (nightFrom && nightTo) {
          const crossMidnight = (nightFrom.h * 60 + nightFrom.min) > (nightTo.h * 60 + nightTo.min);
          if (crossMidnight) {
            // Part A: nightFrom -> 24:00 (current day)
            const aStart = new Date(current); aStart.setHours(nightFrom.h, nightFrom.min, 0, 0);
            const aEnd = new Date(nextDay); aEnd.setHours(0, 0, 0, 0);
            surchargeMs += overlapMs(dayStart, dayEnd, aStart, aEnd);
            // Part B: 00:00 -> nightTo (current day)
            const bStart = new Date(current); bStart.setHours(0, 0, 0, 0);
            const bEnd = new Date(current); bEnd.setHours(nightTo.h, nightTo.min, 0, 0);
            surchargeMs += overlapMs(dayStart, dayEnd, bStart, bEnd);
          } else {
            const nStart = new Date(current); nStart.setHours(nightFrom.h, nightFrom.min, 0, 0);
            const nEnd = new Date(current); nEnd.setHours(nightTo.h, nightTo.min, 0, 0);
            surchargeMs += overlapMs(dayStart, dayEnd, nStart, nEnd);
          }
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return surchargeMs;
  }

  function openEditor(entry, isNew) {
    editingId = isNew ? null : entry.id;
    const type = entry.type || 'work';
    typeInput.value = type;
    const start = new Date(entry.start);
    dateInput.value = toLocalDateInputValue(start);
    fromInput.value = toLocalInputValue(start);
    toInput.value = entry.end ? toLocalInputValue(new Date(entry.end)) : '';
    pauseInput.value = (typeof entry.pauseMin === 'number') ? String(entry.pauseMin) : '';
    overdriveInput.checked = !!entry.overdrive;
    updateEditorMode();
    editDialog.showModal();
  }

  function closeEditor() {
    editingId = null;
    editDialog.close();
  }

  function getRunningEntry() {
    return entries.find(e => !e.end);
  }

  function ensureMonthDefault() {
    if (!monthInput.value) {
      const now = new Date();
      const v = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      monthInput.value = v;
    }
  }

  function getSelectedMonth() {
    ensureMonthDefault();
    const [y,m] = monthInput.value.split('-').map(Number);
    return { year: y, month: m - 1 };
  }

  function buildMonthlyCsv(allEntries, year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const rows = [['Datum','Start','Ende','Dauer (hh:mm)','Zuschläge (hh:mm)','Wochentag','Typ','Pause (Min)','Overdrive','Ort','Soll (Std/Tag)']];
    let totalMs = 0;
    let totalSurchargeMs = 0;
    const monthEntries = allEntries
      .filter(e => new Date(e.start) >= start && new Date(e.start) < end)
      .sort((a,b) => new Date(a.start) - new Date(b.start));
    for (const e of monthEntries) {
      const s = new Date(e.start);
      const t = e.end ? new Date(e.end) : null;
      const durMs = getEntryNetMs(e, settings, s, t);
      const surchargeMs = calculateSurcharge(s, t, settings);
      const dayName = s.toLocaleDateString('de-DE', { weekday: 'long' });
      const type = e.type || 'work';
      totalMs += durMs;
      totalSurchargeMs += surchargeMs;
      rows.push([
        s.toLocaleDateString(),
        (type === 'work') ? fmtTime(s) : '',
        (type === 'work' && t) ? fmtTime(t) : '',
        fmtDuration(durMs),
        fmtDuration(surchargeMs),
        dayName,
        type,
        (typeof e.pauseMin === 'number') ? String(e.pauseMin) : '',
        e.overdrive ? '1' : '',
        settings.location || '',
        String(settings.hoursPerDay)
      ]);
    }
    rows.push([]);
    rows.push(['Summe','','',fmtDuration(totalMs),fmtDuration(totalSurchargeMs),'']);
    return rows.map(r => r.map(escapeCsv).join(';')).join('\n');
  }

  function escapeCsv(value) {
    const s = String(value ?? '');
    if (/[";\n]/.test(s)) {
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  }

  // --- CSV Import utilities ---

  function parseCsvToEntries(csvText) {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = splitCsvLine(lines[0]);
    const idxDate = header.findIndex(h => /datum/i.test(h));
    const idxStart = header.findIndex(h => /^start$/i.test(h));
    const idxEnd = header.findIndex(h => /^ende$/i.test(h));
    const idxType = header.findIndex(h => /(typ|art)/i.test(h));
    const idxPause = header.findIndex(h => /pause/i.test(h));
    const idxOverdrive = header.findIndex(h => /overdrive/i.test(h));
    if (idxDate < 0 || idxStart < 0) return [];

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (!cols.length) continue;
      const dateStr = (cols[idxDate] || '').trim();
      const startStr = (cols[idxStart] || '').trim();
      const endStr = (cols[idxEnd] || '').trim();
      const typeRaw = idxType >= 0 ? (cols[idxType] || '').trim().toLowerCase() : '';
      const type = (typeRaw === 'u' || typeRaw === 'f' || typeRaw === 'work') ? typeRaw : 'work';
      if (!dateStr) continue;

      let start = null;
      let end = null;
      if (type === 'work') {
        if (!startStr) continue;
        start = parseLocalDateTime(dateStr, startStr);
        end = endStr ? parseLocalDateTime(dateStr, endStr) : null;
        if (!start) continue;
      } else {
        start = parseLocalDate(dateStr);
        end = null;
      }

      let pauseMin = undefined;
      if (idxPause >= 0) {
        const p = (cols[idxPause] || '').trim();
        if (p !== '') {
          const n = Number(p);
          if (Number.isFinite(n) && n >= 0) pauseMin = Math.round(n);
        }
      }
      const overdrive = idxOverdrive >= 0 ? ((cols[idxOverdrive] || '').trim() === '1' || /true/i.test((cols[idxOverdrive] || '').trim())) : false;

      out.push({
        id: crypto.randomUUID(),
        start: start.toISOString(),
        end: end ? end.toISOString() : undefined,
        type,
        pauseMin,
        overdrive: type === 'work' ? overdrive : undefined
      });
    }
    return out;
  }

  function splitCsvLine(line) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === ';') { res.push(cur); cur = ''; }
        else if (ch === '"') { inQ = true; }
        else { cur += ch; }
      }
    }
    res.push(cur);
    return res;
  }

  function parseLocalDateTime(dateStr, timeStr) {
    const t = parseTimeHHMM(timeStr);
    if (!t) return null;

    let y,m,d;
    const m1 = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateStr);
    if (m1) {
      d = parseInt(m1[1],10);
      m = parseInt(m1[2],10) - 1;
      y = parseInt(m1[3],10);
    } else {
      const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
      if (!m2) return null;
      y = parseInt(m2[1],10);
      m = parseInt(m2[2],10) - 1;
      d = parseInt(m2[3],10);
    }
    return new Date(y, m, d, t.h, t.min, 0, 0);
  }

  function parseTimeHHMM(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    const h = parseInt(m[1],10);
    const min = parseInt(m[2],10);
    if (isNaN(h) || isNaN(min)) return null;
    return { h, min };
  }

  function normalizeBackupData(data) {
    try {
      const list = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : [];
      const result = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const start = safeDate(item.start);
        if (!start) continue;
        const end = item.end ? safeDate(item.end) : null;
        const typeRaw = typeof item.type === 'string' ? item.type : '';
        const type = (typeRaw === 'u' || typeRaw === 'f' || typeRaw === 'work') ? typeRaw : 'work';
        const pauseMin = Number.isFinite(item.pauseMin) && item.pauseMin >= 0 ? Math.round(item.pauseMin) : undefined;
        const overdrive = !!item.overdrive;
        result.push({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          start: start.toISOString(),
          end: end ? end.toISOString() : undefined,
          type,
          pauseMin,
          overdrive: type === 'work' ? overdrive : undefined
        });
      }

      const s = (data && typeof data === 'object' && data.settings) ? normalizeSettings(data.settings) : null;
      return { entries: result, settings: s };
    } catch {
      return { entries: [], settings: null };
    }
  }

  function safeDate(value) {
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDuration(ms) {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  function toLocalInputValue(date) {
    const pad = (n) => String(n).padStart(2,'0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth()+1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }

  function toLocalDateInputValue(date) {
    const pad = (n) => String(n).padStart(2,'0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth()+1);
    const dd = pad(date.getDate());
    return `${yyyy}-${MM}-${dd}`;
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEntries(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return normalizeSettings(parsed) || { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {}
  }

  function normalizeSettings(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const out = { ...DEFAULT_SETTINGS };
    if (typeof obj.location === 'string') out.location = obj.location;
    if (typeof obj.stateCode === 'string' && /^[a-z]{2}$/.test(obj.stateCode)) out.stateCode = obj.stateCode;
    if (Number.isFinite(obj.hoursPerDay) && obj.hoursPerDay >= 0) out.hoursPerDay = obj.hoursPerDay;
    if (Number.isFinite(obj.defaultPauseMinutes) && obj.defaultPauseMinutes >= 0) out.defaultPauseMinutes = Math.round(obj.defaultPauseMinutes);

    out.dienstbeginnEnabled = !!obj.dienstbeginnEnabled;
    if (typeof obj.dienstbeginnTime === 'string' && parseTimeHHMM(obj.dienstbeginnTime)) out.dienstbeginnTime = obj.dienstbeginnTime;
    if (Number.isFinite(obj.dienstbeginnEarlyMinutes) && obj.dienstbeginnEarlyMinutes >= 0) out.dienstbeginnEarlyMinutes = Math.round(obj.dienstbeginnEarlyMinutes);

    out.surchargeEnabled = !!obj.surchargeEnabled;
    if (typeof obj.surchargeNightFrom === 'string' && parseTimeHHMM(obj.surchargeNightFrom)) out.surchargeNightFrom = obj.surchargeNightFrom;
    if (typeof obj.surchargeNightTo === 'string' && parseTimeHHMM(obj.surchargeNightTo)) out.surchargeNightTo = obj.surchargeNightTo;
    out.surchargeSundayHoliday = (obj.surchargeSundayHoliday !== undefined) ? !!obj.surchargeSundayHoliday : DEFAULT_SETTINGS.surchargeSundayHoliday;

    out.excludePublicHolidaysFromExpected = (obj.excludePublicHolidaysFromExpected !== undefined) ? !!obj.excludePublicHolidaysFromExpected : DEFAULT_SETTINGS.excludePublicHolidaysFromExpected;
    return out;
  }

  function openSettings() {
    // ensure latest settings from storage
    settings = loadSettings();
    settingLocation.value = settings.location || '';
    settingState.value = settings.stateCode || DEFAULT_SETTINGS.stateCode;
    settingHoursPerDay.value = String(settings.hoursPerDay);
    settingDefaultPause.value = String(settings.defaultPauseMinutes);
    settingDienstbeginnEnabled.checked = !!settings.dienstbeginnEnabled;
    settingDienstbeginnTime.value = settings.dienstbeginnTime || DEFAULT_SETTINGS.dienstbeginnTime;
    settingDienstbeginnEarly.value = String(settings.dienstbeginnEarlyMinutes);
    settingSurchargeEnabled.checked = !!settings.surchargeEnabled;
    settingNightFrom.value = settings.surchargeNightFrom || DEFAULT_SETTINGS.surchargeNightFrom;
    settingNightTo.value = settings.surchargeNightTo || DEFAULT_SETTINGS.surchargeNightTo;
    settingSundayHoliday.checked = !!settings.surchargeSundayHoliday;
    settingExcludeHolidaysFromExpected.checked = !!settings.excludePublicHolidaysFromExpected;
    settingsDialog.showModal();
  }

  function readSettingsFromForm() {
    const out = { ...DEFAULT_SETTINGS };
    out.location = (settingLocation.value || '').trim();
    out.stateCode = (settingState.value || DEFAULT_SETTINGS.stateCode).trim().toLowerCase();

    const hpd = Number(settingHoursPerDay.value);
    out.hoursPerDay = (Number.isFinite(hpd) && hpd >= 0) ? hpd : DEFAULT_SETTINGS.hoursPerDay;

    const dp = Number(settingDefaultPause.value);
    out.defaultPauseMinutes = (Number.isFinite(dp) && dp >= 0) ? Math.round(dp) : DEFAULT_SETTINGS.defaultPauseMinutes;

    out.dienstbeginnEnabled = !!settingDienstbeginnEnabled.checked;
    out.dienstbeginnTime = settingDienstbeginnTime.value || DEFAULT_SETTINGS.dienstbeginnTime;
    const early = Number(settingDienstbeginnEarly.value);
    out.dienstbeginnEarlyMinutes = (Number.isFinite(early) && early >= 0) ? Math.round(early) : DEFAULT_SETTINGS.dienstbeginnEarlyMinutes;

    out.surchargeEnabled = !!settingSurchargeEnabled.checked;
    out.surchargeNightFrom = settingNightFrom.value || DEFAULT_SETTINGS.surchargeNightFrom;
    out.surchargeNightTo = settingNightTo.value || DEFAULT_SETTINGS.surchargeNightTo;
    out.surchargeSundayHoliday = !!settingSundayHoliday.checked;

    out.excludePublicHolidaysFromExpected = !!settingExcludeHolidaysFromExpected.checked;
    return normalizeSettings(out) || { ...DEFAULT_SETTINGS };
  }

  function applyDienstbeginnRounding(date, settingsObj, overdrive) {
    if (!settingsObj || !settingsObj.dienstbeginnEnabled) return date;
    if (overdrive) return date;
    const t = parseTimeHHMM(settingsObj.dienstbeginnTime || DEFAULT_SETTINGS.dienstbeginnTime);
    if (!t) return date;
    const scheduled = new Date(date.getFullYear(), date.getMonth(), date.getDate(), t.h, t.min, 0, 0);
    const diffMs = scheduled.getTime() - date.getTime();
    const earlyLimitMs = Math.max(0, Number(settingsObj.dienstbeginnEarlyMinutes) || 0) * 60000;
    if (diffMs > 0 && diffMs <= earlyLimitMs) return scheduled;
    return date;
  }

  function parseLocalDate(value) {
    // Accept yyyy-mm-dd or dd.mm.yyyy
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      const y = parseInt(iso[1],10);
      const m = parseInt(iso[2],10) - 1;
      const d = parseInt(iso[3],10);
      return new Date(y, m, d, 0, 0, 0, 0);
    }
    const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
    if (de) {
      const d = parseInt(de[1],10);
      const m = parseInt(de[2],10) - 1;
      const y = parseInt(de[3],10);
      return new Date(y, m, d, 0, 0, 0, 0);
    }
    return null;
  }

  function overlapMs(aStart, aEnd, bStart, bEnd) {
    const s = Math.max(aStart.getTime(), bStart.getTime());
    const e = Math.min(aEnd.getTime(), bEnd.getTime());
    return e > s ? (e - s) : 0;
  }

  function getEntryNetMs(entry, settingsObj, startDate, endDate) {
    const type = entry.type || 'work';
    if (type === 'u' || type === 'f') {
      const hours = Number(settingsObj && settingsObj.hoursPerDay) || DEFAULT_SETTINGS.hoursPerDay;
      return hours * 60 * 60 * 1000;
    }
    if (!endDate) return 0;
    const rawMs = endDate - startDate;
    const pauseMin = (typeof entry.pauseMin === 'number') ? entry.pauseMin : (Number(settingsObj && settingsObj.defaultPauseMinutes) || 0);
    const net = rawMs - (pauseMin * 60000);
    return Math.max(0, net);
  }

  function formatPauseInfo(entry, settingsObj) {
    const pauseMin = (typeof entry.pauseMin === 'number') ? entry.pauseMin : (Number(settingsObj && settingsObj.defaultPauseMinutes) || 0);
    if (!pauseMin) return '';
    return ` • Pause ${pauseMin}m`;
  }

  function updateEditorMode() {
    const type = /** @type {'work'|'u'|'f'} */ (typeInput.value || 'work');
    const isWork = type === 'work';
    fromInput.toggleAttribute('required', isWork);
    dateInput.toggleAttribute('required', !isWork);
    dateRow.hidden = isWork;
    fromRow.hidden = !isWork;
    toRow.hidden = !isWork;
    pauseRow.hidden = !isWork;
    overdriveRow.hidden = !isWork || !settings.dienstbeginnEnabled;
    if (!isWork) {
      toInput.value = '';
      pauseInput.value = '';
      overdriveInput.checked = false;
    }
  }

  typeInput.addEventListener('change', () => updateEditorMode());
  fromInput.addEventListener('change', () => {
    try {
      if (!fromInput.value) return;
      const d = new Date(fromInput.value);
      dateInput.value = toLocalDateInputValue(d);
    } catch {}
  });

  function announce(text) {
    statusRow.textContent = text;
    setTimeout(() => { if (statusRow.textContent === text) statusRow.textContent = ''; }, 1500);
  }
  
  // Enable iOS-only pull-to-refresh when installed to Home Screen (standalone)
  try {
    const isInWebAppiOS = (window.navigator.standalone === true);
    if (isInWebAppiOS && window.PullToRefresh && typeof window.PullToRefresh.init === 'function') {
      window.PullToRefresh.init({
        mainElement: 'body',
        onRefresh() {
          window.location.reload();
        }
      });
    }
  } catch {}

})();

