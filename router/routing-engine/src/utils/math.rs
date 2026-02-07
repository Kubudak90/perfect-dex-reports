use alloy_primitives::U256;

/// Q96 constant: 2^96 used for sqrt price fixed-point representation
pub fn q96() -> U256 {
    U256::from(1u128) << 96
}

/// Calculate sqrt using Newton's method for U256
pub fn sqrt_u256(value: U256) -> U256 {
    if value.is_zero() {
        return U256::ZERO;
    }

    let mut z = value;
    let two = U256::from(2);
    let mut x = value / two + U256::from(1);

    while x < z {
        z = x;
        x = (value / x + x) / two;
    }

    z
}

/// Calculate percentage
pub fn calculate_percentage(part: U256, total: U256) -> f64 {
    if total.is_zero() {
        return 0.0;
    }

    let part_f64 = part.to::<u128>() as f64;
    let total_f64 = total.to::<u128>() as f64;

    (part_f64 / total_f64) * 100.0
}

/// Apply slippage to amount
pub fn apply_slippage(amount: U256, slippage_bps: u32) -> U256 {
    let slippage = U256::from(slippage_bps);
    let basis_points = U256::from(10000);

    amount * (basis_points - slippage) / basis_points
}

// ---------------------------------------------------------------------------
// CLMM (Concentrated Liquidity) swap math
// ---------------------------------------------------------------------------

/// Result of a single swap step within one tick range
#[derive(Debug, Clone)]
pub struct SwapStepResult {
    /// The sqrt price after the step
    pub sqrt_price_next: U256,
    /// Amount of input token consumed in this step
    pub amount_in: U256,
    /// Amount of output token produced in this step
    pub amount_out: U256,
    /// Fee amount taken from the input
    pub fee_amount: U256,
}

/// Compute a single swap step within a tick range.
///
/// This mirrors the Uniswap v3 `SwapMath.computeSwapStep` function using
/// Q64.96 fixed-point arithmetic.
///
/// # Arguments
/// * `sqrt_price_current` - current sqrtPriceX96
/// * `sqrt_price_target`  - sqrtPriceX96 at the next initialised tick boundary
/// * `liquidity`          - active liquidity (u128 encoded as U256 for arithmetic)
/// * `amount_remaining`   - remaining input amount
/// * `fee_pips`           - fee in pips (e.g. 3000 = 0.3%)
pub fn compute_swap_step(
    sqrt_price_current: U256,
    sqrt_price_target: U256,
    liquidity: u128,
    amount_remaining: U256,
    fee_pips: u32,
) -> SwapStepResult {
    let zero = U256::ZERO;
    if amount_remaining.is_zero() || liquidity == 0 {
        return SwapStepResult {
            sqrt_price_next: sqrt_price_current,
            amount_in: zero,
            amount_out: zero,
            fee_amount: zero,
        };
    }

    let zero_for_one = sqrt_price_current >= sqrt_price_target;
    let liq = U256::from(liquidity);
    let fee_denom = U256::from(1_000_000u64);
    let fee = U256::from(fee_pips);

    // Compute amount after fee
    let amount_remaining_less_fee = amount_remaining * (fee_denom - fee) / fee_denom;

    // Compute the maximum amount we can push through this tick range
    let amount_in_max = if zero_for_one {
        // token0 -> token1: amount0 = L * (1/sqrtP_target - 1/sqrtP_current)
        //   = L * (sqrtP_current - sqrtP_target) / (sqrtP_current * sqrtP_target / Q96)
        get_amount0_delta(sqrt_price_target, sqrt_price_current, liq)
    } else {
        // token1 -> token0: amount1 = L * (sqrtP_target - sqrtP_current) / Q96
        get_amount1_delta(sqrt_price_current, sqrt_price_target, liq)
    };

    let (sqrt_price_next, amount_in, amount_out) = if amount_remaining_less_fee >= amount_in_max {
        // We can reach the target tick
        let amount_out = if zero_for_one {
            get_amount1_delta(sqrt_price_target, sqrt_price_current, liq)
        } else {
            get_amount0_delta(sqrt_price_current, sqrt_price_target, liq)
        };
        (sqrt_price_target, amount_in_max, amount_out)
    } else {
        // We exhaust the remaining amount before reaching target
        let sqrt_price_next = if zero_for_one {
            get_next_sqrt_price_from_amount0(sqrt_price_current, liq, amount_remaining_less_fee)
        } else {
            get_next_sqrt_price_from_amount1(sqrt_price_current, liq, amount_remaining_less_fee)
        };

        let amount_in_actual = if zero_for_one {
            get_amount0_delta(sqrt_price_next, sqrt_price_current, liq)
        } else {
            get_amount1_delta(sqrt_price_current, sqrt_price_next, liq)
        };

        let amount_out = if zero_for_one {
            get_amount1_delta(sqrt_price_next, sqrt_price_current, liq)
        } else {
            get_amount0_delta(sqrt_price_current, sqrt_price_next, liq)
        };

        (sqrt_price_next, amount_in_actual, amount_out)
    };

    // Fee amount: if we fully consumed the step, fee = remaining - amount_in
    // otherwise fee = amount_in * fee / (1e6 - fee)
    let fee_amount = if amount_remaining_less_fee >= amount_in_max {
        // Reached target: fee is proportional to what was used
        if fee_pips == 0 {
            zero
        } else {
            amount_in * fee / (fee_denom - fee) + U256::from(1u64)
        }
    } else {
        amount_remaining - amount_in
    };

    SwapStepResult {
        sqrt_price_next,
        amount_in,
        amount_out,
        fee_amount,
    }
}

