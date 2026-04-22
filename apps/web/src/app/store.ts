import { create } from "zustand";

type AppStore = {
  commandInput: string;
  commandOpen: boolean;
  closeCommand: () => void;
  openCommand: () => void;
  setCommandInput: (value: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  commandInput: "",
  commandOpen: false,
  closeCommand: () => set({ commandInput: "", commandOpen: false }),
  openCommand: () => set({ commandOpen: true }),
  setCommandInput: (commandInput) => set({ commandInput }),
}));
