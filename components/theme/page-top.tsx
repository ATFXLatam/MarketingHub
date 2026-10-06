import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { ThemeToggle } from "./theme-toggle";
import styles from "./page-top.module.css";

/** Page title and the theme switch, shared by every page so the toggle always sits in the same place. */
export function PageTop({ title }: { title: string }) {
  return (
    <header className={styles.top}>
      <InViewTitle as="h1" text={title} variant="blur" className={styles.title} />
      <ThemeToggle />
    </header>
  );
}
