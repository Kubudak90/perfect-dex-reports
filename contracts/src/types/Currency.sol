// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Currency is an address wrapper that supports native ETH
type Currency is address;

using {greaterThan as >, lessThan as <, greaterThanOrEqualTo as >=, equals as ==} for Currency global;

/// @notice Returns true if currency0 is greater than currency1
function greaterThan(Currency currency0, Currency currency1) pure returns (bool) {
    return Currency.unwrap(currency0) > Currency.unwrap(currency1);
}

/// @notice Returns true if currency0 is less than currency1
function lessThan(Currency currency0, Currency currency1) pure returns (bool) {
    return Currency.unwrap(currency0) < Currency.unwrap(currency1);
}

/// @notice Returns true if currency0 is greater than or equal to currency1
function greaterThanOrEqualTo(Currency currency0, Currency currency1) pure returns (bool) {
    return Currency.unwrap(currency0) >= Currency.unwrap(currency1);
}

/// @notice Returns true if currency0 equals currency1
function equals(Currency currency0, Currency currency1) pure returns (bool) {
    return Currency.unwrap(currency0) == Currency.unwrap(currency1);
}

/// @notice Library for Currency operations
library CurrencyLibrary {
    using CurrencyLibrary for Currency;

    /// @notice Address representing native ETH
    address public constant ADDRESS_ZERO = address(0);

    /// @notice Currency representing native ETH
    Currency public constant NATIVE = Currency.wrap(ADDRESS_ZERO);

    /// @notice Returns true if the currency is native ETH
    function isNative(Currency currency) internal pure returns (bool) {
        return Currency.unwrap(currency) == ADDRESS_ZERO;
    }

    /// @notice Returns the address of the currency
    function toAddress(Currency currency) internal pure returns (address) {
        return Currency.unwrap(currency);
    }

    /// @notice Converts an address to Currency
    function fromAddress(address addr) internal pure returns (Currency) {
        return Currency.wrap(addr);
    }
}
