// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IExecutionAdapter {
    /// @notice Pull input from caller and swap directly to recipient.
    function swap(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 minOut, address recipient)
        external returns (uint256 amountOut);
}
