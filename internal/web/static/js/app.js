// Small progressive enhancements on top of htmx. Listeners live on document
// so they survive hx-boost swapping the page body.
(() => {
  "use strict";

  // Toasts: shown from server flashes and from HX-Trigger {"toast": {...}}.
  const dismissLater = (el) => {
    setTimeout(() => {
      el.classList.add("toast-hide");
      setTimeout(() => el.remove(), 300);
    }, 4000);
  };

  const showToast = ({ kind = "success", message = "" } = {}) => {
    const container = document.getElementById("toasts");
    if (!container || !message) return;
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.setAttribute("role", "status");
    el.textContent = message;
    container.append(el);
    dismissLater(el);
  };

  document.addEventListener("toast", (e) => showToast(e.detail));

  // Auto-dismiss server-rendered toasts on first load and after boosted swaps.
  htmx.onLoad((el) => {
    if (el.matches?.(".toast")) dismissLater(el);
    el.querySelectorAll?.(".toast").forEach(dismissLater);
  });

  // Dialogs: <button data-open-dialog="id"> and <button data-close-dialog>.
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-dialog]");
    if (opener) {
      document.getElementById(opener.dataset.openDialog)?.showModal();
      return;
    }
    if (e.target.closest("[data-close-dialog]")) {
      e.target.closest("dialog")?.close();
    }
  });

  // Sent by the server after a dialog form succeeds.
  document.addEventListener("close-dialog", () => {
    document.querySelectorAll("dialog[open]").forEach((d) => {
      d.close();
      d.querySelector("form")?.reset();
    });
  });

  // API docs: run an example request with the signed-in user's key.
  document.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-api-run]");
    if (!button) return;
    const key = document.getElementById("api-docs")?.dataset.apiKey;
    const output = document.getElementById(button.dataset.output);
    if (!key || !output) return;

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      const res = await fetch(button.dataset.apiRun, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      output.firstElementChild.textContent = JSON.stringify({ status: res.status, response: body }, null, 2);
    } catch (err) {
      output.firstElementChild.textContent = String(err);
    } finally {
      output.hidden = false;
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
})();
