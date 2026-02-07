use alloy_primitives::Address;
use serde::{Deserialize, Serialize};

/// Represents a token in the graph
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct TokenNode {
    pub address: Address,
    pub symbol: String,
    pub decimals: u8,
    pub is_native: bool,
}

impl TokenNode {
    pub fn new(address: Address, symbol: String, decimals: u8) -> Self {
        Self {
            address,
            symbol,
            decimals,
            is_native: false,
        }
    }

    pub fn native(address: Address, symbol: String, decimals: u8) -> Self {
        Self {
            address,
            symbol,
            decimals,
            is_native: true,
        }
    }
}
