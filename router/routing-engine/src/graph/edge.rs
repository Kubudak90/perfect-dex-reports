use alloy_primitives::{Address, U256};
use serde::{Deserialize, Serialize};

/// Represents a pool connecting two tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolEdge {
    pub pool_id: [u8; 32],
    pub token0: Address,
    pub token1: Address,
    pub fee: u32,
    pub tick_spacing: i32,
    pub liquidity: u128,
    pub sqrt_price_x96: U256,
    pub tick: i32,
    pub hook_address: Address,
}

impl PoolEdge {
    pub fn new(
        pool_id: [u8; 32],
        token0: Address,
        token1: Address,
        fee: u32,
        tick_spacing: i32,
        liquidity: u128,
        sqrt_price_x96: U256,
        tick: i32,
    ) -> Self {
        Self {
            pool_id,
            token0,
            token1,
            fee,
            tick_spacing,
            liquidity,
            sqrt_price_x96,
            tick,
            hook_address: Address::ZERO,
        }
    }

    pub fn with_hook(
        pool_id: [u8; 32],
        token0: Address,
        token1: Address,
        fee: u32,
        tick_spacing: i32,
        liquidity: u128,
        sqrt_price_x96: U256,
        tick: i32,
        hook_address: Address,
    ) -> Self {
        Self {
            pool_id,
            token0,
            token1,
            fee,
            tick_spacing,
            liquidity,
            sqrt_price_x96,
            tick,
            hook_address,
        }
    }

    /// Get the other token in the pair
    pub fn other_token(&self, token: Address) -> Option<Address> {
        if token == self.token0 {
            Some(self.token1)
        } else if token == self.token1 {
            Some(self.token0)
        } else {
            None
        }
    }

    /// Check if this pool contains a token
    pub fn contains_token(&self, token: Address) -> bool {
        self.token0 == token || self.token1 == token
    }

    /// Get token direction (true if token is token0)
    pub fn zero_for_one(&self, token_in: Address) -> Option<bool> {
        if token_in == self.token0 {
            Some(true)
        } else if token_in == self.token1 {
            Some(false)
        } else {
            None
        }
    }
}
