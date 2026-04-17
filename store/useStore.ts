import { create } from 'zustand';

interface MediaState {
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null) => void;
}

export const useStore = create<MediaState>((set) => ({
  activeVideoId: null,
  setActiveVideoId: (id) => set({ activeVideoId: id }),
}));
