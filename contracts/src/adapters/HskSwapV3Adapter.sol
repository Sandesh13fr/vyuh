// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IExecutionAdapter} from "../interfaces/IExecutionAdapter.sol";
import {ISwapRouterV3} from "../interfaces/ISwapRouterV3.sol";
import {InvalidAddress, InvalidIntent, TransferMismatch} from "../types/VyuhTypes.sol";
contract HskSwapV3Adapter is IExecutionAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    ISwapRouterV3 public immutable router;
    constructor(ISwapRouterV3 router_) {
        if (address(router_).code.length == 0) revert InvalidAddress();
        router = router_;
    }
    /// @inheritdoc IExecutionAdapter
    function swap(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 minOut, address recipient)
        external nonReentrant returns (uint256 amountOut)
    {
        if (recipient != msg.sender || tokenIn == tokenOut || amountIn == 0) revert InvalidIntent();
        IERC20 input = IERC20(tokenIn);
        uint256 beforeBalance = input.balanceOf(address(this));
        input.safeTransferFrom(msg.sender, address(this), amountIn);
        if (input.balanceOf(address(this)) != beforeBalance + amountIn) revert TransferMismatch();
        input.forceApprove(address(router), amountIn);
        amountOut = router.exactInputSingle(ISwapRouterV3.ExactInputSingleParams({
            tokenIn: tokenIn, tokenOut: tokenOut, fee: fee, recipient: recipient, deadline: block.timestamp,
            amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
        }));
        input.forceApprove(address(router), 0);
        if (input.balanceOf(address(this)) != beforeBalance || amountOut < minOut) revert TransferMismatch();
    }
}
