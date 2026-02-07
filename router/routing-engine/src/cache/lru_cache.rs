use dashmap::DashMap;
use std::collections::VecDeque;
use std::hash::Hash;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// LRU cache with TTL support
pub struct LruCache<K, V> {
    cache: Arc<DashMap<K, CacheEntry<V>>>,
    access_order: Arc<parking_lot::Mutex<VecDeque<K>>>,
    max_size: usize,
    ttl: Duration,
}

struct CacheEntry<V> {
    value: V,
    inserted_at: Instant,
    access_count: u64,
}

impl<K: Clone + Hash + Eq, V: Clone> LruCache<K, V> {
    pub fn new(max_size: usize, ttl_seconds: u64) -> Self {
        Self {
            cache: Arc::new(DashMap::new()),
            access_order: Arc::new(parking_lot::Mutex::new(VecDeque::with_capacity(max_size))),
            max_size,
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    /// Get value from cache if present and not expired
    pub fn get(&self, key: &K) -> Option<V> {
        if let Some(mut entry) = self.cache.get_mut(key) {
            // Check TTL
            if entry.inserted_at.elapsed() < self.ttl {
                entry.access_count += 1;

                // Update access order
                let mut order = self.access_order.lock();
                if let Some(pos) = order.iter().position(|k| k == key) {
                    order.remove(pos);
                }
                order.push_back(key.clone());

                return Some(entry.value.clone());
            } else {
                // Expired, remove it
                drop(entry);
                self.cache.remove(key);
            }
        }
        None
    }

    /// Insert value into cache
    pub fn insert(&self, key: K, value: V) {
        // Evict if at capacity
        if self.cache.len() >= self.max_size {
            self.evict_lru();
        }

        let entry = CacheEntry {
            value,
            inserted_at: Instant::now(),
            access_count: 0,
        };

        self.cache.insert(key.clone(), entry);

        // Update access order
        let mut order = self.access_order.lock();
        order.push_back(key);
    }

    /// Evict least recently used entry
    fn evict_lru(&self) {
        let mut order = self.access_order.lock();
        if let Some(key) = order.pop_front() {
            self.cache.remove(&key);
        }
    }

    /// Clear expired entries
    pub fn clear_expired(&self) {
        let now = Instant::now();
        self.cache.retain(|_, entry| now.duration_since(entry.inserted_at) < self.ttl);
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let total_accesses: u64 = self.cache.iter().map(|entry| entry.access_count).sum();

        CacheStats {
            size: self.cache.len(),
            max_size: self.max_size,
            total_accesses,
        }
    }

    /// Clear all entries
    pub fn clear(&self) {
        self.cache.clear();
        self.access_order.lock().clear();
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub size: usize,
    pub max_size: usize,
    pub total_accesses: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_basic() {
        let cache = LruCache::new(3, 60);

        cache.insert("a", 1);
        cache.insert("b", 2);
        cache.insert("c", 3);

        assert_eq!(cache.get(&"a"), Some(1));
        assert_eq!(cache.get(&"b"), Some(2));
        assert_eq!(cache.get(&"c"), Some(3));
    }

    #[test]
    fn test_lru_eviction() {
        let cache = LruCache::new(2, 60);

        cache.insert("a", 1);
        cache.insert("b", 2);
        cache.insert("c", 3); // Should evict "a"

        assert_eq!(cache.get(&"a"), None);
        assert_eq!(cache.get(&"b"), Some(2));
        assert_eq!(cache.get(&"c"), Some(3));
    }

    #[test]
    fn test_lru_access_order() {
        let cache = LruCache::new(2, 60);

        cache.insert("a", 1);
        cache.insert("b", 2);

        // Access "a" to make it more recent
        cache.get(&"a");

        // Insert "c", should evict "b" (least recent)
        cache.insert("c", 3);

        assert_eq!(cache.get(&"a"), Some(1));
        assert_eq!(cache.get(&"b"), None);
        assert_eq!(cache.get(&"c"), Some(3));
    }

    #[test]
    fn test_ttl_expiration() {
        let cache = LruCache::new(10, 1); // 1 second TTL

        cache.insert("a", 1);
        assert_eq!(cache.get(&"a"), Some(1));

        // Wait for expiration
        std::thread::sleep(Duration::from_secs(2));

        assert_eq!(cache.get(&"a"), None);
    }

    #[test]
    fn test_cache_stats() {
        let cache = LruCache::new(10, 60);

        cache.insert("a", 1);
        cache.insert("b", 2);

        cache.get(&"a");
        cache.get(&"a");
        cache.get(&"b");

        let stats = cache.stats();
        assert_eq!(stats.size, 2);
        assert_eq!(stats.max_size, 10);
        assert!(stats.total_accesses >= 3);
    }
}
