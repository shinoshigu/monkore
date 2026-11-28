// Shared by the calculator, image import and catalog validation.
function createMoncolleCharacters(data) {
  'use strict';

  const CHARACTERS = data.traits;
  const MUTATIONS = data.mutations;
  const growth = data.normalGrowth;
  if (!Number.isFinite(CHARACTERS.lovril.interval) || CHARACTERS.lovril.interval <= 0)
    throw new Error('ラブリルの回復間隔には正の秒数を指定してください');
  const CATEGORY_LABELS = { normal: '通常', legend: '伝説', illusion: '幻', boss: 'ボス' };
  const ATTACK_PERIODS = { normal: 1, legend: 2.5, boss: 2 };
  const categories = Object.fromEntries(Object.keys(CATEGORY_LABELS).map(key => [key, []]));
  function attackType(category) { return category === 'illusion' ? 'legend' : category; }
  function supportsLimitBreak(category) { return category === 'legend' || category === 'illusion' || category === 'boss'; }
  const CATALOG_BY_ID = Object.create(null);
  const numbers = new Set();
  const modelIds = new Set();
  const CATALOG = data.characters.map(row => {
    const { id, name, category, no, modelId } = row;
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9_-]*$/.test(id) ||
        typeof name !== 'string' || !name.trim() || !Object.hasOwn(categories, category) || CATALOG_BY_ID[id])
      throw new Error('キャラID・名前・カテゴリを確認してください ' + id);
    if (modelId && modelIds.has(modelId)) throw new Error('画像モデルIDが重複しています ' + modelId);
    if (modelId) modelIds.add(modelId);
    let hp = row.hp, attack = row.attack;
    if (category === 'normal') {
      if (!Number.isInteger(no) || no < 1 || numbers.has(no)) throw new Error('図鑑番号を確認してください ' + id);
      numbers.add(no);
      const scale = Math.pow(growth.ratio, no - 1);
      hp ??= growth.hp * scale;
      attack ??= growth.attack * scale;
    }
    const character = row.character ?? 'none';
    if (!Number.isFinite(hp) || hp <= 0 || !Number.isFinite(attack) || attack <= 0 || !Object.hasOwn(CHARACTERS, character))
      throw new Error('基礎ステータス・特性を確認してください ' + id);
    const entry = { id, no, name, nameEn: row.nameEn, category, modelId, hp, attack, character, type: attackType(category) };
    CATALOG_BY_ID[id] = entry;
    categories[category].push(entry);
    return entry;
  });
  categories.normal.sort((a, b) => a.no - b.no);
  function catalogEntries(category) { return Object.hasOwn(categories, category) ? categories[category] : []; }

  const UNITS = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const BOSS_MODEL = {
    charactersPerPlayer: 3,
    maxPlayers: 4,
    maxRaidCharacters: 12,
    baseHitRate: 1,
    dodgePerLimitBreak: 0.02,
    jkOwnTeamDodge: CHARACTERS.jk.teamDodge,
    effectScope: {
      lovril: 'ownTeam',
      jk: 'ownTeam',
    },
  };

  function catalogLabel(c, language = 'ja') { const name = language === 'en' ? c.nameEn || c.name : c.name; return c.category === 'normal' ? `No.${String(c.no).padStart(2,'0')} ${name}` : name; }
  function formatStat(n, display = 'detail') {
    if (!Number.isFinite(n) || n <= 0) return '0';
    const units = [['T',1e12],['B',1e9],['M',1e6],['K',1e3]];
    const found = units.find(([,v]) => n >= v);
    if (!found) return Number(n.toPrecision(5)).toLocaleString('ja-JP',{maximumFractionDigits:3});
    if (display === 'bag') return `${Math.floor(n / (found[1] / 10)) / 10}${found[0]}`;
    return `${Number((n/found[1]).toPrecision(4)).toLocaleString('ja-JP',{maximumFractionDigits:3})}${found[0]}`;
  }
  function mutationMultiplier(c) { return MUTATIONS[c.category]?.[c.mutation]?.[1] || 1; }
  function limitBreakCount(c) {
    return supportsLimitBreak(c.category)
      ? Math.min(10, Math.max(0, Number(c.limitBreak) || 0))
      : 0;
  }
  function limitBreakMultiplier(c) {
    return 1 + 0.05 * limitBreakCount(c);
  }
  function levelGrowth(level) { return 1 + ((Number(level) || 1) - 1) / 20; }
  function attackAtLevel(entry, mutation, level, limitBreak, paired, enemyType = 'stage') {
    // Paired Lv120/125 at 10 limit breaks display 104.7M/108.5M.
    const base = paired && (entry.id === 'mikon' || entry.id === 'ponja') ? data.pairedStats.attack : entry.attack;
    const form = {category:entry.category, mutation, limitBreak};
    return base * levelGrowth(level) * mutationMultiplier(form)
      * (enemyType === 'boss' ? 1 : limitBreakMultiplier(form));
  }
  function bossDodgeRate(c) { return BOSS_MODEL.dodgePerLimitBreak * limitBreakCount(c); }
  function resolveParty(chars, enemyType = 'normal') {
    const mikonIndexes = chars.map((c,i) => c.category === 'legend' && c.catalogId === 'mikon' ? i : -1).filter(i => i >= 0);
    const ponjaIndexes = chars.map((c,i) => c.category === 'legend' && c.catalogId === 'ponja' ? i : -1).filter(i => i >= 0);
    const pairCount = Math.min(mikonIndexes.length, ponjaIndexes.length);
    const truePowerIndexes = new Set([...mikonIndexes.slice(0,pairCount), ...ponjaIndexes.slice(0,pairCount)]);
    return chars.map((c,index) => {
      const entry = CATALOG_BY_ID[c.catalogId];
      const levelMultiplier = levelGrowth(c.level);
      if (entry && entry.category === c.category) {
        const truePair = truePowerIndexes.has(index);
        const baseHp = truePair ? data.pairedStats.hp : entry.hp;
        const growthMultiplier = levelMultiplier * mutationMultiplier(c);
        const limitMultiplier = limitBreakMultiplier(c);
        const power = attackAtLevel(entry, c.mutation, c.level, c.limitBreak, truePair, enemyType);
        return { power, hp:baseHp*growthMultiplier*limitMultiplier, type:entry.type, character:entry.character, name:entry.name, truePair, bossDodge:bossDodgeRate(c) };
      }
      if (Object.hasOwn(categories, c.category)) {
        return { power:0, hp:0, type:attackType(c.category), character:'none', name:'未選択', truePair:false, bossDodge:bossDodgeRate(c) };
      }
      const attack = Math.max(0,Number(c.manualAttack)||0) * (UNITS[c.manualAttackUnit]||1);
      const enteredHp = Math.max(0,Number(c.manualHp)||0) * (UNITS[c.manualHpUnit]||1);
      const hp = (enteredHp || attack*20) * levelMultiplier;
      return { power:attack*levelMultiplier, hp, type:c.manualType || 'normal', character:c.manualCharacter||'none', name:c.manualName||'手動入力', truePair:false, bossDodge:0 };
    });
  }

  return { CATALOG, CATALOG_BY_ID, CHARACTERS, MUTATIONS, UNITS, BOSS_MODEL, CATEGORY_LABELS, ATTACK_PERIODS, attackType, supportsLimitBreak,
    catalogEntries, catalogLabel, formatStat, attackAtLevel, resolveParty };
}

if (typeof module === 'object' && module.exports) module.exports = createMoncolleCharacters;
