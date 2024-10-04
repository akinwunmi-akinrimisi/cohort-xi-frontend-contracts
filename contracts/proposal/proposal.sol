// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProposalContract {
    struct Proposal {
        string description;
        address payable recipient;
        uint256 amount;
        uint256 voteCount;
        uint256 votingDeadline;
        uint256 minVotesToPass;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    uint256 public proposalCount;

    event ProposalCreated(
        uint256 indexed proposalId,
        string description,
        address recipient,
        uint256 amount,
        uint256 votingDeadline,
        uint256 minVotesToPass
    );
    event Voted(uint256 indexed proposalId, address voter);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor() {
        // Initialize proposalCount to prevent proposal with ID 0
        proposalCount = 1;
    }

    function createProposal(
        string memory _description,
        address payable _recipient,
        uint256 _amount,
        uint256 _votingPeriod,
        uint256 _minVotesToPass
    ) public {
        require(_amount > 0, "Amount must be greater than zero");
        require(_votingPeriod > 0, "Voting period must be greater than zero");
        require(_minVotesToPass > 0, "Minimum votes to pass must be greater than zero");

        uint256 proposalId = proposalCount;
        proposals[proposalId] = Proposal({
            description: _description,
            recipient: _recipient,
            amount: _amount,
            voteCount: 0,
            votingDeadline: block.timestamp + _votingPeriod,
            minVotesToPass: _minVotesToPass,
            executed: false
        });
        
        emit ProposalCreated(proposalId, _description, _recipient, _amount, block.timestamp + _votingPeriod, _minVotesToPass);
        proposalCount++;
    }

    function vote(uint256 _proposalId) public {
        require(_proposalId > 0 && _proposalId < proposalCount, "Invalid proposal ID");
        require(!hasVoted[msg.sender][_proposalId], "Already voted on this proposal");
        require(block.timestamp <= proposals[_proposalId].votingDeadline, "Voting period has ended");

        proposals[_proposalId].voteCount++;
        hasVoted[msg.sender][_proposalId] = true;

        emit Voted(_proposalId, msg.sender);
    }

    function executeProposal(uint256 _proposalId) public {
        require(_proposalId > 0 && _proposalId < proposalCount, "Invalid proposal ID");
        Proposal storage proposal = proposals[_proposalId];

        require(block.timestamp > proposal.votingDeadline, "Voting period has not ended");
        require(!proposal.executed, "Proposal has already been executed");
        require(proposal.voteCount >= proposal.minVotesToPass, "Not enough votes to pass");
        require(address(this).balance >= proposal.amount, "Insufficient contract balance");

        proposal.executed = true;
        proposal.recipient.transfer(proposal.amount);

        emit ProposalExecuted(_proposalId);
    }

    // Function to allow the contract to receive Ether
    receive() external payable {}
}
