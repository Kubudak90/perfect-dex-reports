use crate::cache::RouteCache;
use crate::config::Settings;
use crate::graph::PoolGraph;
use crate::routing::Router;
use std::sync::Arc;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub router: Arc<Router>,
    pub graph: Arc<PoolGraph>,
    pub cache: Arc<RouteCache>,
    pub settings: Settings,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        let graph = Arc::new(PoolGraph::new());
        let router = Arc::new(Router::new(graph.clone()));
        let cache = Arc::new(RouteCache::default());

        Self {
            router,
            graph,
            cache,
            settings,
        }
    }
}
