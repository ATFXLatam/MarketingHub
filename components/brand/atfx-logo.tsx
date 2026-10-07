import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./atfx-logo.module.css";

const RATIO = 285 / 88;

/** Both artworks ship and the theme picks one in CSS, so the logo never flashes the wrong color before hydration. */
export function AtfxLogo({ height = 24 }: { height?: number }) {
  const width = Math.round(height * RATIO);
  return (
    <span className={styles.logo} style={{ "--logo-height": `${height}px`, "--logo-width": `${width}px` } as CSSProperties}>
      <Image className={styles.light} src="/brand/atfx-dark.png" alt="ATFX" width={width} height={height} priority />
      <Image className={styles.dark} src="/brand/atfx-white.png" alt="" width={width} height={height} priority />
    </span>
  );
}
