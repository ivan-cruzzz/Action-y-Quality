/** Motion tokens consumed by the LineChart component (see статистика.txt). */
export const motionTokens = {
  spring: {
    smooth: { visualDuration: 0.48, bounce: 0.18 },
    snappy: { visualDuration: 0.24, bounce: 0.25 },
  },
  duration: {
    instant: 0.12,
    standard: 0.24,
    considered: 0.48,
  },
  ease: {
    standard: [0.22, 1, 0.36, 1],
    inOut: [0.65, 0, 0.35, 1],
  },
};
