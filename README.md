# TaskFlow

**A fast, offline-first task manager that works on any device — no account needed.**

Most task apps require you to sign up, verify an email, and stay connected to the internet just to check off a box. TaskFlow is the opposite. It loads in under a second, works completely offline, and saves everything instantly to your browser. Perfect for low-end devices and people who just want to get things done.

## Features

- ➕ **Add tasks** with an optional note
- ✏️ **Edit tasks** inline (Enter to save, Escape to cancel)
- ✅ **Mark complete** with a smooth strikethrough animation
- 🗑️ **Delete tasks** with a slide-out animation
- 🔍 **Filter tasks** by All, Active, or Completed
- 🔢 **Live counter** showing how many tasks are left
- 🧹 **Clear completed** tasks in one tap
- 🌙 **Dark mode** that remembers your choice
- 💾 **Offline-first** — everything is saved to `localStorage` automatically
- 📱 **Mobile-first design** — looks great on a 360px phone screen

## How to Run It

No installation, no build tools, no server needed.

1. Download or clone this repository.
2. Double-click `index.html` (or open it in any browser).
3. That's it. The app runs entirely in your browser.

To use it on your phone: open `index.html` in Chrome, Firefox, or any mobile browser. You can even add it to your home screen for an app-like experience.

## How It Works

- **HTML** (`index.html`) — the page structure and layout.
- **CSS** (`style.css`) — all styling, including light/dark themes, animations, and responsive rules.
- **JavaScript** (`script.js`) — all behavior: adding, editing, deleting, filtering, and saving to `localStorage`.

Tasks are stored as a JSON array under the key `taskflow.tasks.v1`. Your theme preference is stored separately under `taskflow.theme.v1`.

## What I Learned Building This

- **State management without a framework.** Without React, I had to think carefully about where the source of truth lives (a single `tasks` array), how to sync it to the DOM, and how to avoid stale references. Event delegation on the task list was key to keeping things clean.
- **Accessibility is design.** Using real `<input type="checkbox">` elements (visually hidden but still focusable) instead of clickable `<div>`s meant keyboard users could toggle tasks without me writing a single line of extra JS. Focus rings and `aria-labels` weren't an afterthought — they shaped the markup.
- **Animations need to feel invisible.** The slide-in, slide-out, and strikethrough transitions are all under 300ms. Anything slower feels sluggish; anything faster feels jarring. I ended up matching the easing curves to the underlying physics of a falling object.
- **Small details matter.** Disabling the Add button when the input is empty, hiding the footer when there are no tasks, showing a different empty-state message for each filter — these tiny touches are what separate a demo from a product.

## License

This project is free to use and adapt. No attribution needed — just build something good with it.

---

**Built by [Mustapha Ambali](https://github.com/mustaphyambal-maker)** — Website & App Developer.
