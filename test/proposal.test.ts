import { expect } from "chai";
import { ethers } from "hardhat";
import {
    ProposalContract,
    ProposalContract__factory,
} from "../typechain-types";

describe("proposal", function () {
    let ProposalcontractFactory: ProposalContract__factory;
    let proposalContract: ProposalContract;
    let owner: any;
    let addr1: any;
    let addr2: any;

    beforeEach(async function () {
        ProposalcontractFactory = await ethers.getContractFactory(
            "ProposalContract"
        );
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy the contract
        proposalContract = await ProposalcontractFactory.deploy();
        await proposalContract.waitForDeployment();

        // Fund the contract with some Ether to use in proposal execution
        await owner.sendTransaction({
            to: proposalContract.target,
            value: ethers.parseEther("10"),
        });
    });

    it("Should create a proposal correctly", async function () {
        const tx = await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            3 * 24 * 60 * 60, // 3 days
            2 // Minimum 2 votes to pass
        );

        // Wait for the transaction to be mined
        await tx.wait();

        const proposal = await proposalContract.proposals(1);

        expect(proposal.description).to.equal("Send 1 ETH to addr1");
        expect(proposal.recipient).to.equal(addr1.address);
        expect(proposal.amount).to.equal(ethers.parseEther("1"));
        expect(proposal.voteCount).to.equal(0);
        expect(proposal.executed).to.equal(false);
    });

    it("Should allow voting on a proposal", async function () {
        await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            3 * 24 * 60 * 60, // 3 days
            2 // Minimum 2 votes to pass
        );

        await proposalContract.connect(addr1).vote(1);
        await proposalContract.connect(addr2).vote(1);

        const proposal = await proposalContract.proposals(1);
        expect(proposal.voteCount).to.equal(2);

        // Check if voting status is recorded correctly
        expect(await proposalContract.hasVoted(addr1.address, 1)).to.equal(
            true
        );
        expect(await proposalContract.hasVoted(addr2.address, 1)).to.equal(
            true
        );
    });

    it("Should not allow voting after the voting deadline", async function () {
        await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            60, // 60 seconds voting period
            2 // Minimum 2 votes to pass
        );

        // Move forward in time by 2 minutes
        await ethers.provider.send("evm_increaseTime", [120]);
        await ethers.provider.send("evm_mine", []);

        // Attempt to vote after the deadline
        await expect(
            proposalContract.connect(addr1).vote(1)
        ).to.be.revertedWith("Voting period has ended");
    });

    it("Should execute a proposal successfully", async function () {
        await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            3 * 24 * 60 * 60, // 3 days
            2 // Minimum 2 votes to pass
        );

        await proposalContract.connect(addr1).vote(1);
        await proposalContract.connect(addr2).vote(1);

        // Move forward in time to surpass the voting period
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        const initialBalance = await ethers.provider.getBalance(addr1.address);

        // Execute the proposal
        await proposalContract.executeProposal(1);

        const finalBalance = await ethers.provider.getBalance(addr1.address);
        expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1"));

        const proposal = await proposalContract.proposals(1);
        expect(proposal.executed).to.equal(true);
    });

    it("Should not execute a proposal before the voting period ends", async function () {
        await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            3 * 24 * 60 * 60, // 3 days
            2 // Minimum 2 votes to pass
        );

        await proposalContract.connect(addr1).vote(1);
        await proposalContract.connect(addr2).vote(1);

        // Attempt to execute before the voting period ends
        await expect(proposalContract.executeProposal(1)).to.be.revertedWith(
            "Voting period has not ended"
        );
    });

    it("Should not execute a proposal if not enough votes are cast", async function () {
        await proposalContract.createProposal(
            "Send 1 ETH to addr1",
            addr1.address,
            ethers.parseEther("1"),
            3 * 24 * 60 * 60, // 3 days
            3 // Minimum 3 votes to pass
        );

        await proposalContract.connect(addr1).vote(1);
        await proposalContract.connect(addr2).vote(1);

        // Move forward in time to surpass the voting period
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        // Attempt to execute without enough votes
        await expect(proposalContract.executeProposal(1)).to.be.revertedWith(
            "Not enough votes to pass"
        );
    });
});
