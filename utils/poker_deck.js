const SUITS = [
    { key: 'spade', symbol: '♠', color: 'black' },
    { key: 'heart', symbol: '♥', color: 'red' },
    { key: 'diamond', symbol: '♦', color: 'red' },
    { key: 'club', symbol: '♣', color: 'black' }
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createSingleDeck(deckIndex) {
    const deck = [];

    SUITS.forEach(function (suit) {
        RANKS.forEach(function (rank) {
            deck.push({
                id: 'deck-' + deckIndex + '-' + suit.key + '-' + rank,
                deckIndex: deckIndex,
                rank: rank,
                suitKey: suit.key,
                suit: suit.symbol,
                color: suit.color,
                isJoker: false
            });
        });
    });

    deck.push({
        id: 'deck-' + deckIndex + '-joker-small',
        deckIndex: deckIndex,
        rank: 'JOKER',
        suitKey: 'joker-small',
        suit: '★',
        color: 'black',
        isJoker: true,
        jokerType: 'small'
    });
    deck.push({
        id: 'deck-' + deckIndex + '-joker-big',
        deckIndex: deckIndex,
        rank: 'JOKER',
        suitKey: 'joker-big',
        suit: '★',
        color: 'red',
        isJoker: true,
        jokerType: 'big'
    });

    return deck;
}

function createDoubleDeck() {
    return createSingleDeck(1).concat(createSingleDeck(2));
}

function shuffleDeck(cards) {
    const deck = (cards || []).slice();
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }
    return deck;
}

module.exports = {
    SUITS,
    RANKS,
    createSingleDeck,
    createDoubleDeck,
    shuffleDeck
};
