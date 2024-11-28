const { ethers, upgrades } = require("hardhat");

async function main() {
  rewardsPerBlock = "63400000000000000000";
  endFarmBlock = "33374297";

  const uomi = await ethers.getContractFactory("uomiFarm");

  const uomideployed = await upgrades.deployProxy(uomi, [rewardsPerBlock, endFarmBlock], {
    initializer: "initialize",
    kind: "uups",
  });


  console.log("UOMI deployed to:", uomideployed.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
