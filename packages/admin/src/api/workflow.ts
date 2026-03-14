import { api } from './client'

// Re-export for compatibility
export const getWorkflowConfig = (collectionId: string) => api.get(`/workflow/config/${collectionId}`)
export const saveWorkflowConfig = (config: any) => api.put('/workflow/config', config)
export const executeWorkflowAction = (collectionId: string, contentId: string, action: string, comment?: string) => 
  api.post(`/workflow/${collectionId}/${contentId}/execute`, { action, comment })
export const getAvailableActions = (collectionId: string, contentId: string) => 
  api.get(`/workflow/${collectionId}/${contentId}/available-actions`)
export const getWorkflowHistory = (collectionId: string, contentId: string) => 
  api.get(`/workflow/${collectionId}/${contentId}/history`)
export const getStats = (collectionId: string) => api.get(`/workflow/${collectionId}/stats`)

export interface WorkflowConfig {
  collectionId: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
}

export interface WorkflowState {
  id: string
  name: string
  color: string
}

export interface WorkflowTransition {
  from: string
  to: string
  action: string
}

export interface WorkflowAction {
  id: string
  name: string
  type: string
}

export interface WorkflowHistory {
  id: string
  fromState: string
  toState: string
  action: string
  userId: string
  userName: string
  comment?: string
  createdAt: string
}

export const workflowApi = {
  getConfig(collectionId: string) {
    return api.get(`/workflow/config/${collectionId}`)
  },

  saveConfig(config: WorkflowConfig) {
    return api.put('/workflow/config', config)
  },

  executeAction(collectionId: string, contentId: string, action: string, comment?: string) {
    return api.post(`/workflow/${collectionId}/${contentId}/execute`, { action, comment })
  },

  getHistory(collectionId: string, contentId: string) {
    return api.get(`/workflow/${collectionId}/${contentId}/history`)
  },

  getAvailableActions(collectionId: string, contentId: string) {
    return api.get(`/workflow/${collectionId}/${contentId}/available-actions`)
  },

  getStats(collectionId: string) {
    return api.get(`/workflow/${collectionId}/stats`)
  },
}
