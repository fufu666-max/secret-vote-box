import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import PollCard from "@/components/PollCard";
import backgroundPattern from "@/assets/background-pattern.png";
import { Loader2 } from "lucide-react";
import { getAllPolls, getEncryptedVoteCount, hasUserVoted, castVote, type Poll, getContractAddress, isFinalized as isFinalizedOnChain, getClearVoteCounts, requestFinalize, endPollTx } from "@/lib/contract";
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
  const [finalizedByPoll, setFinalizedByPoll] = useState<Record<number, boolean>>({});
  const [resultsByPoll, setResultsByPoll] = useState<Record<number, { counts: number[]; total: number; percentages: number[] }>>({});
  const [revealingByPoll, setRevealingByPoll] = useState<Record<number, boolean>>({});
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
      // Prefer injected provider to avoid third-party RPCs (prevents 429/CORS)
      let provider: ethers.BrowserProvider | ethers.JsonRpcProvider;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        provider = new ethers.BrowserProvider((window as any).ethereum, "any");
      } else {
        // Fallback read-only RPC
        const rpcUrl = (chainId === 31337)
          ? "http://localhost:8545"
          : "https://rpc.sepolia.org";
        provider = new ethers.JsonRpcProvider(rpcUrl);
      }
      const allPolls = await getAllPolls(provider, chainId || undefined);
      setPolls(allPolls);
      // Load results/finalization status for ended polls
      for (const p of allPolls) {
        const now = Date.now();
        const ended = Number(p.expireAt) * 1000 <= now || !p.isActive;
        if (ended) {
          try {
            const finalized = await isFinalizedOnChain(provider, p.id, chainId || undefined);
            setFinalizedByPoll(prev => ({ ...prev, [p.id]: finalized }));
            if (finalized) {
              const counts = await getClearVoteCounts(provider, p.id, chainId || undefined);
              const total = counts.reduce((a, b) => a + b, 0);
              const percentages = counts.map(c => total > 0 ? (c * 100) / total : 0);
              setResultsByPoll(prev => ({ ...prev, [p.id]: { counts, total, percentages } }));
            } else {
              // Auto-request finalize when a poll has ended but results aren't published yet.
              // Requires a connected wallet to submit the tx; if not connected, skip silently.
              if (isConnected && address && !(revealingByPoll[p.id])) {
                // Fire and forget; UI will refresh on next fetch
                handleRevealResults(p.id).catch(() => {});
              }
            }
          } catch { /* ignore */ }
        }
      }
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

  const handleRevealResults = async (pollId: number) => {
    if (!isConnected || !address) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet.",
      });
      return;
    }
    if (!publicClient) return;
    try {
      setRevealingByPoll(prev => ({ ...prev, [pollId]: true }));
      const ethereum = (window as any).ethereum;
      const provider = new ethers.BrowserProvider(ethereum, "any");
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        try { await provider.send("eth_requestAccounts", []); } catch { /* ignore */ }
      }
      const signer = await provider.getSigner();
      // Ensure poll is ended on-chain before finalize (endPoll may revert if already ended; ignore)
      try {
        const endTx = await endPollTx(signer, pollId, chainId || undefined);
        await endTx.wait();
      } catch {}
      const tx = await requestFinalize(signer, pollId, chainId || undefined);
      await tx.wait();
      // Poll finalization state a few times
      const readProvider = new ethers.BrowserProvider(publicClient as any);
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const finalized = await isFinalizedOnChain(readProvider, pollId, chainId || undefined);
        if (finalized) {
          const counts = await getClearVoteCounts(readProvider, pollId, chainId || undefined);
          const total = counts.reduce((a, b) => a + b, 0);
          const percentages = counts.map(c => total > 0 ? (c * 100) / total : 0);
          setFinalizedByPoll(prev => ({ ...prev, [pollId]: true }));
          setResultsByPoll(prev => ({ ...prev, [pollId]: { counts, total, percentages } }));
          toast({ title: "Results revealed", description: "Clear results are now available." });
          return;
        }
      }
      toast({ variant: "destructive", title: "Reveal pending", description: "Decryption not completed yet. Please try again shortly." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to reveal results",
        description: error.message || "Please try again.",
      });
    } finally {
      setRevealingByPoll(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const fetchUserVotes = async () => {
    if (!publicClient || !address) return;

    try {
      // Use injected provider for read to avoid third-party RPC throttling
      let provider: ethers.BrowserProvider | ethers.JsonRpcProvider;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        provider = new ethers.BrowserProvider((window as any).ethereum, "any");
      } else {
        const rpcUrl = (chainId === 31337)
          ? "http://localhost:8545"
          : "https://rpc.sepolia.org";
        provider = new ethers.JsonRpcProvider(rpcUrl);
      }
      const votes: Vote[] = [];

      for (const poll of polls) {
        const hasVotedResult = await hasUserVoted(provider, poll.id, address, chainId || undefined);
        if (hasVotedResult) {
          const storageKey = `svb:votes:${chainId || 0}:${address}:${poll.id}`;
          const stored = localStorage.getItem(storageKey);
          const storedIndex = stored !== null ? parseInt(stored, 10) : -1;
          votes.push({ pollId: poll.id, optionIndex: isNaN(storedIndex) ? -1 : storedIndex });
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

    // Prevent voting on ended polls (extra guard in addition to contract check)
    try {
      const poll = polls.find(p => p.id === parseInt(pollId));
      if (poll) {
        const status = getPollStatus(poll);
        if (status === "ended") {
          toast({
            variant: "destructive",
            title: "Poll ended",
            description: "This poll has already ended. Voting is closed.",
          });
          return;
        }
      }
    } catch {}

    // Check if user has already voted before attempting to vote (using injected provider to avoid stale RPC)
    try {
      let readProvider: ethers.BrowserProvider | ethers.JsonRpcProvider;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        readProvider = new ethers.BrowserProvider((window as any).ethereum, "any");
      } else {
        const rpcUrl = (chainId === 31337)
          ? "http://localhost:8545"
          : "https://rpc.sepolia.org";
        readProvider = new ethers.JsonRpcProvider(rpcUrl);
      }
      const hasVotedResult = await hasUserVoted(readProvider, parseInt(pollId), address, chainId || undefined);
      if (hasVotedResult) {
        toast({
          variant: "destructive",
          title: "Already voted",
          description: "You have already voted on this poll.",
        });
        return;
      }
    } catch (error) {
      // Be conservative: if we cannot verify, ask the user to refresh instead of sending a likely-reverting tx
      console.warn("Failed to check if user has voted:", error);
      toast({
        variant: "destructive",
        title: "Unable to verify voting status",
        description: "Please refresh the page and try again.",
      });
      return;
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
      // In production (Vercel), always use the injected EIP-1193 provider (window.ethereum)
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No wallet provider detected. Please install or enable your wallet.");
      }
      const ethereum = (window as any).ethereum;
      const provider = new ethers.BrowserProvider(ethereum, "any");
      // Ensure accounts are available (some wallets require explicit request)
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        try {
          await provider.send("eth_requestAccounts", []);
        } catch (reqErr) {
          throw new Error("Wallet not authorized. Please connect your wallet.");
        }
      }
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

      // Persist user selection locally for display (privacy-preserving)
      try {
        const storageKey = `svb:votes:${chainId || 0}:${address}:${parseInt(pollId)}`;
        localStorage.setItem(storageKey, String(optionIndex));
      } catch {}

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
              const finalized = finalizedByPoll[poll.id] || false;
              const results = resultsByPoll[poll.id];
              return (
                <PollCard
                  key={poll.id}
                  id={poll.id.toString()}
                  question={poll.title}
                  description={poll.description || undefined}
                  options={poll.options.map((opt, idx) => ({ id: `option-${idx}`, text: opt }))}
                  status={status as "active" | "ended"}
                  timeRemaining={getTimeRemaining(poll.expireAt)}
                  totalVotes={results?.total || 0}
                  isEncrypted={status === "active"}
                  userVote={userVote?.optionIndex}
                  onVote={handleVote}
                  finalized={finalized}
                  results={results}
                  onReveal={status === "ended" && !finalized ? () => handleRevealResults(poll.id) : undefined}
                  revealing={!!revealingByPoll[poll.id]}
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
