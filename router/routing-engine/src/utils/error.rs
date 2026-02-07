use alloy_primitives::Address;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RouterError {
    #[error("No route found from {from} to {to}")]
    NoRouteFound { from: Address, to: Address },

    #[error("Insufficient liquidity: required {required}, available {available}")]
    InsufficientLiquidity { required: String, available: String },

    #[error("Price impact too high: {impact}%")]
    PriceImpactTooHigh { impact: f64 },

    #[error("Invalid token address: {0}")]
    InvalidTokenAddress(String),

    #[error("Invalid amount: {0}")]
    InvalidAmount(String),

    #[error("Pool not found: {0}")]
    PoolNotFound(String),

    #[error("Simulation failed: {0}")]
    SimulationError(String),

    #[error("RPC error: {0}")]
    RpcError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

pub type Result<T> = std::result::Result<T, RouterError>;
