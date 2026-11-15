import { useWindowDimensions } from 'react-native';

/**
 * Returns the number of grid columns for product cards based on screen width.
 *
 * xs  < 480  → 2 cols
 * sm  480–639 → 3 cols
 * md  640–1023 → 4 cols
 * lg  1024–1279 → 5 cols
 * xl+ ≥ 1280  → 6 cols
 */
export function useColumns(): number {
    const { width } = useWindowDimensions();
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 640)  return 4;
    if (width >= 480)  return 3;
    return 2;
}
