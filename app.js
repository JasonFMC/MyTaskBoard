/**
 * MyTaskBoard — data model, persistence, render, add/toggle/delete.
 * Task shape: { id, text, priority, completed, createdAt }
 * Boot: on DOMContentLoaded, tasks are loaded from localStorage then rendered (empty-state hint when list is empty).
 */

/* ---------------------------------------------------------------------------
 * LOCAL STORAGE
 * -------------
 * Key: STORAGE_KEY. Value: JSON.stringify(tasks) — full array after each change.
 * loadTasks() runs once at startup; invalid items are dropped (isValidTask).
 * saveTasks/loadTasks may throw in quota/private mode; caught and logged.
 * --------------------------------------------------------------------------- */
const STORAGE_KEY = 'myTaskBoard.tasks';

/** Sort rank: smaller = higher on the board (used only in sortTasksForDisplay). */
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/** English labels for priority badges */
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

/**
 * @typedef {{ id: number, text: string, priority: 'high'|'medium'|'low', completed: boolean, createdAt: number }} Task
 */

/** @type {Task[]} */
let tasks = [];

function isValidTask(t) {
  return (
    t &&
    typeof t.id === 'number' &&
    typeof t.text === 'string' &&
    ['high', 'medium', 'low'].includes(t.priority) &&
    typeof t.completed === 'boolean' &&
    typeof t.createdAt === 'number'
  );
}

/** Write the entire tasks array to localStorage (see LOCAL STORAGE block above). */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('saveTasks:', e);
  }
}

/** Read and validate tasks from localStorage; returns [] if missing or invalid. */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidTask);
  } catch (e) {
    console.error('loadTasks:', e);
    return [];
  }
}

/**
 * SORTING — display order only (does not reorder the stored `tasks` array).
 * 1) PRIORITY_ORDER: high before medium before low.
 * 2) Tie-break: ascending createdAt (older task first).
 */
function sortTasksForDisplay(list) {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });
}

/**
 * Wrap a decorative icon so screen readers use the button’s aria-label only.
 * @param {HTMLElement} button
 * @param {string} character single visible glyph (✓ / ↺ / ✗)
 */
function setIconSymbol(button, character) {
  button.textContent = '';
  const glyph = document.createElement('span');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = character;
  button.appendChild(glyph);
}

/**
 * Stats strip (English UI): Total — Completed — Open; values injected into #stat-*.
 */
function updateStatsDom() {
  const total = tasks.length;
  const done = tasks.filter(function (t) {
    return t.completed;
  }).length;
  const open = total - done;

  document.getElementById('stat-total').textContent = String(total);
  document.getElementById('stat-done').textContent = String(done);
  document.getElementById('stat-open').textContent = String(open);
}

/**
 * Step 5: each row is li.task-item → .task-main (span.task-text, span.priority-tag) + actions
 * (complete/reopen ✓|↺, delete ✗). Completed tasks use .task-text.completed (strikethrough in CSS).
 */
function renderTasks() {
  const ul = document.getElementById('task-list');

  const sorted = sortTasksForDisplay(tasks);
  ul.innerHTML = '';

  sorted.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = String(task.id);

    const main = document.createElement('div');
    main.className = 'task-main';

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text' + (task.completed ? ' completed' : '');
    textSpan.textContent = task.text;

    const tag = document.createElement('span');
    tag.className = 'priority-tag priority-' + task.priority;
    tag.textContent = PRIORITY_LABEL[task.priority];
    tag.setAttribute('aria-label', 'Priority: ' + PRIORITY_LABEL[task.priority]);

    main.append(textSpan, tag);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'btn-icon btn-toggle';
    btnToggle.dataset.id = String(task.id);
    setIconSymbol(btnToggle, task.completed ? '\u21BA' : '\u2713'); // ✓ mark done ; ↺ reopen when done
    const toggleLabel = task.completed ? 'Mark as not done' : 'Mark as done';
    btnToggle.setAttribute('aria-label', toggleLabel);
    btnToggle.setAttribute('aria-pressed', task.completed ? 'true' : 'false');
    btnToggle.title = toggleLabel;

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn-icon btn-delete';
    btnDelete.dataset.id = String(task.id);
    setIconSymbol(btnDelete, '\u2717'); // ✗
    btnDelete.setAttribute('aria-label', 'Delete task');
    btnDelete.title = 'Delete';

    actions.append(btnToggle, btnDelete);
    li.append(main, actions);
    ul.appendChild(li);
  });

  updateStatsDom();

  const emptyEl = document.getElementById('task-empty');
  if (emptyEl) {
    emptyEl.hidden = tasks.length > 0;
  }
}

/**
 * Step 3: read input + priority, validate, append task, persist, re-render, reset form.
 */
function addTask() {
  const input = document.getElementById('task-input');
  const select = document.getElementById('priority-select');
  const text = input.value.trim();
  if (!text) return;

  const priority = select.value;
  if (!['high', 'medium', 'low'].includes(priority)) return;

  const now = Date.now();
  tasks.push({
    id: now,
    text,
    priority,
    completed: false,
    createdAt: now,
  });

  saveTasks();
  renderTasks();

  input.value = '';
  select.value = 'medium';
}

/**
 * Step 4: toggle completed flag for the task with the given id.
 */
function toggleTask(id) {
  const task = tasks.find(function (t) {
    return t.id === id;
  });
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
}

/**
 * Step 4: remove the task with the given id.
 */
function deleteTask(id) {
  const next = tasks.filter(function (t) {
    return t.id !== id;
  });
  if (next.length === tasks.length) return;
  tasks = next;
  saveTasks();
  renderTasks();
}

document.addEventListener('DOMContentLoaded', function () {
  // Step 6: restore tasks from localStorage (or start with []).
  tasks = loadTasks();

  document.getElementById('btn-add').addEventListener('click', addTask);
  document.getElementById('task-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask();
    }
  });

  document.getElementById('task-list').addEventListener('click', function (e) {
    const toggleBtn = e.target.closest('.btn-toggle');
    const deleteBtn = e.target.closest('.btn-delete');
    if (toggleBtn) {
      const id = Number(toggleBtn.dataset.id);
      if (!Number.isFinite(id)) return;
      toggleTask(id);
      return;
    }
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      if (!Number.isFinite(id)) return;
      deleteTask(id);
    }
  });

  renderTasks();
});
