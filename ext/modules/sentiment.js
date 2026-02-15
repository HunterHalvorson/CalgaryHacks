/**
 * sentiment.js — Lexicon-based sentiment & emotional language analysis
 * 
 * Approach: AFINN-style scored lexicon with:
 *   - Negation handling (flips polarity within a 3-word window)
 *   - Bigram/phrase detection
 *   - Emotional intensifier & hedge quantification
 *   - Emotional appeal pattern detection
 *
 * All scores derived from word-level lexicon lookups — no hardcoded results.
 */

const SentimentAnalyzer = (() => {

  // AFINN-inspired lexicon: word → score (-5 to +5)
  // Curated for media/news analysis context
  const LEXICON = {
    "abandon":-2,"abandoned":-2,"abandons":-2,"abducted":-3,"abhor":-3,
    "abolish":-2,"abominable":-3,"abuse":-3,"abused":-3,"abuses":-3,
    "abusive":-3,"accept":1,"accident":-2,"accomplish":2,"accomplishment":2,
    "achieve":2,"achievement":2,"ache":-2,"acknowledge":1,"acrimonious":-3,
    "acquit":2,"admirable":2,"admire":2,"admit":-1,"adorable":3,
    "adore":3,"advance":1,"advantage":2,"adventure":2,"afraid":-2,
    "aggravate":-2,"aggressive":-2,"agony":-3,"agree":1,"agreeable":2,
    "alarm":-2,"alarmed":-2,"alarming":-2,"alas":-1,"alienate":-2,
    "allegation":-2,"allege":-2,"alleged":-2,"amazing":3,"ambitious":1,
    "amuse":2,"anger":-2,"angry":-2,"anguish":-3,"annihilate":-3,
    "annoy":-2,"annoyed":-2,"annoying":-2,"antagonize":-2,"anxious":-2,
    "apathy":-1,"apologies":-1,"apologize":-1,"appalling":-3,"appeal":1,
    "appreciate":2,"apprehensive":-2,"approve":2,"argue":-1,"arrogant":-2,
    "assault":-3,"asset":1,"astonish":2,"atrocious":-4,"atrocity":-4,
    "attack":-2,"attract":1,"attractive":2,"audacious":1,"authority":1,
    "avert":-1,"avid":1,"avoid":-1,"award":2,"awesome":3,
    "awful":-3,"awkward":-1,

    "bad":-2,"ban":-1,"bankrupt":-3,"barbaric":-3,"barrier":-1,
    "battle":-1,"beaten":-2,"beautiful":2,"befriend":1,"beg":-1,
    "beneficial":2,"benefit":2,"benevolent":2,"betray":-3,"betrayal":-3,
    "better":1,"bewildered":-1,"bias":-1,"biased":-2,"bitter":-2,
    "bizarre":-1,"blame":-2,"bless":2,"blessing":2,"blind":-1,
    "bliss":3,"block":-1,"bloody":-2,"blunder":-2,"bold":1,
    "bomb":-3,"boost":2,"bore":-1,"boring":-2,"bother":-2,
    "brave":2,"bravery":2,"breach":-2,"breakthrough":3,"brilliant":3,
    "broken":-2,"brutal":-3,"brutality":-3,"burden":-2,"burn":-1,

    "calm":1,"capable":1,"capture":-1,"care":1,"careful":1,
    "careless":-2,"catastrophe":-4,"catastrophic":-4,"celebrate":2,
    "celebration":2,"challenge":-1,"champion":2,"chaos":-3,"charitable":2,
    "charity":2,"charm":2,"cheat":-3,"cheer":2,"cherish":2,
    "child":0,"chill":-1,"civil":1,"civilized":1,"claim":-1,
    "clash":-2,"clean":1,"clear":1,"clever":2,"coerce":-2,
    "collapse":-3,"combat":-1,"comfort":2,"commend":2,"commit":1,
    "compassion":2,"compassionate":2,"compel":-1,"competent":1,
    "complain":-2,"complaint":-2,"comprehensive":1,"compromise":1,
    "condemn":-3,"condemnation":-3,"confidence":2,"confident":2,
    "conflict":-2,"confuse":-1,"confused":-2,"confusion":-2,
    "congratulate":2,"conquer":1,"conspiracy":-2,"constructive":2,
    "contaminate":-2,"contempt":-3,"content":1,"controversial":-1,
    "convict":-2,"conviction":-1,"cooperate":1,"cooperation":2,
    "corrupt":-3,"corruption":-3,"courage":2,"courageous":2,
    "courtesy":2,"coward":-2,"cowardly":-2,"crash":-2,"create":1,
    "creative":2,"credible":2,"crime":-3,"criminal":-3,"crisis":-3,
    "critical":-1,"criticism":-2,"criticize":-2,"cruel":-3,"cruelty":-3,
    "crush":-2,"cry":-2,"cunning":-1,"cure":2,"curse":-2,
    "cut":-1,"cynical":-2,

    "damage":-2,"damn":-3,"danger":-2,"dangerous":-2,"daring":1,
    "dark":-1,"dead":-3,"deadly":-3,"death":-3,"debacle":-3,
    "decay":-2,"deceit":-3,"deceitful":-3,"deceive":-3,"decent":1,
    "deception":-3,"decline":-2,"defeat":-2,"defend":1,"defense":1,
    "defiant":-1,"defy":-1,"degrade":-3,"delay":-1,"deliberate":0,
    "delight":3,"delightful":3,"demand":-1,"demolish":-2,"demon":-3,
    "demonize":-3,"denial":-1,"deny":-1,"deplorable":-3,"depress":-2,
    "depressed":-2,"depressing":-2,"depression":-2,"deprive":-2,
    "deride":-2,"deserve":1,"desire":1,"despair":-3,"desperate":-2,
    "despicable":-3,"despise":-3,"destroy":-3,"destruction":-3,
    "destructive":-3,"detain":-2,"determination":2,"determined":2,
    "devastating":-3,"devastation":-3,"devious":-2,"devoted":2,
    "dignity":2,"dire":-3,"dirty":-2,"disabled":-1,"disadvantage":-2,
    "disagree":-1,"disappear":-1,"disappoint":-2,"disappointed":-2,
    "disappointing":-2,"disappointment":-2,"disaster":-3,"disastrous":-3,
    "disbelief":-2,"discontent":-2,"discourage":-2,"discover":2,
    "discrimination":-3,"disgrace":-3,"disgusting":-3,"dishonest":-3,
    "dislike":-2,"dismal":-2,"dismiss":-1,"disorder":-2,"dispute":-1,
    "disrespect":-2,"disrupt":-2,"dissatisfied":-2,"distort":-2,
    "distress":-2,"disturb":-2,"disturbing":-2,"divide":-1,
    "dominate":-1,"doom":-3,"doubt":-1,"doubtful":-1,"dread":-3,
    "dreadful":-3,"drown":-2,"dumb":-2,"dump":-1,

    "eager":1,"earn":1,"easy":1,"effective":1,"efficient":1,
    "effort":1,"elegant":2,"eliminate":-1,"embarrass":-2,"embarrassing":-2,
    "emergency":-2,"empathy":2,"empower":2,"empowering":2,"empty":-1,
    "encourage":2,"encouraging":2,"endanger":-2,"endure":-1,"enemy":-2,
    "energetic":1,"enjoy":2,"enjoyable":2,"enormous":1,"enrage":-3,
    "enrich":2,"enslaved":-3,"entertain":1,"enthusiasm":2,"equal":1,
    "equality":2,"error":-2,"escape":-1,"essential":1,"ethical":2,
    "evil":-3,"exaggerate":-2,"exasperated":-2,"excel":2,"excellent":3,
    "exceptional":3,"excite":2,"excited":2,"exciting":2,"exclude":-1,
    "exclusive":1,"excuse":-1,"exemplary":3,"exhaust":-2,"exile":-2,
    "exploit":-2,"exploitation":-3,"explosive":-2,"expose":-1,
    "extraordinary":3,"extreme":-1,"extremist":-3,

    "fabricate":-3,"fabulous":3,"fail":-2,"failure":-2,"fair":1,
    "faith":2,"faithful":2,"fake":-3,"false":-2,"fame":1,
    "fantastic":3,"fascinate":2,"fatal":-3,"fault":-2,"favor":1,
    "favorable":2,"fear":-2,"fearful":-2,"fearless":2,"feast":1,
    "feat":2,"feeble":-1,"fierce":-1,"fight":-1,"filthy":-3,
    "fine":1,"fix":1,"flaw":-2,"flawed":-2,"flee":-1,
    "flourish":2,"fool":-2,"foolish":-2,"force":-1,"forceful":-1,
    "forgive":2,"fortunate":2,"foul":-3,"fraud":-3,"fraudulent":-3,
    "free":1,"freedom":2,"friendly":2,"frighten":-2,"frightening":-2,
    "frustrate":-2,"frustrated":-2,"frustrating":-2,"fulfill":2,
    "fun":2,"fundamental":1,"furious":-3,"fury":-3,

    "gain":1,"generous":2,"genius":3,"gentle":2,"genuine":2,
    "gift":2,"glad":2,"gloomy":-2,"glorious":3,"glory":2,
    "good":2,"gorgeous":3,"grace":2,"graceful":2,"gracious":2,
    "grand":2,"grant":1,"grateful":2,"grave":-2,"great":2,
    "greed":-3,"greedy":-3,"grief":-3,"grim":-2,"gross":-2,
    "groundbreaking":3,"growth":1,"guarantee":1,"guilt":-2,"guilty":-2,

    "happy":2,"harassment":-3,"hard":-1,"hardship":-2,"harm":-2,
    "harmful":-2,"harmony":2,"harsh":-2,"hate":-3,"hatred":-3,
    "hazard":-2,"hazardous":-2,"heal":2,"healing":2,"health":1,
    "healthy":2,"heartbreaking":-3,"heartwarming":3,"heavenly":3,
    "help":2,"helpful":2,"helpless":-2,"hero":2,"heroic":2,
    "hesitant":-1,"hideous":-3,"hinder":-2,"honest":2,"honor":2,
    "honorable":2,"hope":2,"hopeful":2,"hopeless":-2,"horrible":-3,
    "horrific":-3,"horrify":-3,"horror":-3,"hostile":-2,"hostility":-2,
    "humble":1,"humiliate":-3,"humiliation":-3,"hurt":-2,"hurtful":-2,
    "hypocrisy":-3,"hypocrite":-3,

    "ideal":2,"ignorance":-2,"ignorant":-2,"ignore":-1,"illegal":-2,
    "illegitimate":-2,"immoral":-3,"impartial":2,"impede":-1,
    "impressive":2,"improve":2,"improvement":2,"inability":-2,
    "inadequate":-2,"incompetent":-2,"incredible":3,"indecent":-2,
    "independent":1,"indifferent":-1,"indignation":-2,"inferior":-2,
    "inflame":-2,"influential":1,"infringe":-2,"infuriate":-3,
    "ingenious":3,"injure":-2,"injustice":-3,"innocent":1,
    "innovate":2,"innovation":2,"innovative":2,"insecure":-2,
    "insensitive":-2,"insidious":-3,"insightful":2,"inspire":2,
    "inspiring":2,"integrity":2,"intelligent":2,"interest":1,
    "intimidate":-2,"intolerant":-2,"invasion":-2,"invest":1,
    "irrational":-2,"irresponsible":-2,

    "jealous":-2,"jeopardize":-2,"joy":2,"joyful":3,"joyous":3,
    "just":1,"justice":2,"justify":1,

    "keen":1,"kill":-3,"killing":-3,"kind":2,"kindness":2,
    "knowledge":1,

    "lack":-1,"lament":-2,"lash":-2,"laugh":1,"launch":1,
    "lawful":1,"lawless":-2,"lead":1,"leader":1,"leadership":1,
    "legitimate":1,"lethal":-3,"liable":-1,"liberal":0,"liberate":2,
    "liberation":2,"liberty":2,"lie":-3,"lied":-3,"liar":-3,
    "like":1,"limit":-1,"lonely":-2,"lose":-2,"loser":-2,
    "loss":-2,"lost":-1,"love":2,"lovely":2,"low":-1,"loyal":2,
    "luck":2,"lucky":2,"lurk":-1,"luxury":1,

    "mad":-2,"magnificent":3,"malicious":-3,"malign":-3,"mandate":-1,
    "manipulate":-3,"manipulation":-3,"marvelous":3,"massacre":-4,
    "masterful":3,"meaningful":2,"menace":-2,"merciful":2,"mercy":2,
    "merit":2,"mess":-2,"mighty":1,"miracle":3,"miserable":-3,
    "misery":-3,"mislead":-3,"misleading":-3,"mistake":-2,"mistrust":-2,
    "mock":-2,"monopolize":-2,"monster":-3,"moral":1,"mourn":-2,
    "murder":-4,"murderous":-4,

    "naive":-1,"nasty":-3,"necessary":1,"neglect":-2,"negligent":-2,
    "negotiate":1,"neutral":0,"nightmare":-3,"noble":2,"nonsense":-2,
    "nurture":2,

    "obnoxious":-3,"obscene":-3,"obstacle":-1,"offend":-2,"offensive":-3,
    "ominous":-2,"oppress":-3,"oppression":-3,"oppressive":-3,
    "optimism":2,"optimistic":2,"ordeal":-2,"outstanding":3,
    "outrage":-3,"outraged":-3,"outrageous":-3,"overcome":1,
    "overwhelm":-1,

    "pain":-2,"painful":-2,"panic":-3,"paradise":3,"paralyze":-2,
    "pardon":1,"passion":2,"passionate":2,"pathetic":-2,"patience":1,
    "patient":1,"patriot":1,"peace":2,"peaceful":2,"perfect":2,
    "peril":-2,"perilous":-2,"persecute":-3,"persevere":2,"pessimistic":-2,
    "phenomenal":3,"pioneer":2,"pity":-1,"plague":-3,"pleasant":2,
    "please":1,"pleased":2,"pleasure":2,"plunder":-3,"poison":-3,
    "pollute":-2,"poor":-2,"popular":1,"positive":2,"poverty":-2,
    "power":1,"powerful":1,"powerless":-2,"praise":2,"pray":1,
    "precious":2,"predator":-3,"predatory":-3,"prejudice":-3,
    "preserve":1,"pride":2,"privilege":1,"problem":-2,"productive":2,
    "profane":-2,"profound":2,"progress":2,"prohibit":-1,"promise":1,
    "promote":1,"propaganda":-3,"proper":1,"prosper":2,"prosperity":2,
    "protect":1,"protective":1,"protest":-1,"proud":2,"provoke":-2,
    "prudent":1,"punish":-2,"punishment":-2,"pure":1,

    "quality":1,"quarrel":-2,

    "racist":-3,"radical":-2,"rage":-3,"rampant":-2,"reckless":-2,
    "recommend":1,"reconcile":2,"reform":1,"refuge":1,"refuse":-1,
    "regret":-2,"reject":-2,"rejoice":3,"relentless":-1,"reliable":2,
    "relief":2,"relieve":2,"remarkable":2,"remedy":2,"remorse":-2,
    "renowned":2,"reprehensible":-3,"repress":-2,"repulsive":-3,
    "rescue":2,"resent":-2,"resentment":-2,"resilient":2,"resist":-1,
    "resolve":1,"respect":2,"responsible":1,"restore":2,"restrain":-1,
    "retaliate":-2,"revenge":-2,"revere":2,"revolt":-2,"revolting":-3,
    "reward":2,"rich":1,"ridicule":-2,"ridiculous":-2,"righteous":2,
    "rigid":-1,"risk":-1,"risky":-1,"rob":-2,"robust":1,
    "rogue":-2,"rotten":-3,"rude":-2,"ruin":-3,"ruthless":-3,

    "sacred":1,"sacrifice":-1,"sad":-2,"safe":1,"safety":1,
    "savage":-3,"save":2,"scandal":-3,"scandalous":-3,"scare":-2,
    "scared":-2,"scary":-2,"scold":-2,"scorn":-2,"secure":1,
    "selfish":-2,"sensational":-1,"sensible":1,"sensitive":1,
    "serene":2,"serious":-1,"severe":-2,"shame":-2,"shameful":-3,
    "shield":1,"shock":-2,"shocking":-2,"shortage":-1,"shrewd":1,
    "sick":-2,"silence":-1,"silly":-1,"sin":-2,"sincere":2,
    "sinister":-3,"skeptical":-1,"slander":-3,"slaughter":-4,
    "smart":2,"smile":2,"smug":-1,"sneak":-1,"solid":1,
    "solution":1,"solve":1,"sorrow":-2,"sorry":-1,"special":2,
    "spectacular":3,"splendid":3,"spoil":-2,"stable":1,"stagnant":-1,
    "starve":-3,"steal":-3,"stern":-1,"stimulate":1,"stink":-2,
    "stolen":-2,"strength":2,"strengthen":2,"stress":-2,"strife":-2,
    "strike":-1,"strong":1,"struggle":-2,"stubborn":-1,"stunning":3,
    "stupid":-2,"submit":-1,"substantial":1,"succeed":2,"success":2,
    "successful":2,"suffer":-2,"suffering":-2,"sufficient":1,
    "suicide":-4,"superior":1,"support":1,"supportive":2,
    "suppress":-2,"supreme":2,"sure":1,"surprise":1,"surrender":-1,
    "suspect":-1,"suspicious":-2,"sustain":1,"sweet":1,"sympathy":2,

    "talent":2,"talented":2,"terrible":-3,"terrific":3,"terrify":-3,
    "terrifying":-3,"terror":-3,"terrorism":-4,"terrorist":-4,
    "thank":2,"thankful":2,"thankless":-2,"thief":-3,"thirst":-1,
    "thorough":1,"thoughtful":2,"thoughtless":-2,"threat":-2,
    "threaten":-2,"threatening":-2,"thrive":2,"tolerate":1,
    "torment":-3,"torture":-4,"toxic":-3,"tradition":1,"tragic":-3,
    "tragedy":-3,"transform":1,"transparent":1,"trap":-2,
    "trauma":-3,"traumatic":-3,"treacherous":-3,"treason":-3,
    "treasure":2,"tremendous":2,"triumph":3,"trouble":-2,"troubled":-2,
    "troubling":-2,"true":1,"trust":2,"trustworthy":2,"truth":2,
    "tyranny":-3,"tyrant":-3,

    "ugly":-2,"unacceptable":-2,"unbearable":-2,"uncertain":-1,
    "undermine":-2,"unfair":-2,"unfortunate":-2,"unfounded":-2,
    "unhappy":-2,"unjust":-3,"unjustified":-2,"unlawful":-2,
    "unlikely":-1,"unprecedented":-1,"unrest":-2,"unsafe":-2,
    "unstable":-2,"uplift":2,"uplifting":2,"upset":-2,"urgent":-1,

    "vague":-1,"valid":1,"valuable":2,"value":1,"vandalize":-3,
    "vengeance":-2,"venom":-3,"verify":1,"veto":-1,"vicious":-3,
    "victim":-2,"victimize":-3,"victory":3,"vigilant":1,"vile":-3,
    "villain":-3,"vindictive":-3,"violate":-3,"violation":-3,
    "violence":-3,"violent":-3,"virtue":2,"virtuous":2,"vital":1,
    "vivid":1,"volunteer":2,"vulnerable":-1,

    "war":-2,"warn":-1,"warning":-1,"waste":-2,"weak":-2,
    "weakness":-2,"wealth":1,"weapon":-2,"weary":-1,"welcome":2,
    "wellbeing":2,"wholesome":2,"wicked":-3,"widespread":0,
    "willing":1,"win":2,"wisdom":2,"wise":2,"wish":1,
    "wonderful":3,"worry":-2,"worsen":-2,"worst":-3,"worth":1,
    "worthless":-3,"worthy":2,"wound":-2,"wrath":-3,"wreck":-2,
    "wrong":-2,

    "yearn":-1,"yield":0,"young":0,"zealot":-2,"zealous":-1
  };

  // Negation words flip polarity in a window
  const NEGATORS = new Set([
    "not","no","never","neither","nobody","nothing","nowhere","nor",
    "cannot","can't","couldn't","shouldn't","wouldn't","won't","don't",
    "doesn't","didn't","isn't","aren't","wasn't","weren't","hasn't",
    "haven't","hadn't","barely","hardly","scarcely","seldom","rarely"
  ]);

  // Intensifiers multiply the score
  const INTENSIFIERS_MAP = {
    "absolutely":1.5,"completely":1.4,"definitely":1.3,"entirely":1.4,
    "especially":1.3,"essentially":1.2,"exactly":1.2,"exceptionally":1.5,
    "exclusively":1.3,"explicitly":1.2,"extensively":1.3,"extraordinarily":1.5,
    "extremely":1.5,"fundamentally":1.3,"greatly":1.3,"heavily":1.3,
    "highly":1.3,"hugely":1.4,"immensely":1.4,"impossibly":1.4,
    "incredibly":1.4,"inevitably":1.3,"intensely":1.4,"literally":1.3,
    "massively":1.4,"overwhelmingly":1.5,"particularly":1.2,"perfectly":1.4,
    "profoundly":1.4,"purely":1.3,"radically":1.3,"remarkably":1.3,
    "seriously":1.3,"significantly":1.2,"simply":1.1,"solely":1.2,
    "strongly":1.3,"surely":1.2,"thoroughly":1.3,"totally":1.4,
    "tremendously":1.4,"truly":1.3,"ultimately":1.2,"unbelievably":1.5,
    "undeniably":1.4,"undoubtedly":1.3,"universally":1.3,"unquestionably":1.4,
    "utterly":1.5,"vastly":1.4,"very":1.25
  };

  const HEDGE_SET = new Set([
    "allegedly","apparently","arguably","assume","assumed","believe","believed",
    "claim","claimed","consider","could","estimated","generally","guess",
    "hopefully","likely","may","maybe","might","often","perhaps","possibly",
    "potentially","presumably","probably","purportedly","reportedly",
    "seems","should","sometimes","somewhat","supposedly","suspect",
    "suspected","tends","think","thought","typically","uncertain","unclear",
    "usually","would"
  ]);

  const EMOTIONAL_PATTERNS = [
    { pattern: /\bthink of the (children|kids|families|elderly|veterans)\b/gi, label: "Appeal to emotion (vulnerable groups)" },
    { pattern: /\b(everyone knows|everybody knows|as we all know|common sense)\b/gi, label: "Appeal to common belief" },
    { pattern: /\b(no one can deny|undeniable fact|unquestionable|beyond dispute)\b/gi, label: "Certainty assertion" },
    { pattern: /\b(wake up|open your eyes|sheeple|kool.?aid)\b/gi, label: "Condescension / dismissiveness" },
    { pattern: /\b(real americans?|true patriots?|real people|ordinary people)\b/gi, label: "Identity/in-group appeal" },
    { pattern: /\b(they don't want you to know|secret(?:ly)?|hidden truth|cover[\s-]?up)\b/gi, label: "Conspiracy framing" },
    { pattern: /\b(where does it end|what'?s next|slippery slope|thin end of the wedge)\b/gi, label: "Slippery slope language" },
    { pattern: /\b(fight back|take back|stand up against|war on|battle for)\b/gi, label: "Militaristic framing" },
    { pattern: /\b(destroy|annihilate|obliterate|eradicate|wipe out|crush)\b/gi, label: "Hyperbolic destruction language" },
    { pattern: /\b(crisis|emergency|catastrophe|nightmare|apocalypse|existential threat)\b/gi, label: "Crisis/urgency framing" }
  ];

  function tokenize(text) {
    return text.toLowerCase().replace(/['']/g, "'").split(/\s+/).map(w => w.replace(/^[^a-z']+|[^a-z']+$/g, "")).filter(w => w.length > 0);
  }

  /**
   * Score tokens with negation awareness and intensifier multiplication
   */
  function scoreTokens(tokens) {
    let positiveScore = 0;
    let negativeScore = 0;
    const positiveWords = [];
    const negativeWords = [];
    let intensifierCount = 0;
    let hedgeCount = 0;
    const intensifierList = new Set();
    const hedgeList = new Set();

    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i].replace(/'/g, "'");
      const cleanWord = word.replace(/[^a-z]/g, "");

      // Track hedges
      if (HEDGE_SET.has(cleanWord)) {
        hedgeCount++;
        hedgeList.add(cleanWord);
      }

      // Track intensifiers
      if (INTENSIFIERS_MAP[cleanWord]) {
        intensifierCount++;
        intensifierList.add(cleanWord);
      }

      // Lookup lexicon score
      if (LEXICON[cleanWord] !== undefined && LEXICON[cleanWord] !== 0) {
        let score = LEXICON[cleanWord];

        // Check for negation in preceding 1-3 words
        let negated = false;
        for (let j = Math.max(0, i - 3); j < i; j++) {
          const prevClean = tokens[j].replace(/[^a-z']/g, "");
          if (NEGATORS.has(prevClean)) {
            negated = true;
            break;
          }
        }

        // Check for intensifier immediately before
        let multiplier = 1.0;
        if (i > 0) {
          const prevClean = tokens[i - 1].replace(/[^a-z]/g, "");
          if (INTENSIFIERS_MAP[prevClean]) {
            multiplier = INTENSIFIERS_MAP[prevClean];
          }
        }

        if (negated) score = -score * 0.75; // Negation flips and slightly dampens
        score *= multiplier;

        if (score > 0) {
          positiveScore += score;
          positiveWords.push(cleanWord);
        } else if (score < 0) {
          negativeScore += Math.abs(score);
          negativeWords.push(cleanWord);
        }
      }
    }

    return {
      positiveScore: Math.round(positiveScore * 100) / 100,
      negativeScore: Math.round(negativeScore * 100) / 100,
      positiveWords: [...new Set(positiveWords)],
      negativeWords: [...new Set(negativeWords)],
      intensifiers: { count: intensifierCount, words: [...intensifierList] },
      hedges: { count: hedgeCount, words: [...hedgeList] }
    };
  }

  function analyze(text) {
    if (!text || text.trim().length === 0) return emptyResult();

    const tokens = tokenize(text);
    const wordCount = tokens.length;
    if (wordCount === 0) return emptyResult();

    const scored = scoreTokens(tokens);

    // Emotional pattern detection
    const emotionalPatterns = [];
    EMOTIONAL_PATTERNS.forEach(({ pattern, label }) => {
      const matches = text.match(pattern);
      if (matches) {
        emotionalPatterns.push({ label, count: matches.length, examples: [...new Set(matches.map(m => m.trim()))].slice(0, 3) });
      }
    });

    const netScore = scored.positiveScore - scored.negativeScore;
    const magnitude = scored.positiveScore + scored.negativeScore;

    // Normalized: net score divided by sqrt(wordCount) — scales with length
    const normalizedScore = wordCount > 0 ? netScore / Math.sqrt(wordCount) : 0;

    // Emotional intensity: how much emotional language relative to total
    const emotionalWordCount = scored.positiveWords.length + scored.negativeWords.length;
    const emotionalDensity = (emotionalWordCount / wordCount) * 100;
    const intensifierDensity = (scored.intensifiers.count / wordCount) * 100;
    const patternContribution = emotionalPatterns.reduce((s, p) => s + p.count, 0);

    // Combined emotional intensity (0-100)
    const rawIntensity = emotionalDensity * 2.5 + intensifierDensity * 4 + patternContribution * 6;
    const emotionalIntensity = Math.min(100, Math.round(rawIntensity));

    const objectivity = Math.max(0, 100 - emotionalIntensity);

    // Tone classification based on normalized score
    let toneLabel;
    const ns = normalizedScore;
    if (Math.abs(ns) < 0.2) toneLabel = "Neutral";
    else if (ns >= 0.2 && ns < 0.7) toneLabel = "Mildly Positive";
    else if (ns >= 0.7 && ns < 1.5) toneLabel = "Positive";
    else if (ns >= 1.5) toneLabel = "Strongly Positive";
    else if (ns <= -0.2 && ns > -0.7) toneLabel = "Mildly Negative";
    else if (ns <= -0.7 && ns > -1.5) toneLabel = "Negative";
    else toneLabel = "Strongly Negative";

    return {
      toneLabel,
      normalizedScore: Math.round(ns * 100) / 100,
      positiveScore: scored.positiveScore,
      negativeScore: scored.negativeScore,
      netScore: Math.round(netScore * 100) / 100,
      emotionalIntensity,
      objectivity,
      positiveWords: scored.positiveWords.slice(0, 15),
      negativeWords: scored.negativeWords.slice(0, 15),
      intensifiers: {
        count: scored.intensifiers.count,
        density: Math.round(intensifierDensity * 100) / 100,
        words: scored.intensifiers.words.slice(0, 10)
      },
      hedges: { count: scored.hedges.count, words: scored.hedges.words.slice(0, 10) },
      emotionalPatterns,
      wordCount
    };
  }

  function emptyResult() {
    return {
      toneLabel: "Neutral", normalizedScore: 0, positiveScore: 0, negativeScore: 0,
      netScore: 0, emotionalIntensity: 0, objectivity: 100,
      positiveWords: [], negativeWords: [],
      intensifiers: { count: 0, density: 0, words: [] },
      hedges: { count: 0, words: [] },
      emotionalPatterns: [], wordCount: 0
    };
  }

  return { analyze };
})();
