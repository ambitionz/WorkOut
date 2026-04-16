const WORKOUT_STORAGE_KEY = 'workout-tracker-history-v1';
const LAST_WORKOUT_KEY = 'workout-tracker-last';
const EXERCISE_COUNT = 3;
const SETS_PER_EXERCISE = 5;

const defaultExerciseNames = ['Exercise 1', 'Exercise 2', 'Exercise 3'];

const dom = {
  dateInput: document.querySelector('#workout-date'),
  exerciseGrid: document.querySelector('#exercise-grid'),
  dailyVolume: document.querySelector('#daily-volume'),
  prVolume: document.querySelector('#pr-volume'),
  weekComparison: document.querySelector('#week-comparison'),
  saveBtn: document.querySelector('#save-btn'),
  copyBtn: document.querySelector('#copy-btn'),
  autofillBtn: document.querySelector('#autofill-btn'),
  exportBtn: document.querySelector('#export-btn'),
  importInput: document.querySelector('#import-input'),
  exerciseTemplate: document.querySelector('#exercise-card-template'),
  setTemplate: document.querySelector('#set-row-template'),
  weeklyChart: document.querySelector('#weekly-chart'),
  feedbackModal: document.querySelector('#feedback-modal'),
  feedbackModalTitle: document.querySelector('#feedback-modal-title'),
  feedbackModalMessage: document.querySelector('#feedback-modal-message'),
  feedbackModalIcon: document.querySelector('#feedback-modal-icon'),
  feedbackModalIconGlyph: document.querySelector('#feedback-modal-icon i'),
  feedbackModalAction: document.querySelector('#feedback-modal-action')
};

const feedbackModalTones = {
  info: {
    icon: 'bi-info-circle-fill',
    iconClasses: 'text-primary bg-primary-subtle',
    buttonClass: 'btn-primary'
  },
  success: {
    icon: 'bi-check2-circle',
    iconClasses: 'text-success bg-success-subtle',
    buttonClass: 'btn-success'
  },
  warning: {
    icon: 'bi-exclamation-triangle-fill',
    iconClasses: 'text-warning bg-warning-subtle',
    buttonClass: 'btn-warning'
  },
  danger: {
    icon: 'bi-x-octagon-fill',
    iconClasses: 'text-danger bg-danger-subtle',
    buttonClass: 'btn-danger'
  }
};

const state = {
  workout: createEmptyWorkout(),
  history: loadHistory(),
  chart: null
};

init();

function init() {
  dom.dateInput.value = formatDateInput(new Date());
  state.workout.date = dom.dateInput.value;

  renderWorkoutTables();
  wireEvents();
  refreshAllDerivedViews();
}

function createEmptyWorkout() {
  return {
    date: formatDateInput(new Date()),
    exercises: Array.from({ length: EXERCISE_COUNT }, (_, index) => ({
      name: defaultExerciseNames[index],
      sets: Array.from({ length: SETS_PER_EXERCISE }, () => ({
        weight: 0,
        reps: 0,
        fail: 0
      }))
    }))
  };
}

