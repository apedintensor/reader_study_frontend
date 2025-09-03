import apiClient from './index';
import type { DiagnosisTerm } from '../types/domain';

export async function fetchDiagnosisTerms(): Promise<DiagnosisTerm[]> {
	const res = await apiClient.get('/api/diagnosis_terms/');
	return res.data as DiagnosisTerm[];
}

