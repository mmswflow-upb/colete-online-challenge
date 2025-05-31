import { v4 as uuidv4 } from 'uuid';
import { Character } from './Character';
import { CharacterType } from '../config/CharacterType';
import {
  OffenseAbility,
  OffenseBehaviors,
} from '../config/AbilityOffense';
import {
  DefenseAbility,
  DefenseBehaviors,
} from '../config/AbilityDefense';
import { Ability } from './Ability';
import { SessionManager } from '../services/sessionManager';

/**
 * @interface SerializedPlayer
 * @property {string} playerId      - The UUID assigned to this player slot
 * @property {string} name          - Character's display name (e.g. "Warrior")
 * @property {number} health        - Current health (0–100)
 * @property {number} attackPower   - Base attack value (15–20)
 * @property {number} defensePower  - Base defense value (10–15)
 * @property {string} abilityId     - The chosen ability ID (e.g. "boostAttackOnAttack")
 * @property {string[]} attackTypes - The list of move‐identifiers this character can use
 */
export interface SerializedPlayer {
  playerId: string;
  name: string;
  health: number;
  attackPower: number;
  defensePower: number;
  abilityId: string;
  attackTypes: string[];
}

/**
 * @interface SerializedSession
 * @property {string} id
 * @property {SerializedPlayer[]} players
 * @property {boolean} bothConnected
 *
 * Describes the minimal JSON‐friendly snapshot of a game session.
 * - `id` is the session's UUID.
 * - `players` is an array of exactly one or two `SerializedPlayer` objects (once both have joined).
 * - `bothConnected` indicates if both players are currently connected via WebSocket.
 */
export interface SerializedSession {
  id: string;
  players: SerializedPlayer[];
  bothConnected: boolean;
}

/**
 * @class Session
 * @description
 *   Manages a two‐player game session:
 *   • Generates two stable player‐IDs (player1Id, player2Id) at creation.
 *   • A 60s "pending‐join" timer: if fewer than two players join within 60s, the session deletes itself.
 *   • Tracks playerId → Character (which stores characterType & full Ability object).
 *   • Tracks socket.id → playerId on WebSocket attach/detach.
 *   • A 60s "disconnect" timer anytime bothConnected() becomes false, which deletes the session if both don't reconnect.
 *   • Combat logic (`useAbility`) that uses `attacker.ability.kind` (offense/defense) to pick the correct behavior.
 */
export class Session {
  /** @type {string} */
  id: string;

  /** @type {string} */
  player1Id: string;

  /** @type {string} */
  player2Id: string;

  /** @private @type {Map<string, Character>} */
  private players: Map<string, Character> = new Map();

  /** @private @type {Map<string, string>} */
  private sockets: Map<string, string> = new Map();

  /** @private @type {NodeJS.Timeout | null} */
  private pendingJoinTimer: NodeJS.Timeout | null = null;

  /** @private @type {NodeJS.Timeout | null} */
  private disconnectTimer: NodeJS.Timeout | null = null;

  /** @private @type {Set<number>} */
  private takenSlots: Set<number> = new Set();

  constructor() {
    this.id = uuidv4();
    this.player1Id = uuidv4();
    this.player2Id = uuidv4();

    // 💡 Start 60s "waiting for both players to join" timer
    this.pendingJoinTimer = setTimeout(() => {
      if (this.players.size < 2) {
        SessionManager.getInstance().delete(this.id);
      }
    }, 60_000);
  }

  /**
   * @method getAvailableSlots
   * @returns {number[]} Array of available player slot numbers (1 or 2)
   */
  public getAvailableSlots(): number[] {
    const available = [];
    if (!this.takenSlots.has(1)) available.push(1);
    if (!this.takenSlots.has(2)) available.push(2);
    return available;
  }