function renderWorkoutTables() {
  dom.exerciseGrid.innerHTML = '';

  state.workout.exercises.forEach((exercise, exerciseIndex) => {
    const card = dom.exerciseTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = card.querySelector('.exercise-name');
    const volumeEl = card.querySelector('[data-exercise-volume]');
    const tbody = card.querySelector('tbody');

    nameInput.value = exercise.name;
    nameInput.addEventListener('input', (event) => {
      state.workout.exercises[exerciseIndex].name = event.target.value.trim() || `Exercise ${exerciseIndex + 1}`;
    });

    exercise.sets.forEach((set, setIndex) => {
      const row = dom.setTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.exerciseIndex = String(exerciseIndex);
      row.dataset.setIndex = String(setIndex);

      row.querySelector('.set-number').textContent = String(setIndex + 1);

      const weightInput = row.querySelector('.weight-input');
      const repsInput = row.querySelector('.reps-input');
      const failInput = row.querySelector('.fail-input');
      const minusBtn = row.querySelector('.rep-minus');
      const plusBtn = row.querySelector('.rep-plus');

      weightInput.value = numericOrZero(set.weight);
      repsInput.value = numericOrZero(set.reps);
      failInput.value = numericOrZero(set.fail);

      weightInput.addEventListener('input', () => updateSetField(exerciseIndex, setIndex, 'weight', weightInput.value));
      repsInput.addEventListener('input', () => updateSetField(exerciseIndex, setIndex, 'reps', repsInput.value));
      failInput.addEventListener('input', () => updateSetField(exerciseIndex, setIndex, 'fail', failInput.value));

      minusBtn.addEventListener('click', () => adjustReps(exerciseIndex, setIndex, -1, repsInput));
      plusBtn.addEventListener('click', () => adjustReps(exerciseIndex, setIndex, 1, repsInput));

      tbody.appendChild(row);
    });

    card.dataset.exerciseIndex = String(exerciseIndex);
    card.dataset.exerciseVolumeTarget = volumeEl.dataset.exerciseVolume || 'volume';
    dom.exerciseGrid.appendChild(card);
  });
}

function wireEvents() {
  dom.dateInput.addEventListener('change', () => {
    state.workout.date = dom.dateInput.value;
  });

  dom.saveBtn.addEventListener('click', () => {
    saveWorkout();
    refreshAllDerivedViews();
  });

  dom.copyBtn.addEventListener('click', () => {
    const prev = loadWorkout();
    if (!prev) {
      showFeedbackModal({
        title: 'No Previous Workout',
        message: 'There is no saved workout yet to load.',
        tone: 'warning'
      });
      return;
    }
    applyWorkoutToUI(prev, { keepCurrentDate: true });
  });

  dom.autofillBtn.addEventListener('click', () => {
    const prev = loadWorkout();
    if (!prev) {
      showFeedbackModal({
        title: 'Nothing to Autofill',
        message: 'Save one workout first, then you can autofill the last session.',
        tone: 'warning'
      });
      return;
    }
    autofillFromWorkout(prev);
    refreshAllDerivedViews();
  });

  dom.exportBtn.addEventListener('click', exportHistoryAsJson);

  dom.importInput.addEventListener('change', importHistoryFromJson);
}

function updateSetField(exerciseIndex, setIndex, field, rawValue) {
  const parsed = parseNumeric(rawValue);
  state.workout.exercises[exerciseIndex].sets[setIndex][field] = parsed;
  refreshAllDerivedViews();
}

function adjustReps(exerciseIndex, setIndex, delta, repsInput) {
  const current = state.workout.exercises[exerciseIndex].sets[setIndex].reps || 0;
  const next = Math.max(0, current + delta);
  state.workout.exercises[exerciseIndex].sets[setIndex].reps = next;
  repsInput.value = String(next);
  refreshAllDerivedViews();
}

function calculateVolume(workout = state.workout) {
  const exerciseVolumes = workout.exercises.map((exercise) =>
    exercise.sets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0)
  );

  return {
    exerciseVolumes,
    dailyVolume: exerciseVolumes.reduce((sum, vol) => sum + vol, 0)
  };
}

function saveWorkout() {
  const sanitized = sanitizeWorkout(state.workout);
  const existingIndex = state.history.findIndex((entry) => entry.date === sanitized.date);

  if (existingIndex >= 0) {
    state.history[existingIndex] = sanitized;
  } else {
    state.history.push(sanitized);
  }

  state.history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(state.history));
  localStorage.setItem(LAST_WORKOUT_KEY, JSON.stringify(sanitized));
  showFeedbackModal({
    title: 'Workout Saved',
    message: 'Your workout has been saved to local history.',
    tone: 'success'
  });
}

function loadWorkout() {
  const raw = localStorage.getItem(LAST_WORKOUT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return sanitizeWorkout(JSON.parse(raw));
  } catch (error) {
    console.error('Could not parse previous workout', error);
    return null;
  }
}

