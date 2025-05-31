# Duel Game Server

A real-time multiplayer duel game server built with Node.js, Express, and Socket.IO. Players can engage in turn-based combat using different character types and abilities.

## Features

- Real-time combat using Socket.IO
- Multiple character types (Warrior, Mage)
- Customizable abilities for both offense and defense
- Turn-based combat system
- Health tracking and damage calculation
- Session management for multiple games

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:3000` by default.

## How It Works

The game server manages real-time duels between two players. Each player selects a character type (Warrior or Mage) and an ability. The server handles:
- Game session creation and management
- Player connections via Socket.IO
- Turn-based combat mechanics
- Ability execution and damage calculation
- Health tracking and game state updates

Players connect to the server, join a game session, and take turns using their abilities to attack or defend. The server broadcasts round results to both players, including damage dealt, abilities used, and current health status.

## Configuration System

The game uses a type-safe configuration system built with TypeScript enums and interfaces. Here's how it works:

### Character Types

Characters are defined in `src/config/CharacterType.ts` using TypeScript enums:

```typescript
export enum CharacterType {
    Warrior = 'warrior',
    Mage = 'mage'
}
```

Each character type has associated metadata defined in the `CharacterTypeData` interface:

```typescript
interface CharacterTypeData {
    name: string;        // Display name
    attacks: string[];   // Available attack moves
}
```

The actual data is stored in a constant that maps each enum value to its metadata:

```typescript
const CharacterTypeData: Record<CharacterType, CharacterTypeData> = {
    [CharacterType.Warrior]: {
        name: 'Warrior',
        attacks: ['slash', 'stab', 'shieldBash']
    },
    [CharacterType.Mage]: {
        name: 'Mage',
        attacks: ['fireball', 'icebolt', 'arcaneBlast']
    }
};
```

### Abilities

The game has two types of abilities: Offense and Defense. Each type follows a similar pattern:

#### Offense Abilities (`src/config/AbilityOffense.ts`)

1. **Enum Definition**:
```typescript
enum OffenseAbility {
    BoostAttackOnAttack = 'boostAttackOnAttack'
}
```

2. **Metadata Interface**:
```typescript
interface OffenseAbilityData {
    displayName: string;
    description: string;
}
```

3. **Behavior Interface**:
```typescript
interface OffenseBehavior {
    onAttack: (baseAttack: number) => number;
}
```

4. **Implementation**:
```typescript
const OffenseBehaviors: Record<OffenseAbility, OffenseBehavior> = {
    [OffenseAbility.BoostAttackOnAttack]: {
        onAttack: (baseAttack: number): number => {
            if (Math.random() < 0.25) {
                return Math.floor(baseAttack * 1.5);
            }
            return baseAttack;
        }
    }
};
```

#### Defense Abilities (`src/config/AbilityDefense.ts`)

1. **Enum Definition**:
```typescript
enum DefenseAbility {
    HalfDamageOnDefend = 'halfDamageOnDefend',
    HealUnder30 = 'healUnder30'
}
```

2. **Metadata Interface**:
```typescript
interface DefenseAbilityData {
    displayName: string;
    description: string;
}
```

3. **Behavior Interface**:
```typescript
interface DefenseBehavior {
    onDefend?: (netDamage: number) => number;
    afterDamage?: (healthAfterDamage: number) => number;
}
```

4. **Implementation**:
```typescript
const DefenseBehaviors: Record<DefenseAbility, DefenseBehavior> = {
    [DefenseAbility.HalfDamageOnDefend]: {
        onDefend: (netDamage: number): number => {
            if (Math.random() < 0.25) {
                return Math.floor(netDamage / 2);
            }
            return netDamage;
        }
    },
    [DefenseAbility.HealUnder30]: {
        afterDamage: (healthAfterDamage: number): number => {
            if (healthAfterDamage > 0 && healthAfterDamage < 30 && Math.random() < 0.25) {
                return healthAfterDamage + 5;
            }
            return healthAfterDamage;
        }
    }
};
```

### Type Safety

The configuration system uses TypeScript's type system to ensure:
- All character types have required metadata
- All abilities have both metadata and behavior implementations
- Ability behaviors implement the correct interface methods
- No typos in ability or character type identifiers

This makes it impossible to:
- Add a character without required metadata
- Add an ability without implementation
- Use non-existent character types or abilities
- Implement ability behaviors incorrectly

## Extending the Game

### Adding New Characters

To add a new character type:

1. Add the new character to the `CharacterType` enum in `src/config/CharacterType.ts`
2. Define the character's metadata in `CharacterTypeData`, including:
   - Display name
   - Available attacks
3. Implement any character-specific logic in the game service

### Adding New Abilities

The game supports two types of abilities:

1. **Offense Abilities** (`src/config/AbilityOffense.ts`):
   - Define damage calculation
   - Add special effects
   - Implement attack modifiers

2. **Defense Abilities** (`src/config/AbilityDefense.ts`):
   - Define damage reduction
   - Add defensive effects
   - Implement counter-attacks

To add a new ability:
1. Create a new ability class implementing the appropriate interface
2. Define the ability's effects and calculations
3. Register the ability in the game's ability registry
4. Update character type data to include the new ability

The modular design allows for easy addition of new content while maintaining the existing game balance and mechanics.

## Testing

A test client is provided in `test-client.js` that simulates a full game between two players. Run it with:

```bash
node test-client.js
```
