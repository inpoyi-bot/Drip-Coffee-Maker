import { useMutation } from '@tanstack/react-query';
import { sendTurn, type AgentTurnResult } from '@/lib/adkClient';
import { getUserId, getSessionId } from '@/lib/session';

export function useSendTurn() {
  return useMutation<AgentTurnResult, Error, string>({
    mutationFn: async (text: string) => {
      return sendTurn(getUserId(), getSessionId(), text);
    }
  });
}
