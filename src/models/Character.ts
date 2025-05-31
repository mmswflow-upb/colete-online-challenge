import { OffenseAbility } from '../config/AbilityOffense';
import { DefenseAbility } from '../config/AbilityDefense';
import { Ability } from './Ability';
import { CharacterType, CharacterTypeData } from '../config/CharacterType';

/**
 * @typedef {Object} OffenseAbilityWrapper
 * @property {'offense'} kind - Discriminator for offense ability.
 * @property {OffenseAbility} type - Specific offense ability enum value.
 *
 * @typedef {Object} DefenseAbilityWrapper
 * @property {'defense'} kind - Discriminator for defense ability.
 * @property {DefenseAbility} type - Specific defense ability enum value.
 *
 * @typedef {OffenseAbilityWrapper | DefenseAbilityWrapper} Ability
 *   Union type: exactly one offense or defense ability.
 */

/**
 * @class Character
 * @description Represents a player’s in‐game avatar:
 *   - type: Which CharacterType (Warrior or Mage)
 *   - name: Human‐readable name
 *   - health: HP, starts at 100
 *   - attackPower: Randomized 15–20
 *   - defensePower: Randomized 10–15
 *   - ability: Exactly one offense or defense ability
 *   - attackTypes: Array of attack‐move strings
 */
export class Character {
  /** @type {CharacterType} */
  type: CharacterType;

  /** @type {string} */
  name: string;

  /** @type {number} */
  health: number;

  /** @type {number} */
  attackPower: number;

  /** @type {number} */
  defensePower: number;

  /** @type {Ability} */
  ability: Ability;

  /** @type {string[]} */
  attackTypes: string[];

  /**
   * @param {CharacterType} type - Archetype (Warrior/Mage)
   * @param {Ability} ability - Chosen offense/defense ability
   */
  constructor(type: CharacterType, ability: Ability) {
    this.type = type;
    this.name = CharacterTypeData[type].name;
    this.health = 100;
    this.attackPower = Character.randomInRange(15, 20);
    this.defensePower = Character.randomInRange(10, 15);
    this.ability = ability;
    this.attackTypes = [...CharacterTypeData[type].attacks];
  }

  /**
   * @private
   * @param {number} min
   * @param {number} max
   * @returns {number} Random integer between min and max (inclusive).
   */
  private static randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * @static
   * @returns {CharacterType[]} All valid CharacterType values.
   */
  static allTypes(): CharacterType[] {
    return Object.values(CharacterType);
  }

  /**
   * @static
   * @param {string} id - A string to parse into CharacterType
   * @returns {CharacterType | undefined} The parsed type or undefined if invalid.
   */
  static parseType(id: string): CharacterType | undefined {
    return (Object.values(CharacterType) as string[]).find((t) => t === id) as
      | CharacterType
      | undefined;
  }

  /**
   * @static
   * @returns {OffenseAbility[]} All valid OffenseAbility values.
   */
  static allOffenseAbilities(): OffenseAbility[] {
    return Object.values(OffenseAbility);
  }

  /**
   * @static
   * @returns {DefenseAbility[]} All valid DefenseAbility values.
   */
  static allDefenseAbilities(): DefenseAbility[] {
    return Object.values(DefenseAbility);
  }
}
