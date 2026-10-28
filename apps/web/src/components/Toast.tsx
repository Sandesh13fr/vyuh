"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { Cross2Icon } from "@radix-ui/react-icons";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "neutral" | "held" | "blocked";
}

type Notify = (t: ToastInput) => void;

const ToastContext = createContext<Notify>(() => {
  throw new Error("useToast must be used inside <ToastProvider>");
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastInput & { id: number })[]>([]);

  const notify = useCallback<Notify>((t) => {
    setToasts((list) => [...list.slice(-3), { ...t, id: Date.now() + Math.random() }]);
  }, []);

  const drop = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={notify}>
      <RadixToast.Provider swipeDirection="right" duration={6000}>
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={`${styles.toast} ${styles[t.tone ?? "neutral"]}`}
            type={t.tone === "blocked" ? "foreground" : "background"}
            onOpenChange={(open) => !open && drop(t.id)}
          >
            <RadixToast.Title className={styles.title}>{t.title}</RadixToast.Title>
            {t.description && <RadixToast.Description className={styles.desc}>{t.description}</RadixToast.Description>}
            <RadixToast.Close className={styles.close} aria-label="Dismiss">
              <Cross2Icon aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
