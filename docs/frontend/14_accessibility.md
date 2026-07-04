# Accessibility (a11y)

Our accessibility strategy ensures that the application is usable by everyone, not just power users with a mouse.

## 1. Keyboard Navigation
- The **Command Center (Cmd+K)** is the ultimate keyboard navigation tool, allowing users to bypass complex mouse movements entirely.
- All interactive elements (buttons, inputs, tabs) use native HTML elements (e.g., `<button>`) to ensure they are focusable and triggerable via the `Enter` or `Space` keys.

## 2. Semantic HTML
- We use `<aside>` for the sidebar, `<nav>` for navigation links, and `<main>` for the primary content area. This allows screen readers to quickly jump to landmarks.

## 3. Focus Management
- Modals (like `CreateWorkspaceModal`) should trap focus. (Note: Full implementation pending via Radix UI primitives or similar).

## 4. Visual Accessibility
- **Contrast**: The dark theme uses high-contrast text (`#F1F3F9`) against deep dark backgrounds (`#05070B`) ensuring WCAG AA compliance for normal text.
- **Focus Rings**: We use subtle glowing focus rings (`focus:ring-purple-500/50`) rather than removing outlines entirely, ensuring keyboard users can see where they are.
