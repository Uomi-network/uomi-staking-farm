const hre = require("hardhat");

async function main() {
  rewardsPerBlock = "1";
  endFarmBlock = "9999999";

  const uomi = await hre.ethers.deployContract("uomiFarm", [
    rewardsPerBlock,
    endFarmBlock,
  ]);


  console.log("UOMI deployed to:", uomi.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
