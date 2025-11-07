import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import PollCard from "@/components/PollCard";
import backgroundPattern from "@/assets/background-pattern.png";
import { Loader2 } from "lucide-react";
import { getAllPolls, getEncryptedVoteCount, hasUserVoted, castVote, type Poll, getContractAddress } from "@/lib/contract";
import { getFHEVMInstance, encryptOptionIndex } from "@/lib/fhevm";
import { chains } from "@/lib/wagmi";
import { ethers } from "ethers";

interface Vote {
  pollId: number;
  optionIndex: number;
}

const Index = () => {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userVotes, setUserVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (publicClient) {
      fetchPolls();
    }
  }, [publicClient]);

  useEffect(() => {
    if (isConnected && address && publicClient) {
      fetchUserVotes();
    }
  }, [isConnected, address, publicClient]);

  const fetchPolls = async () => {
    if (!publicClient) return;

    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const allPolls = await getAllPolls(provider, chainId || undefined);
      setPolls(allPolls);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading polls",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVotes = async () => {
    if (!publicClient || !address) return;

    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const votes: Vote[] = [];

      for (const poll of polls) {
        const hasVotedResult = await hasUserVoted(provider, poll.id, address, chainId || undefined);
        if (hasVotedResult) {
          // TODO: Get the actual option index the user voted for
          // This requires storing vote data or decrypting to find which option was selected
          // For now, we'll just mark that they voted
          votes.push({ pollId: poll.id, optionIndex: -1 });
        }
      }

      setUserVotes(votes);
    } catch (error: any) {
      console.error("Error loading votes:", error);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!isConnected || !address) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to vote.",
      });
      return;
    }

    if (!walletClient || !publicClient) {
      toast({
        variant: "destructive",
        title: "Wallet not available",
        description: "Please ensure your wallet is connected.",
      });
      return;
    }

    // Check if user has already voted before attempting to vote
    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const hasVotedResult = await hasUserVoted(provider, parseInt(pollId), address, chainId || undefined);
      if (hasVotedResult) {
        toast({
          variant: "destructive",
          title: "Already voted",
          description: "You have already voted on this poll.",
        });
        return;
      }
    } catch (error) {
      // If check fails, continue anyway - the contract will reject if already voted
      console.warn("Failed to check if user has voted:", error);
    }

    // Check if contract is deployed on current network
    const contractAddress = getContractAddress(chainId || undefined);
    if (!contractAddress) {
      toast({
        variant: "destructive",
        title: "Contract not deployed",
        description: `Contract is not deployed on this network (Chain ID: ${chainId}). Please switch to a supported network (localhost: 31337 or Sepolia: 11155111).`,
      });
      return;
    }

    try {
      // Use walletClient to get signer instead of publicClient
      if (!walletClient) {
        throw new Error("Wallet client not available. Please ensure your wallet is connected.");
      }
      
      // Convert walletClient to ethers signer (same method as CreatePoll.tsx)
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Initialize FHEVM instance (use chainId instead of provider)
      console.log("Initializing FHEVM instance for voting...");
      const fhevm = await getFHEVMInstance(chainId);
      console.log("FHEVM instance initialized:", !!fhevm);

      // Encrypt the option index
      toast({
        title: "Encrypting vote...",
        description: "Please wait while your vote is being encrypted.",
      });

      console.log("Encrypting option index:", optionIndex);
      const contractAddress = getContractAddress(chainId || undefined);
      const encryptedInput = await encryptOptionIndex(
        fhevm,
        contractAddress,
        address,
        optionIndex
      );
      console.log("Encrypted input:", {
        handlesLength: encryptedInput.handles.length,
        inputProofLength: encryptedInput.inputProof.length,
      });

      // Cast the encrypted vote
      toast({
        title: "Submitting vote...",
        description: "Please confirm the transaction in your wallet.",
      });

      console.log("Casting vote with:", {
        pollId: parseInt(pollId),
        handle: encryptedInput.handles[0],
        proof: encryptedInput.inputProof,
      });

      const tx = await castVote(
        signer,
        parseInt(pollId),
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        chainId || undefined
      );

      toast({
        title: "Transaction submitted",
        description: "Waiting for confirmation...",
      });

      await tx.wait();

      toast({
        title: "Vote submitted successfully!",
        description: "Your encrypted vote has been recorded.",
      });

      // Refresh polls and votes
      await fetchPolls();
      if (address) {
        await fetchUserVotes();
      }
    } catch (error: any) {
      console.error("Error voting:", error);
      toast({
        variant: "destructive",
        title: "Error submitting vote",
        description: error.message || "Failed to submit vote. Please try again.",
      });
    }
  };

  const getTimeRemaining = (expireAt: bigint) => {
    const now = Date.now();
    const expiry = Number(expireAt) * 1000;
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "Less than 1h remaining";
  };

  const getPollStatus = (poll: Poll) => {
    const now = Date.now();
    const expiry = Number(poll.expireAt) * 1000;
    if (expiry <= now || !poll.isActive) return "ended";
    return "active";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="fixed inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundPattern})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      
      <Header />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Active Polls
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your vote remains encrypted until the poll closes. No one can see voting trends
            or pressure you based on current results. Vote freely, vote privately.
          </p>
        </div>

        {!isConnected && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-lg">
              Please connect your wallet to view and participate in polls.
            </p>
          </div>
        )}

        {polls.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No polls available yet. {isConnected && "Be the first to create one!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {polls.map((poll) => {
              const userVote = userVotes.find(v => v.pollId === poll.id);
              const status = getPollStatus(poll);
              return (
                <PollCard
                  key={poll.id}
                  id={poll.id.toString()}
                  question={poll.title}
                  description={poll.description || undefined}
                  options={poll.options.map((opt, idx) => ({ id: `option-${idx}`, text: opt }))}
                  status={status as "active" | "ended"}
                  timeRemaining={getTimeRemaining(poll.expireAt)}
                  totalVotes={0}
                  isEncrypted={true}
                  userVote={userVote?.optionIndex}
                  onVote={handleVote}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
