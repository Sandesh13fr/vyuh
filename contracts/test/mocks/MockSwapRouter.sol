// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapRouterV3} from "../../src/interfaces/ISwapRouterV3.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice MOCK V3 router: pulls tokenIn, mints tokenOut at a fixed rate (out = in * rate / 1e18).
contract MockSwapRouter is ISwapRouterV3 {
    mapping(address => mapping(address => uint256)) public rate;
    /// @notice Set the pair rate in base units, scaled by 1e18.
    function setRate(address tokenIn, address tokenOut, uint256 rate_) external { rate[tokenIn][tokenOut] = rate_; }
    /// @inheritdoc ISwapRouterV3
    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 amountOut) {
        IERC20(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);
        amountOut = p.amountIn * rate[p.tokenIn][p.tokenOut] / 1e18;
        require(amountOut >= p.amountOutMinimum, "Too little received");
        MockERC20(p.tokenOut).mint(p.recipient, amountOut);
    }
}
