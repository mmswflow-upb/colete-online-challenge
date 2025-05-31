/**
 * @enum {string}
 * @description CharacterType enum:
 *   Lists all character archetypes available in the game.
 */
export enum CharacterType {
    /** A close‐combat fighter with balanced offense and defense */
    Warrior = 'warrior',
  
    /** A ranged / magic user with powerful spells */
    Mage = 'mage'
  }
  
  /**
   * @interface CharacterTypeData
   * @property {string} name - Human‐readable name of the character type.
   * @property {string[]} attacks - List of attack‐move identifiers.
   */
  export interface CharacterTypeData {
    name: string;
    attacks: string[];
  }
  
  /**
   * @constant {Record<CharacterType, CharacterTypeData>}
   * @description Metadata for each CharacterType, including display name & available attacks.
   */
  export const CharacterTypeData: Record<CharacterType, CharacterTypeData> = {
    [CharacterType.Warrior]: {
      name: 'Warrior',
      attacks: ['slash', 'stab', 'shieldBash']
    },
    [CharacterType.Mage]: {
      name: 'Mage',
      attacks: ['fireball', 'icebolt', 'arcaneBlast']
    }
  };
  