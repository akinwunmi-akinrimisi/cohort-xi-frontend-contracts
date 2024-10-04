// src/components/ConnectWalletButton.jsx
import React, { useState, useEffect } from "react";
import { useAppkit, useWallet } from "@reown/appkit";

const ConnectWalletButton = ({ onWalletConnected }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const { connect, disconnect, isConnected, currentAccount } = useWallet();
  const { provider } = useAppkit();  // Optional: Reown Appkit's provider setup (if needed)

  // Set the wallet address when the connection status changes
  useEffect(() => {
    if (isConnected) {
      setWalletAddress(currentAccount);
      onWalletConnected(currentAccount);  // Pass the connected address to parent component (App.jsx)
    } else {
      setWalletAddress(null);
    }
  }, [isConnected, currentAccount, onWalletConnected]);

  return (
    <div>
      {!walletAddress ? (
        <button
          onClick={connect}
          className="px-4 py-2 bg-blue-500 text-white rounded-md"
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <p>Connected: {walletAddress}</p>
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-500 text-white rounded-md mt-2"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectWalletButton;
