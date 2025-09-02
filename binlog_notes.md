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
- `OP` is the op made by the player.
  - Invalid ops become `` `n--` ``
- `CONSEQUENCES` is the description of events that happen as a result of the op.
  - This will look different depending on the op.

The binlog is outputted to BINMAT brains as a list, separated by newlines.

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
- `CONSEQUENCES` is the description of events that happen as a result of the op
  - This will look different depending on the op

### Drawing (`dN`)

Drawing has the following forms:

#### Face-down deck

```txt
TP dN / X hTP
```

#### Face-up deck

```txt
TP dN / CA hTP
```

#### Notes

If more than one card is drawn, the cards are all shown in the consequence, separated by spaces.

For example: `... / X X ha0`

### Playing

Playing a card has the following forms

#### Face-down (`pCL`)

```txt
TP pXL / X TL
```

#### Face-up (`uCL`)

```txt
TP OP / CA TL
```

### Discarding (`xCL`)

Discarding has the following forms

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
