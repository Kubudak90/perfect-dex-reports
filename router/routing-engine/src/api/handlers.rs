use super::dto::{ErrorResponse, GraphStatsDto, HealthResponse, QuoteRequest, QuoteResponse};
use super::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use alloy_primitives::U256;
use std::sync::Arc;

/// Health check endpoint
pub async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let stats = state.graph.stats();

    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        chain_id: state.settings.chain.chain_id,
        graph_stats: GraphStatsDto {
            token_count: stats.token_count,
            pool_count: stats.pool_count,
            last_update: stats.last_update,
        },
    };

    Json(response)
}

/// Get quote for a swap
pub async fn get_quote(
    State(state): State<Arc<AppState>>,
    Query(params): Query<QuoteRequest>,
) -> Result<Json<QuoteResponse>, ApiError> {
    // Parse amount
    let amount_in = params.amount_in.parse::<U256>()
        .map_err(|_| ApiError::BadRequest("Invalid amount".to_string()))?;

    // Check cache
    let cache_key = format!(
        "{}:{}:{}",
        params.token_in,
        params.token_out,
        bucket_amount(amount_in)
    );

    if let Some(cached_quote) = state.cache.get(&cache_key).await {
        return Ok(Json(QuoteResponse {
            quote: cached_quote,
            timestamp: chrono::Utc::now().timestamp() as u64,
            cached: true,
        }));
    }

    // Calculate route
    let quote = state
        .router
        .get_quote(
            params.token_in,
            params.token_out,
            amount_in,
            params.slippage,
            params.max_hops,
        )
        .await
        .map_err(ApiError::from)?;

    // Cache result
    state
        .cache
        .set(&cache_key, &quote, std::time::Duration::from_secs(15))
        .await;

    Ok(Json(QuoteResponse {
        quote,
        timestamp: chrono::Utc::now().timestamp() as u64,
        cached: false,
    }))
}

/// Bucket amounts to improve cache hit rate
fn bucket_amount(amount: U256) -> String {
    // Round to 2 significant figures
    let amount_str = amount.to_string();
    if amount_str.len() <= 2 {
        return amount_str;
    }

    let first_two: String = amount_str.chars().take(2).collect();
    let zeros = "0".repeat(amount_str.len() - 2);
    format!("{}{}", first_two, zeros)
}

/// API Error type
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    InternalError(String),
    NotFound(String),
}

impl From<crate::utils::RouterError> for ApiError {
    fn from(err: crate::utils::RouterError) -> Self {
        match err {
            crate::utils::RouterError::NoRouteFound { .. } => {
                ApiError::NotFound(err.to_string())
            }
            crate::utils::RouterError::InvalidAmount(_) => {
                ApiError::BadRequest(err.to_string())
            }
            _ => ApiError::InternalError(err.to_string()),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let error_response = ErrorResponse {
            error: status.canonical_reason().unwrap_or("Error").to_string(),
            message,
        };

        (status, Json(error_response)).into_response()
    }
}
