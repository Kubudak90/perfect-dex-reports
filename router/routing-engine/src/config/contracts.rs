use serde::{Deserialize, Serialize};

/// BaseBook DEX Smart Contract Addresses
/// Chain: Base (8453)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractAddresses {
    /// PoolManager contract address (Singleton)
    /// The core contract managing all liquidity pools
    pub pool_manager: &'static str,

    /// SwapRouter contract address
    /// Handles swap execution through pools
    pub swap_router: &'static str,

    /// PositionManager contract address
    /// Manages LP positions (NFTs)
    pub position_manager: &'static str,

    /// Quoter contract address
    /// Provides swap quotes (view functions)
    pub quoter: &'static str,
}

impl Default for ContractAddresses {
    fn default() -> Self {
        Self::base_mainnet()
    }
}

impl ContractAddresses {
    /// Base mainnet contract addresses
    pub fn base_mainnet() -> Self {
        Self {
            pool_manager: "0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05",
            swap_router: "0xFf438e2d528F55fD1141382D1eB436201552d1A5",
            position_manager: "0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA",
            quoter: "0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b",
        }
    }

    /// Base testnet contract addresses
    pub fn base_testnet() -> Self {
        Self {
            pool_manager: "0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05",
            swap_router: "0xFf438e2d528F55fD1141382D1eB436201552d1A5",
            position_manager: "0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA",
            quoter: "0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b",
        }
    }

    /// Get contract addresses for a specific chain
    pub fn for_chain(chain_id: u64) -> Option<Self> {
        match chain_id {
            8453 => Some(Self::base_mainnet()),
            84532 => Some(Self::base_testnet()), // Base Sepolia
            _ => None,
        }
    }

    /// Validate that all addresses are non-zero
    pub fn validate(&self) -> Result<(), String> {
        let zero_address = "0x0000000000000000000000000000000000000000";

        if self.pool_manager == zero_address {
            return Err("PoolManager address not set".to_string());
        }

        if self.swap_router == zero_address {
            return Err("SwapRouter address not set".to_string());
        }

        if self.position_manager == zero_address {
            return Err("PositionManager address not set".to_string());
        }

        if self.quoter == zero_address {
            return Err("Quoter address not set".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_mainnet_addresses() {
        let contracts = ContractAddresses::base_mainnet();
        assert_eq!(
            contracts.pool_manager,
            "0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05"
        );
    }

    #[test]
    fn test_for_chain() {
        let contracts = ContractAddresses::for_chain(8453);
        assert!(contracts.is_some());

        let contracts = ContractAddresses::for_chain(1); // Ethereum mainnet
        assert!(contracts.is_none());
    }

    #[test]
    fn test_validate() {
        let contracts = ContractAddresses::base_mainnet();
        assert!(contracts.validate().is_ok());
    }
}
