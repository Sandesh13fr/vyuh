// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev MOCK V3 pool exposing just the oracle surface. Cumulative delta is set directly.
contract MockV3Pool {
    address public token0;
    address public token1;
    int56 public delta;
    uint16 public cardinalityNext = 1;

    constructor(address t0, address t1) {
        token0 = t0;
        token1 = t1;
    }

    function setDelta(int56 d) external {
        delta = d;
    }

    function observe(uint32[] calldata) external view returns (int56[] memory c, uint160[] memory s) {
        c = new int56[](2);
        s = new uint160[](2);
        c[0] = 1_000_000;
        c[1] = 1_000_000 + delta;
    }

    function increaseObservationCardinalityNext(uint16 n) external {
        if (n > cardinalityNext) cardinalityNext = n;
    }
}
