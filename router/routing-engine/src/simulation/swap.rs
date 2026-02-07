use crate::graph::PoolEdge;
use crate::utils::math::{compute_swap_step, sqrt_price_x96_to_tick, tick_to_sqrt_price_x96};
use crate::utils::Result;
use crate::utils::RouterError;
use alloy_primitives::U256;

/// Swap simulator using CLMM (Concentrated Liquidity) math.
///
/// This simulates a Uniswap v3/v4-style swap within a single tick range.
/// A full production implementation would iterate across tick boundaries
/// and update liquidity at each crossing. Here we perform a single-step
/// swap using the pool's current sqrt price, liquidity and fee.
pub struct SwapSimulator;

impl SwapSimulator {
    pub fn new() -> Self {
        Self
    }

    /// Simulate a swap through a single pool using CLMM math.
    ///
    /// Uses `compute_swap_step` to calculate exact output based on the
    /// pool's current sqrtPriceX96, liquidity, fee and swap direction.
    pub fn simulate_swap(
        &self,
        pool: &PoolEdge,
        amount_in: U256,
        zero_for_one: bool,
    ) -> Result<SwapResult> {
        if amount_in.is_zero() {
            return Ok(SwapResult {
                amount_out: U256::ZERO,
                sqrt_price_after: pool.sqrt_price_x96,
                tick_after: pool.tick,
            });
        }

        if pool.liquidity == 0 {
            return Err(RouterError::InsufficientLiquidity {
                required: amount_in.to_string(),
                available: "0".to_string(),
            });
        }

        // Determine the target sqrt price (the boundary of the current tick range).
        // In a full implementation we would look up the next initialised tick from
        // a tick bitmap.  Here we approximate by stepping one tick-spacing away.
        let sqrt_price_target = if zero_for_one {
            // Moving price down: target is current tick minus tick_spacing
            let target_tick = pool.tick - pool.tick_spacing;
            tick_to_sqrt_price_x96(target_tick)
        } else {
            // Moving price up: target is current tick plus tick_spacing
            let target_tick = pool.tick + pool.tick_spacing;
            tick_to_sqrt_price_x96(target_tick)
        };

        let step = compute_swap_step(
            pool.sqrt_price_x96,
            sqrt_price_target,
            pool.liquidity,
            amount_in,
            pool.fee,
        );

        let tick_after = sqrt_price_x96_to_tick(step.sqrt_price_next);

        Ok(SwapResult {
            amount_out: step.amount_out,
            sqrt_price_after: step.sqrt_price_next,
            tick_after,
        })
    }

    /// Simulate a multi-step swap across tick boundaries.
    ///
    /// This is a simplified version that performs up to `max_steps` swap
    /// steps, each spanning one tick-spacing.  For a full production
    /// router you would use on-chain tick bitmap data.
    pub fn simulate_swap_multi_step(
        &self,
        pool: &PoolEdge,
        amount_in: U256,
        zero_for_one: bool,
        max_steps: usize,
    ) -> Result<SwapResult> {
        if amount_in.is_zero() {
            return Ok(SwapResult {
                amount_out: U256::ZERO,
                sqrt_price_after: pool.sqrt_price_x96,
                tick_after: pool.tick,
            });
        }

        if pool.liquidity == 0 {
            return Err(RouterError::InsufficientLiquidity {
                required: amount_in.to_string(),
                available: "0".to_string(),
            });
        }

        let mut remaining = amount_in;
        let mut total_out = U256::ZERO;
        let mut current_sqrt_price = pool.sqrt_price_x96;
        let mut current_tick = pool.tick;
        let liquidity = pool.liquidity;

        for _ in 0..max_steps {
            if remaining.is_zero() {
                break;
            }

            let target_tick = if zero_for_one {
                current_tick - pool.tick_spacing
            } else {
                current_tick + pool.tick_spacing
            };

            let sqrt_price_target = tick_to_sqrt_price_x96(target_tick);

            let step = compute_swap_step(
                current_sqrt_price,
                sqrt_price_target,
                liquidity,
                remaining,
                pool.fee,
            );

            total_out += step.amount_out;

            // Subtract consumed input + fee
            let consumed = step.amount_in + step.fee_amount;
            remaining = if remaining > consumed {
                remaining - consumed
            } else {
                U256::ZERO
            };

            current_sqrt_price = step.sqrt_price_next;
            current_tick = sqrt_price_x96_to_tick(current_sqrt_price);
        }

        Ok(SwapResult {
            amount_out: total_out,
            sqrt_price_after: current_sqrt_price,
            tick_after: current_tick,
        })
    }
}

impl Default for SwapSimulator {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct SwapResult {
    pub amount_out: U256,
    pub sqrt_price_after: U256,
    pub tick_after: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::address_from_u64;

    fn create_test_pool(fee: u32, liquidity: u128, tick: i32) -> PoolEdge {
        PoolEdge::new(
            [1u8; 32],
            address_from_u64(1),
            address_from_u64(2),
            fee,
            60, // tick_spacing
            liquidity,
            tick_to_sqrt_price_x96(tick),
            tick,
        )
    }

    #[test]
    fn test_simulate_swap_zero_for_one() {
        let pool = create_test_pool(3000, 1_000_000_000_000_000_000_000, 0);
        let sim = SwapSimulator::new();
        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let result = sim.simulate_swap(&pool, amount_in, true).unwrap();

        assert!(result.amount_out > U256::ZERO, "Should produce output");
        assert!(result.tick_after <= pool.tick, "Tick should move down for zero_for_one");
    }

    #[test]
    fn test_simulate_swap_one_for_zero() {
        let pool = create_test_pool(3000, 1_000_000_000_000_000_000_000, 0);
        let sim = SwapSimulator::new();
        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let result = sim.simulate_swap(&pool, amount_in, false).unwrap();

        assert!(result.amount_out > U256::ZERO, "Should produce output");
    }

    #[test]
    fn test_simulate_swap_zero_amount() {
        let pool = create_test_pool(3000, 1_000_000_000_000_000_000_000, 0);
        let sim = SwapSimulator::new();

        let result = sim.simulate_swap(&pool, U256::ZERO, true).unwrap();
        assert_eq!(result.amount_out, U256::ZERO);
    }

    #[test]
    fn test_simulate_swap_no_liquidity() {
        let pool = create_test_pool(3000, 0, 0);
        let sim = SwapSimulator::new();
        let amount_in = U256::from(1000u64);

        let result = sim.simulate_swap(&pool, amount_in, true);
        assert!(result.is_err());
    }

    #[test]
    fn test_multi_step_swap() {
        let pool = create_test_pool(3000, 1_000_000_000_000_000_000_000, 0);
        let sim = SwapSimulator::new();
        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let single = sim.simulate_swap(&pool, amount_in, true).unwrap();
        let multi = sim
            .simulate_swap_multi_step(&pool, amount_in, true, 5)
            .unwrap();

        // Multi-step should produce at least as much output
        assert!(multi.amount_out >= single.amount_out);
    }
}
