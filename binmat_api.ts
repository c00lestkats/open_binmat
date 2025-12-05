export default function binaryMatrix(
  context: Context,
  args: null | {
    input?: unknown;
    op?: unknown;
    set?: unknown;
    settings?: unknown;
    gid?: unknown;
    as?: unknown;
    v?: unknown;
    d?: unknown;
    log?: unknown;
  }
) {
  //#region type definitions
  interface State {
    lanes: [Lane, Lane, Lane, Lane, Lane, Lane];
    attackerDiscard: Stack<DiscardedCard>;
    attackerDeck: Stack<DeckCard>;
    hands: {
      attacker: max16Array<Stack<HandCard>>;
      defender: max16Array<Stack<HandCard>>;
    };
  }

  type AllowedLength = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
  type max16Array<T> = Array<T> & { length: AllowedLength };
  interface brainArgs {
    plr: // pid of current player,
    pid | 's' | 't';
    s: //modified state, too lazy to ts define it since its rather complicated
    /**
     * {
     *  turns: number, // elapsed turns
     *  l[0-5]: { // decks
     *    c: number, // number of cards
     *    t: cid | "X", // top card or "X" if hidden
     *  }
     * }
     * h(d|a)[0-9a-f]: cid[] | number
     * [a|d][0-5]: (cid | `${cid}u` | "X")[], // attacker/defender stack, u is appended when card is visible for everyone
     * x[0-5a]: cid[], // discards
     * a: number, // attacker deck size
     */
    any;
    plrs: // array of players in the format [pid, username]
    [pid, string][];
    ord: any[];
    ops: // binlog since last turn (of this player, so 2 turns)
    string[];
  }
  const cardValues = [2, 3, 4, 5, 6, 7, 8, 9, 'a', '?', '>', '@', '*'] as const;
  const cardSigns = ['^', '+', '%', '&', '!', '#'] as const;
  type CardValues = (typeof cardValues)[number];
  type CardSigns = (typeof cardSigns)[number];
  interface SpecifiedCard {
    value: CardValues;
    sign?: CardSigns;
  }
  interface Card extends SpecifiedCard {
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
  interface Userbase {
    username: string;
    team: 'a' | 'd' | 's' | 't';
  }
  interface Player extends Userbase {
    username: string;
    team: 'a' | 'd';
    id: pid; // a0, a1, d0 etc
    consecutiveNoOps: number;
  }
  interface Spectator extends Userbase {
    team: 's' | 't';
  }
  type User = Player | Spectator;
  interface Game {
    _id: any;
    type: 'binmat-game';
    state: State;
    players: User[];
    binlog: string[];
    turn: number;
    seed: [number, number, number, number];
    queuedOps: { [Key in Player['id']]?: operation | null };
    lastTurn: number; // unix timestamp of last turns execution
    status: 'lobby' | 'ongoing' | 'completed';
    settings: Settings;
    nextOrd: pid[];
    admin: string; // user who created game
  }
  interface Userdata {
    _id: string; // binmat-<username>
    current: string | null; // binmat id
    type: 'binmat-userdata';
    settings: any;
  }
  type _drawop = `d${laneNum | 'a'}`;
  type _discardop = `x${CardValues | cid}${laneNum | 'a'}`;
  type _combatop = `c${laneNum}`;
  type _playop = `${'p' | 'u'}${CardValues | cid}${laneNum}`;
  type operation = _drawop | _discardop | _combatop | _playop;
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
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
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
  //#region logger

  type LogEntry = { logLevel: LogLevel & number; entry: string };
  type LogLevel = 0 | 1 | 2 | 3 | false | 4 | true | 5 | 6 | 7;

  function getLogger(logLevel: LogLevel, debug: boolean = false) {
    if (typeof logLevel === 'boolean') {
      logLevel = logLevel ? 5 : 3;
    }
    const levels = ['`DCRI`', '`DERR`', '`JWRN`', '`HUNX`', '`QINF`', '`OINF`', '`hVER`', '`gTRC`'];
    const _log: LogEntry[] = [];
    const logger = {
      log: (str: string, level: LogLevel & number) => {
        const time = Date.now() - _ST;
        let entry = `\`1[\`\`${'MKIGEWTXDx'[Math.floor(time / 500)]}${rjust(
          time.toString(),
          4,
          '0'
        )}\`\`1]\` \`1[\`${levels[level]}\`1]\` ${str}`;

        _log.push({ logLevel: level, entry });
        if (debug) $D(entry);
      },
      getLog: () => _log.filter((el) => el.logLevel <= logLevel).map((el) => el.entry),
      getLogOnLevel: (level: LogLevel & number) =>
        _log.filter((el) => el.logLevel <= level).map((el) => el.entry),
    };
    return logger;
  }

  const logger = getLogger(
    args &&
      args.v &&
      (typeof args.v === 'boolean' || (typeof args.v === 'number' && args.v > 0 && args.v < 8))
      ? (args.v as LogLevel)
      : 7,
    args && args.d !== undefined ? true : false
  );

  // TODO REMOVE

  logger.log('This script is in test mode', 4);
  args = args || {};
  args.log = true;

  //#endregionlogger
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
    '^': 'I' as char,
    '+': 'q' as char,
    '%': 'N' as char,
    '&': 'l' as char,
    '!': 'D' as char,
    '#': 'F' as char,
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

  function createLobby(settings?: Partial<Settings>): false | { msg: string; _id: string } {
    const game: Partial<Game> = {
      _id: $db.ObjectId().$oid,
      settings: defaultSettings,
      status: 'lobby',
      type: 'binmat-game',
      admin: context.caller,
      players: [{ username: context.caller, team: 's' }],
    };

    let set = setSettings(game, settings);

    if (set !== true) return set;

    let r = $db.i(game as unknown as any)[0];
    if (r.n !== 1) {
      logger.log('db inset failed, please try again', 0);
      return false;
    }

    const render = renderLobby(game);

    if (!render) return false;

    return { msg: render, _id: game._id };
  }

  function setSettings(game: Partial<Game>, settings?: Partial<Settings>): boolean {
    if (settings) {
      let k = Object.keys(settings);
      let a = Object.keys(defaultSettings);
      let f = k.filter((el) => !a.includes(el));
      if (f.length !== 0) {
        logger.log(`unkown settings detected : ${f.join(', ')}`, 1);
        return false;
      }
    }

    const _settings: Settings = { ...defaultSettings, ...settings };

    game.settings = _settings;

    return true;
  }

  function createGameState(game: Partial<Game>, _seed: string): boolean {
    const seed = cyrb128(_seed);
    const r = sfc32(seed);
    const rInt = (max: number): number => Math.floor(r() * (max + 1));

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
      let availibleLanes: Lane[] = lanes.filter((el: Lane) => el.laneDeck.length < 13);

      availibleLanes[rInt(availibleLanes.length - 1)].laneDeck.push(card);
      availibleCards.splice(availibleCards.indexOf(card), 1);
    }
    // turn top card in lanes 3-5 up
    for (let i = 3; i < 6; i++) {
      lanes[i].laneDeck[12].up = true;
    }

    if (!game.players) {
      logger.log('Could not finds players', 0);
      return false;
    }

    const attackerCount = game.players.filter((el) => el.team === 'a').length;
    const defenderCount = game.players.filter((el) => el.team === 'd').length;

    // put together state
    const boardState: State = {
      lanes: lanes as [Lane, Lane, Lane, Lane, Lane, Lane],
      attackerDeck: [],
      attackerDiscard: [],
      hands: { attacker: Array(attackerCount).fill([]), defender: Array(defenderCount).fill([]) },
    };

    game.state = boardState;
    game.seed = seed;
    game.binlog = [];
    game.turn = 0;
    game.queuedOps = {};
    game.status = 'ongoing';

    game.nextOrd = setNextOrd(game as Game);

    return true;
  }

  const joinGameAs = (gameId: string, as: 'a' | 'd' | 's'): boolean => {
    const g =
      gameId === game?._id ? game : ($db.f({ _id: gameId }).first() as unknown as Partial<Game>);
    if (!g || g.type !== 'binmat-game') {
      logger.log('game not found', 1);
      return false;
    }
    if (g.status !== 'lobby') {
      logger.log('This game is not a lobby', 4);
      return false;
    }

    const playerObj: any = { username: context.caller, team: as };

    if (!g.players) {
      logger.log('game had no players array', 0);
      return false;
    }

    const exist = g.players.filter((el) => el.username === playerObj.username);

    if (!g.settings) {
      logger.log('game had no settings', 0);
      return false;
    }

    const allowMultiple = g.settings.allowMultipleControl;

    if (exist.find((el) => el.team === 'a' || el.team === 'd') && !allowMultiple) {
      logger.log(
        'This game does not allow you to join as multiple players, use switch command to switch team',
        2
      );
      return false;
    }

    if (!exist.find((el) => el.team === 's') && playerObj.team !== 's') {
      g.players.push({ username: context.caller, team: 's' });
    }
    if (exist.find((el) => el.team === 's') && playerObj.team === 's') {
      logger.log('already joined game, skipping', 4);
      return true;
    }

    if (['a', 'd'].includes(playerObj.team)) {
      const highestPlayerIndex = g.players
        .filter((el) => el.team === playerObj.team)
        .map((el) => Number(el.team.substring(1)))
        .reduce((a, b) => (a > b ? a : b), -1);

      playerObj.id = playerObj.team + (highestPlayerIndex + 1);
      playerObj.consecutiveNoOps = 0;
    }

    g.players.push(playerObj);

    userdata.current = g._id;
    $db.us({ _id: g._id }, { $set: g as any });

    logger.log('successfully joined game', 5);
    return true;
  };

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
    if (!(pid[0] === 'a' || pid[0] === 'd')) throw new Error('illegal player id');

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
    logger.log('getting card from hand', 7);

    logger.log(`searching for ${value}${sign || '*'} in hand ${pid}`, 6);

    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    logger.log(`hand: ${renderAllCards(hand, true)}`, 7);

    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    const fitsValue = hand.filter((el) => el.value === value);
    logger.log(`fitsValue: ${renderAllCards(fitsValue, true)}`, 7);

    if (fitsValue.length > 1 && sign === undefined)
      return hand.splice(hand.indexOf(fitsValue[0]), 1)[0];
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

  const powersOfTwo = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];

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
      throw new Error('Could not apply wild, number was higher than 16384 (2 ** 14)');
    return nextPowerOfTwo;
  };

  const cardToCid = (c: Card) => c.value.toString() + (c.sign || '*');
  const displayCards = (
    cards: Card[],
    isTeam: boolean = true,
    isCombat: boolean = false,
    force_visible: boolean = false
  ) => {
    let r = [];
    for (let i = cards.length - 1; i > 0; i--) {
      let card = cards[i];
      if ((isCombat && card.up) || force_visible) r.push(cardToCid(card) + 'u');
      else if (isTeam || card.up) r.push(cardToCid(card));
      else r.push('X');
    }
    return r;
  };

  const toBrainState = (pid: pid | 's' | 't', game: Game): brainArgs => {
    const result: Partial<brainArgs> = {};
    result.plr = pid;

    let prevTurn = `${game.turn - 2} ---`;
    result.ops = game.binlog.slice(game.binlog.indexOf(prevTurn));

    result.plrs = (game.players.filter((el) => el.team === 'a' || el.team === 'd') as Player[]) // don't include spectators
      .map((el) => [el.id, el.username]);

    result.ord = game.nextOrd; // TODO idk if this is only players team order, it probably is so should filter

    result.s = {};
    result.s.turns = game.turn - 1;

    const state = game.state;
    const hands = state.hands;

    // attacker-specific things
    let isAttacker = ['a', 't'].includes(pid[0]);

    for (let i = 0; i < state.hands.attacker.length; i++) {
      let hand = hands.attacker[i];
      if (!hand)
        throw new Error(
          'typescript does not get thesse implied constraints, i < array.length means I _can_ index the array with i thanks'
        );
      result.s[`ha${decToHex(i)}`] = isAttacker ? displayCards(hand) : hand.length;
    }

    // defender-specific things
    let isDefender = ['d', 't'].includes(pid[0]);
    for (let i = 0; i < hands.defender.length; i++) {
      let hand = hands.defender[i];
      if (!hand)
        throw new Error(
          'typescript does not get thesse implied constraints, i < array.length means I _can_ index the array with i thanks'
        );
      result.s[`da${decToHex(i)}`] = isDefender ? displayCards(hand) : hand.length;
    }

    // general things
    result.s.a = state.attackerDeck.length;
    result.s.xa = displayCards(state.attackerDiscard);

    for (let i = 0; i < 6; i++) {
      const lane = state.lanes[i];

      let topCard = lane.laneDeck[lane.laneDeck.length - 1];
      result.s[`l${i}`] = {
        t: topCard.up ? cardToCid(topCard) : 'X',
        c: lane.laneDeck.length,
      };

      const as = lane.attackerStack;
      const ds = lane.defenderStack;
      result.s[`a${i}`] = displayCards(as.cards, isAttacker, true, as.force_visible);
      result.s[`d${i}`] = displayCards(ds.cards, isDefender, true, ds.force_visible);

      result.s[`x${i}`] = displayCards(lane.laneDiscard);
    }

    return result as brainArgs;
  };

  //#endregion helper functions
  //#region render functions

  const renderCard = (card: Card, up: boolean = card.up): string => {
    const c = up ? `${card.value}${card.sign}` : 'XX';
    return colorize(c, up ? colors[card.sign] : ('C' as char));
  };

  const colorize = (str: string, col: char): string =>
    `\`${col}${str.split('\n').join(`\`\n${col}\``)}\``;

  function len_wo_colors(str: string): number {
    let len = str.length;
    len -= Math.floor(count(str, '`') / 2) * 3;
    return len;
  }

  function rjust(str: string, len: number, sym: string = ' '): string {
    for (; len_wo_colors(str) < len; ) {
      str = sym + str;
    }
    return str;
  }

  const ljust = (str: string, len: number, sym: string = ' '): string => {
    for (; len_wo_colors(str) < len; ) {
      str += sym;
    }
    return str;
  };

  function count(str: string, search: string): number {
    return str.split(search).length - 1;
  }

  const appendRight = (str1: string, str2: string): string => {
    let s1 = str1.split('\n');
    let s2 = str2.split('\n');
    let res = [];
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
      res.push((s1[i] || '') + (s2[i] || ''));
    }
    return res.join('\n');
  };

  const renderAllCards = (cards: Card[], force_visible: boolean = false) => {
    return cards.map((el) => renderCard(el, force_visible ? true : undefined)).join(' ');
  };

  const renderCombatStacks = (lanes: State['lanes'], _for: pid, AttackerStack: boolean) => {
    const __for = splitPid(_for);
    const ret = [];
    const whichTeam = AttackerStack ? 'attackerStack' : 'defenderStack';
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      ret.push(
        (AttackerStack ? `\`DAS${i}\`` : `\`PDS${i}\``) +
          `  ${renderAllCards(lane[whichTeam].cards, (__for.team === 'a') === AttackerStack)}`
      );
    }
    return ret.join('\n');
  };

  const renderLanes = (state: State) => {
    const ret = [];
    const lanes = state.lanes;
    for (let i = 0; i < lanes.length; i++) {
      const deck = lanes[i].laneDeck;
      const discard = lanes[i].laneDiscard;

      let l = `\`TL${i}\`   `;

      l += deck.length > 0 ? renderCard(deck[deck.length - 1], i > 2) : '  ';
      l += ` \`A${rjust(deck.length.toString(), 2, '0')} \`|`;
      l += renderAllCards(discard);

      ret.push(l);
    }

    let l = `\`Ta\`    `;

    l +=
      state.attackerDeck.length > 0
        ? renderCard(state.attackerDeck[state.attackerDeck.length - 1])
        : '  ';
    l += ` \`A${rjust(state.attackerDeck.length.toString(), 2, '0')} \`|`;
    l += renderAllCards(state.attackerDiscard);

    ret.push(l);

    return ret.join('\n');
  };

  const renderHands = (state: State, _for: pid, AttackerHands: boolean = true) => {
    const __for = splitPid(_for);
    const whichTeam = AttackerHands ? 'attacker' : 'defender';
    const ret = [];
    for (let i = 0; i < state.hands[whichTeam].length; i++) {
      const hand = state.hands[whichTeam][i];
      ret.push(
        (AttackerHands ? `\`Da${i}\`` : `\`Pd${i}\``) +
          `  ${renderAllCards(hand, (__for.team === 'a') === AttackerHands)}`
      );
    }
    return ret.join('\n');
  };

  const renderBoard = (state: State, _for: pid) => {
    let res = renderCombatStacks(state.lanes, _for, true);
    res += '\n\n';
    res += renderCombatStacks(state.lanes, _for, false);
    res += '\n\n';
    res += renderLanes(state);
    res += '\n\n';
    res += renderHands(state, _for, _for[0] === 'd');
    res += '\n\n';
    res += renderHands(state, _for, _for[0] === 'a' || _for[0] !== 'd');

    return res;
  };

  const renderLobby = (game: Partial<Game>): false | string => {
    if (!game.players || !game.settings) {
      logger.log(
        `Game had no ${
          game.players ? 'settings' : game.settings ? 'player' : 'settings or players'
        }`,
        1
      );
      return false;
    }
    // filter spec right of users who are also there as a player, does not need to be displayed
    const players = game.players.filter((el, ix, arr) =>
      el.team === 's'
        ? arr.filter((el2) => el2.username === el.username && el2.team !== 's').length < 1
        : true
    );
    const settings = game.settings;

    let r = '\n';

    const header = `binmat game \`M${game._id}\`  ${game.status}`;
    const w = Math.min(context.cols, 80);

    const s = [
      '`Usettings`',
      '',
      '{',
      ...(Object.keys(settings) as (keyof typeof settings)[]).map(
        (el) => `  \`N${el}\`: \`V${settings[el]}\``
      ),
      '}',
    ];

    const p = [
      '`Uplayers`',
      '',
      ...players.map((el) =>
        'id' in el
          ? `\`${el.team === 'a' ? 'D' : 'P'}${el.id}\`  @${el.username}`
          : `\`cs\`   @${el.username}`
      ),
    ];

    const ml = {
      s: s.reduce((a, b) => (a > b.length ? a : b.length), 0),
      p: p.reduce((a, b) => (a > b.length ? a : b.length), 0),
    };

    r += header + '\n';
    r += ljust('-', w, '-') + '\n';
    r += appendRight(
      s.map((el) => ljust(el, ml.s) + '|').join('\n'),
      p.map((el) => ljust(el, ml.p)).join('\n')
    );

    return r;
  };

  //#endregion render functions
  //#region binmat game-functions

  const drawCard = (pid: pid, lane: laneNum | attackerDeckLane, game: Game): boolean => {
    logger.log(`drawing function entered with pid ${pid}, lane ${lane}`, 7);
    // get player drawing
    const p = splitPid(pid);

    const r = sfc32(game.seed);
    const state = game.state;

    // get relevant stacks
    const { deck, discard, defenderStack } = getLane(lane, state);
    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    if (defenderStack && defenderStack.cards.length > 0 && p.team === 'a') {
      logger.log('lane is defended, cannot draw', 4);
      return false;
    }

    // defender can't draw from attcker deck
    if (p.team === 'd' && lane === 6) return false;

    if (deck.length === 0) {
      logger.log('deck empty', 5);
      if (discard.length === 0) {
        // invalid op if defender or lane 6, attacker win otherwise
        if (lane === 6 || p.team === 'd') return false;
        return endGame(game, 'a');
      }
      // if deck is empty shuffle discard into deck
      logger.log('shuffling discard into deck', 5);
      deck.push(
        ...shuffleArray(discard, r).map((el: Card) => {
          el.up = false;
          return el;
        })
      );
      discard.splice(0, discard.length);
      // if is visible lane, make top card visible
      if (lane < 6 && lane > 2) deck[deck.length - 1].up = true;
    }

    if (deck.length === 0) throw new Error('shuffling into deck did not work');

    // draw card
    const card = deck.pop() as Card;
    logger.log('drawn card: ' + cardToCid(card), 4);
    if (lane < 6 && lane > 2 && deck.length > 0) {
      // if one of the open decks, make next card visible
      deck[deck.length - 1].up = true;
    }

    // set card visibility to team
    card.up = false;
    hand.push(card as HandCard);

    logger.log('new hand ' + renderAllCards(hand, true), 6);

    return true;
  };

  const discardCard = (
    pid: pid,
    lane: laneNum | attackerDeckLane,
    card: SpecifiedCard,
    game: Game
  ): boolean => {
    logger.log(
      `entered discard function with pid ${pid}, lane ${lane}, card ${cardToCid(card as Card)}`,
      7
    );
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
    let discardCard = spliceCardFromHand(pid, state, card.value, card.sign) as Card | undefined;

    if (discardCard === undefined) {
      logger.log('did not get card', 3);
      return false;
    }

    // make visible and add to discard
    discardCard.up = true;
    discard.push(discardCard as DiscardedCard);

    // if attacker discards to attacker discard, they draw two cards from attacker deck
    if (lane === 6) {
      logger.log('was discard to attackerDiscard, drawing 2 cards from attackerDeck', 5);
      drawCard(pid, lane, game);
      drawCard(pid, lane, game);
    }

    return true;
  };

  const playCard = (
    pid: pid,
    lane: laneNum,
    card: SpecifiedCard,
    game: Game,
    up: boolean = false
  ): boolean => {
    logger.log(
      `entered playing funciton with pid ${pid}, lane ${lane}, card ${cardToCid(
        card as Card
      )}, up ${up}`,
      7
    );
    // get player playing card
    const p = splitPid(pid);

    const state = game.state;

    // get relevant stacks
    const { attackerStack: attacker, defenderStack: defender } = getLane(lane, state);
    const stacks = { attacker, defender };
    const stack = stacks[p.teamlong];

    //TODO
    //if (stack.force_visible && !up) {
    //  logger.log('tried to play up card on force-up stack, invalid op', 4);
    //  return false;
    //}

    const hand = state.hands[p.teamlong][hexToDec(p.num)];
    if (!Array.isArray(hand)) throw new Error('player hand was not an array');

    // > cannot be played on emtpy stacks
    // ? cannot be played face-up on non-empty stacks by attackers
    if (card.value === '>' && stack.cards.length === 0) {
      logger.log("tried to play '>' on empty lane, aborting", 3);
      return false;
    }
    if (card.value === '?' && up && stack.cards.length === 0 && p.team === 'a') {
      logger.log("tried to play '?' face-up as attacker on non-empty stack", 3);
      return false;
    }

    // remove from hand
    const _card = spliceCardFromHand(pid, state, card.value, card.sign) as Card | undefined;

    if (_card === undefined) {
      logger.log('did not get card, aborting', 3);
      return false;
    }
    logger.log(`got card ${cardToCid(_card)}`, 6);

    // play to deck
    _card.up = up;
    stack.cards.push(_card as PlayedCard);

    // if face-up ? or > initiate combat
    if (up && (_card.value === '>' || _card.value === '?')) {
      logger.log('combat was initiated by played card', 4);
      return combat(pid, lane, game, true);
    }

    return true;
  };

  const bounceCombat = (as: CombatStack, ds: CombatStack, ax: Stack<DiscardedCard>): boolean => {
    const asCards = as.cards.splice(0, as.cards.length);
    asCards.forEach((el) => (el.up = true));
    ax.push(...(asCards as DiscardedCard[]));

    ds.cards.forEach((el) => (el.up = true));
    ds.force_visible = true;

    return true;
  };

  const combat = (pid: pid, lane: laneNum, game: Game, fromBreak: boolean = false): boolean => {
    logger.log(`entering combat with pid ${pid}, lane ${lane}`, 6);
    // get teams
    const p = splitPid(pid);
    const o: { team: 'a' | 'd'; teamlong: 'attacker' | 'defender' } =
      p.team === 'a' ? { team: 'd', teamlong: 'defender' } : { team: 'a', teamlong: 'attacker' };

    // get relevant stacks
    const state = game.state;
    const _attackerDiscard = state.attackerDiscard;
    const { discard, deck, attackerStack, defenderStack } = getLane(lane, state);
    const stacks = { attacker: attackerStack, defender: defenderStack };
    const discards = { attacker: _attackerDiscard, defender: discard };

    if (p.teamlong == 'defender' && !fromBreak) {
      logger.log('defender inited combat not from break, not allowed', 4);
      return false;
    }

    logger.log(
      `stacks: ${renderAllCards(stacks.attacker.cards, true)} / ${renderAllCards(
        stacks.defender.cards,
        true
      )}`,
      5
    );

    // resolve traps
    logger.log('resolving traps', 7);
    const attackingTraps = stacks[p.teamlong].cards.filter((el) => el.value === '@');
    logger.log(`player who inited combat has ${attackingTraps.length} traps`, 6);
    for (let i = 0; i < attackingTraps.length; i++) {
      let c = stacks[o.teamlong].cards.pop() as Card | undefined;
      if (c === undefined) break;
      logger.log(`sending ${cardToCid(c)} to discard of ${o.teamlong}`, 6);
      c.up = true;
      discards[p.teamlong].push(c as DiscardedCard);
    }

    const defendingTraps = stacks[o.teamlong].cards.filter((el) => el.value === '@');
    for (let i = 0; i < defendingTraps.length; i++) {
      logger.log(`player who didn't init combat has ${defendingTraps.length} traps`, 6);
      let c = stacks[p.teamlong].cards.pop() as Card | undefined;
      if (c === undefined) break;
      logger.log(`sending ${cardToCid(c)} to discard of ${o.teamlong}`, 6);
      c.up = true;
      discards[o.teamlong].push(c as DiscardedCard);
    }

    // calculate pow
    const pow = {
      attacker: calcStackPow(stacks.attacker.cards),
      defender: calcStackPow(stacks.defender.cards),
    };

    logger.log(`calculated power attacker: ${pow.attacker}, defender: ${pow.defender}`, 6);

    // resolve ?
    const bounces = {
      attacker: stacks.attacker.cards.filter((el) => el.value === '?'),
      defender: stacks.defender.cards.filter((el) => el.value === '?'),
    };
    if (bounces.attacker.length > 0 || bounces.defender.length > 0) {
      logger.log('bounce detected, bouncing combat', 6);
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
    if (pow.attacker === 0 && pow.defender === 0) {
      logger.log('both stacks had pow 0, bouncing', 6);
      return bounceCombat(stacks.attacker, stacks.defender, discards.attacker);
    }

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
      stacks.defender.force_visible = true;

      return true;
    }
    // if attacker win

    const breaks = [
      ...stacks.attacker.cards.filter((el) => el.value === '>'),
      ...stacks.defender.cards.filter((el) => el.value === '>'),
    ];

    // calc damage
    const damage =
      breaks.length !== 0
        ? // if > present, calculate > damage
          Math.max(pow.attacker, stacks.defender.cards.length)
        : // else damage = pow as - pow ds + 1
          powDiff + 1;

    // discard as
    let cards = stacks.attacker.cards.splice(0, stacks.attacker.cards.length);
    cards.forEach((el) => (el.up = true));
    discards.attacker.push(...(cards as DiscardedCard[]));

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

    return true;
  };

  const endGame = (game: Game, winner: 'a' | 'd') => {
    throw new Error('team ' + winner + ' won, win function not implemented tho');
  };

  //#endregion binmat functions
  //#region script logic

  const setNextOrd = (game: Game) => {
    const pids = (game.players.filter((el) => el.team === 'a' || el.team === 'd') as Player[])
      .map((el) => el.id)
      .filter((el) => el[0] === 'a' || el[0] === 'd');
    switch (game.settings.ord) {
      case 'playerIndex':
        return pids.sort((a, b) => (a[1] > b[1] ? 1 : -1)).sort((a, b) => (a[0] > b[0] ? -1 : 1));
      case 'ramdom':
        const r = sfc32(game.seed);
        return shuffleArray(pids, r).sort((a, b) => (a[0] > b[0] ? -1 : 1));
    }
  };
  function getCardAndLaneFromOp(
    op: _discardop | _playop,
    allowAttackerLane: false
  ):
    | {
        lane: laneNum;
        cardVal: CardValues;
        cardSign?: CardSigns;
      }
    | false;
  function getCardAndLaneFromOp(
    op: _discardop | _playop,
    allowAttackerLane?: boolean
  ):
    | {
        lane: laneNum | attackerDeckLane;
        cardVal: CardValues;
        cardSign?: CardSigns;
      }
    | false;
  function getCardAndLaneFromOp(
    op: _discardop | _playop,
    allowAttackerLane: boolean = true
  ):
    | {
        lane: laneNum | attackerDeckLane;
        cardVal: CardValues;
        cardSign?: CardSigns;
      }
    | false {
    // second char has to be a cardValue
    if (!cardValues.map((el) => String(el)).includes(op[1])) return false;
    let cardVal = op[1] as CardValues;
    if (!Number.isNaN(Number(cardVal))) cardVal = Number(cardVal) as CardValues & number;
    let cardSign;
    // third char can be a cardSign | laneNum | attackerLaneNum
    let l = op[2] as CardSigns | `${laneNum}` | 'a';
    if ((cardSigns as readonly string[]).includes(l)) {
      l = op[3] as `${laneNum}` | 'a';
      cardSign = op[2] as CardSigns;
    }
    // laneNum has to always be specified
    if (l === 'a' && !allowAttackerLane) return false;
    const _lane = l === 'a' ? 6 : Number(l);
    // validate correct lane
    if (Number.isNaN(_lane)) return false;
    if (_lane > 6 || _lane < 0) return false;
    return { lane: _lane as laneNum | 6, cardVal, cardSign };
  }

  const runOp = (as: pid, op: operation, game: Game): boolean => {
    logger.log('running ' + op + ' as ' + as, 6);

    // by running a general validation we don't need to verify correct syntax anymore
    // and can expect only operations that are parse-able
    if (!checkOpSyntax(op)) return false;
    logger.log('syntax was valid', 6);

    switch (op[0]) {
      case 'd':
        // draw op
        const drawlane = op.charAt(1);

        let num: laneNum | attackerDeckLane = Number(drawlane) as laneNum;
        if (drawlane === 'a') num = 6;

        return drawCard(as, num, game);
      case 'x':
        // discard op
        const drawparse = getCardAndLaneFromOp(op as _discardop);
        if (drawparse === false)
          throw new Error(
            `could not get details from operation ${op}, this is likely a validation error`
          );
        return discardCard(
          as,
          drawparse.lane,
          { sign: drawparse.cardSign, value: drawparse.cardVal },
          game
        );
      case 'c':
        // combat op
        const lane = op.charAt(1);

        if (lane === 'a') return false;
        let combatLaneNum: laneNum = Number(lane) as laneNum;

        return combat(as, combatLaneNum, game);
      case 'u':
      case 'p':
        // play op
        const up = op[0] === 'u';

        const parse = getCardAndLaneFromOp(op as _playop, false);
        if (parse === false)
          throw new Error(
            `could not get details from operation ${op}, this is likely a validation error`
          );

        return playCard(as, parse.lane, { value: parse.cardVal, sign: parse.cardSign }, game, up);

      default:
        return false;
    }
  };

  /**
   * method to check syntactic correctness of operation
   * @param as playerId
   * @param op op they submitted
   * @param game game state
   * @returns boolean, true if syntactially valid operation
   */
  const checkOpSyntax = (op: operation): boolean => {
    switch (op[0]) {
      // first char needs to be "d" | "x" | "p" | "u" | "c"
      case 'd':
        // dL where L is laneNum | "a"
        if (op.length < 2 || op.length > 2) return false;
        const l = op[1];
        if (l === 'a') {
          return true;
        }
        const _lane = Number(l);
        // validate correct lane
        if (Number.isNaN(_lane)) return false;
        if (_lane < 0 || _lane > 5) return false;
        // has to already be an integer, it'so only 1 char so no need to check for that
        return true;
      case 'x':
      case 'p':
      case 'u':
        // (x|p|u)CL where C is cardValue | cid and L is laneNum (or, only for x, "a")
        if (op.length < 2 || op.length > 4) return false;
        // second char has to be a cardValue
        if (!cardValues.map((el) => String(el)).includes(op[1])) return false;
        // third char can be a cardSign or a laneNum, if it is a CardSign, go to next char to look for laneNum
        const parse = getCardAndLaneFromOp(op as _discardop | _playop, op[0] === 'x');
        if (parse === false) return false;
        return true;
      case 'c':
        // cL where L is LaneNum
        if (op.length < 2 || op.length > 2) return false;
        const _clane = Number(op[1]);
        // validate correct lane
        if (Number.isNaN(_clane)) return false;
        if (_clane < 0 || _clane > 5) return false;
        return true;
      default:
        return false;
    }
  };

  const kickPlayer = (pid: pid, game: Game) => {
    // TODO
  };

  const runTurn = (game: Game) => {
    if (game.turn === game.settings.turnLimit) return endGame(game, 'd');
    logger.log(`running turn ${game.turn}`, 6);
    const players: Player[] = game.players.filter(
      (el) => el.team === 'a' || el.team === 'd'
    ) as Player[];

    const ord = {
      d: game.nextOrd.filter((el) => el[0] === 'd'),
      a: game.nextOrd.filter((el) => el[0] === 'a'),
    };
    const team = game.turn % 2 === 0 ? 'd' : 'a';

    game.binlog.push(`${game.turn} ---`);

    for (let playerId of ord[team]) {
      const op = game.queuedOps[playerId];
      const player = players.find((el) => el.id === playerId);
      if (!player)
        throw new Error(`Could not find player with pid ${playerId}, who was specified in ord`);

      let validop = op !== undefined && op !== null && runOp(playerId, op, game);

      if (!validop) {
        player.consecutiveNoOps++;

        if (
          player.id !== 'a0' &&
          player.id !== 'd0' &&
          game.settings.kickOnInactive &&
          player.consecutiveNoOps > game.settings.markInactiveTurns
        )
          kickPlayer(playerId, game);
      } else player.consecutiveNoOps = 0;
    }

    game.turn++;
    game.queuedOps = {};

    if (team === 'a') setNextOrd(game);

    game.lastTurn = Date.now();

    return true;
  };

  const queueOp = (op: operation, as: pid, game: Game) => {
    const ops = game.queuedOps;

    const turnOf = game.turn % 2 === 0 ? 'd' : 'a';

    if (as[0] !== turnOf) {
      logger.log('it is not your turn', 4);
      return false;
    }

    if (ops[as]) {
      logger.log('you have already submitted an op', 4);
      return false;
    }

    if (!checkOpSyntax(op)) {
      logger.log('invalid op syntax', 2);
      return false;
    }

    ops[as] = op;

    const players = game.players.filter((el) => 'id' in el && el.team == turnOf);

    const notSubmitted = [];
    for (let player of players) {
      if (ops[player.id] === undefined) notSubmitted.push(player.id);
    }

    if (notSubmitted.length === 0) {
      logger.log('all players have submitted an op, running turn', 4);
      return runTurn(game);
    }
    logger.log('not all players have submitted an op, saved op', 4);
    logger.log(`players ${notSubmitted.join(', ')} have not submitted an op`, 6);
    return true;
  };

  //#region script run

  const userdata: Userdata = ($db
    .f({ _id: `binmat-${context.caller}` })
    .first() as unknown as Userdata) || {
    _id: `binmat-${context.caller}`,
    current: null,
    type: 'binmat-userdata',
  };

  const game: Partial<Game> | null = userdata.current
    ? ($db.f({ _id: userdata.current, type: 'binmat-game' }).first() as unknown as Partial<Game>)
    : null;

  if (!args) return 'this is binmat';

  const inp = args.input || args.op;

  let res;
  try {
    main: if (typeof inp !== 'string') res = "whoops, that's not right";
    else if (inp === 'create') {
      if (userdata.current && game) {
        return {
          ok: false,
          msg: `you are already in game ${userdata.current}, leave the game to create a new one`,
        };
      }

      res = createLobby() as any;
      if (res === false) {
        res = logger.getLog();
        break main;
      }

      userdata.current = res._id;
      delete res._id;
      res.ok = true;

      break main;
    } else if (inp === 'set' || inp === 'settings') {
      if (game === null) {
        logger.log('You are not currently in a lobby, cannot set settings.', 4);
        break main;
      }
      if (game.status !== 'lobby') {
        logger.log('game has already begun, cannot change settings.', 4);
        break main;
      }
      if (game.admin !== context.caller) {
        logger.log('Only lobby creator can change settings', 4);
        break main;
      }
      const _set = args.set || args.settings;
      if (typeof _set !== 'object') {
        logger.log('no `Nset`tings object provided, skipping', 2);
        break main;
      }

      let r = setSettings(game, _set as any);
      if (r === true) {
        let lobby = renderLobby(game);
        if (!lobby) {
          break main;
        }
        res = { ok: true, msg: lobby };
      }
    } else if (inp === 'init') {
      if (!game) {
        logger.log('You are not currently in a lobby, cannot init game.', 4);
        break main;
      }
      if (game.status !== 'lobby') {
        logger.log('The game you are in has already started', 4);
        break main;
      }

      if (!game.settings || game.settings.seed === undefined) {
        logger.log('game does not have seed set', 0);
        break main;
      }
      if (!game.players) {
        logger.log('no players array found', 0);
        break main;
      }

      const a0 = game.players.find((el) => 'id' in el && el.id === 'a0');
      const d0 = game.players.find((el) => 'id' in el && el.id === 'd0');

      if (!a0 || !d0) {
        logger.log('err: a0 or d0 was not found', 1);
        break main;
      }

      let r = createGameState(game, game.settings?.seed);
      if (r === true) {
        let lobby = renderLobby(game);
        if (lobby === false) break main;
        res = { ok: true, msg: lobby };
      }
    } else if (inp.startsWith('join')) {
      const gid = args.gid || inp.split(' ')[1] || game?._id;
      if (typeof gid !== 'string') {
        logger.log('invalid gameId (`Ngid`), skipping', 2);
        break main;
      }

      if (userdata.current != gid) {
        if (game && game.status !== 'completed' && game._id !== gid) {
          logger.log(`you are already in game ${game._id} leave it to join a new one`, 2);
          break main;
        }
      }

      const as = args.as || inp.split(' ')[2] || 's';
      if (typeof as !== 'string' || !['a', 'd', 's'].includes(as)) {
        logger.log('invalid position to join `Nas`', 2);
        break main;
      }

      let r = joinGameAs(gid, as as 'a' | 'd' | 's');

      if (r == true) {
        let lobby = renderLobby($db.f({ _id: gid }).first() as unknown as Partial<Game>);
        if (lobby === false) break main;

        res = { ok: true, msg: lobby };
      }
    } else if (inp === 'view') {
      if (!game) {
        logger.log('You are not in a game or lobby', 4);
        break main;
      }

      if (game.status === 'lobby') {
        res = renderLobby(game);
        break main;
      }

      if (!game.state) {
        logger.log('Game has been initialized wrong', 0);
        break main;
      }

      const is = game.players
        .filter((el) => el.username === context.caller && 'id' in el)
        .map((el) => el.id);

      if (is.length === 0) {
        logger.log('you are not a player in this game, you cannot submit ops', 4);
        break main;
      }

      if (is.length > 1 && !args.as) {
        logger.log(
          'You are playing multiple positions in this game, please specify `Nas` who you want to view',
          4
        );
        break main;
      }

      if (args.as && !is.includes(args.as)) {
        logger.log('You are not playing this position', 4);
        break main;
      }

      const _as = args.as || is[0];

      if (!_as) {
        logger.log('do not know your position', 0);
        break main;
      }

      res = { ok: true, msg: renderBoard(game.state, _as) };
    } else if (inp === 'lobby') {
      if (!game) {
        logger.log('You are not in a game or lobby', 4);
        break main;
      }

      let lobby = renderLobby(game);
      if (lobby === false) break main;

      res = { ok: true, msg: lobby };
    } else {
      if (!game) {
        logger.log('You are not in a game or lobby', 4);
        break main;
      }
      if (game.status !== 'ongoing') {
        logger.log('You are not in an ongoing game or lobby', 4);
        break main;
      }
      if (!game.players) {
        logger.log('no players array found', 0);
        break main;
      }
      if (!game.state) {
        logger.log('no state found', 0);
        break main;
      }
      const is = game.players
        .filter((el) => el.username === context.caller && 'id' in el)
        .map((el) => el.id);

      if (is.length === 0) {
        logger.log('you are not a player in this game, you cannot submit ops', 4);
        break main;
      }

      if (is.length > 1 && !args.as) {
        logger.log(
          'You are playing multiple positions in this game, please specify `Nas` who you want to submit',
          4
        );
        break main;
      }

      if (args.as && !is.includes(args.as)) {
        logger.log('You are not playing this position', 4);
        break main;
      }

      const _as = args.as || is[0];

      if (!_as) {
        logger.log('do not know your position', 0);
        break main;
      }

      let r = queueOp(inp as operation, _as, game as Game);

      if (r === false) break main;
      res = { ok: true, msg: 'submitted.' };
    }
  } catch (e) {
    return e.message + '\n' + e.stack + '\n\n' + logger.getLogOnLevel(6);
  }
  // yeeah
  if (game && res && typeof res === 'object' && 'ok' in res && res.ok === true) {
    $db.u1({ _id: game._id }, { $set: game as any });
  }
  if (!res) res = logger.getLog();
  $db.us({ _id: userdata._id }, { $set: userdata as any });
  if (args.d) $D(res);
  if (args.log)
    typeof res === 'string'
      ? (res += '\nlog:\n\n' + logger.getLog().join('\n'))
      : (res.msg += '\nlog:\n\n' + logger.getLog().join('\n'));
  return res;
}
