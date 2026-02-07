use routing_engine::{
    api::{create_router, AppState},
    config::Settings,
    sync::PoolSyncer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "routing_engine=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting BaseBook Routing Engine...");

    // Load settings
    let settings = Settings::load();
    tracing::info!(
        "Configuration loaded: chain_id={}, max_hops={}, max_splits={}",
        settings.chain.chain_id,
        settings.routing.max_hops,
        settings.routing.max_splits
    );

    // Create application state
    let state = AppState::new(settings.clone());

    // Sync pools
    tracing::info!("Syncing pool data...");
    let syncer = PoolSyncer::new(state.graph.clone());
    if let Err(e) = syncer.sync_pools().await {
        tracing::error!("Failed to sync pools: {}", e);
    } else {
        let stats = state.graph.stats();
        tracing::info!(
            "Pool sync complete: {} tokens, {} pools",
            stats.token_count,
            stats.pool_count
        );
    }

    // Create router
    let app = create_router(state);

    // Start server
    let addr = format!("{}:{}", settings.server.host, settings.server.port);
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");

    tracing::info!("🚀 Routing Engine is running on http://{}", addr);
    tracing::info!("📊 Health check: http://{}/health", addr);
    tracing::info!("💱 Quote API: http://{}/v1/quote", addr);

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}
