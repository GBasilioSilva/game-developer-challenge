import axios from 'axios'
import type { CreateMatchPayload, LeaderboardEntry, MatchHistoryEntry } from '../types/game'

// Implementação da Seção 5: cliente HTTP para ranking e histórico usando Axios.
const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
})

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const response = await api.get<LeaderboardEntry[]>('/ranking')
  return response.data
}

export const getMatchHistory = async (): Promise<MatchHistoryEntry[]> => {
  const response = await api.get<MatchHistoryEntry[]>('/history')
  return response.data
}

export const createMatchRecord = async (
  payload: CreateMatchPayload,
): Promise<MatchHistoryEntry> => {
  const response = await api.post<MatchHistoryEntry>('/history', payload)
  return response.data
}
