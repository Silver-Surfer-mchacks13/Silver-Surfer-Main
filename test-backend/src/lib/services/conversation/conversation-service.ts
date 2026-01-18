import { table, type TaskSession, type ConversationMessage } from '@/lib/db/supabase';

export class ConversationService {
  /**
   * Get or create a TaskSession
   * If sessionId is provided, try to find existing session
   * If not found or not provided, create a new one
   */
  async getOrCreateSession(
    sessionId: string | undefined,
    userId: string | null,
    title: string
  ): Promise<TaskSession> {
    // If sessionId provided, try to find existing session
    if (sessionId) {
      const { data: existingSession, error } = await table('TaskSessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && existingSession) {
        // Update UpdatedAt timestamp
        const { data: updatedSession, error: updateError } = await table('TaskSessions')
          .update({ UpdatedAt: new Date().toISOString() })
          .eq('id', sessionId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating session:', updateError);
          // Return existing session even if update failed
          return existingSession as TaskSession;
        }

        return updatedSession as TaskSession;
      }
    }

    // Create new session
    const { data: newSession, error } = await table('TaskSessions')
      .insert({
        UserId: userId,
        Title: title || 'New Conversation',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
        CompletedAt: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return newSession as TaskSession;
  }

  /**
   * Store a conversation message
   */
  async storeMessage(
    sessionId: string,
    userId: string | null,
    role: 'user' | 'assistant',
    content: string,
    pageUrl?: string
  ): Promise<ConversationMessage> {
    const { data: message, error } = await table('ConversationMessages')
      .insert({
        SessionId: sessionId,
        UserId: userId,
        role,
        content,
        PageUrl: pageUrl || null,
        CreatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }

    return message as ConversationMessage;
  }

  /**
   * Update TaskSession completion status
   */
  async updateSessionCompletion(sessionId: string, isComplete: boolean): Promise<void> {
    const updateData: Partial<TaskSession> = {
      UpdatedAt: new Date().toISOString(),
    };

    if (isComplete) {
      updateData.CompletedAt = new Date().toISOString();
    }

    const { error } = await table('TaskSessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session completion:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get conversation history for a session (for future use)
   */
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    const { data: messages, error } = await table('ConversationMessages')
      .select('*')
      .eq('SessionId', sessionId)
      .order('CreatedAt', { ascending: true });

    if (error) {
      throw new Error(`Failed to get conversation history: ${error.message}`);
    }

    return (messages || []) as ConversationMessage[];
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<TaskSession[]> {
    const { data: sessions, error } = await table('TaskSessions')
      .select('*')
      .eq('UserId', userId)
      .order('UpdatedAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }

    return (sessions || []) as TaskSession[];
  }

  /**
   * Get a session by ID, verifying it belongs to the user
   * Throws error if session not found or doesn't belong to user
   */
  async getSessionById(sessionId: string, userId: string): Promise<TaskSession> {
    const { data: session, error } = await table('TaskSessions')
      .select('*')
      .eq('id', sessionId)
      .eq('UserId', userId)
      .single();

    if (error || !session) {
      throw new Error(`Session not found or access denied: ${error?.message || 'Session not found'}`);
    }

    return session as TaskSession;
  }

  /**
   * Store a click action
   */
  async storeClickAction(
    sessionId: string,
    target: string,
    reasoning: string | undefined,
    pageUrl: string
  ): Promise<void> {
    const { error } = await table('ClickAgentActions')
      .insert({
        SessionId: sessionId,
        Target: target,
        Reasoning: reasoning || '',
        Success: false, // Will be updated when action is executed
        ErrorMessage: null,
        PageUrl: pageUrl,
        PageHtml: null, // Can be populated later if needed
        CreatedAt: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing click action:', error);
      // Don't throw - action storage is not critical for conversation flow
    }
  }

  /**
   * Store a wait action
   */
  async storeWaitAction(
    sessionId: string,
    duration: number,
    reasoning: string | undefined,
    pageUrl: string
  ): Promise<void> {
    const { error } = await table('WaitAgentActions')
      .insert({
        SessionId: sessionId,
        Duration: duration,
        Reasoning: reasoning || '',
        Success: false, // Will be updated when action is executed
        ErrorMessage: null,
        PageUrl: pageUrl,
        PageHtml: null,
        CreatedAt: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing wait action:', error);
    }
  }

  /**
   * Store a complete action
   */
  async storeCompleteAction(
    sessionId: string,
    message: string,
    reasoning: string | undefined,
    pageUrl: string
  ): Promise<void> {
    const { error } = await table('CompleteAgentActions')
      .insert({
        SessionId: sessionId,
        Message: message,
        Reasoning: reasoning || '',
        Success: false,
        ErrorMessage: null,
        PageUrl: pageUrl,
        PageHtml: null,
        CreatedAt: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing complete action:', error);
    }
  }

  /**
   * Store a message action (assistant message)
   */
  async storeMessageAction(
    sessionId: string,
    message: string,
    reasoning: string | undefined,
    pageUrl: string
  ): Promise<void> {
    const { error } = await table('MessageAgentActions')
      .insert({
        SessionId: sessionId,
        Message: message,
        Reasoning: reasoning || '',
        PageUrl: pageUrl,
        PageHtml: null,
        CreatedAt: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing message action:', error);
    }
  }
}

// Export singleton instance
export const conversationService = new ConversationService();
