export default function binaryMatrixAPI(context: Context, args: any) {
  //#region type definitions
  interface State {
    lanes: [Lane, Lane, Lane, Lane, Lane, Lane];
    attackerDiscard: Stack<DiscardedCard>;
    attackerDeck: Stack<DeckCard>;
    hands: {
      attacker: [
        Stack<HandCard>,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?
      ];
      defender: [
        Stack<HandCard>,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?,
        Stack<HandCard>?
      ];
    };
  }
  interface brainArgs {
    plr: // pid of current player,
    pid;
    s: //modified state, too lazy to ts define it since its rather complicated
    /**
     * {
     *  turns: number, // elapsed turns
     *  (a|l[0-5]): { // decks
     *    c: number, // number of cards
     *    t: cid | "X", // top card or "X" if hidden
     *  }
     * }
     * h(d|a)[0-9a-f]: cid[] | number
     * [a|d][0-5]: (cid | `${cid}u` | "X")[], // attacker/defender stack, u is appended when card is visible for everyone
     * x[0-5a]: cid[], // discards
     */
    any;
    plrs: // array of players in the format [pid, username]
    [pid, string][];
    ops: // binlog since last turn (of this player, so 2 turns)
    string[];
  }
  const cardValues: readonly [2, 3, 4, 5, 6, 7, 8, 9, 'a', '?', '>', '@', '*'] =
    [2, 3, 4, 5, 6, 7, 8, 9, 'a', '?', '>', '@', '*'];
  const cardSigns: readonly ['^', '+', '%', '&', '!', '#'] = [
    '^',
    '+',
    '%',
    '&',
    '!',
    '#',
  ];
  type CardValues = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'a' | '?' | '>' | '*' | '@';
  type CardSigns = '^' | '+' | '%' | '&' | '!' | '#';
  interface Card {
    value: CardValues;
    sign: CardSigns;
    up: boolean;
  }
  interface PlayedCard extends Card {}
  interface DeckCard extends Card {}
  interface DiscardedCard extends Card {
    up: true;
  }
  interface HandCard extends Card {
    up: false;
  }
  type Stack<T> = T extends Card ? T[] : never;
  interface Lane {
    attackerStack: CombatStack;
    defenderStack: CombatStack;
    laneDeck: Stack<DeckCard>;
    laneDiscard: Stack<DiscardedCard>;
  }
  interface Player {
    username: string;
    team: 'a' | 'd' | 's' | 't';
    id: pid; // a0, a1, d0 etc
    consecutiveNoOps: number;
  }
  interface Game {
    _id: any;
    type: 'binmat-game';
    state: State;
    players: Player[];
    binlog: string[];
    turn: number;
    seed: [number, number, number, number];
    queuedOps: any;
    lastTurn: number; // unix timestamp of last turns execution
    status: 'lobby' | 'ongoing' | 'completed';
    settings: Settings;
  }
  interface Settings {
    timeMode: 'async' | 'timed';
    turnTime: null | number;
    turnLimit: number;
    ord: 'playerIndex' | 'ramdom';
    discardOnInactive: boolean;
    markInactiveTurns: number;
    kickOnInactive: boolean;
    allowBrains: boolean;
    allowMultipleControl: boolean;
    seed: string;
  }

  type laneNum = 0 | 1 | 2 | 3 | 4 | 5;
  type playerNum =
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f';

  type attackerDeckLane = 6;

  type pid = `${'a' | 'd'}${playerNum}`;
  type cid = `${CardValues}${CardSigns}`;

  type CombatStack = { cards: Stack<PlayedCard>; force_visible: boolean };

  const traceDefender = '100101111';
  const traceAttacker = '101000000';

  //#endregion type definitions
  //#region randomness functions

  function cyrb128(str: string): [number, number, number, number] {
    let h1 = 1779033703,
      h2 = 3144134277,
      h3 = 1013904242,
      h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    (h1 ^= h2 ^ h3 ^ h4), (h2 ^= h1), (h3 ^= h1), (h4 ^= h1);
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(state: [number, number, number, number]): () => number {
    return function () {
      state[0] |= 0;
      state[1] |= 0;
      state[2] |= 0;
      state[3] |= 0;
      let t = (((state[0] + state[1]) | 0) + state[3]) | 0;
      state[3] = (state[3] + 1) | 0;
      state[0] = state[1] ^ (state[1] >>> 9);
      state[1] = (state[2] + (state[2] << 3)) | 0;
      state[2] = (state[2] << 21) | (state[2] >>> 11);
      state[2] = (state[2] + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  //#endregion randomness functions
  //#region lobby functions
  const colors = {
    '^': 'I',
    '+': 'C',
    '%': 'N',
    '&': 'l',
    '!': 'D',
    '#': 'F',
  };

  const getSuggestedSeed = (): string => {
    // get a "random" seed from throwning whatever we can grab from the environment into cyrb128
    const t = new Date().toISOString().toLowerCase();
    const o = String($db.ObjectId()).substring(9);
    const c = JSON.stringify(context).toLowerCase();
    const a = JSON.stringify(args).toLowerCase();
    const s = t + a + o + c;
    const n = cyrb128(s);
    const m = Math.abs(n[0] + n[1] + (n[2] * n[3]) / n[1] - n[3]);
    const r = m.toString(16);
    return r + n[r.charCodeAt(0) % 4].toString(16);
  };

  function createLobby(settings?: Partial<Settings>): {
    ok: boolean;
    msg: string;
  } {
    const defaultSettings: Settings = {
      timeMode: 'async',
      turnTime: 5000,
      turnLimit: 110,
      ord: 'playerIndex',
      discardOnInactive: true,
      markInactiveTurns: 2,
      kickOnInactive: false,
      allowBrains: true,
      allowMultipleControl: false,
      seed: getSuggestedSeed(),
    };

    if (settings) {
      let k = Object.keys(settings);
      let a = Object.keys(defaultSettings);
      let f = k.filter((el) => !a.includes(el));
      if (f.length !== 0)
        return { ok: false, msg: 'unkown settings detected: ' + f.join(', ') };
    }

    const _settings: Settings = { ...defaultSettings, ...settings };

    const game: Partial<Game> = {
      _id: $db.ObjectId(),
      settings: _settings,
      status: 'lobby',
      type: 'binmat-game',
    };

    let r = $db.i(game as unknown as any)[0];
    if (r.n !== 1)
      return { ok: false, msg: 'db insert failed, please try again' };

    return { ok: true, msg: game._id };
  }

  function createGame(
    gameId: string,
    _seed: string,
    a0: string,
    d0: string
  ): boolean {
    const seed = cyrb128(_seed);
    const r = sfc32(seed);
    const rInt = (max: number): number => Math.floor(r() * max) + 1;

    // create array if all cards in play
    const availibleCards: DeckCard[] = [];
    for (let v of cardValues) {
      for (let s of cardSigns) {
        availibleCards.push({ value: v, sign: s, up: false });
      }
    }

    const lanes: Lane[] = [];

    // create lanes
    for (let i = 0; i < 6; i++) {
      lanes[i] = {
        attackerStack: { cards: [], force_visible: false },
        defenderStack: { cards: [], force_visible: false },
        laneDiscard: [],
        laneDeck: [],
      };
    }

    // fill cards into lanes, randomly based on seed
    while (availibleCards.length > 0) {
      let card: DeckCard = availibleCards[rInt(availibleCards.length - 1)];
      let availibleLanes: Lane[] = lanes.filter(
        (el: Lane) => el.laneDeck.length < 13
      );

      availibleLanes[rInt(availibleLanes.length - 1)].laneDeck.push(card);
    }
    // turn top card in lanes 3-5 up
    for (let i = 3; i < 6; i++) {
      lanes[i].laneDeck[0].up = true;
    }

    // put together state
    const boardState: State = {
      lanes: lanes as [Lane, Lane, Lane, Lane, Lane, Lane],
      attackerDeck: [],
      attackerDiscard: [],
      hands: { attacker: [[]], defender: [[]] },
    };

    const gameState: Partial<Game> = {
      players: [
        {
          username: a0,
          team: 'a',
          id: 'a0',
          consecutiveNoOps: 0,
        },
        {
          username: d0,
          team: 'd',
          id: 'd0',
          consecutiveNoOps: 0,
        },
      ],
      state: boardState,
      seed,
      binlog: [],
      turn: 0,
      queuedOps: {},
    };

    return $db.u1({ _id: gameId }, gameState as unknown as any)[0].n === 1;
  }

  //#endregion lobby functions
  //#region helper functions

  function shuffleArray<T>(arr: Array<T>, r: () => number): Array<T> {
    return arr.sort(() => r() - 0.5);
  }

  const decToHex = (num: number) => num.toString(16);
  const hexToDec = (num: string) => parseInt(num, 16);

  const splitPid = (
    pid: pid
  ): { team: 'a' | 'd'; teamlong: 'attacker' | 'defender'; num: playerNum } => {
    if (!(pid[0] === 'a' || pid[0] === 'd'))
      throw new Error('illegal player id');

    const _team = pid[0] === 'a' ? 'attacker' : 'defender';
    const num = pid[1] as playerNum;

    return { team: pid[0], teamlong: _team, num };
  };
  function getLane(
    lane: attackerDeckLane,
    state: State
  ): { deck: Stack<DeckCard>; discard: Stack<DiscardedCard> };
  function getLane(
    lane: laneNum,
    state: State
  ): {
    deck: Stack<DeckCard>;
    discard: Stack<DiscardedCard>;
    attackerStack: CombatStack;
    defenderStack: CombatStack;
  };
  function getLane(
    lane: laneNum | attackerDeckLane,
    state: State
  ): {
    deck: Stack<DeckCard>;
    discard: Stack<DiscardedCard>;
    attackerStack?: CombatStack;
    defenderStack?: CombatStack;
  };
  function getLane(
    lane: laneNum | attackerDeckLane,
    state: State
  ): {
    deck: Stack<DeckCard>;
    discard: Stack<DiscardedCard>;
    attackerStack?: CombatStack;
    defenderStack?: CombatStack;
  } {
    let deck;
    let discard;
    let attackerStack;
    let defenderStack;
    // handle attacker "lane"
    if (lane === 6) {
      deck = state.attackerDeck;
      discard = state.attackerDiscard;
    } else {
      deck = state.lanes[lane].laneDeck;
      discard = state.lanes[lane].laneDiscard;
      attackerStack = state.lanes[lane].attackerStack;
      defenderStack = state.lanes[lane].defenderStack;
    }

    return { deck, discard, attackerStack, defenderStack };
  }

  const spliceCardFromHand = (
    pid: pid,
    state: State,
    value: CardValues,
    sign?: CardSigns
  ): HandCard | undefined => {
    // romves specified card from players hand and returns it
    // return undefined if card is not present
    const p = splitPid(pid);

    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    const fitsValue = hand.filter((el) => el.value === value);

    if (fitsValue.length > 1 && sign === undefined) return;
    if (fitsValue.length === 0) return;
    if (sign !== undefined) {
      const c = fitsValue.find((el) => el.sign === sign);
      if (c === undefined) return;
      return hand.splice(hand.indexOf(c), 1)[0];
    }
    if (fitsValue.length === 1) {
      const c = fitsValue[0];
      return hand.splice(hand.indexOf(c), 1)[0];
    }
    return;
  };

  const powersOfTwo = [
    2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384,
  ];

  const calcStackPow = (stack: Stack<Card>): number => {
    // calculate number sum
    const numbers = stack
      .filter((el) => typeof el.value === 'number' || el.value === 'a')
      .map((el) => (el.value === 'a' ? 10 : el.value)) as number[];
    let numSum = numbers.reduce((a, b) => a + b, 0);

    // apply wilds
    const wilds = stack.filter((el) => el.value === '*');
    for (let i = 0; i < wilds.length; i++) {
      numSum = applyWild(numSum);
    }

    let ix = powersOfTwo.indexOf(numSum);
    let pow = ix === -1 ? 0 : ix;

    return pow;
  };

  const applyWild = (num: number): number => {
    const nextPowerOfTwo = powersOfTwo.find((el) => el > num);
    if (!nextPowerOfTwo)
      throw new Error(
        'Could not apply wild, number was higher than 16384 (2 ** 14)'
      );
    return nextPowerOfTwo;
  };

  const toBrainState = (pid: pid, state: State): brainArgs => {
    throw new Error('not implemented.');
  };

  //#endregion helper functions
  //#region binmat game-functions

  const drawCard = (
    pid: pid,
    lane: laneNum | attackerDeckLane,
    game: Game
  ): boolean => {
    // get player drawing
    const p = splitPid(pid);

    const r = sfc32(game.seed);
    const state = game.state;

    // get relevant stacks
    const { deck, discard } = getLane(lane, state);
    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    // defender can't draw from attcker deck
    if (p.team === 'd' && lane === 6) return false;

    if (deck.length === 0) {
      if (discard.length === 0) {
        // invalid op if defender or lane 6, attacker win otherwise
        if (lane === 6 || p.team === 'd') return false;
        throw new Error('win function not implemented');
      }
      // if deck is empty shuffle discard into deck
      deck.push(...shuffleArray(discard, r));
      discard.splice(0, discard.length);
      // if is visible lane, make top card visible
      if (lane < 6 && lane > 2) deck[deck.length - 1].up = true;
    }

    if (deck.length === 0) throw new Error('shuffling into deck did not work');

    // draw card
    const card = deck.pop() as Card;
    if (lane < 6 && lane > 2) {
      // if one of the open decks, make next card visible
      deck[deck.length - 1].up = true;
    }

    // set card visibility to team
    card.up = false;
    hand.push(card as HandCard);

    return true;
  };

  const discardCard = (
    pid: pid,
    lane: laneNum | attackerDeckLane,
    card: Card,
    game: Game
  ): boolean => {
    // get player discarding
    const p = splitPid(pid);

    // defender cannot discard to attcker discard
    if (p.team === 'd' && lane === 6) return false;

    const state = game.state;
    // get relevant stacks
    const { deck, discard } = getLane(lane, state);
    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    // remove from hand
    let discardCard = spliceCardFromHand(pid, state, card.value, card.sign) as
      | Card
      | undefined;

    if (discardCard === undefined) return false;

    // make visible and add to discard
    discardCard.up = true;
    discard.push(discardCard as DiscardedCard);

    // if attacker discards to attacker discard, they draw two cards from attacker deck
    if (lane === 6) {
      drawCard(pid, lane, game);
      drawCard(pid, lane, game);
    }

    return true;
  };

  const playCard = (
    pid: pid,
    lane: laneNum,
    card: Card,
    game: Game,
    up: boolean = false
  ): boolean => {
    // get player playing card
    const p = splitPid(pid);

    const state = game.state;

    // get relevant stacks
    const { attackerStack: attacker, defenderStack: defender } = getLane(
      lane,
      state
    );
    const stacks = { attacker, defender };
    const stack = stacks[p.teamlong];

    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    // > cannot be played on emtpy stacks
    // ? cannot be played face-up on non-empty stacks by attackers
    if (card.value === '>' && stack.cards.length === 0) return false;
    if (card.value === '?' && up && stack.cards.length === 0 && p.team === 'a')
      return false;

    // remove from hand
    const _card = spliceCardFromHand(pid, state, card.value, card.sign) as
      | Card
      | undefined;
    if (_card === undefined) return false;

    // play to deck
    _card.up = up;
    stack.cards.push(_card as PlayedCard);

    // if face-up ? or > initiate combat
    if (up && (_card.value === '>' || _card.value === '?'))
      combat(pid, lane, game);

    return true;
  };

  const bounceCombat = (
    as: CombatStack,
    ds: CombatStack,
    ax: Stack<DiscardedCard>
  ): boolean => {
    const asCards = as.cards.splice(0, as.cards.length);
    asCards.forEach((el) => (el.up = true));
    ax.push(...(asCards as DiscardedCard[]));

    ds.cards.forEach((el) => (el.up = true));

    return true;
  };

  const combat = (pid: pid, lane: laneNum, game: Game): boolean => {
    // get teams
    const p = splitPid(pid);
    const o: { team: 'a' | 'd'; teamlong: 'attacker' | 'defender' } =
      p.team === 'a'
        ? { team: 'd', teamlong: 'defender' }
        : { team: 'a', teamlong: 'attacker' };

    // get relevant stacks
    const state = game.state;
    const _attackerDiscard = state.attackerDiscard;
    const { discard, deck, attackerStack, defenderStack } = getLane(
      lane,
      state
    );
    const stacks = { attacker: attackerStack, defender: defenderStack };
    const discards = { attacker: _attackerDiscard, defender: discard };

    // resolve traps
    const attackingTraps = stacks[o.teamlong].cards.filter(
      (el) => el.value === '@'
    );
    for (let i = 0; i < attackingTraps.length; i++) {
      let c = stacks[o.teamlong].cards.pop() as Card | undefined;
      if (c === undefined) break;
      c.up = true;
      discards[p.teamlong].push(c as DiscardedCard);
    }

    const defendingTraps = stacks[p.teamlong].cards.filter(
      (el) => el.value === '@'
    );
    for (let i = 0; i < defendingTraps.length; i++) {
      let c = stacks[p.teamlong].cards.pop() as Card | undefined;
      if (c === undefined) break;
      c.up = true;
      discards[o.teamlong].push(c as DiscardedCard);
    }

    // calculate pow
    const pow = {
      attacker: calcStackPow(stacks.attacker.cards),
      defender: calcStackPow(stacks.defender.cards),
    };

    // resolve ?
    const bounces = {
      attacker: stacks.attacker.cards.filter((el) => el.value === '?'),
      defender: stacks.defender.cards.filter((el) => el.value === '?'),
    };
    if (bounces.attacker.length > 0 || bounces.defender.length > 0) {
      // discard bounces to opponent discard
      for (let bounce of bounces.attacker) {
        let ix = stacks.attacker.cards.indexOf(bounce);
        let c = stacks.attacker.cards.splice(ix, 1)[0];
        c.up = true;
        discards.defender.push(c as DiscardedCard);
      }
      for (let bounce of bounces.defender) {
        let ix = stacks.defender.cards.indexOf(bounce);
        let c = stacks.defender.cards.splice(ix, 1)[0];
        c.up = true;
        discards.attacker.push(c as DiscardedCard);
      }
      // bounce combat
      return bounceCombat(stacks.attacker, stacks.defender, discards.attacker);
    }

    // if both stacks are pow 0, bounce
    if (pow.attacker === 0 && pow.defender === 0)
      return bounceCombat(stacks.attacker, stacks.defender, discards.attacker);

    // resolve combat winner
    const powDiff = pow.attacker - pow.defender;
    const winner = powDiff < 0 ? 'defender' : 'attacker';

    // if defender win
    if (winner === 'defender') {
      // discard as to xd
      let cards = stacks.attacker.cards.splice(0, stacks.attacker.cards.length);
      cards.forEach((el) => (el.up = true));
      discards.defender.push(...(cards as DiscardedCard[]));

      // turn ds up
      stacks.defender.cards.forEach((el) => (el.up = true));

      return true;
    }
    // if attacker win

    const breaks = [
      ...stacks.attacker.cards.filter((el) => el.value === '>'),
      ...stacks.defender.cards.filter((el) => el.value === '>'),
    ];
    const damage =
      breaks.length !== 0
        ? // if > present, calculate > damage
          Math.max(pow.attacker, stacks.defender.cards.length)
        : // else damage = pow as - pow ds + 1
          powDiff + 1;

    //resolve damage
    for (let i = 0; i < damage; i++) {
      let usePid =
        pid[0] === 'a'
          ? // if attacker attacked, give them cards
            pid
          : // if defender >, give cards rotating, starting a0
            (('a' + (i % game.state.hands.attacker.length)) as pid);
      const ds = stacks.defender.cards;
      const ax = discards.attacker;
      // if still cards in ds, discard them to ax
      if (ds.length > 0) {
        let c = ds.pop();
        if (!c)
          throw new Error(
            "ts wants this but I already check for the condition so if this error shows up the array had no items despite it's length being > 0"
          );
        c.up = true;
        ax.push(c as DiscardedCard);
      } else {
        // else draw card
        drawCard(usePid, lane, game);
      }
    }

    // discard as
    let cards = stacks.attacker.cards.splice(0, stacks.attacker.cards.length);
    cards.forEach((el) => (el.up = true));
    discards.attacker.push(...(cards as DiscardedCard[]));

    return true;
  };

  //#endregion binmat functions
  //#region script logic
}
