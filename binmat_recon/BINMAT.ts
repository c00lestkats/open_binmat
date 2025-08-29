type Axiom = "%" | "&" | "+" | "!" | "^" | "#"

type CardValue = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "a" | "*" | ">" | "?" | "@"

type Card = `${CardValue}${Axiom}`

type TeamHand = Card[]
type EnemyHand = number
type Hand = TeamHand | EnemyHand

type Deck = {
    c: number,
    t: Card | "X"
}

type Discard = Card[]

type Stack = (Card | `${Card}u` | "X")[]

type GameState = {
    a?: Deck,
    a0?: Stack,
    a1?: Stack,
    a2?: Stack,
    a3?: Stack,
    a4?: Stack,
    a5?: Stack,
    d0?: Stack,
    d1?: Stack,
    d2?: Stack,
    d3?: Stack,
    d4?: Stack,
    d5?: Stack,
    ha0?: Hand,
    ha1?: Hand,
    ha2?: Hand,
    ha3?: Hand,
    ha4?: Hand,
    ha5?: Hand,
    ha6?: Hand,
    ha7?: Hand,
    ha8?: Hand,
    ha9?: Hand,
    haa?: Hand,
    hab?: Hand,
    hac?: Hand,
    had?: Hand,
    hae?: Hand,
    haf?: Hand,
    hd0?: Hand,
    hd1?: Hand,
    hd2?: Hand,
    hd3?: Hand,
    hd4?: Hand,
    hd5?: Hand,
    hd6?: Hand,
    hd7?: Hand,
    hd8?: Hand,
    hd9?: Hand,
    hda?: Hand,
    hdb?: Hand,
    hdc?: Hand,
    hdd?: Hand,
    hde?: Hand,
    hdf?: Hand,
    l0?: Deck
    l1?: Deck
    l2?: Deck
    l3?: Deck
    l4?: Deck
    l5?: Deck
    ord: number,
    turns: number,
    x0?: Discard,
    x1?: Discard,
    x2?: Discard,
    x3?: Discard,
    x4?: Discard,
    x5?: Discard,
    xa?: Discard
}

type BINMATArgs = {
    ops: string[],
    plr: string,
    plrs: [string, string][],
    s: GameState
}


type Lane = "0" | "1" | "2" | "3" | "4" | "5"

type POp = `p${CardValue | Card}${Lane}`
type UOp = `u${CardValue | Card}${Lane}`
type XOp = `x${CardValue | Card}${Lane | "a"}`

type DrawOp = `d${Lane | "a"}`
type PlayOp = POp | UOp
type DiscardOp = XOp
type CombatOp = `c${Lane}`

type Op = DrawOp | PlayOp | DiscardOp | CombatOp

type TraceDefender = "100101111" // 303
type TraceAttacker = "101000000" // 320
type Trace = TraceDefender | TraceAttacker

interface PlayerNullsec {
    binmat: {
        /**
         * **NULLSEC**
         */
        connect: (args: { target: string, trace: Trace, brain?: string }) => ScriptResponse,
        /**
         * **NULLSEC**
         */
        c: typeof $ns.binmat.connect,
        /**
         * **NULLSEC**
         */
        xform: (args: { op: Op }) => ScriptResponse,
        /**
         * **NULLSEC**
         */
        x: typeof $ns.binmat.xform
    }
}