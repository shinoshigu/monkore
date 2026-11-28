const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../assets/data/characters.json');
const createCharacters = require('../assets/js/characters.js');
const createSimulation = require('../assets/js/simulation.js');
const rules = createCharacters(data);
const simulation = createSimulation(rules);

test('ブラウザの言語の優先順と日本語へのフォールバック', () => {
  const { preferredLanguage } = require('../assets/js/locale.js');
  assert.equal(preferredLanguage(['fr-FR', 'en-GB', 'ja-JP']), 'en');
  assert.equal(preferredLanguage(['JA-jp', 'en-US']), 'ja');
  assert.equal(preferredLanguage(['de', 'ko-KR']), 'ja');
  assert.equal(preferredLanguage([]), 'ja');
});

test('英語表示の全キャラを元と同じIDで選べる', () => {
  assert.ok(rules.CATALOG.every(entry => typeof entry.nameEn === 'string' && entry.nameEn.trim()));
  const labels = rules.CATALOG.map(entry => rules.catalogLabel(entry, 'en'));
  assert.equal(new Set(labels).size, rules.CATALOG.length);
  assert.equal(rules.catalogLabel(rules.CATALOG_BY_ID.typeZero, 'en'), 'Type-ZERO');
  assert.equal(rules.catalogLabel(rules.CATALOG_BY_ID.typeZero), 'タイプ・ゼロ');
  assert.equal(rules.catalogLabel(rules.CATALOG_BY_ID.n80, 'en'), 'No.80 Umbryx');
});

// The seven slots in the photographed formation, in their original order.
const slots = [
  ['kubinight', 140, 0, 'awakened', '138M'],
  ['mikon', 94, 2, 'normal', '62.4M'],
  ['ponja', 100, 0, 'normal', '59.7M'],
  ['lovril', 100, 0, 'awakened', '59.7M'],
  ['lovril', 100, 0, 'awakened', '59.7M'],
  ['jk', 100, 0, 'normal', '49.8M'],
  ['kyonshina', 100, 1, 'normal', '10.1M'],
];
const chars = slots.map(([catalogId, level, limitBreak, mutation]) => ({
  category: rules.CATALOG_BY_ID[catalogId].category, catalogId, level, limitBreak, mutation,
}));
const party = rules.resolveParty(chars);

test('実測7枠の攻撃力とペア編成', () => {
  assert.deepEqual(party.map(c => rules.formatStat(c.power, 'bag')), slots.map(row => row[4]));
  const twoMikon = rules.resolveParty([chars[1], chars[1]]);
  assert.ok(twoMikon.every(c => !c.truePair));
});

test('図鑑を並べ替えても保存済みIDと通常キャラの基礎値が一致する', () => {
  const reversed = createCharacters({ ...data, characters: [...data.characters].reverse() });
  assert.deepEqual(reversed.catalogEntries('normal'), rules.catalogEntries('normal'));
  assert.deepEqual(reversed.resolveParty(chars), party);
});

test('伝説と幻の攻撃間隔を反映したステージ63の戦闘結果', () => {
  const result = simulation.estimate(63, party, 3, 120, 4);
  assert.equal(Math.round(result.kills * 360), 110);
  assert.equal(Math.round(result.deaths * 360), 5);
  assert.equal(Math.round(result.jkBoostsPerSecond * 360), 47);
  assert.equal(result.kingProcRate, null);
  assert.equal(result.enemyHitRate, 0.3430397727272727);
});

test('タイプ・ゼロの図鑑値・凸と残HPによる攻撃補正', () => {
  const slot = { catalogId:'typeZero', category:'boss', mutation:'normal', level:1, limitBreak:0 };
  const [base] = rules.resolveParty([slot]);
  assert.equal(base.hp, 864e6);
  assert.equal(base.power, 43.2e6);
  assert.equal(base.type, 'boss');
  const [ten] = rules.resolveParty([{...slot, limitBreak:10}]);
  const [raid] = rules.resolveParty([{...slot, limitBreak:10}], 'boss');
  assert.equal(ten.hp, 1296e6);
  assert.equal(ten.power, 64.8e6);
  assert.equal(raid.hp, ten.hp);
  assert.equal(raid.power, base.power);
  assert.equal(raid.bossDodge, 0.2);
  for (const unit of [base, ten, raid]) {
    const ally = {...unit, trait:rules.CHARACTERS[unit.character].trait, max:unit.hp};
    const half = ally.max / 2;
    for (const [hp, factor] of [[ally.max, 1], [half, 2], [half-1, 2], [half+1, 1], [ally.max, 1]]) {
      ally.hp = hp;
      assert.equal(simulation.attackPower(ally), unit.power * factor);
    }
  }
});

test('ステージ1で各カテゴリが所定の間隔で2撃目を出す', () => {
  // The enemy has 30 HP. With 15 damage and ample HP, the second hit is the first kill.
  // With salt=0, the initial attack phase of one ally on stage 1 is the ninth RNG draw.
  let seed = 2654435761;
  for (let i = 0; i < 9; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; }
  const phase = (seed >>> 0) / 4294967296;
  for (const [id, period] of [['n01', 1], ['mikon', 2.5], ['lovril', 2.5], ['typeZero', 2]]) {
    const entry = rules.CATALOG_BY_ID[id];
    const [unit] = rules.resolveParty([{catalogId:id, category:entry.category, level:1}]);
    const party = [{...unit, power:15, hp:1e6}];
    const secondHit = phase * period + period;
    assert.equal(simulation.estimate(1, party, 1, secondHit - 0.0001).kills, 0, id);
    assert.equal(simulation.estimate(1, party, 1, secondHit + 0.0001).kills, 1 / (secondHit + 0.0001), id);
  }
});

test('餌は46から計上し、討伐数ゼロでも順位計算が完了する', () => {
  const rates = simulation.foodRates(party, 25);
  const stages = [{ stage: 45, kills: 1 }, { stage: 46, kills: 1 }];
  const ranked = simulation.rankStages(stages, 1, rates);
  assert.equal(ranked.gemRows[0].stage, 46);
  assert.deepEqual(ranked.feedRows.map(row => row.stage), [46]);
  assert.equal(ranked.combinedRows[0].combined, 1);
  assert.equal(ranked.combinedRows[1].foodHour, 0);
  assert.deepEqual(simulation.rankStages([{ stage: 46, kills: 0 }], 1, rates).combinedRows, []);
});
