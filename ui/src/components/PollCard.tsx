import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Clock, Users, Check } from "lucide-react";

interface PollOption {
  id: string;
  text: string;
}

interface PollCardProps {
  id: string;
  question: string;
  description?: string;
  options: PollOption[];
  status: "active" | "ended";
  timeRemaining?: string;
  totalVotes: number;
  isEncrypted: boolean;
  userVote?: number;
  onVote?: (pollId: string, optionIndex: number) => void;
  // Results rendering (for ended polls)
  finalized?: boolean;
  results?: {
    counts: number[];
    total: number;
    percentages: number[];
  };
  onReveal?: () => void;
  revealing?: boolean;
}

const PollCard = ({
  id,
  question,
  description,
  options,
  status,
  timeRemaining,
  totalVotes,
  isEncrypted,
  userVote,
  onVote,
  finalized,
  results,
  onReveal,
  revealing,
}: PollCardProps) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border bg-card hover:border-accent/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2 group-hover:text-accent transition-colors">
              {question}
            </CardTitle>
            {description && (
              <CardDescription className="text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          <Badge variant={status === "active" ? "default" : "secondary"} className="shrink-0">
            {status === "active" ? "Active" : "Ended"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Poll Options */}
        <div className="space-y-2">
          {options.map((option, index) => (
            <Button
              key={option.id}
              variant={userVote === index ? "default" : "outline"}
              className="w-full justify-between text-left h-auto py-3"
              disabled={status === "ended" && !onReveal}
              onClick={() => onVote?.(id, index)}
            >
              <div className="flex-1 min-w-0">
                <span className="truncate block">{option.text}</span>
                {/* Results bar when finalized */}
                {status === "ended" && finalized && results && (
                  <div className="mt-2">
                    <div className="w-full h-1.5 bg-muted rounded">
                      <div
                        className="h-1.5 bg-accent rounded"
                        style={{ width: `${results.percentages[index] || 0}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {results.counts[index] || 0} votes · {Number.isFinite(results.percentages[index]) ? results.percentages[index].toFixed(0) : 0}%
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pl-2 shrink-0">
                {status === "ended" && finalized && results ? (
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {(results.counts[index] ?? 0)} ({Number.isFinite(results.percentages[index]) ? results.percentages[index].toFixed(0) : 0}%)
                  </span>
                ) : (
                  userVote === index && <Check className="h-4 w-4" />
                )}
              </div>
            </Button>
          ))}
        </div>

        {/* Poll Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {isEncrypted && status === "active" ? (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Lock className="h-3 w-3" />
                  Encrypted total
                </span>
              ) : (
                <span>
                  {status === "ended" && finalized && results
                    ? `${results.total} votes`
                    : `${totalVotes} votes`}
                </span>
              )}
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{timeRemaining}</span>
              </div>
            )}
          </div>
          
          {status === "active" && isEncrypted && (
            <div className="flex items-center gap-1.5 text-accent">
              <Lock className="h-4 w-4" />
              <span className="font-medium">
                Your choice is private
              </span>
            </div>
          )}
          {/* Reveal button removed by request */}
        </div>
      </CardContent>
    </Card>
  );
};

export default PollCard;
