import { OffenseAbility, OffenseAbilityData } from '../config/AbilityOffense';
import { DefenseAbility, DefenseAbilityData } from '../config/AbilityDefense';

/**
 * @typedef {'offense' | 'defense'} AbilityKind
 * @description
 *   Distinguishes whether an ability comes from the offense pool or defense pool.
 */
export type AbilityKind = 'offense' | 'defense';

/**
 * @typedef {OffenseAbility | DefenseAbility} AbilityType
 * @description
 *   A union of all valid ability IDs (both offense and defense enums).
 */
export type AbilityType = OffenseAbility | DefenseAbility;

/**
 * @interface AbilityData
 * @property {AbilityType} id          - e.g. "boostAttackOnAttack" or "halfDamageOnDefend"
 * @property {string}      name        - Human‐readable name
 * @property {string}      description - Explanation of effect
 * @property {AbilityKind} kind        - Either "offense" or "defense"
 */
export interface AbilityData {
  id: AbilityType;
  name: string;
  description: string;
  kind: AbilityKind;
}

/**
 * @class Ability
 * @description Wraps an AbilityData object (with id, name, description, and kind).
 *   The constructor simply stores these four fields so you can easily inspect
 *   whether it is an offense or defense ability (via `kind`).
 */
export class Ability {
  /** @type {AbilityType} */
  id: AbilityType;

  /** @type {string} */
  name: string;

  /** @type {string} */
  description: string;

  /** @type {AbilityKind} */
  kind: AbilityKind;

  /**
   * @param {AbilityData} data
   *   The raw ability record (from config) containing id, name, description, and kind.
   */
  constructor(data: AbilityData) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.kind = data.kind;
  }

  /**
   * @returns {Ability[]}
   *   Builds a combined list of all offense + defense abilities,
   *   each instantiated as an Ability with the correct `kind`.
   */
  static all(): Ability[] {
    // 1. Build offense list
    const offenseList: AbilityData[] = (Object.values(OffenseAbility) as OffenseAbility[]).map(
      (offKey) => {
        const record = OffenseAbilityData[offKey];
        return {
          id: offKey,
          name: record.displayName,
          description: record.description,
          kind: 'offense',
        };
      }
    );

    // 2. Build defense list
    const defenseList: AbilityData[] = (Object.values(DefenseAbility) as DefenseAbility[]).map(
      (defKey) => {
        const record = DefenseAbilityData[defKey];
        return {
          id: defKey,
          name: record.displayName,
          description: record.description,
          kind: 'defense',
        };
      }
    );

    // 3. Combine and instantiate
    return [...offenseList, ...defenseList].map((data) => new Ability(data));
  }

  /**
   * @param {string} id
   * @returns {Ability | undefined}
   *   Finds a single Ability by its ID (searching both offense + defense),
   *   or returns undefined if not found.
   */
  static findById(id: string): Ability | undefined {
    return this.all().find((a) => a.id === id);
  }
}