function loadHistory() {
  const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(sanitizeWorkout).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Could not load history', error);
    return [];
  }
}

function sanitizeWorkout(input) {
  const date = typeof input?.date === 'string' && input.date ? input.date : formatDateInput(new Date());
  const exercises = Array.from({ length: EXERCISE_COUNT }, (_, exerciseIndex) => {
    const sourceExercise = input?.exercises?.[exerciseIndex] || {};
    const name = typeof sourceExercise.name === 'string' && sourceExercise.name.trim()
      ? sourceExercise.name.trim()
      : `Exercise ${exerciseIndex + 1}`;

    const sets = Array.from({ length: SETS_PER_EXERCISE }, (_, setIndex) => {
      const sourceSet = sourceExercise?.sets?.[setIndex] || {};
      return {
        weight: parseNumeric(sourceSet.weight),
        reps: parseNumeric(sourceSet.reps),
        fail: parseNumeric(sourceSet.fail)
      };
    });

    return { name, sets };
  });

  return { date, exercises };
}

function refreshAllDerivedViews() {
  const { exerciseVolumes, dailyVolume } = calculateVolume();

  dom.exerciseGrid.querySelectorAll('.exercise-card').forEach((card, index) => {
    const volumeEl = card.querySelector('[data-exercise-volume]');
    volumeEl.textContent = `${exerciseVolumes[index]} kg`;
  });

  dom.dailyVolume.textContent = `${dailyVolume} kg`;
  updatePrHighlight();
  updateWeeklyComparison();
  renderChart();
}

function updatePrHighlight() {
  const currentVolume = calculateVolume().dailyVolume;
  const maxHistoryVolume = state.history.reduce((max, workout) => {
    const volume = calculateVolume(workout).dailyVolume;
    return Math.max(max, volume);
  }, 0);

  const isPr = currentVolume >= maxHistoryVolume && currentVolume > 0;

  dom.exerciseGrid.classList.toggle('pr-highlight', isPr);
  dom.prVolume.textContent = `${Math.max(currentVolume, maxHistoryVolume)} kg`;
}

function updateWeeklyComparison() {
  const grouped = groupWorkoutsByWeek(getHistoryWithCurrentWorkout());
  const sortedWeeks = Object.keys(grouped).sort();

  if (sortedWeeks.length < 2) {
    dom.weekComparison.textContent = 'No previous week data';
    dom.weekComparison.classList.remove('positive', 'negative');
    return;
  }

  const currentWeek = sortedWeeks[sortedWeeks.length - 1];
  const previousWeek = sortedWeeks[sortedWeeks.length - 2];

  const currentVolume = grouped[currentWeek];
  const previousVolume = grouped[previousWeek];

  if (previousVolume === 0) {
    dom.weekComparison.textContent = 'No comparable previous week volume';
    dom.weekComparison.classList.remove('positive', 'negative');
    return;
  }

  const change = ((currentVolume - previousVolume) / previousVolume) * 100;
  const sign = change >= 0 ? '+' : '';

  dom.weekComparison.textContent = `${sign}${change.toFixed(1)}% (${previousWeek} → ${currentWeek})`;
  dom.weekComparison.classList.toggle('positive', change > 0);
  dom.weekComparison.classList.toggle('negative', change < 0);
}

function groupWorkoutsByWeek(workouts) {
  return workouts.reduce((acc, workout) => {
    const weekKey = getIsoWeekKey(workout.date);
    const volume = calculateVolume(workout).dailyVolume;

    acc[weekKey] = (acc[weekKey] || 0) + volume;
    return acc;
  }, {});
}

