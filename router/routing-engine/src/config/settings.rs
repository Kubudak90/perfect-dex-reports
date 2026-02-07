use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
    pub chain: ChainSettings,
    pub routing: RoutingSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSettings {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainSettings {
    pub chain_id: u64,
    pub rpc_url: String,
    pub pool_manager: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingSettings {
    pub max_hops: usize,
    pub max_splits: usize,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server: ServerSettings {
                host: "0.0.0.0".to_string(),
                port: 3001,
            },
            chain: ChainSettings {
                chain_id: 8453, // Base mainnet
                rpc_url: "https://mainnet.base.org".to_string(),
                pool_manager: "0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05".to_string(),
            },
            routing: RoutingSettings {
                max_hops: 4,
                max_splits: 3,
            },
        }
    }
}

impl Settings {
    pub fn load() -> Self {
        // Load from environment or config file
        // For now, return defaults
        Self::default()
    }
}
