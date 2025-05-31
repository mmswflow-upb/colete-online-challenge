/**
 * @enum {string}
 * @description OffenseAbility enum:
 *   Characters with an offensive ability get a chance to increase their damage on attack.
 */
export enum OffenseAbility {
  /** 25% chance to boost attack by 50% */
  BoostAttackOnAttack = 'boostAttackOnAttack'
}

/**
 * @interface OffenseAbilityData
 * @property {string} displayName - Human‐readable name for UI.
 * @property {string} description - Short description of what the ability does.
 */
export interface OffenseAbilityData {
  displayName: string;
  description: string;
}

/**
 * @constant {Record<OffenseAbility, OffenseAbilityData>}
 * @description Metadata for each offense ability, including display name and description.
 */
export const OffenseAbilityData: Record<OffenseAbility, OffenseAbilityData> = {
  [OffenseAbility.BoostAttackOnAttack]: {
    displayName: 'Boost Attack on Attack',
    description: '25% chance to increase your damage by 50% when attacking.'
  }
};

/**
 * @interface OffenseBehavior
 * @property {(baseAttack: number) => number} onAttack
 *   Given baseAttack, returns the (possibly modified) attack value.
 */
export interface OffenseBehavior {
  onAttack: (baseAttack: number) => number;
}

/**
 * @constant {Record<OffenseAbility, OffenseBehavior>}
 * @description A lookup table mapping each OffenseAbility to its implementation logic.
 */
export const OffenseBehaviors: Record<OffenseAbility, OffenseBehavior> = {
  [OffenseAbility.BoostAttackOnAttack]: {
    /**
     * @param {number} baseAttack
     * @returns {number} 25% chance to boost the attack by 50%.
     */
    onAttack: (baseAttack: number): number => {
      if (Math.random() < 0.25) {
        return Math.floor(baseAttack * 1.5);
      }
      return baseAttack;
    }
  }
};
