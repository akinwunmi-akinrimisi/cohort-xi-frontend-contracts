// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ProposalContractModule = buildModule("ProposalContractModule", (m) => {
  const proposalContract = m.contract("ProposalContract", [], {});

  return { proposalContract };
});

export default ProposalContractModule;

// deployed address: 0x72386218c2437e941140341B3774C5FB591F84eb
