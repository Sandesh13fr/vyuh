export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "vy-theme";

/** Inline in <head> so the stored theme applies before first paint. Kept out of the client module so the server layout gets the string, not a client reference. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
