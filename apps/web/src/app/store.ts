import { create } from "zustand";

import type { OperatingMode } from "@signal-console/domain";

type AppStore = {
  mode: OperatingMode;
  commandOpen: boolean;
  commandInput: string;
  setMode: (mode: OperatingMode) => void;
  openCommand: () => void;
  closeCommand: () => void;
  setCommandInput: (value: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  mode: "demo",
  commandOpen: false,
  commandInput: "",
  setMode: (mode) => set({ mode }),
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false, commandInput: "" }),
  setCommandInput: (commandInput) => set({ commandInput }),
}));
