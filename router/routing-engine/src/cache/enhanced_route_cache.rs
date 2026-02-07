use crate::cache::lru_cache::LruCache;
use crate::routing::{Quote, Route, SplitRoute};
use alloy_primitives::{Address, U256};
use std::sync::Arc;

/// Enhanced route cache with bucketing for better hit rate
pub struct EnhancedRouteCache {
    // Cache for single routes
    route_cache: Arc<LruCache<RouteKey, Route>>,

    // Cache for split routes
    split_cache: Arc<LruCache<RouteKey, SplitRoute>>,

    // Cache for quotes
    quote_cache: Arc<LruCache<QuoteKey, Quote>>,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct RouteKey {
    token_in: Address,
    token_out: Address,
    amount_bucket: String,
    max_hops: usize,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct QuoteKey {
    token_in: Address,
    token_out: Address,
    amount_bucket: String,
    slippage_bps: u32,
    max_hops: usize,
}

impl EnhancedRouteCache {
    pub fn new(max_routes: usize, max_quotes: usize, ttl_seconds: u64) -> Self {
        Self {
            route_cache: Arc::new(LruCache::new(max_routes, ttl_seconds)),
            split_cache: Arc::new(LruCache::new(max_routes / 2, ttl_seconds)),
            quote_cache: Arc::new(LruCache::new(max_quotes, ttl_seconds)),
        }
    }

    /// Get route from cache
    pub fn get_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        max_hops: usize,
    ) -> Option<Route> {
        let key = RouteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            max_hops,
        };

        self.route_cache.get(&key)
    }

    /// Insert route into cache
    pub fn insert_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        max_hops: usize,
        route: Route,
    ) {
        let key = RouteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            max_hops,
        };

        self.route_cache.insert(key, route);
    }

    /// Get split route from cache
    pub fn get_split_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        max_hops: usize,
    ) -> Option<SplitRoute> {
        let key = RouteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            max_hops,
        };

        self.split_cache.get(&key)
    }

    /// Insert split route into cache
    pub fn insert_split_route(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        max_hops: usize,
        split_route: SplitRoute,
    ) {
        let key = RouteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            max_hops,
        };

        self.split_cache.insert(key, split_route);
    }

    /// Get quote from cache
    pub fn get_quote(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        slippage: f64,
        max_hops: usize,
    ) -> Option<Quote> {
        let key = QuoteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            slippage_bps: (slippage * 100.0) as u32,
            max_hops,
        };

        self.quote_cache.get(&key)
    }

    /// Insert quote into cache
    pub fn insert_quote(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        slippage: f64,
        max_hops: usize,
        quote: Quote,
    ) {
        let key = QuoteKey {
            token_in,
            token_out,
            amount_bucket: Self::bucket_amount(amount),
            slippage_bps: (slippage * 100.0) as u32,
            max_hops,
        };

        self.quote_cache.insert(key, quote);
    }

    /// Bucket amounts to improve cache hit rate
    ///
    /// Groups similar amounts together by rounding to 2 significant figures
    fn bucket_amount(amount: U256) -> String {
        if amount.is_zero() {
            return "0".to_string();
        }

        let amount_str = amount.to_string();

        if amount_str.len() <= 2 {
            return amount_str;
        }

        // Take first 2 digits and fill with zeros
        let first_two: String = amount_str.chars().take(2).collect();
        let zeros = "0".repeat(amount_str.len() - 2);
        format!("{}{}", first_two, zeros)
    }

    /// Clear all caches
    pub fn clear_all(&self) {
        self.route_cache.clear();
        self.split_cache.clear();
        self.quote_cache.clear();
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStatistics {
        CacheStatistics {
            route_stats: self.route_cache.stats(),
            split_stats: self.split_cache.stats(),
            quote_stats: self.quote_cache.stats(),
        }
    }
}

impl Default for EnhancedRouteCache {
    fn default() -> Self {
        Self::new(
            1000,  // max 1000 routes
            2000,  // max 2000 quotes
            15,    // 15 second TTL
        )
    }
}

#[derive(Debug, Clone)]
pub struct CacheStatistics {
    pub route_stats: crate::cache::lru_cache::CacheStats,
    pub split_stats: crate::cache::lru_cache::CacheStats,
    pub quote_stats: crate::cache::lru_cache::CacheStats,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::address_from_u64;

    #[test]
    fn test_amount_bucketing() {
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(0)), "0");
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(5)), "5");
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(99)), "99");
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(123)), "120");
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(1234)), "1200");
        assert_eq!(EnhancedRouteCache::bucket_amount(U256::from(98765)), "98000");
    }

    #[test]
    fn test_route_cache_basic() {
        let cache = EnhancedRouteCache::new(10, 10, 60);

        let token_in = address_from_u64(1);
        let token_out = address_from_u64(2);
        let amount = U256::from(1000);

        // Should be empty initially
        assert!(cache.get_route(token_in, token_out, amount, 2).is_none());
    }

    #[test]
    fn test_cache_hit_with_similar_amounts() {
        use crate::graph::PoolEdge;
        use crate::routing::RouteHop;

        let cache = EnhancedRouteCache::new(10, 10, 60);

        let token_in = address_from_u64(1);
        let token_out = address_from_u64(2);

        // Create a test route
        let pool = PoolEdge::new(
            [1u8; 32],
            token_in,
            token_out,
            3000,
            60,
            1_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let hop = RouteHop::new(
            pool,
            token_in,
            token_out,
            U256::from(1000),
            U256::from(990),
        );

        let route = Route::new(
            vec![hop],
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        // Insert with amount 1234
        cache.insert_route(token_in, token_out, U256::from(1234), 2, route.clone());

        // Should hit cache with amount 1250 (same bucket)
        let cached = cache.get_route(token_in, token_out, U256::from(1250), 2);
        assert!(cached.is_some());
    }
}
