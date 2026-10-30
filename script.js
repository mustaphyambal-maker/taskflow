/* ============================================================
   TASKFLOW — MINIMAL TASK MANAGER
   File: script.js
   All logic: add / edit / delete / complete / filter / persist.
   Vanilla JS only. No frameworks. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     0. CONSTANTS & STATE
     ---------------------------------------------------------- */
  const STORAGE_KEY = "taskflow.tasks.v1";
  const THEME_KEY = "taskflow.theme.v1";

  /** @type {Array<{id: string, title: string, note: string, completed: boolean, createdAt: number}>} */
  let tasks = [];
  let currentFilter = "all"; // "all" | "active" | "completed"
  let editingId = null;      // id of the task currently being edited

  /* ----------------------------------------------------------
     1. DOM REFERENCES
     ---------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const els = {
    form: $("#addForm"),
    input: $("#taskInput"),
    addBtn: $("#addBtn"),
    taskList: $("#taskList"),
    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptySub: $("#emptySub"),
    footer: $("#appFooter"),
    itemsLeftCount: $("#itemsLeftCount"),
    itemsLeftLabel: $("#itemsLeftLabel"),
    clearBtn: $("#clearCompleted"),
    themeToggle: $("#themeToggle"),
    filterTabs: $$(".filter-tab"),
  };

  /* ----------------------------------------------------------
     2. UTILITIES
     ---------------------------------------------------------- */

  /** Generate a reasonably unique id (no external libs). */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Escape user content before injecting into HTML. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ----------------------------------------------------------
     3. STORAGE
     ---------------------------------------------------------- */

  /** Load tasks from localStorage. Returns [] on any error. */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Defensive sanitisation of each task shape
      return parsed
        .filter((t) => t && typeof t === "object" && typeof t.title === "string")
        .map((t) => ({
          id: String(t.id || uid()),
          title: String(t.title).slice(0, 200),
          note: String(t.note || "").slice(0, 500),
          completed: Boolean(t.completed),
          createdAt: Number(t.createdAt) || Date.now(),
        }));
    } catch (err) {
      console.warn("TaskFlow: could not load tasks", err);
      return [];
    }
  }

  /** Persist tasks to localStorage. */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn("TaskFlow: could not save tasks", err);
    }
  }

  /* ----------------------------------------------------------
     4. THEME (dark / light) with persistence
     ---------------------------------------------------------- */
  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    els.themeToggle.setAttribute("aria-pressed", String(isDark));
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}

    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(systemDark ? "dark" : "light");
    }

    els.themeToggle.addEventListener("click", () => {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  /* ----------------------------------------------------------
     5. FILTERING
     ---------------------------------------------------------- */

  /** Returns the subset of tasks matching the current filter. */
  function getVisibleTasks() {
    if (currentFilter === "active") return tasks.filter((t) => !t.completed);
    if (currentFilter === "completed") return tasks.filter((t) => t.completed);
    return tasks;
  }

  function setFilter(filter) {
    if (!["all", "active", "completed"].includes(filter)) return;
    currentFilter = filter;

    els.filterTabs.forEach((tab) => {
      const isActive = tab.dataset.filter === filter;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    render();
  }

  /* ----------------------------------------------------------
     6. RENDERING
     ---------------------------------------------------------- */

  /** Build the inner HTML for one task row. */
  function renderTaskHTML(task) {
    const isEditing = task.id === editingId;

    if (isEditing) {
      return `
        <li class="task-item is-editing" data-id="${task.id}">
          <div class="task-body">
            <input
              type="text"
              class="task-edit-input"
              data-edit-title
              value="${escapeHtml(task.title)}"
              maxlength="200"
              aria-label="Edit task title"
            />
            <input
              type="text"
              class="task-edit-note"
              data-edit-note
              value="${escapeHtml(task.note)}"
              placeholder="Add a note (optional)"
              maxlength="500"
              aria-label="Edit task note"
            />
          </div>
          <div class="task-actions" style="opacity:1;">
            <button type="button" class="task-action-btn save-btn"
                    data-action="save" aria-label="Save changes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <button type="button" class="task-action-btn cancel-btn"
                    data-action="cancel" aria-label="Cancel editing">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </li>
      `;
    }

    return `
      <li class="task-item ${task.completed ? "is-completed" : ""}" data-id="${task.id}">
        <label class="task-checkbox">
          <input
            type="checkbox"
            ${task.completed ? "checked" : ""}
            aria-label="Mark '${escapeHtml(task.title)}' as ${task.completed ? "incomplete" : "complete"}"
            data-action="toggle"
          />
          <span class="checkmark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </label>

        <div class="task-body">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${task.note ? `<span class="task-note">${escapeHtml(task.note)}</span>` : ""}
        </div>

        <div class="task-actions">
          <button type="button" class="task-action-btn edit-btn"
                  data-action="edit" aria-label="Edit '${escapeHtml(task.title)}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
          <button type="button" class="task-action-btn delete-btn"
                  data-action="delete" aria-label="Delete '${escapeHtml(task.title)}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </li>
    `;
  }

  /** Update the items-left counter and footer visibility. */
  function renderFooter() {
    const activeCount = tasks.filter((t) => !t.completed).length;
    const completedCount = tasks.length - activeCount;

    els.itemsLeftCount.textContent = String(activeCount);
    els.itemsLeftLabel.textContent = activeCount === 1 ? "item left" : "items left";

    // Disable clear-completed when nothing to clear
    els.clearBtn.disabled = completedCount === 0;

    // Hide footer when there are no tasks at all
    els.footer.hidden = tasks.length === 0;
  }

  /** Update the empty state content based on the current filter. */
  function renderEmptyState(visibleCount) {
    const isFiltered = currentFilter !== "all";
    const isEmpty = visibleCount === 0;

    els.emptyState.hidden = !isEmpty;
    if (!isEmpty) return;

    if (tasks.length === 0) {
      els.emptyTitle.textContent = "No tasks yet";
      els.emptySub.textContent = "Add your first task above to get started.";
    } else if (currentFilter === "active") {
      els.emptyTitle.textContent = "All done!";
      els.emptySub.textContent = "You have no active tasks. Nice work.";
    } else if (currentFilter === "completed") {
      els.emptyTitle.textContent = "Nothing completed";
      els.emptySub.textContent = "Complete a task and it will appear here.";
    } else if (isFiltered) {
      els.emptyTitle.textContent = "No tasks match";
      els.emptySub.textContent = "Try a different filter.";
    }
  }

  /** Re-render the whole task list + footer + empty state. */
  function render() {
    const visible = getVisibleTasks();

    // Rebuild list
    els.taskList.innerHTML = visible.map(renderTaskHTML).join("");

    // Footer
    renderFooter();

    // Empty state
    renderEmptyState(visible.length);

    // If editing, focus the edit input
    if (editingId) {
      const input = els.taskList.querySelector(".task-item.is-editing .task-edit-input");
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  /* ----------------------------------------------------------
     7. ACTIONS
     ---------------------------------------------------------- */

  function addTask(title, note = "") {
    const trimmed = title.trim();
    if (!trimmed) return;

    tasks.push({
      id: uid(),
      title: trimmed,
      note: note.trim(),
      completed: false,
      createdAt: Date.now(),
    });

    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function deleteTask(id) {
    const li = els.taskList.querySelector(`.task-item[data-id="${id}"]`);
    const commit = () => {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      render();
    };

    // Animate out if the row exists, otherwise delete immediately
    if (li) {
      li.classList.add("is-removing");
      li.addEventListener("animationend", commit, { once: true });
      // Fallback in case animation doesn't fire
      setTimeout(commit, 320);
    } else {
      commit();
    }
  }

  function startEdit(id) {
    editingId = id;
    render();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function saveEdit(id) {
    const li = els.taskList.querySelector(`.task-item[data-id="${id}"]`);
    if (!li) return;

    const titleInput = li.querySelector("[data-edit-title]");
    const noteInput = li.querySelector("[data-edit-note]");

    const newTitle = (titleInput?.value || "").trim();
    const newNote = (noteInput?.value || "").trim();

    if (!newTitle) {
      // Empty title — just cancel the edit rather than creating an empty task
      cancelEdit();
      return;
    }

    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.title = newTitle.slice(0, 200);
      task.note = newNote.slice(0, 500);
      saveTasks();
    }

    editingId = null;
    render();
  }

  function clearCompleted() {
    const completedIds = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;

    // Animate each completed row out, then commit
    let remaining = completedIds.length;
    completedIds.forEach((id) => {
      const li = els.taskList.querySelector(`.task-item[data-id="${id}"]`);
      if (li) {
        li.classList.add("is-removing");
        li.addEventListener(
          "animationend",
          () => {
            remaining -= 1;
            if (remaining === 0) commit();
          },
          { once: true }
        );
      } else {
        remaining -= 1;
      }
    });

    const commit = () => {
      tasks = tasks.filter((t) => !t.completed);
      saveTasks();
      render();
    };

    // Safety fallback in case animations don't fire
    setTimeout(() => {
      if (remaining > 0) commit();
    }, 320);
  }

  /* ----------------------------------------------------------
     8. EVENT WIRING
     ---------------------------------------------------------- */

  function initForm() {
    // Enable/disable the add button based on input
    els.input.addEventListener("input", () => {
      els.addBtn.disabled = els.input.value.trim().length === 0;
    });

    // Submit handler (covers Enter + button click)
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = els.input.value;
      if (!title.trim()) return;
      addTask(title);
      els.input.value = "";
      els.addBtn.disabled = true;
      els.input.focus();
    });
  }

  function initFilters() {
    els.filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => setFilter(tab.dataset.filter));
    });
  }

  function initTaskList() {
    // Use event delegation so we don't re-attach listeners on every render
    els.taskList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const li = btn.closest(".task-item");
      if (!li) return;
      const id = li.dataset.id;
      const action = btn.dataset.action;

      if (action === "edit") startEdit(id);
      else if (action === "save") saveEdit(id);
      else if (action === "cancel") cancelEdit();
      else if (action === "delete") deleteTask(id);
    });

    // Toggle checkbox (change event, not click, to respect label behavior)
    els.taskList.addEventListener("change", (e) => {
      const target = e.target;
      if (target && target.matches('input[type="checkbox"][data-action="toggle"]')) {
        const li = target.closest(".task-item");
        if (li) toggleTask(li.dataset.id);
      }
    });

    // Keyboard handling for edit mode
    els.taskList.addEventListener("keydown", (e) => {
      const li = e.target.closest(".task-item.is-editing");
      if (!li) return;
      const id = li.dataset.id;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveEdit(id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    });
  }

  function initFooter() {
    els.clearBtn.addEventListener("click", clearCompleted);
  }

  /* ----------------------------------------------------------
     9. BOOT
     ---------------------------------------------------------- */
    function initInstallPrompt() {
  const banner = document.getElementById("installBanner");
  const confirmBtn = document.getElementById("installConfirm");
  const cancelBtn = document.getElementById("installCancel");
  let deferredPrompt = null;

  if (!banner || !confirmBtn || !cancelBtn) return;

  // ---- 1. If the app is already installed, never show the banner ----
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  ) {
    banner.hidden = true;
    banner.style.display = "none";
    return; // exit early — no install prompt logic needed
  }

  // ---- 2. If the user dismissed the banner before, don't show it ----
  let dismissed = "false";
  try {
    dismissed = localStorage.getItem("taskflow.installDismissed") || "false";
  } catch (err) {}
  if (dismissed === "true") {
    banner.hidden = true;
    banner.style.display = "none";
  }

  // ---- 3. Listen for Chrome's install event ----
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Only show the banner if not dismissed
    if (dismissed !== "true") {
      banner.hidden = false;
      banner.style.display = "flex";
    }
  });

  // ---- 4. Install button ----
  confirmBtn.addEventListener("click", async () => {
    banner.hidden = true;
    banner.style.display = "none";

    if (!deferredPrompt) {
      alert(
        "To install: tap the three dots (⋮) at the top of your browser, then choose 'Install app' or 'Add to Home screen'."
      );
      return;
    }

    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log("Install choice:", choice.outcome);
    } catch (err) {
      alert(
        "Install not available right now. Use the browser menu (⋮) → 'Add to Home screen'."
      );
    }
    deferredPrompt = null;
  });

  // ---- 5. "Not now" button ----
  cancelBtn.addEventListener("click", () => {
    banner.hidden = true;
    banner.style.display = "none";
    try {
      localStorage.setItem("taskflow.installDismissed", "true");
    } catch (err) {}
  });

  // ---- 6. If the app gets installed, hide the banner forever ----
  window.addEventListener("appinstalled", () => {
    banner.hidden = true;
    banner.style.display = "none";
    deferredPrompt = null;
    try {
      localStorage.setItem("taskflow.installDismissed", "true");
    } catch (err) {}
  });
}

  function init() {
    initTheme();
    initForm();
    initFilters();
    initTaskList();
    initFooter();
    initInstallPrompt();

    tasks = loadTasks();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
