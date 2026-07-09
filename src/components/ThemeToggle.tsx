"use client";
import { useEffect, useState } from "react";

// Alterna entre tema escuro (padrão) e claro. Persiste em localStorage e
// aplica data-theme no <html>. O flash inicial é evitado pelo script no layout.
export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    try {
      if (next) {
        document.documentElement.dataset.theme = "light";
        localStorage.setItem("theme", "light");
      } else {
        delete document.documentElement.dataset.theme;
        localStorage.setItem("theme", "dark");
      }
    } catch { /* ignore */ }
  };

  return (
    <button type="button" onClick={toggle}
      title={light ? "Mudar para tema escuro" : "Mudar para tema claro"}
      aria-label="Alternar tema"
      className="text-white/40 hover:text-white/70 transition-colors p-1.5 rounded-lg flex items-center">
      {light ? (
        // lua (indica que um clique vai para o escuro)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // sol (indica que um clique vai para o claro)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
