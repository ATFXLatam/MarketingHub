/** monday.com's mark in its own colors, so the sign-in button reads as theirs at a glance. */
export function MondayMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 256 154" aria-hidden="true" focusable="false">
      <path fill="#F62B54" d="M31.85 153.49a31.9 31.9 0 0 1-27.86-16.17 31.36 31.36 0 0 1 .87-31.82L62.23 15.4A32.13 32.13 0 0 1 90.56.01a31.59 31.59 0 0 1 27.41 16.9 31.24 31.24 0 0 1-1.73 31.77L58.9 138.78a31.71 31.71 0 0 1-27.05 14.71Z" />
      <path fill="#FFCC00" d="M130.26 153.49a31.75 31.75 0 0 1-27.81-16.13 31.33 31.33 0 0 1 .87-31.74l57.27-89.89A32.04 32.04 0 0 1 188.93.01a31.79 31.79 0 0 1 27.59 17 31.17 31.17 0 0 1-2.06 31.92l-57.26 89.89a31.77 31.77 0 0 1-26.94 14.67Z" />
      <ellipse fill="#00CA72" cx="226.47" cy="125.32" rx="29.54" ry="28.92" />
    </svg>
  );
}
