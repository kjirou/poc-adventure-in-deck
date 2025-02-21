/**
 * Shuffle an array with the Fisher–Yates algorithm.
 *
 * Ref) https://www.30secondsofcode.org/js/s/shuffle/
 */
const shuffleArray = (array, getRandom = Math.random) => {
  const copied = array.slice();
  let m = copied.length;
  while (m) {
    const i = Math.floor(getRandom() * m);
    m--;
    [copied[m], copied[i]] = [copied[i], copied[m]];
  }
  return copied;
};

const createCard = (id, contentKind, terrainKind, progression, options) => {
  if (!["enemy", "trap", "treasure"].includes(contentKind)) {
    throw new Error("Invalid contentKind");
  }
  if (
    !["corridor", "crossroad", "maze", "hall", "smallRoom", "sanctum"].includes(
      terrainKind,
    )
  ) {
    throw new Error("Invalid terrainKind");
  }
  if (progression < 1 || progression > 5) {
    throw new Error("Invalid progression");
  }
  const alertLevel = options?.alertLevel;
  if (alertLevel < 0 || alertLevel > 3) {
    throw new Error("Invalid alertLevel");
  }
  return {
    alertLevel,
    contentKind,
    id,
    terrainKind,
    progression,
  };
};

const createDeck = ({
  enemyCardCount,
  sanctumCardCount,
  trapCardCount,
  treasureCardCount,
} = params) => {
  const totalCardCount = enemyCardCount + trapCardCount + treasureCardCount;

  // 進行度の分布はなるべく一定にする。5, 4, 3, 2, 1, 5, 4, 3, 2, 1, ... と配布する。
  let cardProgressionList = [];
  for (let i = 0; i < totalCardCount; i++) {
    cardProgressionList.push(5 - (i % 5));
  }
  cardProgressionList = shuffleArray(cardProgressionList);

  // 地形の分布は sanctum を除いてなるべく一定にする。corridor, crossroad, maze, hall, smallRoom, ... と配布する。
  let cardTerrainList = [];
  for (let i = 0; i < totalCardCount; i++) {
    cardTerrainList.push(
      ["corridor", "crossroad", "maze", "hall", "smallRoom"][i % 5],
    );
  }
  cardTerrainList = shuffleArray(cardTerrainList);

  let cardIndex = 0;

  // 罠カードを生成する。
  const trapCards = [];
  for (let i = 0; i < trapCardCount; i++) {
    trapCards.push(
      createCard(
        cardIndex,
        "trap",
        cardTerrainList[cardIndex],
        cardProgressionList[cardIndex],
      ),
    );
    cardIndex++;
  }

  // 敵カードを生成する。
  const enemyCards = [];
  for (let i = 0; i < enemyCardCount; i++) {
    enemyCards.push(
      createCard(
        cardIndex,
        "enemy",
        cardTerrainList[cardIndex],
        cardProgressionList[cardIndex],
        // ランダムで3枚に1枚は警戒レベルを1設定する。
        { alertLevel: Math.random() < 0.33 ? 1 : 0 },
      ),
    );
    cardIndex++;
  }

  // 宝カードを生成する。
  const treasureCards = [];
  for (let i = 0; i < treasureCardCount; i++) {
    treasureCards.push(
      createCard(
        cardIndex,
        "treasure",
        cardTerrainList[cardIndex],
        cardProgressionList[cardIndex],
      ),
    );
    cardIndex++;
  }

  let deck = [...trapCards, ...enemyCards, ...treasureCards];
  deck = shuffleArray(deck);

  // 先頭から sanctumCardCount 枚数のカードを enemy の sanctum カードで上書きする。進行度は維持する。
  for (let i = 0; i < sanctumCardCount; i++) {
    deck[i] = {
      ...deck[i],
      contentKind: "enemy",
      terrainKind: "sanctum",
      alertLevel: 1,
    };
  }

  return shuffleArray(deck);
};

const drawCards = ({ deck, count, discardPile } = params) => {
  let newDeck = deck;
  let newHand = [];
  let newDiscardPile = discardPile;
  let isShuffled = false;
  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      if (newDiscardPile.length === 0) {
        break;
      }
      newDeck = shuffleArray(newDiscardPile);
      isShuffled = true;
      newDiscardPile = [];
    }
    const drawnCard = newDeck[0];
    newDeck = newDeck.slice(1);
    newHand = [...newHand, drawnCard];
  }
  return { newDeck, newHand, newDiscardPile, isShuffled };
};

const maxPartyForce = 100;

const progress = ({
  partyForce,
  selectedCard,
  necessaryProgression,
} = params) => {
  let newNecessaryProgression = necessaryProgression - selectedCard.progression;

  let newPartyForce = partyForce;
  if (selectedCard.contentKind === "enemy") {
    // パーティの戦力が低いほど、警戒度が高いほど損害を大きくする
    const partyForceRatio = partyForce / maxPartyForce;
    const alertLevelRatio = 1.0 + selectedCard.alertLevel * 0.5;
    const damage = Math.ceil(8 * (2 - partyForceRatio) * alertLevelRatio);
    newPartyForce = partyForce - damage;
  } else if (selectedCard.contentKind === "trap") {
    newPartyForce -= 16;
  }

  return {
    newNecessaryProgression,
    newPartyForce,
  };
};

