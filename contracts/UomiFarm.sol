//
//
//       ██╗░░░██╗░█████╗░███╗░░░███╗██╗
//       ██║░░░██║██╔══██╗████╗░████║██║
//       ██║░░░██║██║░░██║██╔████╔██║██║
//       ██║░░░██║██║░░██║██║╚██╔╝██║██║
//       ╚██████╔╝╚█████╔╝██║░╚═╝░██║██║
//       ░╚═════╝░░╚════╝░╚═╝░░░░░╚═╝╚═╝
//
//       Staking farm contract for Uomi token
//
//
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract uomiFarm is Ownable {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount; // How many  tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 lastDepositTime; // Last deposit time
        //
        // We do some fancy math here. Basically, any point in time, the amount of Uomi
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (userInfo.amount * pool.accUomiPerShare) - userInfo.rewardDebt
        //
        // Whenever a user deposits or withdraws tokens to a pool. Here's what happens:
        //   1. The pool's accUomiPerShare (and lastRewardBlock) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's amount gets updated.
        //   4. User's rewardDebt gets updated.
    }

    struct PoolInfo {
        IERC20 token; // Address of staked token
        uint256 allocPoint; // How many allocation points assigned to this pool. Uomi to distribute per block.
        uint256 lastRewardBlock; // Last block number that Uomi distribution occurs.
        uint256 accUomiPerShare; // Accumulated Uomi per share, times 1e18. See below.
        uint256 totalStaked; // Total staked in this pool
        uint256 minTimeStaked; // min time staked in seconds to get rewards
    }

    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when uomi mining starts ->

    // max reward block
    uint256 public maxRewardBlockNumber;

    // rewad per block in wei
    uint256 public rewardPerBlock;

    // Accumulated uomi per share, times 1e18.
    uint256 public constant accUomiPerShareMultiple = 1e18;
    // The uomi token!
    IERC20 public uomi;

    // Info on each pool added
    PoolInfo[] public poolInfo;
    // Info of each user that stakes tokens.
    mapping(uint256 pid => mapping(address user => UserInfo)) public userInfo;
    //events
    event Deposited(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed pid, uint256 amount);
    event ClaimedReward(address indexed user, uint256 indexed pid);
    //errors
    error NotEnoughToWithdraw();
    error AllocPointZero();
    error MaxPoolCapReached();
    error DepositZero();
    error poolNotExist();

    constructor(
        IERC20 _uomi,
        uint256 _rewardPerBlock,
        uint256 _maxRewardBlockNumber
    ) Ownable(msg.sender) {
        uomi = _uomi;
        rewardPerBlock = _rewardPerBlock;
        maxRewardBlockNumber = _maxRewardBlockNumber;
    }

    /**
     * @dev Returns the total reward for a user in a specific pool.
     * @param _pid The pool ID.
     * @param _address The user's address.
     * @return The total reward for the user in the specified pool.
     */
    function getTotalRewardByPoolId(
        uint256 _pid,
        address _address
    ) public view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_address];

        uint256 poolRewardPerShare = getPoolRewardPerShare(_pid);
        uint256 totalReward = ((user.amount * poolRewardPerShare) /
            accUomiPerShareMultiple) - user.rewardDebt;

        return totalReward;
    }

    /**
     * @dev Returns the total reward for a user in all pools.
     * @param _address The user's address.
     * @return The total reward for the user in all pools.
     */
    function getTotalReward(address _address) public view returns (uint256) {
        uint256 totalReward = 0;
        uint256 length = poolInfo.length;

        for (uint256 pid = 0; pid < length; ++pid) {
            UserInfo storage user = userInfo[pid][_address];

            uint256 poolRewardPerShare = getPoolRewardPerShare(pid);

            totalReward =
                totalReward +
                ((user.amount * poolRewardPerShare) / accUomiPerShareMultiple) -
                user.rewardDebt;
        }

        return totalReward;
    }

    /**
     * @dev Returns the number of pools in the UomiFarm contract.
     * @return The length of the poolInfo array.
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @dev Updates the maximum reward block number.
     * @param _newMaxRewardBlockNumber The new maximum reward block number.
     * Only the contract owner can call this function.
     */
    function updateMaxRewardBlockNumber(
        uint256 _newMaxRewardBlockNumber
    ) public onlyOwner {
        maxRewardBlockNumber = _newMaxRewardBlockNumber;
    }

    /**
     * @dev Updates the reward per block for staking.
     * @param _rewardPerBlock The new reward per block value.
     * Only the contract owner can call this function.
     */
    function updateRewardPerBlock(uint256 _rewardPerBlock) public onlyOwner {
        rewardPerBlock = _rewardPerBlock;
    }

    /**
     * @dev Transfers all the UOMI tokens held by the contract to the specified address.
     * Can only be called by the contract owner.
     * @param _to The address to which the UOMI tokens will be transferred.
     */
    function redeemAllRewards(address _to) public onlyOwner {
        uint256 uomiBal = uomi.balanceOf(address(this));
        uomi.transfer(_to, uomiBal);
    }

    /**
     * @dev Adds a new pool to the UomiFarm contract.
     * @param _allocPoint The allocation point of the pool.
     * @param _token The address of the staked token.
     * @param _withUpdate Whether to update all pools before adding the new one.
     * @param _minTimeStaked The minimum time staked in seconds to get rewards
     * @notice Only the contract owner can call this function.
     */
    function add(
        uint256 _allocPoint, // allocation point for the pool
        IERC20 _token, // staked token address
        bool _withUpdate, //update all pools
        uint256 _minTimeStaked, // min time staked in seconds to get rewards
        uint256 _lastRewardBlockNumber // max reward block
    ) public onlyOwner {
        if (_allocPoint < 1) {
            revert AllocPointZero();
        }

        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                token: _token,
                allocPoint: _allocPoint,
                lastRewardBlock: _lastRewardBlockNumber,
                accUomiPerShare: 0,
                totalStaked: 0,
                minTimeStaked: _minTimeStaked
            })
        );
    }

    /**
     * @dev Updates the allocation point and other parameters of a pool.
     * @param _pid The pool ID.
     * @param _allocPoint The new allocation point for the pool.
     * @param _withUpdate Whether to update all pools before making the change.
     *                    Set to true if there are pending changes in other pools.
     *                    Set to false if only updating a single pool.
     * @notice Only the contract owner can call this function.
     */
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint =
            totalAllocPoint -
            poolInfo[_pid].allocPoint +
            _allocPoint;

        poolInfo[_pid].allocPoint = _allocPoint;
    }

    /**
     * @dev Updates all pools in the UomiFarm contract.
     * This function iterates through all the pools and calls the `updatePool` function for each pool.
     * It is a public function that can be called by anyone.
     */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /**
     * @dev Updates the pool information and calculates the accumulated UOMI rewards per share.
     * @param _pid The pool ID.
     * @notice This function should be called periodically to update the pool rewards.
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];

        if (pool.lastRewardBlock > maxRewardBlockNumber) {
            revert MaxPoolCapReached();
        }

        pool.accUomiPerShare = getPoolRewardPerShare(_pid);
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev Safely transfers UOMI tokens to a specified address.
     * If the contract's UOMI balance is less than the specified amount,
     * it transfers the entire balance. Otherwise, it transfers the specified amount.
     * @param _to The address to transfer the UOMI tokens to.
     * @param _amount The amount of UOMI tokens to transfer.
     */
    function safeUomiTransfer(address _to, uint256 _amount) internal {
        uint256 uomiBal = uomi.balanceOf(address(this));
        if (_amount > uomiBal) {
            uomi.transfer(_to, uomiBal);
        } else {
            uomi.transfer(_to, _amount);
        }
    }

    /**
     * @dev Allows a user to deposit tokens into a specific pool.
     * @param _pid The pool ID.
     * @param _amount The amount of tokens to deposit.
     * Requirements:
     * - The amount must be greater than zero.
     * - The pool must exist.
     * Effects:
     * - Updates the pool information.
     * - Transfers the deposited tokens from the user to the contract.
     * - Updates the user's staked amount and the pool's total staked amount.
     * - Calculates and transfers any pending rewards to the user.
     * - Updates the user's reward debt.
     * - Updates the user's last deposit time.
     * Emits a `Deposited` event.
     */
    function deposit(uint256 _pid, uint256 _amount) public {
        if (_amount == 0) {
            revert DepositZero();
        }
        PoolInfo storage pool = poolInfo[_pid];
        if (pool.token == IERC20(address(0))) {
            revert poolNotExist();
        }
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = ((user.amount * pool.accUomiPerShare) /
                accUomiPerShareMultiple) - user.rewardDebt;

            if (pending > 0) {
                safeUomiTransfer(msg.sender, pending);
            }
        }

        pool.token.safeTransferFrom(msg.sender, address(this), _amount);
        user.amount = user.amount + _amount;
        pool.totalStaked = pool.totalStaked + _amount;

        user.rewardDebt =
            (user.amount * pool.accUomiPerShare) /
            accUomiPerShareMultiple;
        user.lastDepositTime = block.timestamp;
        emit Deposited(msg.sender, _pid, _amount);
    }

    /**
     * @dev Allows a user to withdraw all their staked tokens from a specific pool.
     * @param _pid The pool ID.
     */
    function withdrawAll(uint256 _pid) public {
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        withdraw(_pid, amount);
    }

    /**
     * @dev Allows a user to withdraw their staked tokens from a specific pool.
     * @param _pid The pool ID.
     * @param _amount The amount of tokens to withdraw.
     * @notice The user must have enough tokens staked to withdraw the specified amount.
     * @notice If the user has not reached the minimum staking time for the pool, the withdrawal will be rejected.
     * @notice The user will receive any pending rewards before withdrawing their tokens.
     * @notice The user's staked token balance and the pool's total staked tokens will be updated accordingly.
     * @notice Emits a `Withdrawn` event with the user's address, pool ID, and amount of tokens withdrawn.
     */
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        if (user.amount < _amount) revert NotEnoughToWithdraw();

        updatePool(_pid);

        uint256 pending;
        if (user.lastDepositTime + pool.minTimeStaked <= block.timestamp) {
            pending =
                ((user.amount * pool.accUomiPerShare) /
                    accUomiPerShareMultiple) -
                user.rewardDebt;
        } else {
            pending = 0;
            //if the user withdraws before 30 days have passed, the timer restarts
            user.lastDepositTime = block.timestamp;
        }

        if (pending > 0) {
            safeUomiTransfer(msg.sender, pending);
        }

        if (_amount > 0) {
            user.amount = user.amount - _amount;
            pool.token.safeTransfer(msg.sender, _amount);
            pool.totalStaked = pool.totalStaked - _amount;
        }

        user.rewardDebt =
            (user.amount * pool.accUomiPerShare) /
            accUomiPerShareMultiple;

        emit Withdrawn(msg.sender, _pid, _amount);
    }

    /**
     * @dev Allows a user to claim their pending rewards for a specific pool.
     * @param _pid The pool ID.
     */
    function claimReward(uint256 _pid) public {
        UserInfo storage user = userInfo[_pid][msg.sender];
        PoolInfo storage pool = poolInfo[_pid];

        uint256 poolRewardPerShare = getPoolRewardPerShare(_pid);

        uint256 pending = user.lastDepositTime + pool.minTimeStaked <=
            block.timestamp
            ? ((user.amount * poolRewardPerShare) / accUomiPerShareMultiple) -
                user.rewardDebt
            : 0;

        if (pending > 0) {
            safeUomiTransfer(msg.sender, pending);

            user.rewardDebt =
                (user.amount * poolRewardPerShare) /
                accUomiPerShareMultiple;
        }

        emit ClaimedReward(msg.sender, _pid);
    }

    /**
     * @dev Calculates the reward per share for a given pool.
     * @param _pid The pool ID.
     * @return The reward per share for the pool.
     */
    function getPoolRewardPerShare(
        uint256 _pid
    ) internal view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number < pool.lastRewardBlock) {
            return 0;
        }
        uint256 tokenSupply = pool.totalStaked;
        if (tokenSupply == 0) {
            return 0;
        }
        if (pool.lastRewardBlock > maxRewardBlockNumber) {
            return 0;
        }

        uint256 currentRewardBlock = block.number >= maxRewardBlockNumber
            ? maxRewardBlockNumber
            : block.number;

        uint256 totalReward = (currentRewardBlock - pool.lastRewardBlock) *
            rewardPerBlock;

        uint256 uomiReward = (totalReward * pool.allocPoint) / totalAllocPoint;

        return
            pool.accUomiPerShare +
            ((uomiReward * accUomiPerShareMultiple) / tokenSupply);
    }

    function removeRewards(uint256 _amount) public onlyOwner {
        uomi.transfer(msg.sender, _amount);
    }
}
