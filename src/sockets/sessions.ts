import { Server, Socket } from 'socket.io';
import { SessionManager } from '../services/sessionManager';
import { Character } from '../models/Character';
import {
  OffenseAbility,
  OffenseBehaviors,
} from '../config/AbilityOffense';
import {
  DefenseAbility,
  DefenseBehaviors,
} from '../config/AbilityDefense';

/**
 * We keep two maps:
 *  1) socketToSession: Map from socket.id → sessionId
 *     (so we know which session to clean up on disconnect).
 *  2) sessionRounds: Map from sessionId → current round number.
 *     We increment this every time an attack is processed.
 */
const socketToSession = new Map<string, string>();
const sessionRounds = new Map<string, number>();

/**
 * @function initSocket
 * @param io {Server} - the Socket.IO server
 *
 * Listens for:
 *   • 'join'       → when a client wants to join a session
 *   • 'useAbility' → when a client uses their ability on the opponent
 *   • 'disconnect' → when a client disconnects
 */
export function initSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ──────────────────────────────────────────────────────────────────────
    // 1) Handle "join" event
    //    Payload: { sessionId: string; playerId: string }
    // ──────────────────────────────────────────────────────────────────────
    socket.on('join', (payload: { sessionId: string; playerId: string }) => {
      const { sessionId, playerId } = payload;
      const sess = SessionManager.getInstance().get(sessionId);

      if (!sess) {
        socket.emit('error', 'Session not found.');
        return;
      }

      if (!sess.hasPlayer(playerId)) {
        socket.emit('error', 'You have not joined or invalid playerId');
        return;
      }

      // Attach this socket to the session and join the room
      sess.attachSocket(socket.id, playerId);
      socket.join(sessionId);
      socketToSession.set(socket.id, sessionId);

      // Broadcast the initial or updated state
      io.in(sessionId).emit('state', sess.serialize());

      // If bothConnected just became true, initialize round counter
      const serialized = sess.serialize();
      if (serialized.bothConnected && !sessionRounds.has(sessionId)) {
        sessionRounds.set(sessionId, 0);
      }
    });

    // ──────────────────────────────────────────────────────────────────────
    // 2) Handle "useAbility" event
    //    Payload: { sessionId: string; fromPlayer: string; toPlayer: string }
    //
    //    Instead of simply calling sess.useAbility(...),
    //    we replicate the exact combat logic here so we can capture:
    //      - Which offense ability (if any) triggered
    //      - Which defense ability (if any) triggered
    //      - Damage dealt
    //      - New healths
    //    Then we emit a "roundResult" event containing those details.
    // ──────────────────────────────────────────────────────────────────────
    socket.on(
      'useAbility',
      (payload: { sessionId: string; fromPlayer: string; toPlayer: string }) => {
        const { sessionId, fromPlayer, toPlayer } = payload;
        const sess = SessionManager.getInstance().get(sessionId);

        if (!sess) {
          socket.emit('error', 'Session not found.');
          return;
        }
        if (!sess.hasPlayer(fromPlayer) || !sess.hasPlayer(toPlayer)) {
          socket.emit('error', 'One or both players not recognized.');
          return;
        }

        try {
          // ────────────────────────────────────────────────────────────
          // A) Retrieve Character instances for attacker & defender
          //    (These are the same objects your Session model holds.)
          // ────────────────────────────────────────────────────────────
          const playersMap = (sess as any).players as Map<string, Character>;
          // (We know Session has a private `players: Map<string, Character>`.)
          const attacker = playersMap.get(fromPlayer)!;
          const defender = playersMap.get(toPlayer)!;

          // ────────────────────────────────────────────────────────────
          // B) Round counter: increment it (or initialize to 1 if missing)
          // ────────────────────────────────────────────────────────────
          let roundNumber = 1;
          if (sessionRounds.has(sessionId)) {
            roundNumber = sessionRounds.get(sessionId)! + 1;
          }
          sessionRounds.set(sessionId, roundNumber);

          // ────────────────────────────────────────────────────────────
          // C) Capture "before" stats for logging
          // ────────────────────────────────────────────────────────────
          const attackerName = attacker.name;
          const defenderName = defender.name;
          const baseAttack   = attacker.attackPower;
          const defensePower = defender.defensePower;
          const beforeHealth = defender.health;

          // ────────────────────────────────────────────────────────────
          // D) Offense ability logic
          // ────────────────────────────────────────────────────────────
          let modifiedAttack = baseAttack;
          let offenseAbilityUsed: string | null = null;
          if (attacker.ability.kind === 'offense') {
            const offId = attacker.ability.id as OffenseAbility;
            const offBehavior = OffenseBehaviors[offId];
            // 25% chance inside onAttack
            const tryAttack = offBehavior.onAttack(baseAttack);
            if (tryAttack !== baseAttack) {
              offenseAbilityUsed = offId; // e.g. "boostAttackOnAttack"
            }
            modifiedAttack = tryAttack;
          }

          // ────────────────────────────────────────────────────────────
          // E) Compute raw netDamage before defense
          // ────────────────────────────────────────────────────────────
          let netDamage = modifiedAttack - defensePower;
          if (netDamage < 0) netDamage = 0;

          // ────────────────────────────────────────────────────────────
          // F) Defense ability logic
          // ────────────────────────────────────────────────────────────
          let defenseAbilityUsed: string | null = null;
          if (defender.ability.kind === 'defense') {
            const defId = defender.ability.id as DefenseAbility;

            // 1) HalfDamageOnDefend chance
            if (defId === DefenseAbility.HalfDamageOnDefend) {
              const defBehavior = DefenseBehaviors[DefenseAbility.HalfDamageOnDefend];
              const tryDamage = defBehavior.onDefend!(netDamage);
              if (tryDamage !== netDamage) {
                defenseAbilityUsed = defId; // e.g. "halfDamageOnDefend"
              }
              netDamage = tryDamage;
            }
          }

          // ────────────────────────────────────────────────────────────
          // G) Apply netDamage to defender's health
          // ────────────────────────────────────────────────────────────
          let newHealth = beforeHealth - netDamage;
          if (newHealth < 0) newHealth = 0;

          // ────────────────────────────────────────────────────────────
          // H) Potential HealUnder30
          // ────────────────────────────────────────────────────────────
          if (defender.ability.kind === 'defense') {
            const defId = defender.ability.id as DefenseAbility;
            if (defId === DefenseAbility.HealUnder30) {
              const healBehavior = DefenseBehaviors[DefenseAbility.HealUnder30];
              const tryHeal = healBehavior.afterDamage!(newHealth);
              if (tryHeal !== newHealth) {
                defenseAbilityUsed = defId; // e.g. "healUnder30"
              }
              newHealth = tryHeal;
            }
          }

          // ────────────────────────────────────────────────────────────
          // I) Update the defender’s health in the Session
          // ────────────────────────────────────────────────────────────
          defender.health = newHealth;

          // ────────────────────────────────────────────────────────────
          // J) Prepare the combined "abilityUsed" string (or null)
          // ────────────────────────────────────────────────────────────
          // If offense and defense both triggered in the same round,
          // you might want to concatenate them. For simplicity, we list offense first:
          let abilityUsed: string | null = null;
          if (offenseAbilityUsed) {
            abilityUsed = offenseAbilityUsed;
          }
          if (defenseAbilityUsed) {
            abilityUsed = abilityUsed
              ? `${abilityUsed},${defenseAbilityUsed}`
              : defenseAbilityUsed;
          }

          // ────────────────────────────────────────────────────────────
          // K) Gather post‐attack health for both players
          // ────────────────────────────────────────────────────────────
          // After this damage, defender.health has been updated.
          // Attacker’s health is unchanged (but we still send it for completeness).
          const attackerHealthPost = attacker.health;
          const defenderHealthPost = defender.health;
          const healthAfter: Record<string, number> = {
            [fromPlayer]: attackerHealthPost,
            [toPlayer]:   defenderHealthPost,
          };

          // ────────────────────────────────────────────────────────────
          // L) Build the RoundResult object
          // ────────────────────────────────────────────────────────────
          const roundResult = {
            roundNumber,
            sessionId,
            attackerId:   fromPlayer,
            attackerName,
            defenderId:   toPlayer,
            defenderName,
            abilityUsed,                   // e.g. "boostAttackOnAttack" or "halfDamageOnDefend,healUnder30" or null
            damageDealt:  netDamage,
            healthAfter,                   // post‐round health map
          };

          // ────────────────────────────────────────────────────────────
          // M) Emit "roundResult" to all clients in this session
          // ────────────────────────────────────────────────────────────
          io.in(sessionId).emit('roundResult', roundResult);

          // ────────────────────────────────────────────────────────────
          // N) Finally broadcast the updated session state
          // ────────────────────────────────────────────────────────────
          io.in(sessionId).emit('state', sess.serialize());
        } catch (err: any) {
          socket.emit('error', err.message || 'Error using ability.');
        }
      }
    );

    // ──────────────────────────────────────────────────────────────────────
    // 3) Handle "disconnect" event
    // ──────────────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sessionId = socketToSession.get(socket.id);
      if (!sessionId) {
        console.log(`Socket disconnected (no session): ${socket.id}`);
        return;
      }

      const sess = SessionManager.getInstance().get(sessionId);
      if (sess) {
        const wasAttached = sess.detachSocket(socket.id);
        if (wasAttached) {
          io.in(sessionId).emit('state', sess.serialize());
        }
      }

      socketToSession.delete(socket.id);
      console.log(`Socket disconnected from session ${sessionId}: ${socket.id}`);
    });
  });
}
