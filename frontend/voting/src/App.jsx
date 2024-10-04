// src/App.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";  // Import ethers for contract interaction
import { PROPOSAL_CONTRACT_ADDRESS, PROPOSAL_CONTRACT_ABI } from "./contracts/config";
import ConnectWalletButton from "./components/ConnectWalletButton";  // Import the Connect Wallet Button

const App = () => {
  const [currentAccount, setCurrentAccount] = useState(null);  // Track connected account
  const [contract, setContract] = useState(null);  // Track contract instance
  const [proposals, setProposals] = useState([]);  // Track proposals
  const [errorMessage, setErrorMessage] = useState("");  // Handle errors

  // Handle wallet connection
  const handleWalletConnection = (walletAddress) => {
    setCurrentAccount(walletAddress);
  };

  // Initialize the contract instance
  const initializeContract = async () => {
    if (!currentAccount) return;

    // Create a new provider and signer
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    // Create the contract instance
    const proposalContract = new ethers.Contract(PROPOSAL_CONTRACT_ADDRESS, PROPOSAL_CONTRACT_ABI, signer);
    setContract(proposalContract);
  };

  // Fetch all existing proposals
  const fetchProposals = async () => {
    if (!contract) return;

    try {
      const proposalCount = await contract.proposalCount();  // Fetch total number of proposals
      const proposalArray = [];
      for (let i = 1; i < proposalCount; i++) {
        const proposal = await contract.proposals(i);
        proposalArray.push({
          id: i,
          description: proposal.description,
          recipient: proposal.recipient,
          amount: ethers.utils.formatEther(proposal.amount),
          voteCount: proposal.voteCount.toNumber(),
          votingDeadline: new Date(proposal.votingDeadline.toNumber() * 1000).toLocaleString(),
          minVotesToPass: proposal.minVotesToPass.toNumber(),
          executed: proposal.executed,
        });
      }
      setProposals(proposalArray);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  };

  // Re-initialize the contract instance when the connected account changes
  useEffect(() => {
    if (currentAccount) {
      initializeContract();
    }
  }, [currentAccount]);

  return (
    <div className="App">
      <h1>Proposal DApp with Reown Appkit</h1>
      {/* Render the Connect Wallet Button */}
      <ConnectWalletButton onWalletConnected={handleWalletConnection} />

      {/* Display the connected account if available */}
      {currentAccount && (
        <div>
          <p>Connected Wallet: {currentAccount}</p>
          <button onClick={fetchProposals}>Load Proposals</button>
        </div>
      )}

      {/* Display the proposals */}
      <div>
        <h2>All Proposals</h2>
        {proposals.length === 0 ? (
          <p>No proposals found</p>
        ) : (
          <ul>
            {proposals.map((proposal) => (
              <li key={proposal.id}>
                <h3>Proposal {proposal.id}</h3>
                <p>Description: {proposal.description}</p>
                <p>Recipient: {proposal.recipient}</p>
                <p>Amount: {proposal.amount} ETH</p>
                <p>Vote Count: {proposal.voteCount}</p>
                <p>Voting Deadline: {proposal.votingDeadline}</p>
                <p>Minimum Votes to Pass: {proposal.minVotesToPass}</p>
                <p>Status: {proposal.executed ? "Executed" : "Pending"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
    </div>
  );
};

export default App;
