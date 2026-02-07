use crate::routing::Quote;
use dashmap::DashMap;
use std::time::{Duration, Instant};

/// Simple in-memory cache for routes
pub struct RouteCache {
    cache: DashMap<String, CacheEntry>,
    ttl: Duration,
}

struct CacheEntry {
    quote: Quote,
    inserted_at: Instant,
}

impl RouteCache {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: DashMap::new(),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    pub async fn get(&self, key: &str) -> Option<Quote> {
        if let Some(entry) = self.cache.get(key) {
            if entry.inserted_at.elapsed() < self.ttl {
                return Some(entry.quote.clone());
            } else {
                // Expired, remove it
                drop(entry);
                self.cache.remove(key);
            }
        }
        None
    }

    pub async fn set(&self, key: &str, quote: &Quote, _duration: Duration) {
        self.cache.insert(
            key.to_string(),
            CacheEntry {
                quote: quote.clone(),
                inserted_at: Instant::now(),
            },
        );
    }

    pub fn clear(&self) {
        self.cache.clear();
    }
}

impl Default for RouteCache {
    fn default() -> Self {
        Self::new(15) // 15 seconds default TTL
    }
}
