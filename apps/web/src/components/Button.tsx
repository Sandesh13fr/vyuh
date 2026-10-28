import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  /** Render the child element (e.g. a Link) with button styling. */
  asChild?: boolean;
}

export function Button({ variant = "primary", size = "md", asChild, className, type, ...rest }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const cls = [styles.button, styles[variant], size === "sm" && styles.sm, className].filter(Boolean).join(" ");
  return <Comp className={cls} type={asChild ? undefined : (type ?? "button")} {...rest} />;
}
