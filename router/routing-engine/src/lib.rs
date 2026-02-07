//! BaseBook DEX Routing Engine
//!
//! High-performance smart router for optimal swap path finding,
//! including multi-hop routing, split routing, and gas-aware optimization.

pub mod api;
pub mod cache;
pub mod config;
pub mod graph;
pub mod routing;
pub mod simulation;
pub mod sync;
pub mod utils;

// Re-exports for convenience
pub use graph::{PoolEdge, PoolGraph, TokenNode};
pub use routing::{Quote, Route, RouteHop, Router, SplitRoute};
pub use simulation::SwapSimulator;

pub use utils::error::{Result, RouterError};
pub use utils::types::*;

#[cfg(test)]
mod tests {
    #[test]
    fn test_basic() {
        // Basic sanity test
        assert_eq!(2 + 2, 4);
    }
}
