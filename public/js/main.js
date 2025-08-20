// year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// --- Dark mode ----------------------------------------------------
const root = document.documentElement; // <html>
const DARK_KEY = "myspacex:dark";

function setDark(on) {
  root.classList.toggle("dark", on);
  try { localStorage.setItem(DARK_KEY, on ? "1" : "0"); } catch {}
}

// initial (persisted) preference or OS preference
(() => {
  let on = false;
  try { on = localStorage.getItem(DARK_KEY) === "1"; } catch {}
  if (!on) {
    // if no saved choice, follow system
    on = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  setDark(on);
})();

// toggle buttons
function wireDarkToggle(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => setDark(!root.classList.contains("dark")));
}
wireDarkToggle(document.getElementById("dark-toggle"));
wireDarkToggle(document.getElementById("dark-toggle-mobile"));

// --- Mobile menu --------------------------------------------------
function wireMenu() {
  const btn  = document.getElementById("mobile-menu-button");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("hidden") === false;
    btn.setAttribute("aria-expanded", String(isOpen));
    // swap icon (hamburger ↔ close)
    btn.innerHTML = isOpen
      ? `<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <path stroke-linecap="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
         </svg>`
      : `<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <path stroke-linecap="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
         </svg>`;
  });
}
wireMenu();

// --- Scroll-reveal (IntersectionObserver) -------------------------
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("reveal-active");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
