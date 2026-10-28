import { explainReason, type ReasonCode } from "@vyuh/shared";
import { ringForCode, ringName } from "@/lib/rings";
import styles from "./ReasonChip.module.css";

export interface ReasonChipProps {
  code: ReasonCode;
  /** Hide the plain-words explanation (tables, tight rows). The code keeps a title tooltip. */
  compact?: boolean;
}

export function ReasonChip({ code, compact = false }: ReasonChipProps) {
  const held = code === "OK";
  const ring = ringForCode(code);
  const words = explainReason(code);
  const where = ring ? `Ring ${ring}, ${ringName(ring)}. ` : "";
  return (
    <span className={`${styles.chip} ${held ? styles.held : styles.blocked}`} title={compact ? where + words : undefined}>
      <span className={styles.dot} aria-hidden="true" />
      <code className={styles.code}>{code}</code>
      {compact ? <span className="visually-hidden">{where + words}</span> : <span className={styles.words}>{words}</span>}
    </span>
  );
}
