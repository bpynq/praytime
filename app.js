(function () {
  'use strict';

  const KEY_LOCS = 'praytime_user_locations';
  const KEY_ACTIVE = 'praytime_active_loc_idx';

  function loadLocations() {
    try {
      const stored = localStorage.getItem(KEY_LOCS);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getInitialActiveIndex(count) {
    return count === 0 ? 0 : Math.max(0, Math.min(parseInt(localStorage.getItem(KEY_ACTIVE), 10) || 0, count - 1));
  }

  let locations = loadLocations();
  let activeIdx = getInitialActiveIndex(locations.length);

  function saveLocations() {
    localStorage.setItem(KEY_LOCS, JSON.stringify(locations));
    localStorage.setItem(KEY_ACTIVE, String(activeIdx));
  }

  function formatRelativeTime(diffMs) {
    const totalMinutes = Math.floor(Math.max(0, diffMs) / 60000);
    if (totalMinutes === 0) return 'now';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `in ${minutes}m`;
    if (minutes === 0) return `in ${hours}h`;
    return `in ${hours}h ${minutes}m`;
  }

  function getNextPrayer(data, nowTs) {
    const now = nowTs || Date.now();
    const timeline = [
      { key: 'midnight', name: 'Midnight', ts: data.midnight.yesterdayTs },
      { key: 'qiyam', name: 'Qiyam', ts: data.qiyam.yesterdayTs },
      { key: 'fajr', name: 'Fajr', ts: data.fajr.todayTs },
      { key: 'sunrise', name: 'Sunrise', ts: data.sunrise.todayTs },
      { key: 'dhuhr', name: 'Dhuhr', ts: data.dhuhr.todayTs },
      { key: 'asr', name: 'Asr', ts: data.asr.hanafiTs },
      { key: 'sunset', name: 'Sunset', ts: data.sunset.todayTs },
      { key: 'isha', name: 'Isha', ts: data.isha.todayTs },
      { key: 'midnight', name: 'Midnight', ts: data.midnight.todayTs },
      { key: 'qiyam', name: 'Qiyam', ts: data.qiyam.todayTs },
      { key: 'fajr', name: 'Fajr', ts: data.fajr.tomorrowTs },
      { key: 'sunrise', name: 'Sunrise', ts: data.sunrise.tomorrowTs }
    ];

    const nextEvent = timeline.find((event) => event.ts > now) || timeline[timeline.length - 1];

    const diff = Math.max(0, nextEvent.ts - now);
    const relativeTime = formatRelativeTime(diff);
    const text = relativeTime === 'now' ? `${nextEvent.name} now` : `${nextEvent.name} ${relativeTime}`;

    return {
      nextKey: nextEvent.key,
      text
    };
  }

  const ROWS = [
    { key: 'fajr', name: 'Fajr', leftId: null, middleId: 'fajrToday', rightId: 'fajrTomorrow' },
    { key: 'sunrise', name: 'Sunrise', leftId: null, middleId: 'sunriseToday', rightId: 'sunriseTomorrow' },
    { key: 'dhuhr', name: 'Dhuhr', leftId: null, middleId: 'dhuhrToday', rightId: null },
    { key: 'asr', name: 'Asr', leftId: 'asrStd', middleId: 'asrHanafi', rightId: null },
    { key: 'sunset', name: 'Sunset', leftId: null, middleId: 'sunsetToday', rightId: null },
    { key: 'isha', name: 'Isha', leftId: null, middleId: 'ishaToday', rightId: null },
    { key: 'midnight', name: 'Midnight', leftId: 'midnightYesterday', middleId: 'midnightToday', rightId: null },
    { key: 'qiyam', name: 'Qiyam', leftId: 'qiyamYesterday', middleId: 'qiyamToday', rightId: null }
  ];

  const pillsContainer = document.getElementById('locationPills');
  const currentDateEl = document.getElementById('currentDate');
  const statusTimeDiffEl = document.getElementById('statusTimeDiff');
  const locationPanel = document.getElementById('locationPanel');
  const openLocModalBtn = document.getElementById('openLocModal');
  const closeLocPanelBtn = document.getElementById('closeLocPanel');
  const addLocationForm = document.getElementById('addLocationForm');
  const savedLocationsList = document.getElementById('savedLocationsList');
  const useGpsBtn = document.getElementById('useGpsBtn');
  const locNameInput = document.getElementById('locName');
  const locLatInput = document.getElementById('locLat');
  const locLngInput = document.getElementById('locLng');

  const prayerList = document.getElementById('prayerList');
  prayerList.innerHTML = ROWS.map((row) => `
    <div class="prayer-row" data-key="${row.key}" role="row">
      <span class="prayer-name" role="rowheader">${row.name}<span class="active-badge" aria-label="Upcoming prayer">Upcoming</span></span>
      <div class="times-group">
        <span class="time-col secondary" role="cell">${row.leftId ? `<span class="slot-time" id="${row.leftId}">--:--</span>` : ''}</span>
        <span class="time-col primary" role="cell"><span class="slot-time" id="${row.middleId}">--:--</span></span>
        <span class="time-col secondary" role="cell">${row.rightId ? `<span class="slot-time" id="${row.rightId}">--:--</span>` : ''}</span>
      </div>
    </div>`).join('');

  const prayerRows = document.querySelectorAll('.prayer-row');

  function setupPills() {
    if (locations.length === 0) {
      pillsContainer.innerHTML = '<button type="button" class="loc-btn active">Add Location</button>';
      openLocModalBtn.style.display = 'none';
      return;
    }

    openLocModalBtn.style.display = '';
    pillsContainer.innerHTML = locations.map((loc, idx) =>
      `<button type="button" class="loc-btn ${idx === activeIdx ? 'active' : ''}" role="tab" aria-selected="${idx === activeIdx}" data-idx="${idx}">${loc.name}</button>`
    ).join('');
  }

  function renderSavedLocations() {
    if (locations.length === 0) {
      savedLocationsList.innerHTML = '<div class="saved-loc-empty">No locations saved. Enter your coordinates above.</div>';
      return;
    }

    savedLocationsList.innerHTML = locations.map((loc, idx) => {
      const latFormatted = Number(loc.lat).toFixed(4);
      const lngFormatted = Number(loc.lng).toFixed(4);
      return `
        <div class="saved-loc-item">
          <div class="saved-loc-meta">
            <span class="saved-loc-name">${loc.name}</span>
            <span class="saved-loc-coords">${latFormatted}, ${lngFormatted}</span>
          </div>
          <button type="button" class="saved-loc-del" data-idx="${idx}" aria-label="Delete ${loc.name}">Delete</button>
        </div>`;
    }).join('');
  }

  function render() {
    if (locations.length === 0 || !locations[activeIdx]) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      currentDateEl.textContent = window.PrayTime.formatDate(new Date(), timeZone);
      statusTimeDiffEl.textContent = 'Set location to view times';
      document.querySelectorAll('.slot-time').forEach((el) => {
        el.textContent = '--:--';
      });
      prayerRows.forEach((row) => {
        row.classList.remove('active');
      });
      return;
    }

    const now = new Date();
    const data = window.PrayTime.getDailyPrayerData(locations[activeIdx], now);
    const nextInfo = getNextPrayer(data, now.getTime());

    currentDateEl.textContent = data.dateFormatted;
    statusTimeDiffEl.textContent = nextInfo.text;

    const values = {
      fajrToday: data.fajr.today,
      fajrTomorrow: data.fajr.tomorrow,
      sunriseToday: data.sunrise.today,
      sunriseTomorrow: data.sunrise.tomorrow,
      dhuhrToday: data.dhuhr.today,
      asrStd: data.asr.standard,
      asrHanafi: data.asr.hanafi,
      sunsetToday: data.sunset.today,
      ishaToday: data.isha.today,
      midnightYesterday: data.midnight.yesterday,
      midnightToday: data.midnight.today,
      qiyamYesterday: data.qiyam.yesterday,
      qiyamToday: data.qiyam.today
    };

    for (const [id, val] of Object.entries(values)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    prayerRows.forEach((row) => {
      const key = row.getAttribute('data-key');
      row.classList.toggle('active', key === nextInfo.nextKey);
    });
  }

  function openLocationPanel() {
    renderSavedLocations();
    locationPanel.hidden = false;
    openLocModalBtn.setAttribute('aria-expanded', 'true');
  }

  function closeLocationPanel() {
    locationPanel.hidden = true;
    openLocModalBtn.setAttribute('aria-expanded', 'false');
  }

  pillsContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('.loc-btn');
    if (!btn) return;

    if (btn.dataset.idx !== undefined) {
      activeIdx = parseInt(btn.dataset.idx, 10);
      saveLocations();
      setupPills();
      render();
    } else {
      openLocationPanel();
    }
  });

  savedLocationsList.addEventListener('click', (event) => {
    const delBtn = event.target.closest('.saved-loc-del');
    if (!delBtn) return;

    const idx = parseInt(delBtn.dataset.idx, 10);
    locations.splice(idx, 1);
    activeIdx = Math.max(0, Math.min(activeIdx, locations.length - 1));
    saveLocations();
    setupPills();
    renderSavedLocations();
    render();
  });

  openLocModalBtn.addEventListener('click', () => {
    locationPanel.hidden ? openLocationPanel() : closeLocationPanel();
  });

  closeLocPanelBtn.addEventListener('click', () => {
    closeLocationPanel();
  });

  function flashGpsButton(message) {
    useGpsBtn.textContent = message;
    setTimeout(() => {
      useGpsBtn.textContent = 'Use Device Location';
    }, 2000);
  }

  useGpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      flashGpsButton('GPS Unsupported');
      return;
    }

    useGpsBtn.textContent = 'Detecting...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locLatInput.value = pos.coords.latitude.toFixed(6);
        locLngInput.value = pos.coords.longitude.toFixed(6);
        if (!locNameInput.value) {
          locNameInput.value = 'GPS Location';
        }
        useGpsBtn.textContent = 'Use Device Location';
      },
      () => {
        flashGpsButton('Location Failed');
      }
    );
  });

  addLocationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = locNameInput.value.trim();
    const lat = parseFloat(locLatInput.value);
    const lng = parseFloat(locLngInput.value);

    if (!name || isNaN(lat) || isNaN(lng)) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    locations.push({ name, lat, lng, timezone });
    activeIdx = locations.length - 1;
    saveLocations();

    addLocationForm.reset();
    setupPills();
    renderSavedLocations();
    render();
    closeLocationPanel();
  });

  setupPills();
  render();

  setInterval(render, 10000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      render();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    });
  }
})();
