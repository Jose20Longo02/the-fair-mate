// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Deposit contract for platform: users call depositFor(userId, amount)
 * to send USDC to the treasury. Backend indexes Deposit events to credit user balance.
 */
contract Deposit is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public immutable treasury;

    event DepositFor(string userId, uint256 amount);

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0) && _treasury != address(0), "Invalid addresses");
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * User must have approved this contract for at least `amount` USDC (6 decimals).
     * Transfers USDC from msg.sender to treasury and emits DepositFor for backend indexing.
     */
    function depositFor(string calldata userId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(userId).length > 0, "UserId required");
        require(usdc.transferFrom(msg.sender, treasury, amount), "Transfer failed");
        emit DepositFor(userId, amount);
    }
}
