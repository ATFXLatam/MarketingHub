import Image from "next/image";
import styles from "./monday-sign-in.module.css";

/** Both artworks ship and the theme picks one in CSS, so the logo never flashes the wrong color before hydration. */
export function AtfxLogo() {
  return (
    <span className={styles.logo}>
      <Image className={styles.logoLight} src="/brand/atfx-dark.png" alt="ATFX" width={78} height={24} priority />
      <Image className={styles.logoDark} src="/brand/atfx-white.png" alt="" width={78} height={24} priority />
    </span>
  );
}
