# Repository Guidelines

## Project Structure & Module Organization
This repository is a small static web app with a flat layout:

- `index.html` defines the UI, templates, and CDN script/style includes.
- `app.js` contains all application logic, state management, local storage handling, import/export, and chart rendering.
- `style.css` holds custom styles layered on top of Bootstrap.

Keep related changes together: UI markup in `index.html`, behavior in `app.js`, and presentation in `style.css`.

## Build, Test, and Development Commands
There is no build step or package manager setup in this repo.

- `start index.html` opens the app directly on Windows.
- `python -m http.server 8000` serves the app locally at `http://localhost:8000` for safer browser testing.
- `git status` reviews your working tree before opening a pull request.

The app depends on CDN-hosted Bootstrap, Bootstrap Icons, and Chart.js, so a network connection is needed when loading the page.

## Coding Style & Naming Conventions
Use the existing style consistently:

- Indent with 2 spaces in HTML, CSS, and JavaScript.
- Use `camelCase` for variables and functions, e.g. `renderWorkoutTables`.
- Use `UPPER_SNAKE_CASE` for constants, e.g. `WORKOUT_STORAGE_KEY`.
- Use descriptive `kebab-case` for CSS classes and HTML ids, e.g. `exercise-grid`.

Prefer small helper functions over duplicated logic, and keep DOM references centralized in the `dom` object.

## Testing Guidelines
There is currently no automated test suite. Validate changes manually in the browser:

- Create and save a workout.
- Copy/autofill from a previous workout.
- Export and re-import workout history.
- Confirm summary metrics and the weekly chart update correctly.

If you add tests later, place them in a dedicated `tests/` folder and keep filenames aligned with the feature under test.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `Initialize repository` and `change UI to bootstrap`. Follow that pattern with focused messages under ~72 characters.

Pull requests should include:

- a brief summary of the user-facing change,
- any manual test steps performed,
- screenshots or short recordings for UI changes,
- links to related issues, if applicable.

## Security & Configuration Tips
Do not commit real user workout exports or browser storage dumps. When changing persistence or import logic, preserve backward compatibility for existing `localStorage` keys unless a migration is intentional.
