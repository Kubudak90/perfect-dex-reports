
/// Fixed-point Q96 constant for price calculations
pub const Q96: u128 = 1u128 << 96;

/// Maximum number of hops allowed in a route
pub const MAX_HOPS: usize = 4;

/// Maximum number of splits allowed
pub const MAX_SPLITS: usize = 3;

/// Minimum liquidity threshold (1 token)
pub const MIN_LIQUIDITY: u128 = 1_000_000_000_000_000_000;

/// Common addresses
pub mod addresses {
    use alloy_primitives::{address, Address};

    /// WETH on Base
    pub fn weth() -> Address {
        address!("4200000000000000000000000000000000000006")
    }

    /// USDC on Base
    pub fn usdc() -> Address {
        address!("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
    }
}

/// Helper to create an Address from a u64 value (for tests).
/// Places the value in the last 8 bytes (big-endian), matching
/// the old `Address::from_low_u64_be` behaviour from ethers-rs.
pub fn address_from_u64(n: u64) -> alloy_primitives::Address {
    let mut bytes = [0u8; 20];
    bytes[12..20].copy_from_slice(&n.to_be_bytes());
    alloy_primitives::Address::from(bytes)
}

/// Helper functions for U256
pub mod u256_ext {
    use alloy_primitives::U256;

    pub fn to_f64(value: U256) -> f64 {
        let mut result = 0.0;
        let mut multiplier = 1.0;

        for word in value.as_limbs().iter() {
            result += (*word as f64) * multiplier;
            multiplier *= 2.0_f64.powi(64);
        }

        result
    }

    pub fn from_f64(value: f64) -> U256 {
        U256::from((value as u128).min(u128::MAX))
    }
}