// 敵が2枚手札にある場合は警戒度+1、3枚手札にある場合は警戒度+2する
const enhanceEnemiesOnHand = (hand) => {
  const enemyCount = hand.filter((card) => card.contentKind === "enemy").length;
  if (enemyCount === 2) {
    return hand.map((card) => {
      if (card.contentKind === "enemy") {
        return {
          ...card,
          alertLevel: card.alertLevel + 1,
        };
      }
      return card;
    });
  }
  if (enemyCount >= 3) {
    return hand.map((card) => {
      if (card.contentKind === "enemy") {
        return {
          ...card,
          alertLevel: card.alertLevel + 2,
        };
      }
      return card;
    });
  }
  return hand;
};

const maxHandCount = 3;

const renderScreen = ({
  deck,
  hand,
  discardPile,
  resolvedCardPile,
  dangerMode,
  partyForce,
  necessaryProgression,
} = props) => {
  const deckCountCountElement = document.querySelector("#deckCount");
  const discardPileCountElement = document.querySelector("#discardPileCount");
  const resolvedCardPileCountElement = document.querySelector(
    "#resolvedCardPileCount",
  );
  const partyForceElement = document.querySelector("#partyForce");
  const necessaryProgressionElement = document.querySelector(
    "#necessaryProgression",
  );

  deckCountCountElement.textContent = deck.length;
  if (dangerMode) {
    deckCountCountElement.style.color = "red";
  }
  discardPileCountElement.textContent = discardPile.length;
  resolvedCardPileCountElement.textContent = resolvedCardPile.length;
  partyForceElement.textContent = partyForce;
  if (partyForce <= 0) {
    partyForceElement.style.color = "red";
  }
  necessaryProgressionElement.textContent = necessaryProgression;
  if (necessaryProgression <= 0) {
    necessaryProgressionElement.style.color = "green";
  }

  for (let i = 0; i < maxHandCount; i++) {
    const card = hand[i];
    const cardElement = document.querySelector(`#card-${i}`);
    const progressionElement = cardElement.querySelector(".progression");
    const contentElement = cardElement.querySelector(".content");
    const terrainElement = cardElement.querySelector(".terrain");
    if (card) {
      progressionElement.textContent = `+${card.progression}`;
      contentElement.textContent = `${card.contentKind.toUpperCase()}${card.alertLevel !== undefined ? `: ${card.alertLevel}` : ""}`;
      terrainElement.textContent = card.terrainKind.toUpperCase();
    } else {
      progressionElement.textContent = "";
      contentElement.textContent = "";
      terrainElement.textContent = "";
    }
  }
};

const main = () => {
  const enemyCardCount = 15;
  const sanctumCardCount = 3;
  const trapCardCount = 5;
  const treasureCardCount = 10;

  let partyForce = 100;
  let necessaryProgression = 50;
  // 一度山札をシャッフルした後 true になり、以降は敵カードが2枚以上だと警戒度増加
  let dangerMode = false;

  let deck = createDeck({
    enemyCardCount,
    sanctumCardCount,
    trapCardCount,
    treasureCardCount,
  });
  let hand = [];
  let discardPile = [];
  let resolvedCardPile = [];

  (() => {
    const { newDeck, newHand, newDiscardPile } = drawCards({
      deck,
      count: maxHandCount,
      discardPile,
    });
    deck = newDeck;
    hand = newHand;
    discardPile = newDiscardPile;
    renderScreen({
      deck,
      hand,
      discardPile,
      resolvedCardPile,
      dangerMode,
      partyForce,
      necessaryProgression,
    });
  })();

  // 手札へイベントハンドラ設定
  for (let i = 0; i < maxHandCount; i++) {
    const cardElement = document.querySelector(`#card-${i}`);
    cardElement.addEventListener("click", () => {
      // ゲームの計算
      const selectedCard = hand[i];
      if (!selectedCard) {
        return;
      }
      const { newNecessaryProgression, newPartyForce } = progress({
        partyForce,
        selectedCard,
        necessaryProgression,
      });
      necessaryProgression = newNecessaryProgression;
      partyForce = newPartyForce;

      // 手札を解決済みへ移動
      resolvedCardPile = [...resolvedCardPile, selectedCard];

      // 他の手札を捨札へ移動
      discardPile = [
        ...discardPile,
        ...hand.filter((card) => card !== selectedCard),
      ];

      const { newDeck, newHand, newDiscardPile, isShuffled } = drawCards({
        deck,
        count: maxHandCount,
        discardPile,
      });
      dangerMode = dangerMode || isShuffled;
      deck = newDeck;
      hand = dangerMode ? enhanceEnemiesOnHand(newHand) : newHand;
      discardPile = newDiscardPile;
      renderScreen({
        deck,
        hand,
        discardPile,
        resolvedCardPile,
        dangerMode,
        partyForce,
        necessaryProgression,
      });
      console.log("Deck:", deck);
    });
  }
};

main();
