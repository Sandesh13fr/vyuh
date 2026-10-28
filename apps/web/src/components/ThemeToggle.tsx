"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { THEME_KEY, type ThemeChoice as Theme } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: DesktopIcon },
] as const;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === "light" || t === "dark" ? t : "system");
  }, []);

  const Current = OPTIONS.find((o) => o.value === theme)?.Icon ?? DesktopIcon;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className={styles.trigger} aria-label={`Theme: ${theme}. Change theme`}>
        <Current aria-hidden="true" />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className={styles.menu} align="end" sideOffset={6}>
          <Dropdown.RadioGroup
            value={theme}
            onValueChange={(v) => {
              const next = v as Theme;
              setTheme(next);
              apply(next);
            }}
          >
            {OPTIONS.map(({ value, label, Icon }) => (
              <Dropdown.RadioItem key={value} value={value} className={styles.item}>
                <Icon aria-hidden="true" />
                {label}
                <Dropdown.ItemIndicator className={styles.indicator}>•</Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
