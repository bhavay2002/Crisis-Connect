/**
 * useCrisisActions — provides mutation wrappers for crisis operations.
 * Components call these; they never call apiRequest directly.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/shared/hooks";
import { verifyReport, resolveReport } from "../services/crisis.api";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useCrisisActions() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/reports"] });

  const upvoteMutation = useMutation({
    mutationFn: verifyReport,
    onSuccess: () => {
      toast({ title: "Report upvoted" });
      invalidate();
    },
    onError: (err: any) => {
      if (isUnauthorizedError(err)) { setLocation("/login"); return; }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveReport,
    onSuccess: () => {
      toast({ title: "Report resolved" });
      invalidate();
    },
    onError: (err: any) => {
      if (isUnauthorizedError(err)) { setLocation("/login"); return; }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return {
    upvote:  (id: string) => upvoteMutation.mutate(id),
    resolve: (id: string) => resolveMutation.mutate(id),
    isLoading: upvoteMutation.isPending || resolveMutation.isPending,
  };
}
