import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Address } from 'viem';

export type TransactionType =
  | 'swap'
  | 'addLiquidity'
  | 'removeLiquidity'
  | 'collect'
  | 'approve';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
  hash: Address;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number;
  chainId: number;

  // Swap specific
  tokenIn?: Address;
  tokenOut?: Address;
  amountIn?: string;
  amountOut?: string;

  // UI
  summary: string;
}

interface TransactionState {
  transactions: Transaction[];
}

interface TransactionActions {
  addTransaction: (tx: Omit<Transaction, 'status' | 'timestamp'>) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  removeTransaction: (hash: string) => void;
  clearAll: () => void;
  getPendingTransactions: () => Transaction[];
  getRecentTransactions: (limit?: number) => Transaction[];
}

export const useTransactionStore = create<TransactionState & TransactionActions>()(
  persist(
    (set, get) => ({
      transactions: [],

      addTransaction: (tx) => {
        const newTx: Transaction = {
          ...tx,
          status: 'pending',
          timestamp: Date.now(),
        };

        set((state) => ({
          transactions: [newTx, ...state.transactions],
        }));
      },

      updateTransaction: (hash, updates) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, ...updates } : tx
          ),
        }));
      },

      removeTransaction: (hash) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.hash !== hash),
        }));
      },

      clearAll: () => {
        set({ transactions: [] });
      },

      getPendingTransactions: () => {
        return get().transactions.filter((tx) => tx.status === 'pending');
      },

      getRecentTransactions: (limit = 10) => {
        return get()
          .transactions.slice(0, limit)
          .sort((a, b) => b.timestamp - a.timestamp);
      },
    }),
    {
      name: 'basebook-transactions',
      version: 1,
    }
  )
);
