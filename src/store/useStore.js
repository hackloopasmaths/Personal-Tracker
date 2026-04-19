import { create } from 'zustand';

export const useStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  todayDraft: {},
  setTodayDraft: (updates) =>
    set((state) => ({
      todayDraft: { ...state.todayDraft, ...updates },
    })),

  userProfile: null,
  setUserProfile: (userProfile) => set({ userProfile }),

  isLogModalOpen: false,
  setLogModalOpen: (open) => set({ isLogModalOpen: open }),

  xpToast: null,
  setXpToast: (xpToast) => set({ xpToast }),
}));
