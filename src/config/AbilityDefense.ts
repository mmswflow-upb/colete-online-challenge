/**
 * @enum {string}
 * @description DefenseAbility enum:
 *   Characters with a defensive ability can take half damage or heal when low.
 */
export enum DefenseAbility {
    /** 25% chance to halve incoming damage */
    HalfDamageOnDefend = 'halfDamageOnDefend',
  
    /** 25% chance to heal 5 HP if health < 30 */
    HealUnder30 = 'healUnder30'
  }
  
  /**
   * @interface DefenseAbilityData
   * @property {string} displayName - Human‐readable name for UI.
   * @property {string} description - Short description of what the ability does.
   */
  export interface DefenseAbilityData {
    displayName: string;
    description: string;
  }
  
  /**
   * @constant {Record<DefenseAbility, DefenseAbilityData>}
   * @description Metadata for each defense ability, including display name and description.
   */
  export const DefenseAbilityData: Record<DefenseAbility, DefenseAbilityData> = {
    [DefenseAbility.HalfDamageOnDefend]: {
      displayName: 'Half Damage on Defend',
      description: '25% chance to take only half damage when attacked.'
    },
    [DefenseAbility.HealUnder30]: {
      displayName: 'Heal Under 30',
      description: '25% chance to heal 5 HP if your health falls below 30.'
    }
  };
  
  /**
   * @interface DefenseBehavior
   * @property {(netDamage: number) => number=} onDefend
   *   Optionally modifies net damage before applying it.
   * @property {(healthAfterDamage: number) => number=} afterDamage
   *   Optionally modifies health after damage is applied.
   */
  export interface DefenseBehavior {
    onDefend?: (netDamage: number) => number;
    afterDamage?: (healthAfterDamage: number) => number;
  }
  
  /**
   * @constant {Record<DefenseAbility, DefenseBehavior>}
   * @description A lookup table mapping each DefenseAbility to its implementation logic.
   */
  export const DefenseBehaviors: Record<DefenseAbility, DefenseBehavior> = {
    [DefenseAbility.HalfDamageOnDefend]: {
      /**
       * @param {number} netDamage
       * @returns {number} 25% chance to halve net damage, otherwise return original.
       */
      onDefend: (netDamage: number): number => {
        if (Math.random() < 0.25) {
          return Math.floor(netDamage / 2);
        }
        return netDamage;
      }
    },
    [DefenseAbility.HealUnder30]: {
      /**
       * @param {number} healthAfterDamage
       * @returns {number} If health < 30 (and >0), 25% chance to heal +5
       */
      afterDamage: (healthAfterDamage: number): number => {
        if (healthAfterDamage > 0 && healthAfterDamage < 30 && Math.random() < 0.25) {
          return healthAfterDamage + 5;
        }
        return healthAfterDamage;
      }
    }
  };
  