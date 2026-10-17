import prisma from "../src/lib/prisma";
import crypto from "crypto";

async function main() {
  console.log("Seeding persistent SQLite database...");

  // Publisher Account
  const publisherAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
  const contributorAddress = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";

  await prisma.user.upsert({
    where: { id: "user-publisher" },
    update: {},
    create: {
      id: "user-publisher",
      name: "web3-publisher-demo",
      email: "publisher@contribchain.local",
    },
  });

  await prisma.walletLink.upsert({
    where: { address: publisherAddress },
    update: {},
    create: {
      address: publisherAddress,
      userId: "user-publisher",
      githubId: "12345678",
    },
  });

  await prisma.user.upsert({
    where: { id: "user-contributor" },
    update: {},
    create: {
      id: "user-contributor",
      name: "solidity-contributor-demo",
      email: "contributor@contribchain.local",
    },
  });

  await prisma.walletLink.upsert({
    where: { address: contributorAddress },
    update: {},
    create: {
      address: contributorAddress,
      userId: "user-contributor",
      githubId: "87654321",
    },
  });

  // Project 1
  const proj1 = await prisma.project.upsert({
    where: { id: "proj-1" },
    update: {},
    create: {
      id: "proj-1",
      onChainId: 1,
      publisherAddress,
      name: "Uniswap v4 Periphery & Hooks",
      shortDescription: "Custom AMM liquidity pools and dynamic fee calculation hooks.",
      detailedDescription:
        "Building production-grade hooks and periphery contracts for Uniswap v4 on Ethereum Sepolia testnet. Contributors can design dynamic swap routers and liquidity managers.",
      category: "DeFi",
      technologies: JSON.stringify(["Solidity", "Foundry", "Uniswap v4", "TypeScript"]),
      repoId: "uniswap/v4-periphery",
      repoUrl: "https://github.com/uniswap/v4-periphery",
      liveDappUrl: "https://app.uniswap.org",
      metadataURI: "app://metadata/project/proj-1",
      metadataHash: "0x24c249d809d276015d1dde014b7c5275e23061a62b957a02764d3311f2afd1ba",
    },
  });

  // Project 2
  const proj2 = await prisma.project.upsert({
    where: { id: "proj-2" },
    update: {},
    create: {
      id: "proj-2",
      onChainId: 2,
      publisherAddress,
      name: "Chainlink Functions Web3 Toolkit",
      shortDescription: "Serverless off-chain compute connecting smart contracts with Web2 APIs.",
      detailedDescription:
        "Developer SDK providing cryptographic verification of off-chain API requests, consensus computation, and automated contract callbacks.",
      category: "Infrastructure",
      technologies: JSON.stringify(["Solidity", "Chainlink CCIP", "Node.js", "WebAssembly"]),
      repoId: "smartcontractkit/functions-toolkit",
      repoUrl: "https://github.com/smartcontractkit/functions-toolkit",
      liveDappUrl: "https://functions.chain.link",
      metadataURI: "app://metadata/project/proj-2",
      metadataHash: "0x58b9f1d44081c79a4ec8c1a6fcf4a54471b0db79fbb24a49931b67f1b2ee8840",
    },
  });

  // Project 3
  const proj3 = await prisma.project.upsert({
    where: { id: "proj-3" },
    update: {},
    create: {
      id: "proj-3",
      onChainId: 3,
      publisherAddress,
      name: "Safe Account Modules",
      shortDescription: "ERC-4337 smart contract account modules and passkey signers.",
      detailedDescription:
        "Modular smart accounts enabling social recovery, biometric passkey authentication, and batch transaction dispatchers for multi-sig operations.",
      category: "Tooling",
      technologies: JSON.stringify(["Solidity", "ERC-4337", "WebAuthn", "TypeScript"]),
      repoId: "safe-global/safe-smart-account",
      repoUrl: "https://github.com/safe-global/safe-smart-account",
      liveDappUrl: "https://app.safe.global",
      metadataURI: "app://metadata/project/proj-3",
      metadataHash: "0x789cf1d44081c79a4ec8c1a6fcf4a54471b0db79fbb24a49931b67f1b2ee9911",
    },
  });

  // Opportunity 1
  const opp1Deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.opportunity.upsert({
    where: { id: "opp-1" },
    update: {},
    create: {
      id: "opp-1",
      onChainId: 1,
      projectId: proj1.id,
      publisherAddress,
      title: "Gas-optimized TWAP Hook with dynamic tick intervals",
      taskType: "feature",
      description:
        "Design and implement a gas-optimized afterSwap hook for Uniswap v4 pools that records a cumulative time-weighted average price (TWAP) with bounded storage overhead.",
      acceptanceCriteria:
        "1. Comprehensive Foundry test suite with >95% line coverage.\n2. Gas cost strictly under 35,000 gas per swap.\n3. Verified deployment on Ethereum Sepolia testnet.",
      difficulty: "Advanced",
      requiredSkills: JSON.stringify(["Solidity ^0.8.20", "Uniswap v4 Core", "Foundry"]),
      rewardEth: "0.8",
      rewardWei: "800000000000000000",
      deadline: opp1Deadline,
      state: "OPEN",
    },
  });

  // Opportunity 2
  const opp2Deadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  await prisma.opportunity.upsert({
    where: { id: "opp-2" },
    update: {},
    create: {
      id: "opp-2",
      onChainId: 2,
      projectId: proj2.id,
      publisherAddress,
      title: "Cross-chain state proof verifier with CCIP callback",
      taskType: "feature",
      description:
        "Build a verified receiver contract that validates state proofs executed via Chainlink Functions and delivers cross-chain events to Sepolia.",
      acceptanceCriteria:
        "1. Merkle-Patricia Trie proof verifier in Solidity.\n2. Handles reorgs and timeout rollbacks gracefully.\n3. Pull request passed all CI checks.",
      difficulty: "Intermediate",
      requiredSkills: JSON.stringify(["Solidity", "Chainlink Functions", "Hardhat"]),
      rewardEth: "1.2",
      rewardWei: "1200000000000000000",
      deadline: opp2Deadline,
      state: "OPEN",
    },
  });

  console.log("Database seeded successfully with verified projects and opportunities!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
