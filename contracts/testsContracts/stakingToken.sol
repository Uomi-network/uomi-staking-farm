// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract stakingToken is ERC20, ERC20Permit, Ownable {
    constructor()
        ERC20("stakingToken", "stakingToken")
        ERC20Permit("stakingToken")
        Ownable(msg.sender)
    {
        _mint(msg.sender, 31536000 * 10 ** decimals());
    }
}
