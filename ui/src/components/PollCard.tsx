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
              disabled={status === "ended"}
              onClick={() => onVote?.(id, index)}
            >
              <span className="truncate">{option.text}</span>
              {userVote === index && (
                <Check className="h-4 w-4 ml-2 shrink-0" />
              )}
            </Button>
          ))}
        </div>

        {/* Poll Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{totalVotes} votes</span>
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{timeRemaining}</span>
              </div>
            )}
          </div>
          
          {isEncrypted && status === "active" && (
            <div className="flex items-center gap-1.5 text-accent">
              <Lock className="h-4 w-4" />
              <span className="font-medium">Encrypted</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PollCard;
