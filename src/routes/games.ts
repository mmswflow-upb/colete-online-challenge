import { Router, Request, Response, RequestHandler } from 'express';
import { SessionManager } from '../services/sessionManager';

const router = Router();
const sessions = SessionManager.getInstance();

/**
 * @route POST /games
 * @description Creates a new game session and returns { sessionId, joinLink }
 */
const createGameHandler: RequestHandler = (req, res) => {
  // 1) Create a fresh session
  const sess = sessions.create();
  const sessionId = sess.id; // assuming .id is how you get the new ID

  // 2) Build a single invite link
  //    We assume the client will be served from the same origin as the API,
  //    so we can use req.protocol + '://' + req.get('host') to form the base.
  const origin = `${req.protocol}://${req.get('host')}`;
  const joinLink = `${origin}/lobby.html?sessionId=${sessionId}`;

  // 3) Send back just { sessionId, joinLink }
  return res.json({ sessionId, joinLink });
};

/**
 * @route GET /games/:sessionId/slots
 * @description Returns which player‐slots are still open for this session.
 *              { availableSlots: number[] }
 */
const getAvailableSlotsHandler: RequestHandler = (req, res) => {
  const { sessionId } = req.params;
  const sess = sessions.get(sessionId);
  if (!sess) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const availableSlots = sess.getAvailableSlots(); // e.g. returns [0,1] or [1] etc.
  return res.json({ availableSlots });
};

/**
 * @route POST /games/:sessionId/join
 * @description Called from the selection page. Body = { characterTypeId, abilityKind, abilityId, preferredSlot }
 *              Returns { playerId } or { error }.
 */
const joinGameHandler: RequestHandler = (req, res) => {
  const { sessionId } = req.params;
  const { characterTypeId, abilityKind, abilityId, preferredSlot } = req.body as {
    characterTypeId: string;
    abilityKind: 'offense' | 'defense';
    abilityId: string;
    preferredSlot: number;
  };

  const sess = sessions.get(sessionId);
  if (!sess) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // This will throw if the slot is already taken, or if IDs are invalid
    const playerId = sess.addPlayer(characterTypeId, abilityId, preferredSlot);
    return res.json({ playerId });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Unknown error' });
  }
};

router.post('/', createGameHandler);
router.get('/:sessionId/slots', getAvailableSlotsHandler);
router.post('/:sessionId/join', joinGameHandler);

export default router;
