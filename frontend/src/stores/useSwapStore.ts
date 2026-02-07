import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Token } from '@/types/token';

interface SwapState {
  // Token selection
  tokenIn: Token | null;
  tokenOut: Token | null;

  // Amounts
  amountIn: string;
  amountOut: string;
  isExactIn: boolean;

  // Settings
  slippageTolerance: number; // Default: 0.5%
  deadline: number; // Default: 20 minutes
  expertMode: boolean;
  multihopEnabled: boolean;

  // Recent tokens
  recentTokens: Token[];
}

interface SwapActions {
  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  switchTokens: () => void;
  setSlippage: (value: number) => void;
  setDeadline: (value: number) => void;
  setExpertMode: (value: boolean) => void;
  setMultihopEnabled: (value: boolean) => void;
  addRecentToken: (token: Token) => void;
  reset: () => void;
}

const initialState: SwapState = {
  tokenIn: null,
  tokenOut: null,
  amountIn: '',
  amountOut: '',
  isExactIn: true,
  slippageTolerance: 0.5,
  deadline: 20,
  expertMode: false,
  multihopEnabled: true,
  recentTokens: [],
};

export const useSwapStore = create<SwapState & SwapActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTokenIn: (token) => {
        const { tokenOut, addRecentToken } = get();
        // If same token selected, switch
        if (tokenOut?.address === token.address) {
          set({ tokenIn: token, tokenOut: get().tokenIn });
        } else {
          set({ tokenIn: token });
        }
        addRecentToken(token);
      },

      setTokenOut: (token) => {
        const { tokenIn, addRecentToken } = get();
        // If same token selected, switch
        if (tokenIn?.address === token.address) {
          set({ tokenOut: token, tokenIn: get().tokenOut });
        } else {
          set({ tokenOut: token });
        }
        addRecentToken(token);
      },

      setAmountIn: (amount) => set({ amountIn: amount, isExactIn: true }),

      setAmountOut: (amount) => set({ amountOut: amount, isExactIn: false }),

      switchTokens: () =>
        set((state) => ({
          tokenIn: state.tokenOut,
          tokenOut: state.tokenIn,
          amountIn: state.amountOut,
          amountOut: state.amountIn,
        })),

      setSlippage: (value) => set({ slippageTolerance: value }),

      setDeadline: (value) => set({ deadline: value }),

      setExpertMode: (value) => set({ expertMode: value }),

      setMultihopEnabled: (value) => set({ multihopEnabled: value }),

      addRecentToken: (token) =>
        set((state) => {
          const filtered = state.recentTokens.filter(
            (t) => t.address !== token.address
          );
          return {
            recentTokens: [token, ...filtered].slice(0, 10),
          };
        }),

      reset: () => set({ ...initialState, recentTokens: get().recentTokens }),
    }),
    {
      name: 'basebook-swap',
      partialize: (state) => ({
        slippageTolerance: state.slippageTolerance,
        deadline: state.deadline,
        expertMode: state.expertMode,
        multihopEnabled: state.multihopEnabled,
        recentTokens: state.recentTokens,
      }),
    }
  )
);
