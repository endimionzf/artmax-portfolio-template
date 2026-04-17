import { create } from 'zustand';

interface MediaState {
  activeVideoId: number | null;
  setActiveVideoId: (id: number | null) => void;
}

export const useStore = create<MediaState>((set) => ({
  activeVideoId: null,
  setActiveVideoId: (id) => set({ activeVideoId: id }),
}));
