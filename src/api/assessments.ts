import apiClient from '.';
import type { AssessmentNew, AssessmentCreatePayload } from '../types/domain';

// Unified assessment create/replace endpoint (backend path no longer prefixed by /api or /v1)
export async function submitAssessment(payload: AssessmentCreatePayload) {
  const { data } = await apiClient.post<AssessmentNew>('/api/assessment/', payload);
  return data;
}

// List assessments (0-2) for an assignment
export async function listAssignmentAssessments(assignmentId: number) {
  const { data } = await apiClient.get<AssessmentNew[]>(`/api/assessment/assignment/${assignmentId}`);
  return data;
}

// Fetch all assessments for user+block (audit/report)
export async function listBlockAssessments(userId: number, blockIndex: number) {
  const { data } = await apiClient.get<AssessmentNew[]>(`/api/assessment/user/${userId}/block/${blockIndex}`);
  return data;
}