/// Calculate amount0 delta:  L * Q96 * (sqrtP_upper - sqrtP_lower) / (sqrtP_upper * sqrtP_lower)
/// Returns the rounded-up amount of token0 needed to move between two prices.
fn get_amount0_delta(sqrt_price_lower: U256, sqrt_price_upper: U256, liquidity: U256) -> U256 {
    if sqrt_price_lower >= sqrt_price_upper || sqrt_price_lower.is_zero() {
        return U256::ZERO;
    }
    let q96 = U256::from(1u128) << 96;
    let numerator = liquidity * q96 * (sqrt_price_upper - sqrt_price_lower);
    let denominator = sqrt_price_upper * sqrt_price_lower;
    if denominator.is_zero() {
        return U256::ZERO;
    }
    // round up
    (numerator + denominator - U256::from(1u64)) / denominator
}

/// Calculate amount1 delta:  L * (sqrtP_upper - sqrtP_lower) / Q96
/// Returns the rounded-up amount of token1 needed to move between two prices.
fn get_amount1_delta(sqrt_price_lower: U256, sqrt_price_upper: U256, liquidity: U256) -> U256 {
    if sqrt_price_lower >= sqrt_price_upper {
        return U256::ZERO;
    }
    let q96 = U256::from(1u128) << 96;
    let numerator = liquidity * (sqrt_price_upper - sqrt_price_lower);
    // round up
    (numerator + q96 - U256::from(1u64)) / q96
}

/// Given token0 input, compute the next sqrt price.
/// sqrtP_next = sqrtP * L / (L + amount * sqrtP / Q96)
fn get_next_sqrt_price_from_amount0(
    sqrt_price: U256,
    liquidity: U256,
    amount: U256,
) -> U256 {
    if amount.is_zero() {
        return sqrt_price;
    }
    let q96 = U256::from(1u128) << 96;
    let numerator = liquidity * sqrt_price;
    let denominator: U256 = liquidity + amount * sqrt_price / q96;
    if denominator.is_zero() {
        return sqrt_price;
    }
    numerator / denominator
}

/// Given token1 input, compute the next sqrt price.
/// sqrtP_next = sqrtP + amount * Q96 / L
fn get_next_sqrt_price_from_amount1(
    sqrt_price: U256,
    liquidity: U256,
    amount: U256,
) -> U256 {
    if liquidity.is_zero() {
        return sqrt_price;
    }
    let q96 = U256::from(1u128) << 96;
    sqrt_price + amount * q96 / liquidity
}

/// Convert a tick to a sqrtPriceX96 using the standard formula:
/// sqrtPrice = sqrt(1.0001^tick) * 2^96
/// For performance we compute via floating-point and convert.
pub fn tick_to_sqrt_price_x96(tick: i32) -> U256 {
    let sqrt_ratio = (1.0001_f64).powf(tick as f64 / 2.0);
    let q96_f64 = 2.0_f64.powi(96);
    let value = sqrt_ratio * q96_f64;
    if value <= 0.0 || !value.is_finite() {
        return U256::from(1u128) << 96; // 1.0 price
    }
    U256::from(value as u128)
}

