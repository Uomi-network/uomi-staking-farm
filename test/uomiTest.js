/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { time } = require("@openzeppelin/test-helpers");
const R = require("ramda");

const cyan = "\x1b[36m%s\x1b[0m";
const yellow = "\x1b[33m%s\x1b[0m";

const fromWei = (stringValue) => ethers.utils.formatUnits(stringValue, 18);
const toWei = (value) => ethers.utils.parseEther(value);

describe("OVRLandContainer", async () => {
  let RewardToken, rewardToken;
  let StakingToken, stakingToken;
  let UomiFarm, uomiFarm;

  beforeEach(async () => {
    RewardToken = await ethers.getContractFactory("rewardToken");
    StakingToken = await ethers.getContractFactory("stakingToken");
    UomiFarm = await ethers.getContractFactory("uomiFarm");

    [
      owner, // 50 ether
      addr1, // 0
      addr2, // 0
      addr3, // 0
      addr4, // 0
      addr5, // 0
      addr6, // 0
      addr7, // 0
      addr8, // 0
      addr9, // 0
      addr10, // 0
      addr11, // 0
      addr12, // 0
      addr13, // 0
      addr14, // 0
      addr15, // 0
      addr16, // 0
      addr17, // 0
      addr18, // 1000 ether
    ] = await ethers.getSigners();
  });

  describe("Uomi farm tests", () => {
    it("Should deploy contracts", async () => {
      rewardToken = await RewardToken.deploy();
      console.debug(cyan, `Reward token address: ${rewardToken.address}`);

      stakingToken = await StakingToken.deploy();
      console.debug(cyan, `Staking token address: ${stakingToken.address}`);

      uomiFarm = await UomiFarm.deploy(
        rewardToken.address,
        toWei("1"),
        999999999
      );
      console.debug(cyan, `Uomi farm address: ${uomiFarm.address}`);
    });
    it("send staking tokens to 10 addresses and all reward tokens to farm", async () => {
      const addresses = [
        addr1,
        addr2,
        addr3,
        addr4,
        addr5,
        addr6,
        addr7,
        addr8,
        addr9,
        addr10,
      ];
      const amount = toWei("1000");

      for (const address of addresses) {
        await stakingToken.transfer(address.address, amount);
        console.debug(
          yellow,
          `Staking token balance of ${address.address}: ${fromWei(
            await stakingToken.balanceOf(address.address)
          )}`
        );
      }

      await rewardToken.transfer(
        uomiFarm.address,
        await rewardToken.totalSupply()
      );
    });
    it("Add a new pool into the farm with 30 days", async () => {
      await uomiFarm.add(100, stakingToken.address, true, 2628000, 999999999);
      await uomiFarm.openMarket();
      console.debug(cyan, `Pool 0 info: ${await uomiFarm.poolInfo(0)}`);
    });

    it("Owner deposits 10 tokens into pool 0", async () => {
      await stakingToken.approve(uomiFarm.address, toWei("10"));
      await uomiFarm.deposit(0, toWei("10"));
      const userInfo = await uomiFarm.userInfo(0, owner.address);

      console.debug(
        "correct deposited",
        userInfo.amount.toString() == toWei("10")
      );
    });
    it("owner claims rewards", async () => {
      //console current block
      await uomiFarm.claimReward(0);
      const rewardTokenBalance = await rewardToken.balanceOf(owner.address);

      console.debug(
        "correct reward token balance",
        parseFloat(fromWei(rewardTokenBalance)).toFixed(2) == 0
      );
    });
    it("1 block passed, should have earned 1 tokens", async () => {
      const rewardByPoolId = await uomiFarm.getTotalRewardByPoolId(
        0,
        owner.address
      );
      console.debug("current block", await ethers.provider.getBlockNumber());
      console.debug(
        "correct earned",
        parseFloat(fromWei(rewardByPoolId)).toFixed(2) == 1
      );
    });

    it("addr1 should deposit 10 token into pool 0", async () => {
      await stakingToken.connect(addr1).approve(uomiFarm.address, toWei("10"));
      await uomiFarm.connect(addr1).deposit(0, toWei("10"));
      const userInfo = await uomiFarm.userInfo(0, addr1.address);

      console.debug(
        "correct deposited",
        userInfo.amount.toString() == toWei("10")
      );
    });
    it("1 block passed, addr1 should have earned 1 / 2", async () => {
      await time.advanceBlock();

      const addr1RewardByPoolId = await uomiFarm.getTotalRewardByPoolId(
        0,
        addr1.address
      );

      console.debug(
        "correct earned",
        parseFloat(fromWei(addr1RewardByPoolId)).toFixed(2) ==
          (1 / 2).toFixed(2)
      );
    });
    it("owner and addr1 should withdrawAll", async () => {
      await uomiFarm.withdrawAll(0);
      await uomiFarm.connect(addr1).withdrawAll(0);

      const userInfoOwner = await uomiFarm.userInfo(0, owner.address);
      const userInfoAddr1 = await uomiFarm.userInfo(0, addr1.address);

      console.debug(
        "correct withdrawn",
        userInfoOwner.amount.toString() == 0 &&
          userInfoAddr1.amount.toString() == 0
      );

      // addr1 and owner balance of rewardToken should be == 0 (30 days not passed)
      console.debug(
        "correct reward token balance",
        parseFloat(fromWei(await rewardToken.balanceOf(owner.address))) == 0 &&
          parseFloat(fromWei(await rewardToken.balanceOf(addr1.address))) == 0
      );
    });
    it("Owner deposits 10 tokens into pool 0", async () => {
      await stakingToken.approve(uomiFarm.address, toWei("10"));
      await uomiFarm.deposit(0, toWei("10"));

      const userInfo = await uomiFarm.userInfo(0, owner.address);

      console.debug(
        "correct deposited",
        userInfo.amount.toString() == toWei("10")
      );
    });

    it("31 days passed, should have earned multiple of 1 tokens", async () => {
      //1 block every 12 seconds
      for (let i = 0; i < 2628000 / 12; i++) {
        await time.advanceBlock();
      }

      const rewardByPoolId0 = await uomiFarm.getTotalRewardByPoolId(
        0,
        owner.address
      );

      console.debug(
        "correct earned",
        parseFloat(fromWei(rewardByPoolId0)).toFixed(2) == 2628000 / 12 //1 token per block
      );
    });
    it("time forward 1 month, owner should withdrawAll from pool 0", async () => {
      await time.increase(2628000); //1 month

      await uomiFarm.withdrawAll(0);

      const userInfo = await uomiFarm.userInfo(0, owner.address);

      console.debug("correct withdrawn", userInfo.amount.toString() == 0);

      // owner balance of rewardToken should be != 0
      console.debug(
        "correct reward token balance",
        parseFloat(fromWei(await rewardToken.balanceOf(owner.address))) != 0
      );
    });
  });
});
