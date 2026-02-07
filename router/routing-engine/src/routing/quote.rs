use crate::routing::SplitRoute;
use crate::utils::math::apply_slippage;
use serde::{Deserialize, Serialize};

/// Quote response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub amount_in: String,
    pub amount_out: String,
    pub amount_out_min: String,
    pub price_impact: f64,
    pub gas_estimate: u64,
    pub gas_estimate_usd: f64,
    pub route_string: String,
    pub route: SplitRoute,
}

impl Quote {
    pub fn from_route(route: SplitRoute, slippage: f64) -> Self {
        let slippage_bps = (slippage * 100.0) as u32;
        let amount_out_min = apply_slippage(route.total_amount_out, slippage_bps);

        let route_string = if let Some((first_route, _)) = route.routes.first() {
            first_route.route_string()
        } else {
            String::new()
        };

        // Base L2 gas price estimate.
        // In production this would be fetched from RPC via eth_gasPrice.
        // Base mainnet typically runs at 0.001-0.1 gwei; we use a
        // conservative 0.01 gwei default.  With ETH ~$3000:
        //   gas_cost_eth = gas_used * gas_price_gwei / 1e9
        //   gas_cost_usd = gas_cost_eth * eth_price_usd
        let gas_price_gwei = 0.01_f64;
        let eth_price_usd = 3000.0_f64;
        let gas_cost_eth = route.total_gas_estimate as f64 * gas_price_gwei / 1_000_000_000.0;
        let gas_estimate_usd = gas_cost_eth * eth_price_usd;

        Self {
            amount_in: route.total_amount_in.to_string(),
            amount_out: route.total_amount_out.to_string(),
            amount_out_min: amount_out_min.to_string(),
            price_impact: route.combined_price_impact,
            gas_estimate: route.total_gas_estimate,
            gas_estimate_usd,
            route_string,
            route,
        }
    }
}
