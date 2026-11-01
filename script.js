/* ============================================================
   TASKFLOW — MINIMAL TASK MANAGER
   File: script.js
   All logic: add, edit, delete, complete, filter, dates, priorities.
   Vanilla JS only. No frameworks. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     0. CONSTANTS & STATE
     ---------------------------------------------------------- */
  const STORAGE_KEY = "taskflow.tasks.v1";
  const THEME_KEY = "taskflow.theme.v1";

  let tasks = [];
  let currentFilter = "all"; // "all" | "active" | "completed"
  let editingId = null;      // id of the task currently being edited
  let currentPriority = "low"; // "low" | "medium" | "high"

  /* ----------------------------------------------------------
     1. DOM REFERENCES
     ---------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const els = {
    form: $("#addForm"),
    input: $("#taskInput"),
    addBtn: $("#addBtn"),
    dateBtn: $("#dateBtn"),
    dateInput: $("#taskDate"),
    priorityBtn: $("#priorityBtn"),
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
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Format a Date as a short readable string (e.g. "Oct 30") */
  function formatDate(d) {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  /* ----------------------------------------------------------
     3. STORAGE
     ---------------------------------------------------------- */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((t) => t && typeof t === "object" && typeof t.title === "string")
        .map((t) => ({
          id: String(t.id || uid()),
          title: String(t.title).slice(0, 200),
          note: String(t.note || "").slice(0, 500),
          dueDate: String(t.dueDate || ""),
          priority: String(t.priority || "low"),
          completed: Boolean(t.completed),
          createdAt: Number(t.createdAt) || Date.now(),
        }));
    } catch (err) {
      console.warn("TaskFlow: could not load tasks", err);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn("TaskFlow: could not save tasks", err);
    }
  }

  /* ----------------------------------------------------------
     4. THEME
     ---------------------------------------------------------- */
  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    if (els.themeToggle) {
      els.themeToggle.setAttribute("aria-pressed", String(isDark));
    }
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

    if (els.themeToggle) {
      els.themeToggle.addEventListener("click", () => {
        const next = document.body.classList.contains("dark") ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      });
    }
  }

  /* ----------------------------------------------------------
     5. FILTERING
     ---------------------------------------------------------- */
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
  function renderDueDate(dateStr, isCompleted) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    const due = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(due.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    let label = "";
    let cls = "";

    if (isCompleted) {
      label = formatDate(due);
    } else if (diffDays < 0) {
      label = diffDays === -1 ? "Yesterday" : formatDate(due);
      cls = "is-overdue";
    } else if (diffDays === 0) {
      label = "Today";
      cls = "is-today";
    } else if (diffDays === 1) {
      label = "Tomorrow";
    } else if (diffDays < 7) {
      label = due.toLocaleDateString(undefined, { weekday: "long" });
    } else {
      label = formatDate(due);
    }

    return `
      <span class="task-due ${cls}" title="Due ${formatDate(due)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        ${label}
      </span>
    `;
  }

  function renderTaskHTML(task) {
    const isEditing = task.id === editingId;

    if (isEditing) {
      return `
        <li class="task-item is-editing" data-id="${task.id}">
          <div class="task-body">
            <input type="text" class="task-edit-input" data-edit-title value="${escapeHtml(task.title)}" maxlength="200" aria-label="Edit task title" />
            <input type="text" class="task-edit-note" data-edit-note value="${escapeHtml(task.note)}" placeholder="Add a note (optional)" maxlength="500" aria-label="Edit task note" />
            <input type="date" class="task-edit-date" data-edit-date value="${escapeHtml(task.dueDate || "")}" aria-label="Edit due date" />
          </div>
          <div class="task-actions" style="opacity:1;">
            <button type="button" class="task-action-btn save-btn" data-action="save" aria-label="Save changes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </button>
            <button type="button" class="task-action-btn cancel-btn" data-action="cancel" aria-label="Cancel editing">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </li>
      `;
    }

    const dueHtml = task.dueDate ? renderDueDate(task.dueDate, task.completed) : "";
    const priority = task.priority || "low";
    const priorityHtml = priority !== "low"
      ? `<span class="task-priority-dot priority-${priority}" aria-label="${priority} priority"></span>`
      : "";

    return `
      <li class="task-item ${task.completed ? "is-completed" : ""}" data-id="${task.id}">
        <label class="task-checkbox">
          <input type="checkbox" ${task.completed ? "checked" : ""} aria-label="Mark '${escapeHtml(task.title)}' as ${task.completed ? "incomplete" : "complete"}" data-action="toggle" />
          <span class="checkmark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </label>

        <div class="task-body">
          <div class="task-title-row">
            ${priorityHtml}
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>
          ${task.note ? `<span class="task-note">${escapeHtml(task.note)}</span>` : ""}
          ${dueHtml}
        </div>

        <div class="task-actions">
          <button type="button" class="task-action-btn edit-btn" data-action="edit" aria-label="Edit '${escapeHtml(task.title)}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          </button>
          <button type="button" class="task-action-btn delete-btn" data-action="delete" aria-label="Delete '${escapeHtml(task.title)}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
      </li>
    `;
  }

  function renderFooter() {
    const activeCount = tasks.filter((t) => !t.completed).length;
    const completedCount = tasks.length - activeCount;

    if (els.itemsLeftCount) els.itemsLeftCount.textContent = String(activeCount);
    if (els.itemsLeftLabel) els.itemsLeftLabel.textContent = activeCount === 1 ? "item left" : "items left";
    if (els.clearBtn) els.clearBtn.disabled = completedCount === 0;
    if (els.footer) els.footer.hidden = tasks.length === 0;
  }

  function renderEmptyState(visibleCount) {
    const isFiltered = currentFilter !== "all";
    const isEmpty = visibleCount === 0;

    if (els.emptyState) els.emptyState.hidden = !isEmpty;
    if (!isEmpty) return;

    if (tasks.length === 0) {
      if (els.emptyTitle) els.emptyTitle.textContent = "No tasks yet";
      if (els.emptySub) els.emptySub.textContent = "Add your first task above to get started.";
    } else if (currentFilter === "active") {
      if (els.emptyTitle) els.emptyTitle.textContent = "All done!";
      if (els.emptySub) els.emptySub.textContent = "You have no active tasks. Nice work.";
    } else if (currentFilter === "completed") {
      if (els.emptyTitle) els.emptyTitle.textContent = "Nothing completed";
      if (els.emptySub) els.emptySub.textContent = "Complete a task and it will appear here.";
    } else if (isFiltered) {
      if (els.emptyTitle) els.emptyTitle.textContent = "No tasks match";
      if (els.emptySub) els.emptySub.textContent = "Try a different filter.";
    }
  }

  function render() {
    const visible = getVisibleTasks();
    if (els.taskList) els.taskList.innerHTML = visible.map(renderTaskHTML).join("");
    renderFooter();
    renderEmptyState(visible.length);

    if (editingId) {
      const input = els.taskList.querySelector(".task-item.is-editing .task-edit-input");
      if (input) { input.focus(); input.select(); }
    }
  }

  /* ----------------------------------------------------------
     7. ACTIONS
     ---------------------------------------------------------- */
  function addTask(title, note = "", dueDate = "", priority = "low") {
    const trimmed = title.trim();
    if (!trimmed) return;

    tasks.push({
      id: uid(),
      title: trimmed,
      note: note.trim(),
      dueDate: dueDate || "",
      priority: priority || "low",
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

    if (li) {
      li.classList.add("is-removing");
      li.addEventListener("animationend", commit, { once: true });
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
    const dateInput = li.querySelector("[data-edit-date]");

    const newTitle = (titleInput?.value || "").trim();
    const newNote = (noteInput?.value || "").trim();
    const newDate = (dateInput?.value || "").trim();

    if (!newTitle) { cancelEdit(); return; }

    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.title = newTitle.slice(0, 200);
      task.note = newNote.slice(0, 500);
      task.dueDate = newDate;
      saveTasks();
    }

    editingId = null;
    render();
  }

  function clearCompleted() {
    const completedIds = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;

    let remaining = completedIds.length;
    const commit = () => {
      tasks = tasks.filter((t) => !t.completed);
      saveTasks();
      render();
    };

    completedIds.forEach((id) => {
      const li = els.taskList.querySelector(`.task-item[data-id="${id}"]`);
      if (li) {
        li.classList.add("is-removing");
        li.addEventListener("animationend", () => {
          remaining -= 1;
          if (remaining === 0) commit();
        }, { once: true });
      } else {
        remaining -= 1;
      }
    });

    setTimeout(() => { if (remaining > 0) commit(); }, 320);
  }

  /* ----------------------------------------------------------
     8. EVENT WIRING
     ---------------------------------------------------------- */
  function initForm() {
    const priorities = ["low", "medium", "high"];
    
    if (els.input) {
      els.input.addEventListener("input", () => {
        if (els.addBtn) els.addBtn.disabled = els.input.value.trim().length === 0;
      });
    }

    // Date Button
    if (els.dateBtn && els.dateInput) {
      els.dateBtn.addEventListener("click", () => {
        if (typeof els.dateInput.showPicker === "function") {
          els.dateInput.showPicker();
        } else {
          els.dateInput.click();
        }
      });

      els.dateInput.addEventListener("change", () => {
        if (els.dateInput.value) {
          els.dateBtn.classList.add("has-date");
          els.dateBtn.title = "Due: " + els.dateInput.value;
        } else {
          els.dateBtn.classList.remove("has-date");
          els.dateBtn.title = "Set a due date";
        }
      });
    }

    // Priority Button
    if (els.priorityBtn) {
      els.priorityBtn.classList.add("priority-low");
      
      els.priorityBtn.addEventListener("click", () => {
        const idx = priorities.indexOf(currentPriority);
        currentPriority = priorities[(idx + 1) % priorities.length];
        
        els.priorityBtn.classList.remove("priority-low", "priority-medium", "priority-high");
        els.priorityBtn.classList.add("priority-" + currentPriority);
        els.priorityBtn.title = "Priority: " + currentPriority;
      });
    }

    // Form Submit
    if (els.form) {
      els.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = els.input.value;
        const dueDate = els.dateInput ? els.dateInput.value : "";
        if (!title.trim()) return;

        addTask(title, "", dueDate, currentPriority);

        els.input.value = "";
        if (els.dateInput) els.dateInput.value = "";
        if (els.dateBtn) {
          els.dateBtn.classList.remove("has-date");
          els.dateBtn.title = "Set a due date";
        }

        currentPriority = "low";
        if (els.priorityBtn) {
          els.priorityBtn.classList.remove("priority-medium", "priority-high");
          els.priorityBtn.classList.add("priority-low");
          els.priorityBtn.title = "Priority: Low";
        }

        if (els.addBtn) els.addBtn.disabled = true;
        els.input.focus();
      });
    }
  }

  function initFilters() {
    els.filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => setFilter(tab.dataset.filter));
    });
  }

  function initTaskList() {
    if (!els.taskList) return;

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

    els.taskList.addEventListener("change", (e) => {
      const target = e.target;
      if (target && target.matches('input[type="checkbox"][data-action="toggle"]')) {
        const li = target.closest(".task-item");
        if (li) toggleTask(li.dataset.id);
      }
    });

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
    if (els.clearBtn) els.clearBtn.addEventListener("click", clearCompleted);
  }

  function initInstallPrompt() {
    const banner = document.getElementById("installBanner");
    const confirmBtn = document.getElementById("installConfirm");
    const cancelBtn = document.getElementById("installCancel");
    let deferredPrompt = null;

    if (!banner || !confirmBtn || !cancelBtn) return;

    // If already installed, hide forever
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      banner.hidden = true;
      banner.style.display = "none";
      return;
    }

    // Check if user dismissed before
    let dismissed = "false";
    try { dismissed = localStorage.getItem("taskflow.installDismissed") || "false"; } catch (err) {}
    
    if (dismissed === "true") {
      banner.hidden = true;
      banner.style.display = "none";
    }

    // Listen for Chrome's install event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (dismissed !== "true") {
        banner.hidden = false;
        banner.style.display = "flex";
      }
    });

    confirmBtn.addEventListener("click", async () => {
      banner.hidden = true;
      banner.style.display = "none";

      if (!deferredPrompt) {
        alert("To install, tap the three dots (⋮) and choose 'Install app' or 'Add to Home screen'.");
        return;
      }

      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log("Install choice:", choice.outcome);
        deferredPrompt = null;
      } catch (err) {
        alert("Install not available right now. Use the browser menu (⋮) → 'Add to Home screen'.");
      }
    });

    cancelBtn.addEventListener("click", () => {
      banner.hidden = true;
      banner.style.display = "none";
      try { localStorage.setItem("taskflow.installDismissed", "true"); } catch (err) {}
    });

    window.addEventListener("appinstalled", () => {
      banner.hidden = true;
      banner.style.display = "none";
      deferredPrompt = null;
      try { localStorage.setItem("taskflow.installDismissed", "true"); } catch (err) {}
    });
  }

  /* ----------------------------------------------------------
     9. BOOT
     ---------------------------------------------------------- */
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
