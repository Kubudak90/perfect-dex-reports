use super::{PoolEdge, TokenNode};
use dashmap::DashMap;
use alloy_primitives::Address;
use parking_lot::RwLock;
use petgraph::graph::{DiGraph, NodeIndex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// The main pool graph structure
///
/// Uses a directed graph where:
/// - Nodes represent tokens
/// - Edges represent pools (bidirectional)
pub struct PoolGraph {
    /// Directed graph: nodes are tokens, edges are pools
    graph: Arc<RwLock<DiGraph<TokenNode, PoolEdge>>>,

    /// Fast lookup: token address -> node index
    token_index: DashMap<Address, NodeIndex>,

    /// Fast lookup: pool_id -> edge indices
    pool_index: DashMap<[u8; 32], Vec<(NodeIndex, NodeIndex)>>,

    /// Last update timestamp
    last_update: AtomicU64,
}

impl PoolGraph {
    pub fn new() -> Self {
        Self {
            graph: Arc::new(RwLock::new(DiGraph::new())),
            token_index: DashMap::new(),
            pool_index: DashMap::new(),
            last_update: AtomicU64::new(0),
        }
    }

    /// Get or create a node for a token
    fn get_or_create_node(&self, token: TokenNode) -> NodeIndex {
        if let Some(index) = self.token_index.get(&token.address) {
            return *index;
        }

        let mut graph = self.graph.write();
        let index = graph.add_node(token.clone());
        self.token_index.insert(token.address, index);
        index
    }

    /// Add or update a pool in the graph
    pub fn upsert_pool(&self, pool: PoolEdge, token0_node: TokenNode, token1_node: TokenNode) {
        let node0 = self.get_or_create_node(token0_node);
        let node1 = self.get_or_create_node(token1_node);

        let mut graph = self.graph.write();

        // Add bidirectional edges (can swap both directions)
        graph.add_edge(node0, node1, pool.clone());
        graph.add_edge(node1, node0, pool.clone());

        // Update pool index
        self.pool_index
            .insert(pool.pool_id, vec![(node0, node1), (node1, node0)]);

        // Update timestamp
        self.last_update
            .store(chrono::Utc::now().timestamp() as u64, Ordering::Relaxed);
    }

    /// Get all pools connected to a token
    pub fn get_pools_for_token(&self, token: Address) -> Vec<PoolEdge> {
        let graph = self.graph.read();

        if let Some(node_index) = self.token_index.get(&token) {
            let mut pools = Vec::new();

            // Get all outgoing edges
            for edge_ref in graph.edges(*node_index) {
                pools.push(edge_ref.weight().clone());
            }

            pools
        } else {
            Vec::new()
        }
    }

    /// Get a specific pool by ID
    pub fn get_pool(&self, pool_id: [u8; 32]) -> Option<PoolEdge> {
        let graph = self.graph.read();

        if let Some(indices) = self.pool_index.get(&pool_id) {
            if let Some((from, to)) = indices.first() {
                if let Some(edge) = graph.find_edge(*from, *to) {
                    return Some(graph[edge].clone());
                }
            }
        }

        None
    }

    /// Check if a path exists between two tokens
    pub fn has_path(&self, from: Address, to: Address) -> bool {
        let graph = self.graph.read();

        let start = match self.token_index.get(&from) {
            Some(idx) => *idx,
            None => return false,
        };

        let end = match self.token_index.get(&to) {
            Some(idx) => *idx,
            None => return false,
        };

        // Use BFS to check connectivity
        use petgraph::algo::has_path_connecting;
        has_path_connecting(&*graph, start, end, None)
    }

    /// Get all tokens in the graph
    pub fn get_all_tokens(&self) -> Vec<TokenNode> {
        let graph = self.graph.read();
        graph.node_weights().cloned().collect()
    }

    /// Get graph statistics
    pub fn stats(&self) -> GraphStats {
        let graph = self.graph.read();
        GraphStats {
            token_count: graph.node_count(),
            pool_count: graph.edge_count() / 2, // Bidirectional
            last_update: self.last_update.load(Ordering::Relaxed),
        }
    }
}

impl Default for PoolGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct GraphStats {
    pub token_count: usize,
    pub pool_count: usize,
    pub last_update: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::U256;
    use crate::utils::address_from_u64;

    #[test]
    fn test_pool_graph_creation() {
        let graph = PoolGraph::new();
        let stats = graph.stats();
        assert_eq!(stats.token_count, 0);
        assert_eq!(stats.pool_count, 0);
    }

    #[test]
    fn test_add_pool() {
        let graph = PoolGraph::new();

        let token0 = TokenNode::new(
            address_from_u64(1),
            "TOKEN0".to_string(),
            18,
        );
        let token1 = TokenNode::new(
            address_from_u64(2),
            "TOKEN1".to_string(),
            18,
        );

        let pool = PoolEdge::new(
            [0u8; 32],
            token0.address,
            token1.address,
            3000,
            60,
            1_000_000,
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool, token0.clone(), token1.clone());

        let stats = graph.stats();
        assert_eq!(stats.token_count, 2);
        assert_eq!(stats.pool_count, 1);

        assert!(graph.has_path(token0.address, token1.address));
    }
}
