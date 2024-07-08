const hre = require("hardhat");

async function main() {
  uomiAddress = "0x799a356Ca3B5D229AC49CB8AFc9EDb8c1b23Ea1A";
  rewardsPerBlock = "1";
  endFarmBlock = "9999999";

  const uomi = await hre.ethers.deployContract("uomiFarm", [
    uomiAddress,
    rewardsPerBlock,
    endFarmBlock,
  ]);

  await uomi.waitForDeployment();

  console.log("UOMI deployed to:", uomi.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
