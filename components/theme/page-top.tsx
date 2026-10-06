import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { ThemeToggle } from "./theme-toggle";
import styles from "./page-top.module.css";

interface PageTopProps {
  title: string;
  description?: string;
  /** Pages inside the app shell already offer the theme in the account menu. */
  showToggle?: boolean;
}

export function PageTop({ title, description, showToggle = true }: PageTopProps) {
  return (
    <header className={styles.top}>
      <div className={styles.text}>
        <InViewTitle as="h1" text={title} variant="blur" className={styles.title} />
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {showToggle && <ThemeToggle />}
    </header>
  );
}
