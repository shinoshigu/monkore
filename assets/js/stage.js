function initializeMoncolleStage(rules) {
  'use strict';
  const { t } = moncolleLocale;
  const { CATALOG, CATALOG_BY_ID, CHARACTERS, MUTATIONS, UNITS, BOSS_MODEL,
    CATEGORY_LABELS, ATTACK_PERIODS, attackType, supportsLimitBreak,
    catalogEntries, formatStat, attackAtLevel, resolveParty } = rules;
  const { stageCount, MODEL, estimate, rankStages, gemMultiplier, foodRates } = createMoncolleSimulation(rules);

  const catalogLabel = entry => rules.catalogLabel(entry, moncolleLocale.language);
  const matchesName = (entry, query) => [catalogLabel(entry), entry.name, entry.nameEn, entry.id]
    .some(value => value && value.toLowerCase() === query);
  const GEM_UNITS = [['QiD',48],['QD',45],['Td',42],['Dd',39],['Ud',36],['Dc',33],['No',30],['Oc',27],['Sp',24],['Sx',21],['Qi',18],['Qa',15],['T',12],['B',9],['M',6],['K',3]];
  const STORAGE = 'stage-calculator-v19';
  const PREVIOUS_STORAGE = 'stage-calculator-v18.10-20261127';
  const OLD_STORAGES = ['stage-calculator-v18.9-20261127', 'stage-calculator-v18.8-20261127', 'stage-calculator-v18.7-20261127', 'stage-calculator-v18.6-20261126', 'stage-calculator-v18.5-20261126', 'stage-calculator-v18.4-20261126', 'stage-calculator-v18.3-20261126', 'stage-calculator-v18-20261125', 'stage-calculator-v17.8-20261124', 'stage-calculator-v17.7-20261124', 'stage-calculator-v17.6-20261123', 'stage-calculator-v17.5-20261123', 'stage-calculator-v17.4-20261122', 'stage-calculator-v17.3-20261122', 'stage-calculator-v17.2-20261121', 'stage-calculator-v17.1-20261121', 'stage-calculator-v17-20261121', 'stage-calculator-v16-20261121', 'stage-calculator-v15-20261119', 'stage-calculator-v14-20261119', 'stage-calculator-v13-20261119', 'stage-calculator-v12-20261119', 'stage-calculator-v10-20261117'];

  const OLD_TRAIT_TO_CHARACTER = {
    none: 'none', gem: 'awakenedNyarowin', coin: 'nyarowin', both: 'kyonshina',
    boss: 'yamata', feed: 'kabochild', premium: 'ayatsuritch', roulette: 'doppa',
    heal: 'lovril', multi: 'kubinight', jk: 'jk', kingNidra: 'kingNidra',
  };

  const emptyChar = () => ({
    category:'normal', catalogId:'', mutation:'normal', level:'1', limitBreak:'0',
    manualName:'', manualAttack:'0', manualAttackUnit:'M', manualHp:'0', manualHpUnit:'M', manualType:'normal', manualCharacter:'none',
  });
  const emptyState = () => ({
    chars: Array.from({ length: 7 }, emptyChar),
    rebirth: '0', skill: '4.75', target: '0', targetUnit: 'QD', premiumRate: '25', enemyType: 'normal',
  });

  function migrateCharacter(c) {
    if (c && Object.hasOwn(CHARACTERS, c.character)) return c.character;
    return OLD_TRAIT_TO_CHARACTER[c?.trait] || 'none';
  }

  function normalizeChar(c) {
    if (c && (Object.hasOwn(CATEGORY_LABELS, c.category) || c.category === 'manual')) {
      const level = Math.min(150, Math.max(1, Math.round(Number(c.level) || 1)));
      const limitBreak = Math.min(10, Math.max(0, Math.round(Number(c.limitBreak) || 0)));
      const savedEntry = CATALOG_BY_ID[c.catalogId];
      const category = savedEntry?.category || c.category;
      const allowedMutation = MUTATIONS[category] || {};
      const mutation = Object.hasOwn(allowedMutation, c.mutation) ? c.mutation : 'normal';
      return {
        ...emptyChar(), ...c, category, level:String(level), limitBreak:String(limitBreak), mutation,
        manualName: ['特性なし','特性無し'].includes(String(c.manualName || '').trim()) ? '' : String(c.manualName || ''),
        catalogId: CATALOG_BY_ID[c.catalogId]?.category === category ? c.catalogId : '',
        manualAttackUnit: Object.hasOwn(UNITS,c.manualAttackUnit) ? c.manualAttackUnit : 'M',
        manualHpUnit: Object.hasOwn(UNITS,c.manualHpUnit) ? c.manualHpUnit : 'M',
        manualType: Object.hasOwn(ATTACK_PERIODS, c.manualType) ? c.manualType : (category === 'manual' ? 'legend' : attackType(category)),
        manualCharacter: Object.hasOwn(CHARACTERS,c.manualCharacter) ? c.manualCharacter : 'none',
      };
    }
    if (!c || !Object.hasOwn(UNITS,c.unit) || !Number.isFinite(Number(c.power)) || Number(c.power) < 0) throw Error(t('戦力データが不正です'));
    const character = migrateCharacter(c);
    return {
      ...emptyChar(), category:'manual', manualName:character === 'none' ? '' : (CHARACTERS[character]?.label || ''),
      manualAttack:String(c.power), manualAttackUnit:c.unit,
      manualHp:String(Number(c.power)*20), manualHpUnit:c.unit,
      manualType:c.type === 'legend' ? 'legend' : 'normal', manualCharacter:character,
    };
  }

  function validate(obj) {
    if (!obj || !Array.isArray(obj.chars) || obj.chars.length !== 7) throw Error(t('編成データが不正です'));
    const chars = obj.chars.map(normalizeChar);
    const savedSkill = Number(obj.skill);
    const savedPremiumRate = Number(obj.premiumRate);
    return {
      chars,
      rebirth: String(obj.rebirth ?? 0),
      skill: String(Number.isFinite(savedSkill) ? Math.min(4.75, Math.max(1, savedSkill)) : 4.75),
      target: String(obj.target ?? 0),
      targetUnit: GEM_UNITS.some(([u]) => u === obj.targetUnit) ? obj.targetUnit : 'QD',
      premiumRate: String(Number.isFinite(savedPremiumRate) ? Math.min(25, Math.max(0, Math.round(savedPremiumRate))) : 25),
      enemyType: 'normal',
    };
  }

  let state = emptyState();
  try {
    const stored = localStorage.getItem(STORAGE) || localStorage.getItem(PREVIOUS_STORAGE) || OLD_STORAGES.map(key => localStorage.getItem(key)).find(Boolean);
    if (stored) state = validate(JSON.parse(stored));
  } catch (_) {}

  const $ = id => document.getElementById(id);
  const charsEl = $('chars');
  const characterOptions = () => Object.entries(CHARACTERS).map(([id,c]) => `<option value="${id}">${t(c.label)}</option>`).join('');
  function renderCatalogLists() {
    $('catalog-lists').replaceChildren();
    for (const category of Object.keys(CATEGORY_LABELS)) {
      const list = document.createElement('datalist');
      list.id = 'catalog-' + category;
      for (const entry of catalogEntries(category)) list.append(new Option(catalogLabel(entry), catalogLabel(entry)));
      $('catalog-lists').append(list);
    }
  }
  renderCatalogLists();
  for (const [unit] of [...GEM_UNITS].reverse()) $('targetUnit').add(new Option(unit, unit));

  function escapeAttribute(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
  function derivedHtml(r) {
    const trait = CHARACTERS[r.character]?.label || '特性なし';
    return `HP ${formatStat(r.hp)}<br>${t('攻撃 {0}', formatStat(r.power, 'bag'))}${r.power > 0 ? t('（{0}秒に1回）', ATTACK_PERIODS[r.type]) : ''}<br>${r.truePair?t('真の力｜'):''}${t(trait)}`;
  }
  function updateDerivedRows() {
    const resolved = resolveParty(state.chars, state.enemyType);
    charsEl.querySelectorAll('[data-derived]').forEach(el => { el.innerHTML = derivedHtml(resolved[Number(el.dataset.derived)]); });
  }
  function renderCharacterRows() {
    const resolved = resolveParty(state.chars, state.enemyType);
    charsEl.innerHTML = state.chars.map((c,i) => {
      const entries = catalogEntries(c.category);
      const entry = CATALOG_BY_ID[c.catalogId];
      const searchValue = entry ? catalogLabel(entry) : '';
      const catalogField = entries.length ? `<input type="search" list="catalog-${c.category}" value="${escapeAttribute(searchValue)}" placeholder="${t('名前・No.で検索')}" aria-label="${t('キャラ{0}のキャラ名', i+1)}" data-i="${i}" data-role="catalog">`
        : `<input value="${t('手動入力')}" aria-label="${t('キャラ{0}の入力方式', i+1)}" disabled>`;
      const mutations = MUTATIONS[c.category];
      const mutationField = mutations ? `<select aria-label="${t('キャラ{0}の変異', i+1)}" data-i="${i}" data-k="mutation">${Object.entries(mutations).map(([id,[label]])=>`<option value="${id}" ${c.mutation===id?'selected':''}>${t(label)}</option>`).join('')}</select>` : `<span></span>`;
      const hasLimitBreak = supportsLimitBreak(c.category);
      const growthFields = `<div class="growth-fields ${hasLimitBreak?'':'single'}">
        <label class="char-number"><span>Lv</span><input type="number" min="1" max="150" step="1" value="${c.level}" aria-label="${t('キャラ{0}のレベル', i+1)}" data-i="${i}" data-k="level"></label>
        ${hasLimitBreak ? `<label class="char-number"><span>${t('凸')}</span><input type="number" min="0" max="10" step="1" value="${c.limitBreak}" aria-label="${t('キャラ{0}の凸数', i+1)}" data-i="${i}" data-k="limitBreak"></label>` : ''}
      </div>`;
      const manual = c.category === 'manual';
      const manualFields = manual ? `<div class="manual-fields">
        <input value="${escapeAttribute(c.manualName||'')}" placeholder="${t('キャラ名（任意）')}" aria-label="${t('キャラ{0}の手動名', i+1)}" data-i="${i}" data-k="manualName">
        <input type="number" min="0" step="any" value="${escapeAttribute(c.manualAttack)}" placeholder="${t('Lv1攻撃')}" aria-label="${t('キャラ{0}のLv1攻撃力', i+1)}" data-i="${i}" data-k="manualAttack">
        <select aria-label="${t('キャラ{0}の攻撃単位', i+1)}" data-i="${i}" data-k="manualAttackUnit">${Object.keys(UNITS).map(u=>`<option ${c.manualAttackUnit===u?'selected':''}>${u}</option>`).join('')}</select>
        <input type="number" min="0" step="any" value="${escapeAttribute(c.manualHp)}" placeholder="Lv1 HP" aria-label="${t('キャラ{0}のLv1 HP', i+1)}" data-i="${i}" data-k="manualHp">
        <select aria-label="${t('キャラ{0}のHP単位', i+1)}" data-i="${i}" data-k="manualHpUnit">${Object.keys(UNITS).map(u=>`<option ${c.manualHpUnit===u?'selected':''}>${u}</option>`).join('')}</select>
        <select aria-label="${t('キャラ{0}の攻撃間隔', i+1)}" data-i="${i}" data-k="manualType">${Object.entries(ATTACK_PERIODS).map(([type, seconds]) => `<option value="${type}" ${c.manualType===type?'selected':''}>${t('{0}（{1}秒）', t(type==='legend'?'伝説・幻':CATEGORY_LABELS[type]), seconds)}</option>`).join('')}</select>
        <select aria-label="${t('キャラ{0}の手動特性', i+1)}" data-i="${i}" data-k="manualCharacter">${characterOptions().replace(`value="${c.manualCharacter}"`,`value="${c.manualCharacter}" selected`)}</select>
      </div>` : '';
      const r = resolved[i];
      return `<div class="char">
        <span class="name">${t('キャラ{0}', i+1)}</span>
        <select aria-label="${t('キャラ{0}のカテゴリ', i+1)}" data-i="${i}" data-k="category">${Object.entries(CATEGORY_LABELS).map(([category, label]) => `<option value="${category}" ${c.category===category?'selected':''}>${t(label)}</option>`).join('')}<option value="manual" ${c.category==='manual'?'selected':''}>${t('手動')}</option></select>
        ${catalogField}${mutationField}
        ${growthFields}
        <div class="derived" data-derived="${i}">${derivedHtml(r)}</div>
        ${manualFields}
      </div>`;
    }).join('');
  }

  function renderInputs() {
    renderCharacterRows();
    $('rebirth').value = state.rebirth;
    $('skill').value = state.skill;
    $('target').value = state.target;
    $('targetUnit').value = state.targetUnit;
    $('premiumRate').value = state.premiumRate;
    $('enemyType').value = state.enemyType;
  }

  function formatHourly(n) {
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return t('0 QD/時');
    const exponent = Math.log10(Math.abs(n)) + 45;
    const found = GEM_UNITS.find(([, power]) => exponent >= power - 1e-10);
    if (!found) return t`${Number((n * 1e45).toPrecision(4)).toLocaleString('ja-JP')} ジェム/時`;
    const [unit, power] = found;
    const scaled = n * Math.pow(10, 45 - power);
    return t`${Number(scaled.toPrecision(4)).toLocaleString('ja-JP', { maximumFractionDigits: 9 })} ${unit}/時`;
  }
  function nextRebirthTarget(rebirth) {
    if (!Number.isInteger(rebirth) || rebirth < 0 || rebirth > 627) return null;
    let exponent;
    if (rebirth === 0) {
      exponent = Math.log10(500);
    } else if (rebirth <= 4) {
      exponent = Math.log10(8000) + (rebirth - 1) * Math.log10(8);
    } else {
      exponent = Math.log10(31_250_000) + (rebirth - 5) * Math.log10(5);
    }
    const found = GEM_UNITS.find(([, power]) => exponent >= power - 1e-10) || GEM_UNITS[GEM_UNITS.length - 1];
    const [unit, power] = found;
    const amount = Math.pow(10, exponent - power);
    if (!Number.isFinite(amount)) return null;
    return { amount: String(Number(amount.toPrecision(7))), unit };
  }
  function autofillNextRebirthTarget() {
    const nextTarget = nextRebirthTarget(Number(state.rebirth));
    if (!nextTarget) return;
    state.target = nextTarget.amount;
    state.targetUnit = nextTarget.unit;
    $('target').value = state.target;
    $('targetUnit').value = state.targetUnit;
  }
  function formatCount(n) {
    if (!Number.isFinite(n)) return '—';
    return Number(n.toPrecision(4)).toLocaleString('ja-JP', { maximumFractionDigits: 3 });
  }
  function duration(hours) {
    if (!Number.isFinite(hours) || hours < 0) return '—';
    if (hours === 0) return t('0分');
    if (hours > 1e9) return t`${hours.toExponential(2)}時間`;
    const minutes = Math.ceil(hours * 60);
    if (minutes < 60) return t`${minutes}分`;
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return t`${h.toLocaleString('ja-JP')}時間${m ? t`${m}分` : ''}`;
  }

  let showAllGem = false, showAllFeed = false, showAllCombined = false;
  let computeTimer = 0, computeGeneration = 0;
  let simulationCacheKey = '', simulationCacheRows = null;
  function setBusy(busy) {
    $('toggleGem').disabled = busy;
    $('toggleFeed').disabled = busy;
    $('toggleCombined').disabled = busy;
    $('reset').disabled = busy;
  }
  function clearRankings() {
    $('gemRanking').innerHTML = '';
    $('feedRanking').innerHTML = '';
    $('combinedRanking').innerHTML = '';
    $('feedSummary').textContent = '—';
    $('combinedSummary').textContent = '—';
    $('traitStatus').textContent = '';
  }
  function partySimulationKey(party, enemyType) {
    return `${enemyType}|${party.map(c => [c.power,c.hp,c.type,c.character,c.bossDodge].join(',')).join(';')}`;
  }
  function yieldToBrowser() {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 24 });
      else setTimeout(resolve, 0);
    });
  }
  async function simulateAllStages(party, enemyType, generation) {
    const key = partySimulationKey(party, enemyType);
    if (key === simulationCacheKey && simulationCacheRows) return simulationCacheRows;
    const rows = [];
    for (let index = 0; index < stageCount; index++) {
      const stage = index + 1;
      rows.push({ stage, ...estimate(stage, party, MODEL.runs, MODEL.seconds, 0, enemyType) });
      if (index % 3 === 2) {
        await yieldToBrowser();
        if (generation !== computeGeneration) return null;
      }
    }
    if (generation !== computeGeneration) return null;
    simulationCacheKey = key;
    simulationCacheRows = rows;
    return rows;
  }
  async function compute(generation) {
    computeTimer = 0;
    setBusy(true);
    const r = Number(state.rebirth), skill = Number(state.skill);
    const premiumInput = Number(state.premiumRate);
    const party = resolveParty(state.chars, state.enemyType);
    const hasPower = party.some(c => Number(c.power) > 0);
    const premiumValid = Number.isFinite(premiumInput) && premiumInput >= 0 && premiumInput <= 25;
    const skillValid = Number.isFinite(skill) && skill >= 1 && skill <= 4.75;
    const valid = hasPower && Number.isInteger(r) && r >= 0 && r <= 627 && skillValid && premiumValid;
    const targetNumber = Number(state.target);
    const targetExponent = GEM_UNITS.find(([unit]) => unit === state.targetUnit)?.[1] ?? 45;
    const targetQD = targetNumber * Math.pow(10, targetExponent - 45);
    const targetValid = Number.isFinite(targetNumber) && targetNumber >= 0 && Number.isFinite(targetQD);
    if (!valid) {
      $('best').textContent = '—'; $('hour').textContent = '—'; $('targetTime').textContent = '—';
      $('bestSub').textContent = t('ステージ1～75から選択'); $('hourSub').textContent = t('1時間あたり'); $('targetTimeSub').textContent = t('現在の目標額まで');
      clearRankings();
      $('status').textContent = !hasPower ? t('キャラの戦力を1体以上入力すると計算します。')
        : !premiumValid ? t('高級餌になる確率は0～25%で入力してください。')
        : t('リバース数は0～627の整数、ジェムスキル倍率は1～4.75で入力してください。');
      setBusy(false); return;
    }
    const rates = foodRates(party, premiumInput);
    const factor = gemMultiplier(party, r, skill);
    if (!Number.isFinite(factor)) {
      clearRankings();
      $('targetTime').textContent = '—';
      $('targetTimeSub').textContent = t('現在の目標額まで');
      $('status').textContent = t('倍率が計算範囲を超えています。リバース数を小さくしてください。');
      setBusy(false); return;
    }
    const simulationRows = await simulateAllStages(party, state.enemyType, generation);
    if (!simulationRows || generation !== computeGeneration) return;
    const { gemRows, feedRows, combinedRows } = rankStages(simulationRows, factor, rates);
    const bestGem = gemRows[0], bestFeed = feedRows[0];
    if (!bestGem || bestGem.gemScore <= 0) {
      $('best').textContent = '—'; $('hour').textContent = t('0 QD/時'); $('targetTime').textContent = '—';
      $('bestSub').textContent = t('討伐可能なステージなし'); $('hourSub').textContent = t('1時間あたり'); $('targetTimeSub').textContent = t('現在の目標額まで');
      clearRankings();
      $('status').textContent = t('シミュレーション時間内に敵を倒せませんでした。');
      setBusy(false); return;
    }
    const bestCombined = combinedRows[0];

    $('best').textContent = String(bestGem.stage);
    $('bestSub').textContent = t`討伐 ${bestGem.kills.toFixed(3)}体/秒・死亡 ${bestGem.deaths.toFixed(3)}回/秒`;
    $('hour').textContent = formatHourly(bestGem.hour);
    $('hourSub').textContent = t`ステージ${bestGem.stage}での予測`;
    $('targetTime').textContent = targetValid && targetQD > 0 && bestGem.hour > 0 ? duration(targetQD / bestGem.hour) : '—';
    $('targetTimeSub').textContent = targetValid && targetQD > 0 ? t`ステージ${bestGem.stage}での予測` : t('目標額を入力してください');
    const traitParty = state.enemyType === 'boss' ? party.slice(0, BOSS_MODEL.charactersPerPlayer) : party;
    const activeLovrilCount = traitParty.filter(c => Number(c.power) > 0 && c.character === 'lovril').length;
    const activeJkCount = traitParty.filter(c => Number(c.power) > 0 && c.character === 'jk').length;
    const activeKingNidraCount = traitParty.filter(c => Number(c.power) > 0 && c.character === 'kingNidra').length;
    const traitNotes = [];
    if (activeLovrilCount) {
      traitNotes.push(t`ラブリル×${activeLovrilCount}：${CHARACTERS.lovril.interval}秒ごとに自チーム全員を最大HPの${(state.enemyType === 'boss' ? CHARACTERS.lovril.bossHeal : CHARACTERS.lovril.stageHeal) * 100}%分回復（重複なし）`);
    }
    if (activeJkCount) {
      traitNotes.push(state.enemyType === 'boss'
        ? t`JK×${activeJkCount}（BOSS）：自チーム全員の回避率+5%（重複なし）・敵命中実測 ${bestGem.enemyHitRate === null ? '—' : `${(bestGem.enemyHitRate * 100).toFixed(1)}%`}`
        : t`JK×${activeJkCount}（通常）：各JKの敵ごとの初撃2倍・発動 ${formatCount(bestGem.jkBoostsPerSecond * 60)}回/分`);
    }
    if (state.enemyType === 'boss') {
      const dodgeUsers = traitParty.filter(c => Number(c.power) > 0 && Number(c.bossDodge) > 0);
      if (dodgeUsers.length) traitNotes.push(t`凸回避：${dodgeUsers.map(c => `${c.name} ${(c.bossDodge * 100).toFixed(0)}%`).join('・')}`);
      traitNotes.push(t`BOSS編成：自チーム${BOSS_MODEL.charactersPerPlayer}体／最大${BOSS_MODEL.maxPlayers}人・レイド全体${BOSS_MODEL.maxRaidCharacters}体`);
    }
    if (activeKingNidraCount) {
      traitNotes.push(t`キングニドラ×${activeKingNidraCount}：1.5倍発動 ${bestGem.kingProcRate === null ? '—' : `${(bestGem.kingProcRate * 100).toFixed(1)}%`}（攻撃ごと30%）`);
    }
    $('traitStatus').textContent = traitNotes.join('｜');
    $('status').textContent = targetValid ? '' : t('目標額は0以上の数値を入力してください。');
    $('gemRanking').innerHTML = gemRows.slice(0, showAllGem ? 75 : 10).map((row, i) => `
      <tr><td>${i + 1}</td><td>${row.stage}</td><td>${formatHourly(row.hour)}</td>
      <td>${targetValid && targetQD > 0 && row.hour > 0 ? duration(targetQD / row.hour) : '—'}</td>
      <td>${(row.gemScore / bestGem.gemScore * 100).toFixed(1)}%</td><td>${row.kills.toFixed(3)}</td></tr>`).join('');
    $('feedRanking').innerHTML = feedRows.slice(0, showAllFeed ? 30 : 10).map((row, i) => `
      <tr><td>${i + 1}</td><td>${row.stage}</td><td>${formatCount(row.foodHour)}</td>
      <td>${formatCount(row.premiumHour)}</td><td>${formatCount(row.normalHour)}</td>
      <td>${bestFeed.foodHour > 0 ? `${(row.foodHour / bestFeed.foodHour * 100).toFixed(1)}%` : '—'}</td><td>${row.kills.toFixed(3)}</td></tr>`).join('');
    $('combinedRanking').innerHTML = combinedRows.slice(0, showAllCombined ? 75 : 10).map((row, i) => `
      <tr><td>${i + 1}</td><td>${row.stage}</td><td>${row.foodEligible ? (row.combined * 100).toFixed(1) : '—'}</td>
      <td>${(row.gemRelative * 100).toFixed(1)}%</td><td>${row.foodEligible ? `${(row.foodRelative * 100).toFixed(1)}%` : '—'}</td>
      <td>${formatHourly(row.hour)}</td><td>${row.foodEligible ? formatCount(row.foodHour) : '—'}</td></tr>`).join('');
    $('feedSummary').textContent = bestFeed.foodHour > 0
      ? t`対象：ステージ46～75｜最適ステージ${bestFeed.stage}：餌 ${formatCount(bestFeed.foodHour)}/時（高級 ${formatCount(bestFeed.premiumHour)}/時・通常 ${formatCount(bestFeed.normalHour)}/時）｜餌ドロップ率 ${(rates.dropRate * 100).toFixed(0)}%・高級化率 ${(rates.premiumRate * 100).toFixed(0)}%`
      : t`対象：ステージ46～75｜この編成では餌を獲得できる敵を倒せませんでした。`;
    $('combinedSummary').textContent = bestCombined.combined > 0
      ? t`総合最適ステージ${bestCombined.stage}：総合指数 ${(bestCombined.combined * 100).toFixed(1)}（ジェム比 ${(bestCombined.gemRelative * 100).toFixed(1)}%・餌比 ${(bestCombined.foodRelative * 100).toFixed(1)}%）`
      : t('ステージ46以上で餌を獲得できないため、総合最適ステージはありません。');
    setBusy(false);
  }
  function scheduleCompute() {
    clearTimeout(computeTimer);
    const generation = ++computeGeneration;
    $('status').textContent = t('計算中…');
    computeTimer = setTimeout(() => compute(generation), 220);
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (_) {}
    scheduleCompute();
  }

  charsEl.addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.i === undefined) return;
    if (el.dataset.role === 'catalog') {
      const index = Number(el.dataset.i);
      const c = state.chars[index];
      const entries = catalogEntries(c.category);
      const query = el.value.trim().toLocaleLowerCase('ja-JP');
      const exact = entries.find(entry => matchesName(entry, query));
      if (exact) {
        c.catalogId = exact.id;
        renderCharacterRows();
        save();
      }
      return;
    }
    if (!el.dataset.k) return;
    const c = state.chars[Number(el.dataset.i)];
    c[el.dataset.k] = el.dataset.k === 'level'
      ? String(Math.min(150,Math.max(1,Math.round(Number(el.value)||1))))
      : el.dataset.k === 'limitBreak'
        ? String(Math.min(10,Math.max(0,Math.round(Number(el.value)||0))))
        : el.value;
    updateDerivedRows();
    save();
  });
  charsEl.addEventListener('wheel', event => {
    const el = event.target;
    if (el.dataset?.i === undefined || event.deltaY === 0) return;
    const index = Number(el.dataset.i);
    const c = state.chars[index];
    if (el.dataset.role === 'catalog') {
      const entries = catalogEntries(c.category);
      if (!entries.length) return;
      event.preventDefault();
      const direction = c.category === 'normal'
        ? (event.deltaY < 0 ? 1 : -1)
        : (event.deltaY > 0 ? 1 : -1);
      const currentIndex = entries.findIndex(entry => entry.id === c.catalogId);
      const nextIndex = currentIndex < 0
        ? (direction > 0 ? 0 : entries.length - 1)
        : (currentIndex + direction + entries.length) % entries.length;
      const nextEntry = entries[nextIndex];
      c.catalogId = nextEntry.id;
      el.value = catalogLabel(nextEntry);
      updateDerivedRows();
      save();
      return;
    }
    if (el.dataset.k === 'mutation') {
      const mutationIds = Object.keys(MUTATIONS[c.category] || {});
      if (!mutationIds.length) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const currentIndex = Math.max(0, mutationIds.indexOf(c.mutation));
      const nextIndex = (currentIndex + direction + mutationIds.length) % mutationIds.length;
      c.mutation = mutationIds[nextIndex];
      el.value = c.mutation;
      updateDerivedRows();
      save();
    }
  }, { passive:false });
  charsEl.addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.i === undefined) return;
    const index = Number(el.dataset.i);
    const c = state.chars[index];
    if (el.dataset.role === 'catalog') {
      const entries = catalogEntries(c.category);
      const query = el.value.trim().toLocaleLowerCase('ja-JP');
      const exact = entries.find(entry => matchesName(entry, query));
      const partial = entries.filter(entry => [catalogLabel(entry), entry.name, entry.nameEn].some(value => value?.toLowerCase().includes(query)));
      c.catalogId = (exact || (partial.length === 1 ? partial[0] : null))?.id || '';
    } else if (el.dataset.k === 'category') {
      c.category = el.value;
      c.catalogId = '';
      c.mutation = 'normal';
      if (c.category !== 'manual') c.manualType = attackType(c.category);
    } else if (el.dataset.k) {
      c[el.dataset.k] = el.value;
      if (el.dataset.k === 'level') c.level = String(Math.min(150,Math.max(1,Math.round(Number(el.value)||1))));
      if (el.dataset.k === 'limitBreak') c.limitBreak = String(Math.min(10,Math.max(0,Math.round(Number(el.value)||0))));
    }
    renderCharacterRows();
    save();
  });
  for (const id of ['rebirth','skill','target','targetUnit','premiumRate','enemyType']) {
    const el = $(id);
    const update = () => {
      state[id] = el.value;
      if (id === 'rebirth') autofillNextRebirthTarget();
      if (id === 'enemyType') updateDerivedRows();
      save();
    };
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  }
  function selectRankingTab(tab) {
    const gemSelected = tab === 'gem';
    const feedSelected = tab === 'feed';
    const combinedSelected = tab === 'combined';
    $('gemTab').setAttribute('aria-selected', String(gemSelected));
    $('feedTab').setAttribute('aria-selected', String(feedSelected));
    $('combinedTab').setAttribute('aria-selected', String(combinedSelected));
    $('gemPanel').classList.toggle('hidden', !gemSelected);
    $('feedPanel').classList.toggle('hidden', !feedSelected);
    $('combinedPanel').classList.toggle('hidden', !combinedSelected);
  }
  $('gemTab').addEventListener('click', () => selectRankingTab('gem'));
  $('feedTab').addEventListener('click', () => selectRankingTab('feed'));
  $('combinedTab').addEventListener('click', () => selectRankingTab('combined'));
  $('toggleGem').addEventListener('click', () => {
    showAllGem = !showAllGem;
    $('toggleGem').textContent = showAllGem ? t('上位10ステージのみ表示') : t('全75ステージを表示');
    scheduleCompute();
  });
  $('toggleFeed').addEventListener('click', () => {
    showAllFeed = !showAllFeed;
    $('toggleFeed').textContent = showAllFeed ? t('上位10ステージのみ表示') : t('全30ステージを表示');
    scheduleCompute();
  });
  $('toggleCombined').addEventListener('click', () => {
    showAllCombined = !showAllCombined;
    $('toggleCombined').textContent = showAllCombined ? t('上位10ステージのみ表示') : t('全75ステージを表示');
    scheduleCompute();
  });
  $('reset').addEventListener('click', () => {
    if (!confirm(t('入力を初期状態に戻しますか？'))) return;
    state = emptyState(); showAllGem = showAllFeed = showAllCombined = false;
    $('toggleGem').textContent = t('全75ステージを表示');
    $('toggleFeed').textContent = t('全30ステージを表示');
    $('toggleCombined').textContent = t('全75ステージを表示');
    selectRankingTab('gem');
    renderInputs(); save();
  });
  $('download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: '19.1', ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'moncolle-calculator-v19.1-settings.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('load').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try { state = validate(JSON.parse(await file.text())); renderInputs(); save(); }
    catch (error) { alert(t`読み込みに失敗しました：${error.message}`); }
    event.target.value = '';
  });

  window.moncolleCalculator = {
    attackAtLevel, supportsLimitBreak, categoryLabels: CATEGORY_LABELS,
    catalog: CATALOG.map(entry => ({
      id: entry.id,
      no: entry.no || null,
      modelId: entry.modelId || null,
      name: entry.name,
      nameEn: entry.nameEn,
      get label() { return catalogLabel(entry); },
      category: entry.category,
      attack: entry.attack,
      character: entry.character,
    })),
    mutations: Object.fromEntries(Object.entries(MUTATIONS).map(([category, values]) => [
      category,
      Object.entries(values).map(([id, [label, multiplier]]) => ({ id, label, multiplier })),
    ])),
    applyImportedParty(items) {
      if (!Array.isArray(items)) return;
      items.slice(0, 7).forEach((item, index) => {
        const entry = CATALOG_BY_ID[item.catalogId];
        if (!entry) return;
        const next = emptyChar();
        next.category = entry.category;
        next.catalogId = entry.id;
        next.level = String(Math.min(150, Math.max(1, Math.round(Number(item.level) || 1))));
        next.limitBreak = String(supportsLimitBreak(entry.category)
          ? Math.min(10, Math.max(0, Math.round(Number(item.limitBreak) || 0)))
          : 0);
        next.mutation = Object.hasOwn(MUTATIONS[entry.category] || {}, item.mutation) ? item.mutation : 'normal';
        next.manualType = entry.type;
        state.chars[index] = next;
      });
      renderInputs();
      save();
    },
  };

  window.addEventListener('moncolle-language', () => {
    renderCatalogLists();
    renderInputs();
    $('toggleGem').textContent = t(showAllGem ? '上位10ステージのみ表示' : '全75ステージを表示');
    $('toggleFeed').textContent = t(showAllFeed ? '上位10ステージのみ表示' : '全30ステージを表示');
    $('toggleCombined').textContent = t(showAllCombined ? '上位10ステージのみ表示' : '全75ステージを表示');
    scheduleCompute();
  });
  renderInputs();
  scheduleCompute();
}
