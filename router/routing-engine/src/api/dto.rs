use alloy_primitives::Address;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: String,
    #[serde(default = "default_slippage")]
    pub slippage: f64,
    pub max_hops: Option<usize>,
    pub max_splits: Option<usize>,
}

fn default_slippage() -> f64 {
    0.5
}

#[derive(Debug, Serialize)]
pub struct QuoteResponse {
    pub quote: crate::routing::Quote,
    pub timestamp: u64,
    pub cached: bool,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub chain_id: u64,
    pub graph_stats: GraphStatsDto,
}

#[derive(Debug, Serialize)]
pub struct GraphStatsDto {
    pub token_count: usize,
    pub pool_count: usize,
    pub last_update: u64,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}
