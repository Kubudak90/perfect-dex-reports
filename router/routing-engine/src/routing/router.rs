use crate::cache::EnhancedRouteCache;
use crate::graph::PoolGraph;
use crate::routing::multi_hop::{find_best_multi_hop_route, find_top_routes};
use crate::routing::parallel::find_best_route_parallel;
use crate::routing::single_hop::find_best_single_hop_route;
use crate::routing::split::optimize_split_route;
use crate::routing::{Quote, Route, SplitRoute};
use crate::utils::{Result, MAX_HOPS, MAX_SPLITS};
use alloy_primitives::{Address, U256};
use std::sync::Arc;
use std::time::Instant;

/// Router configuration
#[derive(Debug, Clone)]
pub struct RouterConfig {
    pub enable_cache: bool,
    pub enable_parallel: bool,
    pub cache_ttl_seconds: u64,
    pub max_routes_cached: usize,
    pub max_quotes_cached: usize,
}

impl Default for RouterConfig {
    fn default() -> Self {
        Self {
            enable_cache: true,
            enable_parallel: true,
            cache_ttl_seconds: 15,
            max_routes_cached: 1000,
            max_quotes_cached: 2000,
        }
    }
}

/// Main router struct with performance optimizations
pub struct Router {
    graph: Arc<PoolGraph>,
    cache: Arc<EnhancedRouteCache>,
    config: RouterConfig,
}

impl Router {
    pub fn new(graph: Arc<PoolGraph>) -> Self {
        Self::with_config(graph, RouterConfig::default())
    }

    pub fn with_config(graph: Arc<PoolGraph>, config: RouterConfig) -> Self {
        let cache = Arc::new(EnhancedRouteCache::new(
            config.max_routes_cached,
            config.max_quotes_cached,
            config.cache_ttl_seconds,
        ));

        Self {
            graph,
            cache,
            config,
        }
    }