function renderChart() {
  const weeklyMap = groupWorkoutsByWeek(getHistoryWithCurrentWorkout());
  const labels = Object.keys(weeklyMap).sort();
  const values = labels.map((label) => weeklyMap[label]);

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(dom.weeklyChart, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weekly Total Volume',
        data: values,
        borderColor: '#2c68ff',
        backgroundColor: 'rgba(44, 104, 255, 0.15)',
        tension: 0.2,
        fill: true,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Volume (kg)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'ISO Week'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function applyWorkoutToUI(workout, { keepCurrentDate = false } = {}) {
  const currentDate = dom.dateInput.value;
  state.workout = sanitizeWorkout(workout);

  if (keepCurrentDate) {
    state.workout.date = currentDate;
  }

  dom.dateInput.value = state.workout.date;
  renderWorkoutTables();
  refreshAllDerivedViews();
}

function autofillFromWorkout(sourceWorkout) {
  const source = sanitizeWorkout(sourceWorkout);
  state.workout.exercises.forEach((exercise, exerciseIndex) => {
    exercise.name = source.exercises[exerciseIndex].name;

    exercise.sets.forEach((set, setIndex) => {
      set.weight = source.exercises[exerciseIndex].sets[setIndex].weight;
      set.reps = source.exercises[exerciseIndex].sets[setIndex].reps;
      set.fail = source.exercises[exerciseIndex].sets[setIndex].fail;
    });
  });

  renderWorkoutTables();
}

function exportHistoryAsJson() {
  const payload = JSON.stringify(state.history, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `workout-history-${formatDateInput(new Date())}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function importHistoryFromJson(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) {
        throw new Error('Imported JSON must be an array of workouts.');
      }

      state.history = parsed.map(sanitizeWorkout).sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(state.history));
      const latestWorkout = state.history[state.history.length - 1] || null;
      if (latestWorkout) {
        localStorage.setItem(LAST_WORKOUT_KEY, JSON.stringify(latestWorkout));
      } else {
        localStorage.removeItem(LAST_WORKOUT_KEY);
      }
      refreshAllDerivedViews();
      showFeedbackModal({
        title: 'Import Complete',
        message: 'Workout history was imported successfully.',
        tone: 'success'
      });
    } catch (error) {
      console.error(error);
      showFeedbackModal({
        title: 'Import Failed',
        message: 'Failed to import JSON file. Ensure the file format is correct.',
        tone: 'danger'
      });
    } finally {
      dom.importInput.value = '';
    }
  };

  reader.readAsText(file);
}

function getHistoryWithCurrentWorkout() {
  const current = sanitizeWorkout(state.workout);
  const merged = state.history.filter((entry) => entry.date !== current.date);
  merged.push(current);
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

function getIsoWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;

  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);

  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function parseNumeric(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}

function numericOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showFeedbackModal({ title = 'Notice', message, tone = 'info', actionLabel = 'Got it' }) {
  if (!dom.feedbackModal || !dom.feedbackModalTitle || !dom.feedbackModalMessage) {
    window.alert(message);
    return;
  }

  const feedbackTone = feedbackModalTones[tone] || feedbackModalTones.info;

  dom.feedbackModalTitle.textContent = title;
  dom.feedbackModalMessage.textContent = message;

  if (dom.feedbackModalIcon && dom.feedbackModalIconGlyph) {
    dom.feedbackModalIcon.className = `feedback-modal-icon mx-auto ${feedbackTone.iconClasses}`;
    dom.feedbackModalIconGlyph.className = `bi ${feedbackTone.icon}`;
  }

  if (dom.feedbackModalAction) {
    dom.feedbackModalAction.textContent = actionLabel;
    dom.feedbackModalAction.className = `btn ${feedbackTone.buttonClass} px-4`;
    dom.feedbackModalAction.setAttribute('data-bs-dismiss', 'modal');
  }

  const feedbackModal = getFeedbackModalInstance();
  if (!feedbackModal) {
    window.alert(message);
    return;
  }

  feedbackModal.show();
}

function getFeedbackModalInstance() {
  if (!dom.feedbackModal || !window.bootstrap?.Modal) {
    return null;
  }

  return window.bootstrap.Modal.getOrCreateInstance(dom.feedbackModal);
}
