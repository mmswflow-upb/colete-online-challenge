import { Session } from '../models/Session';

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, Session>();

  private constructor() {}

  /** Return the singleton instance */
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /** Create & store a new Session */
  create(): Session {
    const sess = new Session();
    this.sessions.set(sess.id, sess);
    return sess;
  }

  /** Lookup an existing session by ID */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** Delete a session (called automatically after timeouts) */
  delete(id: string): void {
    this.sessions.delete(id);
  }

  /** Return all active sessions (used during socket.disconnect logic) */
  all(): Session[] {
    return Array.from(this.sessions.values());
  }
}