    /// Find the best route for a swap with caching
    ///
    /// Automatically selects the best strategy:
    /// - Single-hop for max_hops = 1
    /// - Parallel evaluation for max_hops > 2 (if enabled)
    /// - Sequential evaluation otherwise
    pub async fn find_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        max_hops: Option<usize>,
    ) -> Result<Route> {
        let max_hops = max_hops.unwrap_or(MAX_HOPS);
        let start = Instant::now();

        // Check cache first
        if self.config.enable_cache {
            if let Some(cached) = self.cache.get_route(token_in, token_out, amount_in, max_hops) {
                tracing::debug!("Cache hit for route in {:?}", start.elapsed());
                return Ok(cached);
            }
        }

        // Compute route
        let route = if max_hops == 1 {
            // Single-hop optimization
            find_best_single_hop_route(&self.graph, token_in, token_out, amount_in)?
        } else if self.config.enable_parallel && max_hops > 2 {
            // Parallel evaluation for multi-hop
            find_best_route_parallel(self.graph.clone(), token_in, token_out, amount_in, max_hops)
                .ok_or_else(|| crate::utils::RouterError::NoRouteFound {
                    from: token_in,
                    to: token_out,
                })?
        } else {
            // Try single-hop first
            if let Ok(single_hop) =
                find_best_single_hop_route(&self.graph, token_in, token_out, amount_in)
            {
                // Check if multi-hop can beat it
                if let Ok(multi_hop) =
                    find_best_multi_hop_route(&self.graph, token_in, token_out, amount_in, max_hops)
                {
                    if multi_hop.total_amount_out > single_hop.total_amount_out {
                        multi_hop
                    } else {
                        single_hop
                    }
                } else {
                    single_hop
                }
            } else {
                find_best_multi_hop_route(&self.graph, token_in, token_out, amount_in, max_hops)?
            }
        };

        // Cache result
        if self.config.enable_cache {
            self.cache
                .insert_route(token_in, token_out, amount_in, max_hops, route.clone());
        }

        tracing::debug!("Route found in {:?}", start.elapsed());
        Ok(route)
    }

    /// Find the best route with split support
    pub async fn find_split_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        max_hops: Option<usize>,
        max_splits: Option<usize>,
    ) -> Result<SplitRoute> {
        let max_hops = max_hops.unwrap_or(MAX_HOPS);
        let max_splits = max_splits.unwrap_or(MAX_SPLITS);
        let start = Instant::now();

        // Check cache
        if self.config.enable_cache {
            if let Some(cached) =
                self.cache
                    .get_split_route(token_in, token_out, amount_in, max_hops)
            {
                tracing::debug!("Cache hit for split route in {:?}", start.elapsed());
                return Ok(cached);
            }
        }

        // For small amounts, single route is better
        let min_split_amount = U256::from(100_000_000_000_000_000u128);
        if amount_in < min_split_amount {
            let route = self
                .find_route(token_in, token_out, amount_in, Some(max_hops))
                .await?;
            return Ok(SplitRoute::single(route));
        }

        // Find top routes
        let top_routes = find_top_routes(
            &self.graph,
            token_in,
            token_out,
            amount_in,
            max_hops,
            max_splits * 2,
        );

        if top_routes.is_empty() {
            let route = self
                .find_route(token_in, token_out, amount_in, Some(max_hops))
                .await?;
            return Ok(SplitRoute::single(route));
        }

        // Optimize split
        let split_route = optimize_split_route(top_routes, amount_in)?;

        // Cache result
        if self.config.enable_cache {
            self.cache.insert_split_route(
                token_in,
                token_out,
                amount_in,
                max_hops,
                split_route.clone(),
            );
        }

        tracing::debug!("Split route found in {:?}", start.elapsed());
        Ok(split_route)
    }

    /// Get a quote for a swap
    pub async fn get_quote(
        &self,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        slippage: f64,
        max_hops: Option<usize>,
    ) -> Result<Quote> {
        let max_hops = max_hops.unwrap_or(MAX_HOPS);
        let start = Instant::now();

        // Check cache
        if self.config.enable_cache {
            if let Some(cached) =
                self.cache
                    .get_quote(token_in, token_out, amount_in, slippage, max_hops)
            {
                tracing::debug!("Cache hit for quote in {:?}", start.elapsed());
                return Ok(cached);
            }
        }

        let route = self
            .find_route(token_in, token_out, amount_in, Some(max_hops))
            .await?;
        let quote = Quote::from_route(SplitRoute::single(route), slippage);

        // Cache result
        if self.config.enable_cache {
            self.cache
                .insert_quote(token_in, token_out, amount_in, slippage, max_hops, quote.clone());
        }

        tracing::debug!("Quote generated in {:?}", start.elapsed());
        Ok(quote)
    }

    /// Get a quote with split routing
    pub async fn get_split_quote(
        &self,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        slippage: f64,
        max_hops: Option<usize>,
        max_splits: Option<usize>,
    ) -> Result<Quote> {
        let split_route = self
            .find_split_route(token_in, token_out, amount_in, max_hops, max_splits)
            .await?;
        Ok(Quote::from_route(split_route, slippage))
    }

    /// Get graph reference
    pub fn graph(&self) -> &PoolGraph {
        &self.graph
    }

    /// Get cache statistics
    pub fn cache_stats(&self) -> crate::cache::CacheStatistics {
        self.cache.stats()
    }

    /// Clear all caches
    pub fn clear_cache(&self) {
        self.cache.clear_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::{PoolEdge, TokenNode};
    use crate::utils::address_from_u64;

    fn create_test_graph() -> Arc<PoolGraph> {
        let graph = Arc::new(PoolGraph::new());

        let token_a = address_from_u64(1);
        let token_b = address_from_u64(2);
        let token_c = address_from_u64(3);

        let node_a = TokenNode::new(token_a, "A".to_string(), 18);
        let node_b = TokenNode::new(token_b, "B".to_string(), 18);
        let node_c = TokenNode::new(token_c, "C".to_string(), 18);

        let pool_ac_1 = PoolEdge::new(
            [1u8; 32],
            token_a,
            token_c,
            3000,
            60,
            500_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_ac_2 = PoolEdge::new(
            [2u8; 32],
            token_a,
            token_c,
            500,
            10,
            1_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_ab = PoolEdge::new(
            [3u8; 32],
            token_a,
            token_b,
            3000,
            60,
            2_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_bc = PoolEdge::new(
            [4u8; 32],
            token_b,
            token_c,
            3000,
            60,
            2_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool_ac_1, node_a.clone(), node_c.clone());
        graph.upsert_pool(pool_ac_2, node_a.clone(), node_c.clone());
        graph.upsert_pool(pool_ab, node_a, node_b.clone());
        graph.upsert_pool(pool_bc, node_b, node_c);

        graph
    }

    #[tokio::test]
    async fn test_router_with_cache() {
        let graph = create_test_graph();
        let router = Router::new(graph);

        let token_a = address_from_u64(1);
        let token_c = address_from_u64(3);
        let amount = U256::from(1_000_000_000_000_000_000u128);

        // First call - cache miss
        let route1 = router
            .find_route(token_a, token_c, amount, Some(4))
            .await
            .expect("Should find route");

        // Second call - cache hit
        let route2 = router
            .find_route(token_a, token_c, amount, Some(4))
            .await
            .expect("Should find route");

        assert_eq!(route1.total_amount_out, route2.total_amount_out);

        let stats = router.cache_stats();
        println!("Cache stats: {:?}", stats);
    }

    #[tokio::test]
    async fn test_router_parallel_mode() {
        let graph = create_test_graph();

        let config = RouterConfig {
            enable_parallel: true,
            ..Default::default()
        };

        let router = Router::with_config(graph, config);

        let token_a = address_from_u64(1);
        let token_c = address_from_u64(3);
        let amount = U256::from(1_000_000_000_000_000_000u128);

        let route = router
            .find_route(token_a, token_c, amount, Some(4))
            .await
            .expect("Should find route");

        assert!(route.total_amount_out > U256::ZERO);
    }
}
