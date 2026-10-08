import { MorphLoader } from "@/components/arc/morph-loader/morph-loader";
import styles from "./board-loader.module.css";

/** The wait while monday answers: one loader in the page's place, with what it is waiting for in words. */
export function BoardLoader({ label = "Loading the board from monday" }: { label?: string }) {
  return (
    <div className={styles.root}>
      <MorphLoader variant="ring" size={32} label={label} decorative />
      <p className={styles.label} role="status">{label}</p>
    </div>
  );
}
