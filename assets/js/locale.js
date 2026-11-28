// Japanese source strings double as the fallback. Placeholders keep values separate from UI text.
const moncolleLocale = (() => {
  'use strict';
  const english = {
    "計算機の切り替え": "Calculators",
    "最適ステージ・予想時給計算機": "Best Stage & Gem Rate Calculator",
    "ボス戦計算機": "Boss Battle Calculator",
    "ステージ": "Stages",
    "ボス": "Boss",
    "編成と現在の倍率を選ぶだけで、ステージ1～75のジェム・餌・総合効率を比較できます。": "Choose your party and multipliers to compare gems, food and combined efficiency across stages 1–75.",
    "7キャラの編成": "Your party of seven",
    "キャラデータを読み込み中…": "Loading monster data…",
    "編成画像から入力": "Import a party screenshot",
    "画像の種類": "Image type",
    "自動判定": "Auto-detect",
    "バッグ全体": "Full bag",
    "編成部分のみ": "Party row only",
    "スクリーンショット": "Screenshot",
    "画像を解析": "Analyze image",
    "編成7体が横一列に写った切り取り画像がおすすめです。バッグ全体も自動で切り取れます。解析後、候補とLv・凸・変異を確認して編成に反映してください。": "Use a screenshot with all seven monsters in one row, or upload the full bag for automatic cropping. Check the names, levels, limit breaks and variants before applying.",
    "画像は外部へ送信せず、このブラウザ内で処理します。初回解析時だけ画像判定・OCRデータを読み込みます。": "Images are processed in your browser. Recognition and OCR data are downloaded on first use.",
    "解析する編成部分のプレビュー": "Party crop preview",
    "編成部分を自動検出": "Find party row",
    "切り抜き範囲を調整": "Adjust crop",
    "左位置": "Left",
    "上位置": "Top",
    "横幅": "Width",
    "高さ": "Height",
    "選択済みのキャラを編成に反映": "Apply selected monsters",
    "カテゴリ→キャラ→変異→Lv・凸の順に選ぶと、HP・攻撃力・特性を自動設定します。名前と変異はマウスホイールでも変更できます。": "Choose a category, monster, variant, level and limit breaks to calculate its stats. Use the mouse wheel to cycle through monsters or variants.",
    "倍率・目標": "Multipliers & goal",
    "リバース数": "Rebirths",
    "ジェムスキル倍率（倍）": "Gem skill multiplier",
    "稼ぎたいジェム額": "Gem target",
    "例：10": "e.g. 10",
    "目標額の単位": "Gem target unit",
    "高級餌になる確率（%）": "Premium food chance (%)",
    "餌はステージ46以上で、敵撃破時に基本5%でドロップ判定（カボチャイルドで+3ポイント）し、落ちた餌だけ高級化を別判定します（初期25%、アヤツリッチで+5ポイント）。入力内容はブラウザ内に自動保存します。": "From stage 46, each kill has a 5% chance to drop food (+3 percentage points with Kabochild). Each drop has a separate chance to become premium food (25% by default, +5 points with Ayatsuritch). Your settings are saved in this browser.",
    "計算結果": "Results",
    "予測最適ステージ": "Best stage for gems",
    "ステージ1～75から選択": "Across stages 1–75",
    "予想ジェム時給": "Estimated gems per hour",
    "1時間あたり": "Per hour",
    "目標到達時間": "Time to goal",
    "現在の目標額まで": "To your gem target",
    "ステージ別効率ランキング": "Stage rankings",
    "効率ランキングの種類": "Ranking type",
    "ジェム効率": "Gems",
    "餌効率": "Food",
    "総合ランキング": "Combined",
    "全75ステージを表示": "Show all 75 stages",
    "全30ステージを表示": "Show all 30 stages",
    "上位10ステージのみ表示": "Show top 10",
    "入力を初期状態に戻す": "Reset inputs",
    "順位": "Rank",
    "予想時給": "Gems/h",
    "最適比": "% of best",
    "討伐/秒": "Kills/s",
    "餌/時": "Food/h",
    "高級餌/時": "Premium/h",
    "通常餌/時": "Regular/h",
    "ジェム効率と餌効率を同じ重さで評価します。餌の対象はステージ46以上です。ステージ45以下はジェム情報だけを表示し、総合指数・餌比・餌/時は「—」になります。": "The combined score weighs gems and food equally. Food drops from stage 46, so stages 1–45 show only gem results.",
    "総合指数": "Combined score",
    "ジェム比": "Gem efficiency",
    "餌比": "Food efficiency",
    "設定のバックアップ": "Settings backup",
    "設定を保存（JSON）": "Export settings (JSON)",
    "設定ファイルを読み込む": "Import settings",
    "はじめて使う方へ": "Getting started",
    "持っている7体を、上から順に選びます。": "Choose your seven monsters in party order.",
    "リバース数・ジェムスキル倍率・餌の設定を入力します。": "Enter your rebirth count, gem multiplier and food settings.",
    "計算結果とランキングから、目的に合うステージを確認します。": "Check the rankings for the best stage for your goal.",
    "入力内容はこのブラウザに自動保存されます。詳しい仕様を知らなくても、そのまま使えます。": "Your party and settings are saved automatically in this browser.",
    "ボス戦の詳細が判明してから、正確な計算機を追加します。": "The calculator will be available once the boss battle rules are confirmed.",
    "準備中": "Coming soon",
    "自分の編成": "Your party",
    "最大3体の編成枠": "Up to three party slots",
    "1人3体まで、最大4人で協力するボス戦に対応予定です。": "Planned support for up to four players with three monsters each.",
    "通常": "Normal",
    "伝説": "Legendary",
    "幻": "Mythic",
    "伝説・幻": "Legendary / Mythic",
    "手動": "Manual",
    "手動入力": "Manual entry",
    "ノーマル": "Normal",
    "無印": "Base",
    "闇": "Dark",
    "漆黒": "Dark",
    "シャイニー": "Shiny",
    "レインボー": "Rainbow",
    "覚醒": "EX",
    "変異": "Variant",
    "名前": "Name",
    "攻撃力": "ATK",
    "凸": "LB",
    "特性なし": "No ability",
    "未選択": "No selection",
    "真の力｜": "True power · ",
    "ニャロウィン（コイン+10%）": "Nyalloween (+10% coins)",
    "覚醒ニャロウィン（ジェム+10%）": "Nyaloween EX (+10% gems)",
    "カボチャイルド（餌+3%）": "Kabochild (+3 points to food drop chance)",
    "キョンシーナ（コイン・ジェム+10%）": "Kyonshina (+10% coins and gems)",
    "ヤマタノコロチ（BOSSキラー）": "Yamatanokorochi (Boss Killer)",
    "アヤツリッチ（高級餌+5%）": "Ayatsuritch (+5 points to premium food chance)",
    "ドッパー（ボーナス図柄+3%）": "Dopper (+3% bonus symbol chance)",
    "ラブリル（30秒ごとに味方全員を最大HPの20%分回復）": "Labril (heals 20% of each ally’s max HP every 30s in stages)",
    "クビナイト（最大3体同時攻撃）": "Kubiknight (hits up to 3 targets)",
    "JK（通常初撃2倍／BOSS時は自チーム全員の回避率+5%）": "JK (double first hit per enemy in stages; +5% team dodge in boss battles)",
    "キングニドラ（30%で自身のダメージ1.5倍）": "King Nidra (30% chance to deal 1.5× damage)",
    "タイプ・ゼロ（自身のHPが50%以下の間、攻撃力2倍）": "Type-ZERO (double ATK at 50% HP or less)",
    "ミコン（ポンジャと同時編成で真の力）": "Mikon (true power when paired with Ponja)",
    "ポンジャ（ミコンと同時編成で真の力）": "Ponja (true power when paired with Mikon)",
    "キャラ{0}": "Monster {0}",
    "キャラ{0}のキャラ名": "Monster {0} name",
    "キャラ{0}の入力方式": "Monster {0} input mode",
    "キャラ{0}の変異": "Monster {0} variant",
    "キャラ{0}のレベル": "Monster {0} level",
    "キャラ{0}の凸数": "Monster {0} limit breaks",
    "キャラ{0}の手動名": "Monster {0} custom name",
    "キャラ{0}のLv1攻撃力": "Monster {0} base ATK",
    "キャラ{0}の攻撃単位": "Monster {0} ATK unit",
    "キャラ{0}のLv1 HP": "Monster {0} base HP",
    "キャラ{0}のHP単位": "Monster {0} HP unit",
    "キャラ{0}の攻撃間隔": "Monster {0} attack interval",
    "キャラ{0}の手動特性": "Monster {0} ability",
    "キャラ{0}のカテゴリ": "Monster {0} category",
    "名前・No.で検索": "Search name or No.",
    "キャラ名（任意）": "Name (optional)",
    "Lv1攻撃": "Base ATK",
    "攻撃 {0}": "ATK {0}",
    "（{0}秒に1回）": " (every {0}s)",
    "{0}（{1}秒）": "{0} ({1}s)",
    "戦力データが不正です": "Invalid power data",
    "編成データが不正です": "Invalid party data",
    "0 QD/時": "0 QD/h",
    "{0} ジェム/時": "{0} gems/h",
    "{0} {1}/時": "{0} {1}/h",
    "0分": "0 min",
    "{0}分": "{0} min",
    "{0}時間": "{0} h",
    "{0}時間{1}": "{0} h {1}",
    "キャラの戦力を1体以上入力すると計算します。": "Choose at least one monster or enter its attack power.",
    "高級餌になる確率は0～25%で入力してください。": "Enter a premium food chance from 0 to 25%.",
    "リバース数は0～627の整数、ジェムスキル倍率は1～4.75で入力してください。": "Enter a whole number of rebirths from 0 to 627 and a gem multiplier from 1 to 4.75.",
    "倍率が計算範囲を超えています。リバース数を小さくしてください。": "The multiplier is too large to calculate. Lower the rebirth count.",
    "討伐可能なステージなし": "No clearable stage",
    "シミュレーション時間内に敵を倒せませんでした。": "No enemies were defeated within the simulation time.",
    "討伐 {0}体/秒・死亡 {1}回/秒": "{0} kills/s · {1} deaths/s",
    "ステージ{0}での予測": "Estimate for stage {0}",
    "目標額を入力してください": "Enter a gem target",
    "目標額は0以上の数値を入力してください。": "Enter a gem target of zero or more.",
    "計算中…": "Calculating…",
    "入力を初期状態に戻しますか？": "Reset your party and settings?",
    "読み込みに失敗しました：{0}": "Could not load the file: {0}",
    "ラブリル×{0}：{1}秒ごとに自チーム全員を最大HPの{2}%分回復（重複なし）": "Labril ×{0}: heals {2}% of each ally’s max HP every {1}s (does not stack)",
    "JK×{0}（BOSS）：自チーム全員の回避率+5%（重複なし）・敵命中実測 {1}": "JK ×{0} (boss): +5% team dodge (does not stack); simulated enemy hit rate {1}",
    "JK×{0}（通常）：各JKの敵ごとの初撃2倍・発動 {1}回/分": "JK ×{0}: double damage on its first hit against each enemy, {1} triggers/min",
    "凸回避：{0}": "Dodge from limit breaks: {0}",
    "BOSS編成：自チーム{0}体／最大{1}人・レイド全体{2}体": "Boss party: {0} monsters per team, up to {1} players and {2} monsters total",
    "キングニドラ×{0}：1.5倍発動 {1}（攻撃ごと30%）": "King Nidra ×{0}: 1.5× damage triggered on {1} of attacks (30% chance per attack)",
    "対象：ステージ46～75｜最適ステージ{0}：餌 {1}/時（高級 {2}/時・通常 {3}/時）｜餌ドロップ率 {4}%・高級化率 {5}%": "Stages 46–75 · Best: stage {0}, {1} food/h ({2} premium, {3} regular) · Drop chance {4}%, premium chance {5}%",
    "対象：ステージ46～75｜この編成では餌を獲得できる敵を倒せませんでした。": "Stages 46–75: this party could not defeat an enemy that drops food.",
    "総合最適ステージ{0}：総合指数 {1}（ジェム比 {2}%・餌比 {3}%）": "Best combined: stage {0}, score {1} (gem efficiency {2}%, food efficiency {3}%)",
    "ステージ46以上で餌を獲得できないため、総合最適ステージはありません。": "No combined ranking because this party earned no food on stages 46–75.",
    "characters.local.js を開けませんでした": "Could not open characters.local.js",
    "計算機を起動できませんでした。{0}": "Could not start the calculator: {0}",
    "画像を開けませんでした": "Could not open the image",
    "画像解析ライブラリを読み込めませんでした": "Could not load the image recognition library",
    "初回用のOCRデータを読み込んでいます…": "Loading OCR data for first use…",
    "OCR準備中… {0}%": "Preparing OCR… {0}%",
    "OpenCVはこの環境では利用できません": "OpenCV is unavailable in this browser",
    "画像を整えるOpenCVを読み込んでいます…": "Loading OpenCV for image processing…",
    "OpenCVの初期化が時間内に完了しませんでした": "OpenCV initialization timed out",
    "キャラ画像の判定モデルを読み込んでいます…": "Loading the monster recognition model…",
    "画像判定の設定を読み込めませんでした": "Could not load recognition settings",
    "要確認・キャラを選択": "Review: select a monster",
    "変異を確認": "Check variant",
    "選択済みの{0}体を編成に反映": "Apply selected monsters ({0})",
    "反映するキャラを確認してください": "Review the monsters to apply",
    "画像のキャラ{0}": "Monster {0} in image",
    "画像のキャラ{0}の変異": "Variant of monster {0} in image",
    "画像のキャラ{0}のレベル": "Level of monster {0} in image",
    "画像のキャラ{0}の凸数": "Limit breaks of monster {0} in image",
    "照合項目 {0}": "Matched: {0}",
    "候補 {0}": "Candidates: {0}",
    "照合候補": "Possible matches",
    "要確認　{0}": "Review: {0}",
    "読取攻撃力 {0}": "Detected ATK: {0}",
    "計算から推定　{0}": "Inferred: {0}",
    "Lv確認": "Check Lv",
    "凸確認": "Check LB",
    "手動で編集中": "Editing manually",
    "画像モデルで編成部分を自動検出しています…": "Finding the party row…",
    "編成部分として判定しました。このまま解析できます。": "Party row detected. Ready to analyze.",
    "バッグ全体として判定しました。解析時に編成部分の位置を自動補正します。": "Full bag detected. The party row will be aligned during analysis.",
    "画像の種類を変更しました。プレビューを確認してください。": "Image type changed. Check the preview.",
    "編成部分のみの画像なので、画像全体を使用します。": "Using the full image as the party row.",
    "編成部分を自動で切り取りました。プレビューを確認して解析してください。": "Party row cropped. Check the preview, then analyze.",
    "位置補正を完了できなかったため、標準位置で切り取りました。必要なら範囲を調整してください。": "Using the default crop. Adjust it if needed.",
    "キャラ{0}/7の名前を読み取っています…": "Reading monster {0} of 7…",
    "キャラ{0}/7のLv・凸を読み取っています…": "Reading level and limit breaks for monster {0} of 7…",
    "解析しました。要確認の枠は、候補と画像を見比べて選べます。": "Analysis complete. For slots marked for review, compare the candidates with the image.",
    "解析に失敗しました：{0}": "Analysis failed: {0}",
    "選択済みの{0}体を元の枠に反映しました。{1}": "Applied {0} monsters to their original slots. {1}",
    "要確認の枠は元の編成のままです。": "Slots marked for review kept their previous monsters.",
    "攻撃力の読みが {0} と {1} に分かれました": "Conflicting ATK readings: {0} and {1}",
    "名前・キャラ画像と不一致": "Name and portrait disagree",
    "凸の対象外のキャラに凸表示があります": "A limit break was detected on a monster that cannot limit break",
    "表示攻撃力 {0} と計算値が不一致": "Displayed ATK {0} differs from the calculated value",
    "同じ条件に合う候補が複数あります": "Several monsters match these stats",
    "キャラを絞れる手掛かりが不足しています": "Not enough information to identify the monster",
    "他を固定すると {0} で攻撃力が一致": "Keeping the other values fixed, ATK matches at {0}",
    "攻撃力の読取候補のうち {0} が他の項目と一致": "Detected ATK {0} matches the other readings",
    "背景は{0}、": "The background suggests {0}. ",
    "表示攻撃力は{0}相当。変異を確認してください": "Displayed ATK matches {0}. Check the variant.",
    "{0}枠でミコン{1}体＋ポンジャ{2}体。位置を確認してください": "Slots {0} contain {1} Mikon and {2} Ponja. Check their order.",
    "ミコンとポンジャの位置を絞り切れません": "Could not determine which slots contain Mikon and Ponja",
    "ミコン・ポンジャの編成人数と表示攻撃力が一致しません": "Mikon and Ponja counts do not match the displayed ATK",
    "名前の読みが食い違ったため、他の枠の相方と表示攻撃力で判定": "Identified from the paired monster and displayed ATK after conflicting name readings",
    "Lv表示の読みが {0} と {1} に分かれました": "Conflicting level readings: {0} and {1}",
    "キャラ1": "Monster 1",
    "キャラ2": "Monster 2",
    "キャラ3": "Monster 3"
  };
  const key = 'moncolle-language';
  const supported = value => value === 'ja' || value === 'en';
  function preferredLanguage(languages) {
    for (const language of languages) {
      const primary = language.toLowerCase().split('-')[0];
      if (supported(primary)) return primary;
    }
    return 'ja';
  }
  let language = 'ja';
  function t(source, ...values) {
    if (Array.isArray(source)) source = source.reduce((out, str, i) => out + (i ? '{' + (i-1) + '}' : '') + str, '');
    const template = language === 'en' && Object.hasOwn(english, source) ? english[source] : source;
    return values.length ? template.replace(/\{(\d+)\}/g, (_, i) => String(values[i])) : template;
  }
  function initialize() {
    let saved;
    try { saved = localStorage.getItem(key); } catch {}
    // file URLs may use separate storage for each HTML file. Carry the choice across the two pages.
    const linked = location.protocol === 'file:' && new URL(location.href).searchParams.get('lang');
    let explicit = supported(linked) ? linked : supported(saved) ? saved : null;
    language = explicit || preferredLanguage(navigator.languages?.length ? navigator.languages : [navigator.language || 'ja']);
    if (supported(linked)) {
      try { localStorage.setItem(key, linked); } catch {}
    }
    const picker = document.getElementById('language');
    const title = document.title;
    const bindings = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode()); ) {
      const value = node.nodeValue.trim();
      if (Object.hasOwn(english, value)) {
        const original = node.nodeValue;
        bindings.push(() => { node.nodeValue = original.replace(value, () => t(value)); });
      }
    }
    for (const el of document.querySelectorAll('[aria-label],[placeholder]')) {
      for (const attr of ['aria-label', 'placeholder']) {
        const value = el.getAttribute(attr);
        if (value && Object.hasOwn(english, value)) bindings.push(() => el.setAttribute(attr, t(value)));
      }
    }
    function render() {
      document.documentElement.lang = language;
      document.title = title.replace(/^(.+?)( v[\d.]+)$/, (_, name, version) => t(name) + version);
      picker.value = language;
      for (const bind of bindings) bind();
      if (location.protocol === 'file:') {
        for (const link of document.querySelectorAll('.mode-link')) {
          const url = new URL(link.href);
          if (explicit) url.searchParams.set('lang', explicit);
          else url.searchParams.delete('lang');
          link.href = url.href;
        }
      }
    }
    render();
    picker.addEventListener('change', () => {
      if (!supported(picker.value)) return;
      language = picker.value;
      explicit = language;
      try { localStorage.setItem(key, language); } catch {}
      if (location.protocol === 'file:' && location.search) {
        try {
          const url = new URL(location.href);
          url.searchParams.set('lang', language);
          history.replaceState(null, '', url);
        } catch {}
      }
      render();
      window.dispatchEvent(new Event('moncolle-language'));
    });
  }
  if (typeof document !== 'undefined') initialize();
  return { t, preferredLanguage, get language() { return language; } };
})();
if (typeof module === 'object' && module.exports) module.exports = moncolleLocale;

