import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getAllPolls, hasUserVoted, type Poll } from "@/lib/contract";
import { ethers } from "ethers";

interface Vote {
  pollId: number;
  poll: Poll;
}

const MyVotes = () => {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected) {
      navigate("/");
    }
  }, [isConnected, navigate]);

  useEffect(() => {
    if (isConnected && address && publicClient) {
      fetchVotes();
    }
  }, [isConnected, address, publicClient]);

  const fetchVotes = async () => {
    if (!publicClient || !address) return;

    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const allPolls = await getAllPolls(provider, chainId || undefined);
      
      const userVotes: Vote[] = [];
      for (const poll of allPolls) {
        const hasVotedResult = await hasUserVoted(provider, poll.id, address, chainId || undefined);
        if (hasVotedResult) {
          userVotes.push({ pollId: poll.id, poll });
        }
      }

      setVotes(userVotes);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading votes",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getPollStatus = (poll: Poll) => {
    const now = Date.now();
    const expiry = Number(poll.expireAt) * 1000;
    if (expiry <= now || !poll.isActive) return "ended";
    return "active";
  };

  if (!isConnected || loading) {
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
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Votes</h1>
          <p className="text-muted-foreground">View all polls you've participated in</p>
        </div>

        {votes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground text-lg">
                You haven't voted on any polls yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {votes.map((vote) => {
              const status = getPollStatus(vote.poll);
              return (
                <Card key={vote.pollId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{vote.poll.title}</CardTitle>
                        {vote.poll.description && (
                          <CardDescription>{vote.poll.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant={status === "active" ? "default" : "secondary"}>
                        {status === "active" ? "Active" : "Ended"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-md border border-primary">
                        <span className="font-medium">Your Vote:</span>
                        <span className="text-primary font-semibold">
                          Vote submitted (encrypted)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your vote is encrypted and will be revealed when the poll ends.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyVotes;
