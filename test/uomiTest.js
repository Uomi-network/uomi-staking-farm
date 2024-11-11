let expect;
before(async () => {
    ({ expect } = await import("chai"));
});
const { ethers } = require("hardhat");


describe("UomiFarm", function () {
  let UomiFarm;
  let uomiFarm;
  let UomiToken;
  let uomiToken;
  let StakeToken;
  let stakeToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const REWARD_PER_BLOCK = ethers.utils.parseEther("100"); // 100 tokens per block
  const INITIAL_MINT = ethers.utils.parseEther("1000000"); // 1M tokens
  const ALLOCATION_POINT = 100;

  beforeEach(async function () {
    // Get test accounts
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    UomiToken = await ethers.getContractFactory("MockERC20");
    uomiToken = await UomiToken.deploy("Uomi Token", "UOMI");
    await uomiToken.mint(owner.address, INITIAL_MINT);

    StakeToken = await ethers.getContractFactory("MockERC20");
    stakeToken = await StakeToken.deploy("Stake Token", "STK");
    await stakeToken.mint(addr1.address, INITIAL_MINT);
    await stakeToken.mint(addr2.address, INITIAL_MINT);

    // Deploy UomiFarm
    const currentBlock = await ethers.provider.getBlockNumber();
    const maxRewardBlock = currentBlock + 1000; // Set max reward block to current + 1000
    
    UomiFarm = await ethers.getContractFactory("uomiFarm");
    uomiFarm = await UomiFarm.deploy(
      await uomiToken.getAddress(),
      REWARD_PER_BLOCK,
      maxRewardBlock
    );

    // Transfer reward tokens to the farm
    await uomiToken.transfer(
      await uomiFarm.getAddress(),
      ethers.utils.parseEther("500000")
    );

    // Add staking pool
    await uomiFarm.add(ALLOCATION_POINT, await stakeToken.getAddress(), false);

    // Approve tokens for staking
    await stakeToken.connect(addr1).approve(
      await uomiFarm.getAddress(),
      INITIAL_MINT
    );
    await stakeToken.connect(addr2).approve(
      await uomiFarm.getAddress(),
      INITIAL_MINT
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await uomiFarm.owner()).to.equal(owner.address);
    });

    it("Should set the correct reward per block", async function () {
      expect(await uomiFarm.rewardPerBlock()).to.equal(REWARD_PER_BLOCK);
    });

    it("Should initialize pool correctly", async function () {
      const pool = await uomiFarm.poolInfo(0);
      expect(pool.token).to.equal(await stakeToken.getAddress());
      expect(pool.allocPoint).to.equal(ALLOCATION_POINT);
      expect(pool.totalStaked).to.equal(0);
    });
  });

  describe("Pool Management", function () {
    it("Should allow owner to add new pools", async function () {
      const newStakeToken = await StakeToken.deploy("New Stake", "NSTK");
      await uomiFarm.add(50, await newStakeToken.getAddress(), false);
      
      expect(await uomiFarm.poolLength()).to.equal(2);
      const pool = await uomiFarm.poolInfo(1);
      expect(pool.token).to.equal(await newStakeToken.getAddress());
      expect(pool.allocPoint).to.equal(50);
    });

    it("Should revert when adding pool with zero allocation points", async function () {
      const newStakeToken = await StakeToken.deploy("New Stake", "NSTK");
      await expect(
        uomiFarm.add(0, await newStakeToken.getAddress(), false)
      ).to.be.revertedWithCustomError(uomiFarm, "AllocPointZero");
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await uomiFarm.connect(addr1).deposit(0, stakeAmount);

      const userInfo = await uomiFarm.userInfo(0, addr1.address);
      expect(userInfo.amount).to.equal(stakeAmount);
    });

    it("Should revert when staking zero amount", async function () {
      await expect(
        uomiFarm.connect(addr1).deposit(0, 0)
      ).to.be.revertedWithCustomError(uomiFarm, "DepositZero");
    });

    it("Should update pool total staked amount", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await uomiFarm.connect(addr1).deposit(0, stakeAmount);

      const pool = await uomiFarm.poolInfo(0);
      expect(pool.totalStaked).to.equal(stakeAmount);
    });
  });

  describe("Rewards and Withdrawals", function () {
    it("Should not distribute rewards before mainnet release", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await uomiFarm.connect(addr1).deposit(0, stakeAmount);

      // Mine a few blocks
      await mine(5);

      const totalReward = await uomiFarm.getTotalRewardByPoolId(0, addr1.address);
      expect(totalReward).to.equal(0);
    });

    it("Should forfeit rewards when withdrawing before mainnet release", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await uomiFarm.connect(addr1).deposit(0, stakeAmount);

      // Mine a few blocks
      await mine(5);

      // Withdraw all tokens
      await uomiFarm.connect(addr1).withdrawAll(0);

      const userInfo = await uomiFarm.userInfo(0, addr1.address);
      expect(userInfo.amount).to.equal(0);
      expect(userInfo.pendingReward).to.equal(0);
    });

    it("Should stop generating rewards after maxRewardBlockNumber", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await uomiFarm.connect(addr1).deposit(0, stakeAmount);

      const currentBlock = await ethers.provider.getBlockNumber();
      await uomiFarm.updateMaxRewardBlockNumber(currentBlock + 5);

      // Mine more blocks than maxRewardBlockNumber
      await mine(10);

      const pool = await uomiFarm.poolInfo(0);
      expect(pool.lastRewardBlock).to.be.lte(await uomiFarm.maxRewardBlockNumber());
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update maxRewardBlockNumber", async function () {
      const newMaxBlock = 1000000;
      await uomiFarm.updateMaxRewardBlockNumber(newMaxBlock);
      expect(await uomiFarm.maxRewardBlockNumber()).to.equal(newMaxBlock);
    });

    it("Should allow owner to update rewardPerBlock", async function () {
      const newRewardPerBlock = ethers.utils.parseEther("200");
      await uomiFarm.updateRewardPerBlock(newRewardPerBlock);
      expect(await uomiFarm.rewardPerBlock()).to.equal(newRewardPerBlock);
    });

    it("Should allow owner to redeem all rewards", async function () {
      const initialBalance = await uomiToken.balanceOf(owner.address);
      await uomiFarm.redeemAllRewards(owner.address);
      const finalBalance = await uomiToken.balanceOf(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });
});

async function mine(blocks) {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
}