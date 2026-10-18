export const shellTabs = ["home", "map", "phone"] as const;

export type ShellTab = (typeof shellTabs)[number];

export const shellTabLabels: Record<ShellTab, string> = {
  home: "Home",
  map: "Map",
  phone: "Phone",
};