  /**
   * @method assignPlayerSlot
   * @param {string} playerId - The player ID to assign a slot to
   * @param {number} [preferredSlot] - Optional preferred slot number (1 or 2)
   * @returns {number} The assigned slot number (1 or 2)
   * @throws {Error} If no slots are available
   */
  public assignPlayerSlot(playerId: string, preferredSlot?: number): number {
    if (this.players.has(playerId)) {
      // Player already has a slot, return their current slot
      return this.takenSlots.has(1) && this.players.get(playerId) === this.players.get(this.player1Id) ? 1 : 2;
    }

    if (preferredSlot && !this.takenSlots.has(preferredSlot)) {
      this.takenSlots.add(preferredSlot);
      return preferredSlot;
    }

    const availableSlots = this.getAvailableSlots();
    if (availableSlots.length === 0) {
      throw new Error('No player slots available');
    }

    const assignedSlot = availableSlots[0];
    this.takenSlots.add(assignedSlot);
    return assignedSlot;
  }

  /**
   * @method addPlayer
   * @description Called via HTTP when a player joins.
   *   Validates:
   *     • characterTypeId must be a valid CharacterType.
   *     • abilityId must correspond to a real Ability.
   *   Then instantiates a new Character(type, ability) and cancels the pending‐join timer if now full.
   *
   * @param {string} characterTypeId
   * @param {string} abilityId       - Any valid Ability ID ("boostAttackOnAttack", "halfDamageOnDefend", etc.)
   * @param {number=} preferredSlot  - Optional preferred player slot (1 or 2)
   * @throws {Error} If validation fails or session is full/duplicate join.
   */
  addPlayer(
    characterTypeId: string,
    abilityId: string,
    preferredSlot?: number
  ): string {
    // 1) Prevent >2 players
    if (this.players.size >= 2) {
      throw new Error('Session is already full');
    }

    // 2) Assign player slot and get player ID
    const slot = this.assignPlayerSlot('', preferredSlot);
    const playerId = slot === 1 ? this.player1Id : this.player2Id;

    // 3) Validate CharacterType
    const charType = (Object.values(CharacterType) as string[]).find(
      (t) => t === characterTypeId
    ) as CharacterType | undefined;
    if (!charType) {
      throw new Error(`Character type "${characterTypeId}" not recognized`);
    }

    // 4) Lookup and validate the Ability object
    const ability = Ability.findById(abilityId);
    if (!ability) {
      throw new Error(`Ability "${abilityId}" not found`);
    }

    // 5) Instantiate the new Character with the full Ability object
    const character = new Character(charType, ability);
    this.players.set(playerId, character);

    // 6) If two players have now joined, cancel pending‐join timer
    if (this.players.size === 2 && this.pendingJoinTimer) {
      clearTimeout(this.pendingJoinTimer);
      this.pendingJoinTimer = null;
    }

    return playerId;
  }

