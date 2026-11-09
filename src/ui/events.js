/**
 * Event delegation. Markup declares intent with data attributes and handlers are looked up by name:
 *   data-act="name"     → handlers.click[name](el, event)
 *   data-change="name"  → handlers.change[name](el, event)
 *   data-input="name"   → handlers.input[name](el, event)
 *   <form data-submit="name"> → handlers.submit[name](form, event)
 */
export function bindEvents(handlers, { onKeydown } = {}) {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    handlers.click[el.dataset.act]?.(el, e);
  });
  document.addEventListener('change', (e) => {
    const name = e.target.dataset?.change;
    if (name) handlers.change[name]?.(e.target, e);
  });
  document.addEventListener('input', (e) => {
    const name = e.target.dataset?.input;
    if (name) handlers.input[name]?.(e.target, e);
  });
  document.addEventListener('submit', (e) => {
    const name = e.target.dataset?.submit;
    if (name && handlers.submit[name]) {
      e.preventDefault();
      handlers.submit[name](e.target, e);
    }
  });
  if (onKeydown) document.addEventListener('keydown', onKeydown);
}
