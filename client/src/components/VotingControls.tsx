import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface VotingControlsProps {
  reportId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
  size?: "sm" | "md" | "lg";
}

export function VotingControls({ 
  reportId, 
  initialUpvotes = 0, 
  initialDownvotes = 0,
  size = "md" 
}: VotingControlsProps) {
  const { toast } = useToast();
  
  const { data: myVote } = useQuery<{ voteType: "upvote" | "downvote" } | null>({
    queryKey: ['/api/reports', reportId, 'my-vote'],
  });

  const { data: voteData } = useQuery<{ upvotes: number; downvotes: number; consensusScore: number }>({
    queryKey: ['/api/reports', reportId, 'votes'],
  });

  const upvotes = voteData?.upvotes ?? initialUpvotes;
  const downvotes = voteData?.downvotes ?? initialDownvotes;

  const voteMutation = useMutation({
    mutationFn: async (voteType: "upvote" | "downvote") => {
      return await apiRequest(`/api/reports/${reportId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId, 'my-vote'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit vote",
      });
    },
  });

  const deleteVoteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/reports/${reportId}/vote`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports', reportId, 'my-vote'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove vote",
      });
    },
  });

  const handleVote = (voteType: "upvote" | "downvote") => {
    if (myVote?.voteType === voteType) {
      deleteVoteMutation.mutate();
    } else {
      voteMutation.mutate(voteType);
    }
  };

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={myVote?.voteType === "upvote" ? "default" : "outline"}
        size={buttonSize}
        onClick={() => handleVote("upvote")}
        disabled={voteMutation.isPending || deleteVoteMutation.isPending}
        data-testid={`button-upvote-${reportId}`}
        className="gap-1"
      >
        <ThumbsUp size={iconSize} />
        <span data-testid={`text-upvotes-${reportId}`}>{upvotes}</span>
      </Button>
      
      <Button
        variant={myVote?.voteType === "downvote" ? "default" : "outline"}
        size={buttonSize}
        onClick={() => handleVote("downvote")}
        disabled={voteMutation.isPending || deleteVoteMutation.isPending}
        data-testid={`button-downvote-${reportId}`}
        className="gap-1"
      >
        <ThumbsDown size={iconSize} />
        <span data-testid={`text-downvotes-${reportId}`}>{downvotes}</span>
      </Button>
    </div>
  );
}
