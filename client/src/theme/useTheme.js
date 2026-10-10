import { useSyncExternalStore } from "react";
import { getTheme, getServerTheme, subscribeTheme } from "./themeStore";

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
}