  /**
   * @method hasPlayer
   * @param {string} playerId
   * @returns {boolean} True if this session already has a Character for the given playerId.
   */
  public hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  /**
   * @method attachSocket
   * @description Called when a WebSocket client emits 'join':
   *   • Maps socket.id → playerId.
   *   • If bothConnected() becomes true, cancels any running disconnect timer.
   *
   * @param {string} socketId
   * @param {string} playerId
   */
  attachSocket(socketId: string, playerId: string) {
    this.sockets.set(socketId, playerId);

    // If both players are now connected, clear the disconnect timer
    if (this.bothConnected() && this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /**
   * @method detachSocket
   * @description Called on WebSocket disconnect:
   *   • Removes socket.id → playerId mapping.
   *   • If bothConnected() becomes false, schedules a 60s timer to delete the session.
   *   • Returns true if that socket belonged to this session.
   *
   * @param {string} socketId
   * @returns {boolean} True if socket was attached to this session.
   */
  detachSocket(socketId: string): boolean {
    const wasAttached = this.sockets.delete(socketId);
    if (!wasAttached) return false;

    if (!this.bothConnected() && !this.disconnectTimer) {
      this.disconnectTimer = setTimeout(() => {
        SessionManager.getInstance().delete(this.id);
      }, 60_000);
    }
    return true;
  }

  /**
   * @method bothConnected
   * @description Returns true only if:
   *   • Exactly two players have joined, AND
   *   • Each playerId is present among the currently attached sockets.
   *
   * @returns {boolean}
   */
  bothConnected(): boolean {
    if (this.players.size !== 2) return false;
    const connectedSet = new Set(this.sockets.values());
    return [...this.players.keys()].every((pid) =>
      connectedSet.has(pid)
    );
  }

  /**
   * @method useAbility
   * @description Executes one combat "turn":
   *   1) Look up attacker & defender Character instances.
   *   2) Read attacker.ability (an Ability object) and check .kind === 'offense'.
   *      If offense, call OffenseBehaviors[ability.id].onAttack on the base attack.
   *   3) Compute netDamage = modifiedAttack − defender.defensePower (clamped ≥ 0).
   *   4) Retrieve defender.ability. If defender.ability.kind === 'defense' and
   *      id === HalfDamageOnDefend, call DefenseBehaviors[HalfDamageOnDefend].onDefend().
   *   5) Subtract netDamage from defender.health (clamped ≥ 0).
   *   6) If defender.ability.kind === 'defense' and id === HealUnder30, call
   *      DefenseBehaviors[HealUnder30].afterDamage() to possibly heal.
   *
   * @param {string} fromPlayer – playerId of the attacker
   * @param {string} toPlayer   – playerId of the defender
   * @throws {Error} If attacker or defender not found
   */
  useAbility(fromPlayer: string, toPlayer: string) {
    const attacker = this.players.get(fromPlayer);
    const defender = this.players.get(toPlayer);
    if (!attacker || !defender) {
      throw new Error('One or both players not found');
    }

    // 1) Base attack value
    let attackValue = attacker.attackPower;

    // 2) Attacker's ability
    const attackerAbility = attacker.ability;
    if (attackerAbility.kind === 'offense') {
      const offId = attackerAbility.id as OffenseAbility;
      const behavior = OffenseBehaviors[offId];
      attackValue = behavior.onAttack(attackValue);
    }

    // 3) Compute netDamage
    let netDamage = attackValue - defender.defensePower;
    if (netDamage < 0) netDamage = 0;

    // 4) Defender's ability
    const defenderAbility = defender.ability;
    if (defenderAbility.kind === 'defense') {
      if (defenderAbility.id === DefenseAbility.HalfDamageOnDefend) {
        const behavior = DefenseBehaviors[DefenseAbility.HalfDamageOnDefend];
        if (behavior.onDefend) {
          netDamage = behavior.onDefend(netDamage);
        }
      }
    }

    // 5) Apply damage
    defender.health -= netDamage;
    if (defender.health < 0) defender.health = 0;

    // 6) Possibly heal if "HealUnder30"
    if (defenderAbility.kind === 'defense') {
      if (defenderAbility.id === DefenseAbility.HealUnder30) {
        const behavior = DefenseBehaviors[DefenseAbility.HealUnder30];
        if (behavior.afterDamage) {
          defender.health = behavior.afterDamage(defender.health);
        }
      }
    }
  }

  /**
   * @method serialize
   * @description Returns a JSON‐serializable snapshot of the session:
   *   • `id`: session UUID
   *   • `players`: array of SerializedPlayer
   *   • `bothConnected`: boolean indicating if both players are connected
   *
   * @returns {SerializedSession}
   */
  serialize(): SerializedSession {
    const serializedPlayers: SerializedPlayer[] = [];
    for (const [pid, char] of this.players.entries()) {
      serializedPlayers.push({
        playerId: pid,
        name: char.name,
        health: char.health,
        attackPower: char.attackPower,
        defensePower: char.defensePower,
        abilityId: char.ability.id,       // just the string ID
        attackTypes: [...char.attackTypes],
      });
    }
    return {
      id: this.id,
      players: serializedPlayers,
      bothConnected: this.bothConnected(),
    };
  }
}
