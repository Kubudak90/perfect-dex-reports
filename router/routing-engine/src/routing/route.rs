use crate::graph::PoolEdge;
use alloy_primitives::{Address, U256};
use serde::{Deserialize, Serialize};

/// A single hop in a route
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteHop {
    pub pool: PoolEdge,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: U256,
    pub amount_out: U256,
}

impl RouteHop {
    pub fn new(
        pool: PoolEdge,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        amount_out: U256,
    ) -> Self {
        Self {
            pool,
            token_in,
            token_out,
            amount_in,
            amount_out,
        }
    }
}

/// A complete route (possibly multi-hop)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub hops: Vec<RouteHop>,
    pub total_amount_in: U256,
    pub total_amount_out: U256,
    pub price_impact: f64,
    pub gas_estimate: u64,
}

impl Route {
    pub fn new(
        hops: Vec<RouteHop>,
        total_amount_in: U256,
        total_amount_out: U256,
        price_impact: f64,
        gas_estimate: u64,
    ) -> Self {
        Self {
            hops,
            total_amount_in,
            total_amount_out,
            price_impact,
            gas_estimate,
        }
    }

    pub fn hop_count(&self) -> usize {
        self.hops.len()
    }

    pub fn route_string(&self) -> String {
        if self.hops.is_empty() {
            return String::new();
        }

        let mut parts = vec![format!("{:?}", self.hops[0].token_in)];
        for hop in &self.hops {
            parts.push(format!("{:?}", hop.token_out));
        }

        parts.join(" → ")
    }
}

/// A split route (multiple routes for same swap)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitRoute {
    pub routes: Vec<(Route, u8)>, // (route, percentage)
    pub total_amount_in: U256,
    pub total_amount_out: U256,
    pub combined_price_impact: f64,
    pub total_gas_estimate: u64,
}

impl SplitRoute {
    pub fn new(
        routes: Vec<(Route, u8)>,
        total_amount_in: U256,
        total_amount_out: U256,
        combined_price_impact: f64,
        total_gas_estimate: u64,
    ) -> Self {
        Self {
            routes,
            total_amount_in,
            total_amount_out,
            combined_price_impact,
            total_gas_estimate,
        }
    }

    pub fn single(route: Route) -> Self {
        let total_amount_in = route.total_amount_in;
        let total_amount_out = route.total_amount_out;
        let price_impact = route.price_impact;
        let gas_estimate = route.gas_estimate;

        Self {
            routes: vec![(route, 100)],
            total_amount_in,
            total_amount_out,
            combined_price_impact: price_impact,
            total_gas_estimate: gas_estimate,
        }
    }

    pub fn split_count(&self) -> usize {
        self.routes.len()
    }
}
