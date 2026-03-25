# binlog notes

## Overview

The general "layout" or "design" of the binlog is:

```txt
`VTRN` `n------`
TP OP / CONSEQUENCES
```

The placeholders in the above diagram are labeled as follows:

- `TRN` is the number of that turn, colored with `V`.
- `TP` is the player that made the op.
  - `T` = team (`d` or `a`)
  - `P` = player index (`0` - `f`)
  - Examples: `d0`, `a0`, etc.
  - If a binlog entry spans multiple lines, `TP` is replaced with `` `n--` ``
- `OP` is the op made by the player.
  - Invalid ops become `` `n--` ``
- `CONSEQUENCES` is the description of events that happen as a result of the op.
  - This will look different depending on the op.

The binlog is outputted to BINMAT brains as a list, separated by newlines, with no coloring syntax.

## Ops, consequences, and you

### Glossary and notation

- `OP` is the op submitted by the player.
  - Invalid ops become `` `n--` ``
- `X` is a "hidden" card, or the card back if you want to think of it that way
- `dN` is a draw op
  - `N` is the deck label (`0` - `5`, `a`)
- `pCL` is a play op
  - `C` is a card (as either `C` or `CA`)
  - `L` is the lane the card is played to
- `uCL` is a play op, but face up
  - `C` is a card (as either `C` or `CA`)
  - `L` is the lane the card is played to
- `cL` is a combat op
  - `L` is the lane combat is declared in
- `xCN` is a discard op
  - `C` is a card (as either `C` or `CA`)
  - `N` is the deck label (`0` - `5`, `a`)
- `C` and `CA` are a card, where `C` is a card's value, and `A` is a card's axiom
- `TRN` is the number of that turn
- `TP` is the player that made the op
  - `T` = team (`d` or `a`)
  - `P` = player index (`0` - `f`)
  - Examples: `d0`, `a0`, etc
  - If a binlog entry spans multiple lines, `TP` is replaced with `` `n--` ``
- `CONSEQUENCES` is the description of events that happen as a result of the op
  - This will look different depending on the op

### Drawing (`dN`)

Drawing has the following forms:

> [!NOTE]
> If more than one card is drawn, the cards are all shown in the consequence, separated by spaces.
> For example: `... / X X ha0`

#### Face-down deck

```txt
TP dN / X hTP
```

#### Face-up deck

```txt
TP dN / CA hTP
```

### Playing

Playing a card has the following forms:

#### Face-down (`pCL`)

```txt
TP pXL / X TL
```

#### Face-up (`uCL`)

```txt
TP OP / CA TL
```

### Discarding (`xCL`)

Discarding has the following forms:

> [!NOTE]
> When multiple cards are being discarded, it is shown similar to drawing,
> with all cards shown space-separated.

#### General

```txt
TP OP / CA xN
```

#### Attacker discard

```txt
aP OP / CA xa / X X haP
```

### Combat (`cL`)

This one's _fun_.

Combat always spans multiple lines, with the combat information actually appearing on a new line, not the op line.

The "structure" for combat in the binlog is:

```txt
TP OP
TP cL / AS / DS
TP [MODIFIERS (@, ?)]
TP ASP DSP DMG / [CONSEQUENCES]
```

- `AS` and `DS` are attacker and defender stack contents respectively
- `MODIFIERS` will differ based on the modifier, outlined below, and appear in order of resolution
  - The WILD (`*`) and BREAK (`>`) modifiers have no special entry in the binlog, only modifying combat evaluation.
- `ASP` and `DSP` are attacker and defender stack power respectively
- `DMG` is damage dealt by attacker
- `CONSEQUENCES` will have generally have multiple "segments" in it, appearing in the order of with they are resolved.
  - This will typically have the attacker stack discarded, then the results of damage being dealt
    - Damage is first dealt to the opposing defender stack, and then the lane deck behind it.
    - Damage to the opposing stack appears in `CONSEQUENCES` as cards in that stack being sent to `xa`
    - Damage to a lane deck appears in `CONSEQUENCES` as cards being drawn from the lane deck.
  - If the defender stack has more power than the attacker stack (or it's a bounce), the only consequence will be the discarding of the attacker stack.

#### TRAP (`@`)

The resolution of a trap is as follows:

```txt
TP T@ / CA xN
```

All traps being resolved appear in the same line, showing as multiple cards being discarded.

#### BOUNCE (`?`)

The bounce resolution appears in the binlog as the bounce being discarded.

It also appears directly before the combat summary, as it is evaluated last.

```txt
TP T? / ?A xN
```
