import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { letterService } from '../services/letterService';

export const useMasterTemplate = (templateType: 'letter_of_intent' | 'offer_letter') => {
  return useQuery({
    queryKey: ['master-template', templateType],
    queryFn: () => letterService.getMasterTemplate(templateType),
  });
};

export const useUploadMasterTemplate = (templateType: 'letter_of_intent' | 'offer_letter') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => letterService.uploadMasterTemplate(templateType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-template', templateType] });
    },
  });
};

export const useCandidateLetters = (appId?: string) => {
  return useQuery({
    queryKey: ['candidate-letters', appId],
    queryFn: () => letterService.getCandidateLetters(appId!),
    enabled: Boolean(appId),
  });
};

export const useUpdateCandidateLetter = (appId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      letterType,
      fieldValues,
      revisedFile,
      textEdits,
      paragraphs,
      tableCells,
    }: {
      letterType: 'letter_of_intent' | 'offer_letter';
      fieldValues: Record<string, any>;
      revisedFile?: File;
      textEdits?: Record<string, string>;
      paragraphs?: Record<string, string>;
      tableCells?: Record<string, string>;
    }) =>
      letterService.updateCandidateLetter(
        appId!,
        letterType,
        fieldValues,
        revisedFile,
        textEdits,
        paragraphs,
        tableCells
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-letters', appId] });
    },
  });
};

export const useSendCandidateLetters = (appId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ forceResend, documentScope }: { forceResend?: boolean; documentScope?: string } = {}) =>
      letterService.sendCandidateLetters(appId!, forceResend, documentScope || 'both'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-letters', appId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-application', appId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-detail', appId] });
    },
  });
};
