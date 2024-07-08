# Uomi Network

![Uomi Network](https://pbs.twimg.com/profile_images/1803434790680506368/tEAb8qfo_400x400.jpg)

## Introduction

Uomi Network farm Smart Contract. This project is built using HardHat, and the smart contract is written in Solidity.

## Features

- **Staking**: Users can deposit their Uomi tokens to earn rewards.
- **Multiple Pools**: Support for multiple staking pools with different tokens.
- **Block Rewards**: Distribution of rewards per mined block.
- **Allocation Points**: Each pool has customizable allocation points that determine the distribution of rewards.
- **Management**: Only the contract owner can add new pools or modify existing parameters.

## Installation

1. **Clone the repository**:

   ```sh
   git clone https://github.com/genjigakura/uomi-staking-farm.git
   cd uomi-staking-farm
   ```

2. **Install dependencies**:

   ```sh
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the project's root directory and add the following variables:

   ```
    ETHERSCAN_API_KEY=YOUR_API_KEY
    PRIVATE_KEY=YOUR_PRIVATE_KEY
    ALCHEMY_KEY=YOUR_API_KEY
    COINMARKETCAP_API_KEY=YOUR_API_KEY
   ```

4. **Compile the contract**:

   ```sh
   npx hardhat compile
   ```

5. **Deploy the contract**:
   ```sh
   npx hardhat run scripts/deploy.js --network your_network
   ```

## Usage

### Deposit Tokens

Users can deposit tokens into the staking pools to start earning rewards. Use the `deposit` function:

```javascript
await uomiFarm.deposit(poolId, amount);
```

### Withdraw Tokens

Users can withdraw their tokens at any time using the `withdraw` function:

```javascript
await uomiFarm.withdraw(poolId, amount);
```

### Claim Rewards

Users can claim their pending rewards using the `claimReward` function:

```javascript
await uomiFarm.claimReward(poolId);
```

## Smart Contract

### Overview

The smart contract `uomiFarm` manages the staking and reward distribution logic. It leverages OpenZeppelin libraries for enhanced security and functionality.

### Key Structures

- **UserInfo**: This struct stores details for each user including:

  - `amount`: Number of tokens the user has staked.
  - `rewardDebt`: Tracks the user's pending reward debt.
  - `lastDepositTime`: Timestamp of the user's last deposit.

- **PoolInfo**: This struct holds details for each staking pool:
  - `token`: The address of the staked token.
  - `allocPoint`: The allocation points assigned to the pool, dictating Uomi distribution per block.
  - `lastRewardBlock`: The last block number when Uomi distribution occurred or will occur.
  - `accUomiPerShare`: Accumulated Uomi per share, multiplied by 1e18.
  - `totalStaked`: Total tokens staked in the pool.
  - `minTimeStaked`: Minimum time in seconds required to stake to earn rewards.

### Key Functions

- **`deposit(uint256 _pid, uint256 _amount)`**: Allows users to deposit tokens into a specified pool. This function updates the pool's reward distribution, transfers the user's tokens to the contract, and updates the user's staked amount and reward debt.
- **`withdraw(uint256 _pid, uint256 _amount)`**: Enables users to withdraw their staked tokens from a specific pool. This function ensures the user has enough tokens staked, calculates pending rewards, and updates the pool's and user's information accordingly.

- **`claimReward(uint256 _pid)`**: Allows users to claim their pending rewards from a specified pool. It transfers the pending rewards to the user's address and updates their reward debt.

- **`add(uint256 _allocPoint, IERC20 _token, bool _withUpdate, uint256 _minTimeStaked, uint256 _lastRewardBlockNumber)`**: Allows the contract owner to add a new staking pool. This function can optionally update all pools before adding the new one.

- **`set(uint256 _pid, uint256 _allocPoint, bool _withUpdate)`**: Allows the contract owner to update the allocation points of an existing pool. Optionally updates all pools before making changes.

- **`massUpdatePools()`**: Iterates through all pools and updates their reward information. This function can be called by anyone.

- **`updatePool(uint256 _pid)`**: Updates a specific pool's reward information and calculates the accumulated Uomi rewards per share.

### Events

- `Deposited(address indexed user, uint256 indexed pid, uint256 amount)`: Emitted when a user deposits tokens into a pool.
- `Withdrawn(address indexed user, uint256 indexed pid, uint256 amount)`: Emitted when a user withdraws tokens from a pool.
- `ClaimedReward(address indexed user, uint256 indexed pid)`: Emitted when a user claims rewards from a pool.

### Errors

- `NotEnoughToWithdraw()`: Thrown when a user tries to withdraw more tokens than they have staked.
- `AllocPointZero()`: Thrown when allocation points are set to zero for a new pool.
- `MaxPoolCapReached()`: Thrown when a pool's reward block exceeds the maximum reward block number.
- `DepositZero()`: Thrown when a deposit amount is zero.
- `poolNotExist()`: Thrown when an operation is attempted on a non-existent pool.

## Testing

This project includes additional smart contracts used for testing purposes:

- **`stakingToken.sol`**: A mock token contract used for staking in tests.
- **`rewardToken.sol`**: A mock token contract used for rewarding in tests.

### Running Tests

To run the tests, use the following command:

```sh
npx hardhat test
```