/// Convert a sqrtPriceX96 to the nearest tick.
pub fn sqrt_price_x96_to_tick(sqrt_price_x96: U256) -> i32 {
    let q96_f64 = 2.0_f64.powi(96);
    let sqrt_ratio = sqrt_price_x96.to::<u128>() as f64 / q96_f64;
    if sqrt_ratio <= 0.0 {
        return 0;
    }
    let tick = (sqrt_ratio * sqrt_ratio).ln() / 1.0001_f64.ln();
    tick.floor() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt_u256(U256::from(0)), U256::from(0));
        assert_eq!(sqrt_u256(U256::from(1)), U256::from(1));
        assert_eq!(sqrt_u256(U256::from(4)), U256::from(2));
        assert_eq!(sqrt_u256(U256::from(9)), U256::from(3));
        assert_eq!(sqrt_u256(U256::from(16)), U256::from(4));
    }

    #[test]
    fn test_slippage() {
        let amount = U256::from(1000);
        // 0.5% slippage (50 bps)
        let result = apply_slippage(amount, 50);
        assert_eq!(result, U256::from(995));
    }

    #[test]
    fn test_compute_swap_step_zero_for_one() {
        // sqrt price at tick 0 = 1.0 * 2^96
        let sqrt_price_current = U256::from(1u128) << 96;
        // target at a lower tick (e.g. tick -100)
        let sqrt_price_target = tick_to_sqrt_price_x96(-100);
        let liquidity: u128 = 1_000_000_000_000_000_000_000; // 1000 tokens
        let amount_remaining = U256::from(1_000_000_000_000_000_000u128); // 1 token
        let fee_pips = 3000u32; // 0.3%

        let result = compute_swap_step(
            sqrt_price_current,
            sqrt_price_target,
            liquidity,
            amount_remaining,
            fee_pips,
        );

        // Output should be non-zero and less than input
        assert!(result.amount_out > U256::ZERO, "Should have output");
        assert!(result.amount_in > U256::ZERO, "Should consume input");
        assert!(result.fee_amount > U256::ZERO, "Should have fee");
    }

    #[test]
    fn test_compute_swap_step_one_for_zero() {
        let sqrt_price_current = U256::from(1u128) << 96;
        let sqrt_price_target = tick_to_sqrt_price_x96(100);
        let liquidity: u128 = 1_000_000_000_000_000_000_000;
        let amount_remaining = U256::from(1_000_000_000_000_000_000u128);
        let fee_pips = 3000u32;

        let result = compute_swap_step(
            sqrt_price_current,
            sqrt_price_target,
            liquidity,
            amount_remaining,
            fee_pips,
        );

        assert!(result.amount_out > U256::ZERO, "Should have output");
        assert!(result.amount_in > U256::ZERO, "Should consume input");
    }

    #[test]
    fn test_compute_swap_step_zero_remaining() {
        let sqrt_price_current = U256::from(1u128) << 96;
        let sqrt_price_target = tick_to_sqrt_price_x96(-60);
        let liquidity: u128 = 1_000_000_000_000_000_000_000;
        let fee_pips = 3000u32;

        let result = compute_swap_step(
            sqrt_price_current,
            sqrt_price_target,
            liquidity,
            U256::ZERO,
            fee_pips,
        );

        assert_eq!(result.amount_in, U256::ZERO);
        assert_eq!(result.amount_out, U256::ZERO);
        assert_eq!(result.sqrt_price_next, sqrt_price_current);
    }

    #[test]
    fn test_tick_to_sqrt_price_roundtrip() {
        for tick in [-10000, -1000, -100, 0, 100, 1000, 10000] {
            let sqrt_price = tick_to_sqrt_price_x96(tick);
            let recovered_tick = sqrt_price_x96_to_tick(sqrt_price);
            assert!(
                (recovered_tick - tick).abs() <= 1,
                "Tick roundtrip failed: {} -> {} -> {}",
                tick,
                sqrt_price,
                recovered_tick
            );
        }
    }

    #[test]
    fn test_amount0_delta_basic() {
        let q96 = U256::from(1u128) << 96;
        let sqrt_lower = q96; // price = 1
        let sqrt_upper = q96 * U256::from(2); // price = 4 (sqrt(4) = 2)
        let liq = U256::from(1_000_000_000_000_000_000u128);

        let delta = get_amount0_delta(sqrt_lower, sqrt_upper, liq);
        assert!(delta > U256::ZERO);
    }

    #[test]
    fn test_amount1_delta_basic() {
        let q96 = U256::from(1u128) << 96;
        let sqrt_lower = q96;
        let sqrt_upper = q96 * U256::from(2);
        let liq = U256::from(1_000_000_000_000_000_000u128);

        let delta = get_amount1_delta(sqrt_lower, sqrt_upper, liq);
        assert!(delta > U256::ZERO);
    }
}
