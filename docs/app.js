// Pack opener app
(async function(){
  const cards = await fetch('cards.json').then(r=>r.json());
  const sets = await fetch('sets.json').then(r=>r.json());

  // Sets to combine into "Where No One Has Gone Before"
  const promoSetCodes = ['AGT', 'ARM', 'ATP', 'EFC', 'EPR', 'ENT', 'FAJ', 'FAN', 'ITG', 'OTD', 'SAN', 'STD'];
  // Virtual promo sets to be combined into a single "Virtual Promos" pack
  const virtualPromoSetCodes = ['RIF','WPE','WPH','TAC','T50','PWP','COA','GIF','EQU','WHO','TNE','PAR','SOL','LFS','TWI','DRP'];
  // Default virtual-only short codes to include even if not listed on the page
  const defaultVirtualShortCodes = ['COC'];

  // Build set map from cards (use Set Code + Set Name from cards)
  const setsByCode = {};
  cards.forEach(c=>{
    const code = (c['Set Code']||c['Set_Code']||c['SetCode']||'').trim();
    const name = (c['Set Name']||c['Set_Name']||c['SetName']||'').trim();
    if(!code) return;
    if(!setsByCode[code]) setsByCode[code] = {code, name, cards: []};
    setsByCode[code].cards.push(c);
  });

  // Create the combined "Where No One Has Gone Before" set
  const combinedPromoCards = [];
  promoSetCodes.forEach(code => {
    if(setsByCode[code]) combinedPromoCards.push(...setsByCode[code].cards);
  });
  setsByCode['WNOHGB'] = {code: 'WNOHGB', name: 'Where No One Has Gone Before', cards: combinedPromoCards};

  // Remove individual promo sets from setsByCode
  promoSetCodes.forEach(code => delete setsByCode[code]);

  // Create the combined "Virtual Promos" set from the explicit virtual promo short codes
  const combinedVirtualPromoCards = [];
  virtualPromoSetCodes.forEach(code => {
    if(setsByCode[code]) combinedVirtualPromoCards.push(...setsByCode[code].cards);
  });
  setsByCode['VPROMO'] = {code: 'VPROMO', name: 'Virtual Promos', cards: combinedVirtualPromoCards};
  // Remove individual virtual promo sets from setsByCode so they don't appear separately
  virtualPromoSetCodes.forEach(code => delete setsByCode[code]);

  // global promo pool (for promo packs that draw from many promo sets)
  const globalPromoPool = cards.filter(c=>{
    const r = normalizeRarity(c.Rarity||c['Rarity']||'');
    return r.includes('promo');
  });

  // map sets.json by name for metadata (has_foils etc.)
  const metaByName = {};
  sets.forEach(s=>{ if(s.set_name) metaByName[String(s.set_name).trim()] = s; });
  // also map sets.json by set_code for more reliable lookups
  const metaByCode = {};
  sets.forEach(s=>{ if(s.set_code) metaByCode[String(s.set_code).trim()] = s; });

  // Build pack selection UI
  const packSelection = document.getElementById('pack-selection');
  const packOrder = ['PRE', 'ALT', 'QCM', 'FCO', 'DS9', 'DOM', 'BOG', 'ROA', 'TWT', 'TSD', 'MIR', 'VOY', 'BOR', 'HAD', 'TMP', 'WNOHGB'];
  if(!packOrder.includes('VPROMO')) packOrder.push('VPROMO');
  let setList = Object.values(setsByCode).sort((a,b)=>{
    const aIdx = packOrder.indexOf(a.code);
    const bIdx = packOrder.indexOf(b.code);
    if(aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if(aIdx !== -1) return -1;
    if(bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  
  // If this page requested virtual-only mode, apply a filter using `window.VIRTUAL_SHORT_CODES`
  try {
    if(window.VIRTUAL_ONLY) {
        const pageVirtual = Array.isArray(window.VIRTUAL_SHORT_CODES) ? window.VIRTUAL_SHORT_CODES.slice() : [];
        const virtualCodes = Array.from(new Set(pageVirtual.concat(defaultVirtualShortCodes||[])));
        if(virtualCodes.length) {
          setList = setList.filter(s => {
            const meta = metaByName[s.name] || {};
            const shortCode = meta.short_code || s.code;
            return virtualCodes.includes(shortCode) || virtualCodes.includes(s.code);
          });
        }
    }
    if(window.PHYSICAL_ONLY) {
      const physicalCodes = window.PHYSICAL_SHORT_CODES || [];
      if(Array.isArray(physicalCodes) && physicalCodes.length) {
        setList = setList.filter(s => {
          const meta = metaByName[s.name] || {};
          const shortCode = meta.short_code || s.code;
          return physicalCodes.includes(shortCode) || physicalCodes.includes(s.code);
        });
      }
    }
  } catch(e) { /* ignore if window not available */ }

  setList.forEach(s=>{
    // Hide `COC` as a standalone tile everywhere (it will still be included in virtual packs)
    if(s.code === 'COC') return;
    // Prefer metadata lookup by name, then by set_code (from cards), then empty
    const meta = metaByName[s.name] || metaByCode[s.code] || {};
    const tile = document.createElement('div');
    tile.className = 'pack-tile';
    
    // Try to load pack art: prefer explicit `pack_art` from sets.json, else try filename candidates
    const cacheBust = '?v=15';
    let artCandidates = [];
    if(meta.pack_art && String(meta.pack_art).trim()){
      artCandidates = [String(meta.pack_art).trim() + cacheBust];
    } else {
      // Determine short code: prefer meta.short_code, then metaByCode lookup, else fallback to s.code
      const shortCode = meta.short_code || (metaByCode[s.code] && metaByCode[s.code].short_code) || s.code;
      // Special handling for WNOHGB -> WNHGB filename
      const packArtCode = (shortCode === 'WNOHGB') ? 'WNHGB' : shortCode;
      artCandidates = [
        `pack-art/${packArtCode}.png${cacheBust}`,
        `pack-art/${packArtCode}.jpg${cacheBust}`,
        `pack-art/${packArtCode}.jpeg${cacheBust}`,
        `pack-art/${packArtCode}.webp${cacheBust}`
      ];
    }
    const tryArt = (idx=0) => {
      if(idx >= artCandidates.length){
        tile.classList.add('pack-tile-fallback');
        return;
      }
      const src = artCandidates[idx];
      const img = new Image();
      img.onload = () => { tile.style.backgroundImage = `url('${src}')`; };
      img.onerror = () => tryArt(idx+1);
      img.src = src;
    };
    tryArt();
    
    const info = document.createElement('div');
    info.className = 'pack-tile-info';
    info.innerHTML = `
      <div class="pack-tile-name">${s.name}</div>
    `;
    
    tile.appendChild(info);
    tile.addEventListener('click', ()=>{
      const pack = generatePackForSet(s.code);
      incrementPackOpens(s.code);
      renderPacks([pack], s.code);
      // Scroll to cards
      document.getElementById('pack-container').scrollIntoView({behavior:'smooth'});
    });
    
    packSelection.appendChild(tile);
  });

  function normalizeRarity(r){
    if(!r) return '';
    return String(r).toLowerCase().trim();
  }

  function getRarityCode(raw){
    if(!raw) return '';
    const r = String(raw).trim();
    const up = r.toUpperCase();
    // Preserve explicit codes like CV, UV, RV, R+V, URV
    if(/^(CV|UV|RV|URV|R\+V|R\+V|UR)$/.test(up)) return up.replace(/\s+/g,'');
    if(up.includes('URV') || up.includes('ULTRA') || up.includes('U.R.V')) return 'UR';
    if(up.includes('R+V') || up.includes('RARE PLUS') || up.includes('RARE+')) return 'R+';
    if(up.includes('RARE')) return 'R';
    if(up.includes('UNCOMMON')) return 'U';
    if(up.includes('COMMON')) return 'C';
    if(up.includes('PROMO')) return 'P';
    // fallback: first 3 chars uppercase
    return up.slice(0,3);
  }

  function groupPools(cards, setCode){
    const pools = {common:[],uncommon:[],rare:[],rarePlus:[],ultra:[],starter:[],foil:[],promo:[],tribble:[],hasStarterCards:false};
    cards.forEach(c=>{
      const r = normalizeRarity(c.Rarity || c['Rarity'] || c.rarity || '');

      // Handle common virtual rarity codes like CV/UV/RV/R+V/URV first
      if(r.includes('urv') || r.includes('ultra') || r.includes('u.r.v')) { pools.ultra.push(c); return; }
      if(r.includes('r+v') || r.includes('rare plus') || r.includes('rare+')) { pools.rarePlus.push(c); return; }
      if(r === 'rv' || r === 'r/v' || r === 'r v' || r === 'rarev' || r === 'rv ') { pools.rare.push(c); return; }
      if(r === 'uv' || r === 'u/v' || r === 'u v' || r.includes('uncommonv') ) { pools.uncommon.push(c); return; }
      if(r === 'cv' || r === 'c/v' || r === 'c v' || r.includes('commonv') ) { pools.common.push(c); return; }

      // TSD special handling: separate tribble cards from non-tribble cards
      if(setCode === 'TSD' && r.includes('starter')) {
        const hasTribble = c['Has Tribble'] === 'true' || c['Has Tribble'] === true;
        if(hasTribble) {
          pools.tribble.push(c);
        } else {
          pools.common.push(c);  // Non-tribble starters treated as commons
        }
        pools.hasStarterCards = true;
        return;
      }
      
      if(r.includes('ultra')) pools.ultra.push(c);
      else if(r.includes('rare plus') || r.includes('rare+')) pools.rarePlus.push(c);
      else if(r === 'rare') pools.rare.push(c);
      else if(r === 'uncommon' || r.includes('uncommon')) pools.uncommon.push(c);
      else if(r === 'common' || r.includes('common')) pools.common.push(c);
      else if(r === 'starter' || r.includes('starter')) {
        // DS9 & VOY: treat starters as uncommons, others: treat as rares
        if(setCode === 'DS9' || setCode === 'VOY') {
          pools.uncommon.push(c);
        } else {
          pools.rare.push(c);
        }
        pools.hasStarterCards = true;
      }
      else if(r.includes('foil')) pools.foil.push(c);
      else if(r.includes('promo')) pools.promo.push(c);
      else {
        // default: treat as common
        pools.common.push(c);
      }
    });
    return pools;
  }

  function sampleWithoutReplacement(pool, n){
    const out = [];
    const copy = pool.slice();
    while(out.length < n && copy.length){
      const idx = Math.floor(Math.random()*copy.length);
      out.push(copy.splice(idx,1)[0]);
    }
    return out;
  }

  function sampleWithReplacement(pool, n){
    const out = [];
    for(let i=0;i<n;i++){
      if(pool.length===0) break;
      out.push(pool[Math.floor(Math.random()*pool.length)]);
    }
    return out;
  }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function generatePackForSet(setCode){
    const s = setsByCode[setCode];
    if(!s) {
      console.error(`Set not found: ${setCode}`);
      return [];
    }
    const meta = metaByName[s.name] || {};
    const pools = groupPools(s.cards, setCode);

    console.log(`Generating pack for ${setCode} (${s.name}):`, {
      totalCards: s.cards.length,
      common: pools.common.length,
      uncommon: pools.uncommon.length,
      rare: pools.rare.length,
      rarePlus: pools.rarePlus.length,
      ultra: pools.ultra.length,
      promo: pools.promo.length
    });

    // Fallbacks: if a set lacks commons/uncommons/rare, promote other pools so packs still generate
    if(pools.common.length === 0){
      // use promo as common replacements
      pools.common = pools.common.concat(pools.promo);
    }
    if(pools.uncommon.length === 0){
      // fall back to commons
      pools.uncommon = pools.uncommon.concat(pools.common);
    }
    if((pools.ultra.length + pools.rarePlus.length + pools.rare.length) === 0){
      // fall back to uncommons or commons for rare slot
      pools.rare = pools.rare.concat(pools.uncommon, pools.common);
    }

    // Special handling for "Where No One Has Gone Before" combined promo set
    // For Decipher: 7 commons drawn from all Decipher sets, and 3 promo cards drawn from Decipher promo pool
    if(setCode === 'WNOHGB'){
      const pack = [];
      // Determine Decipher set short-codes: prefer window.PHYSICAL_SHORT_CODES (Decipher page), else fallback to promoSetCodes
      const decipherCodes = (typeof window !== 'undefined' && Array.isArray(window.PHYSICAL_SHORT_CODES) && window.PHYSICAL_SHORT_CODES.length) ? window.PHYSICAL_SHORT_CODES : promoSetCodes;

      // Build filtered card list for Decipher sets
      const decipherCards = cards.filter(c => {
        const code = (c['Set Code']||c['Set_Code']||c['SetCode']||'').trim();
        return decipherCodes.includes(code) || decipherCodes.includes((c['Set Code']||c['Set_Code']||c['SetCode']||'').toUpperCase());
      });

      // Group pools from Decipher cards
      const decPools = groupPools(decipherCards, setCode);

      // 7 commons from Decipher commons
      const commons = sampleWithoutReplacement(decPools.common, 7);
      if(commons.length < 7) commons.push(...sampleWithReplacement(decPools.common, 7-commons.length));
      pack.push(...commons);

      // 3 promos from Decipher promo pool (fallback to globalPromoPool)
      let promoPool = decPools.promo.length > 0 ? decPools.promo : globalPromoPool;
      const promos = sampleWithoutReplacement(promoPool, 3);
      if(promos.length < 3) promos.push(...sampleWithReplacement(promoPool, 3-promos.length));
      pack.push(...promos);

      return pack;
    }

    // Special handling for Virtual Promos combined set (VPROMO)
    if(setCode === 'VPROMO'){
      const pack = [];
      // Determine virtual short codes list from window (virtual page) if available, else fall back to all sets
      const virtualCodes = (typeof window !== 'undefined' && Array.isArray(window.VIRTUAL_SHORT_CODES) && window.VIRTUAL_SHORT_CODES.length) ? window.VIRTUAL_SHORT_CODES : Object.keys(setsByCode);

      // Build non-promo virtual codes by excluding the explicit promo short codes
      const nonPromoCodes = virtualCodes.filter(c => !virtualPromoSetCodes.includes(c));

      // Collect cards from non-promo virtual sets
      const nonPromoCards = cards.filter(c => {
        const code = (c['Set Code']||c['Set_Code']||c['SetCode']||'').trim();
        return nonPromoCodes.includes(code) || nonPromoCodes.includes(code.toUpperCase());
      });

      const nonPromoPools = groupPools(nonPromoCards, setCode);

      // 7 commons from non-promo virtual commons
      const commons = sampleWithoutReplacement(nonPromoPools.common, 7);
      if(commons.length < 7) commons.push(...sampleWithReplacement(nonPromoPools.common, 7-commons.length));
      pack.push(...commons);

      // 3 promo (PV) cards from the explicit virtual promo pool; detect PV/promo in rarity
      const promoPool = combinedVirtualPromoCards.length > 0 ? combinedVirtualPromoCards.filter(c=>{
        const r = normalizeRarity(c.Rarity||c['Rarity']||'');
        return r.includes('pv') || r.includes('promo') || r.includes('pv ');
      }) : globalPromoPool;
      const promos = sampleWithoutReplacement(promoPool, 3);
      if(promos.length < 3) promos.push(...sampleWithReplacement(promoPool, 3-promos.length));
      pack.push(...promos);

      return pack;
    }

    // Special handling for TSD (Tribbles Starter): 4 non-tribble + 1 tribble = 5 cards
    if(setCode === 'TSD'){
      const pack = [];
      
      // 4 non-tribble cards (treated as commons)
      const nonTribbles = sampleWithoutReplacement(pools.common, 4);
      if(nonTribbles.length < 4) nonTribbles.push(...sampleWithReplacement(pools.common, 4-nonTribbles.length));
      pack.push(...nonTribbles);
      
      // 1 tribble card
      const tribble = sampleWithoutReplacement(pools.tribble, 1);
      if(tribble.length < 1) tribble.push(...sampleWithReplacement(pools.tribble, 1));
      pack.push(...tribble);
      
      return pack;
    }

    // If this set is essentially a promo set (no commons and has promos), create a 15-card promo pack
    if(pools.promo.length > 0 && pools.common.length === 0){
      const pack = [];
      // Build global pools from all cards (for drawing commons, uncommons, rares from other sets)
      const globalPools = groupPools(cards, setCode);
      
      // 11 commons from all sets globally
      const commons = sampleWithoutReplacement(globalPools.common, 11);
      if(commons.length < 11) commons.push(...sampleWithReplacement(globalPools.common, 11-commons.length));
      pack.push(...commons);
      
      // 3 uncommons from all sets globally
      const uncs = sampleWithoutReplacement(globalPools.uncommon, 3);
      if(uncs.length < 3) uncs.push(...sampleWithReplacement(globalPools.uncommon, 3-uncs.length));
      pack.push(...uncs);
      
      // 1 rare/promo from this set's promo pool
      const rare = sampleWithoutReplacement(pools.promo, 1);
      if(rare.length===0) rare.push(...sampleWithoutReplacement(globalPools.rare, 1));
      pack.push(...rare);
      
      return pack;
    }

    // Determine composition
    const hasStarter = pools.hasStarterCards;
    const hasFoilMeta = String(meta.has_foils||'').toLowerCase()==='true';

    let pack = [];
    if(hasStarter){
      // If this is a pure starter set (no commons/uncommons), just pull 15 random cards from the set
      if(pools.common.length === 0 && pools.uncommon.length === 0 && pools.rare.length > 0){
        const starterCards = sampleWithoutReplacement(pools.rare, 15);
        if(starterCards.length < 15) starterCards.push(...sampleWithReplacement(pools.rare, 15-starterCards.length));
        pack.push(...starterCards);
      } else {
        // 11 common, 3 uncommon, 1 rare (starters are now in rare pool)
        // If this starter set has no commons, pull from global pool
        let commonPool = pools.common.length > 0 ? pools.common : groupPools(cards, setCode).common;
        commonPool = filterRecentPulls(setCode, commonPool, 'common');
        const commons = sampleWithoutReplacement(commonPool, 11);
        if(commons.length < 11) commons.push(...sampleWithReplacement(commonPool, 11-commons.length));
        commons.forEach(c => addToRecentPulls(setCode, 'common', c.ID || c.Id || c.id));
        pack.push(...commons);

        // If this starter set has no uncommons, pull from global pool or fallback to commons
        let uncommonPool = pools.uncommon.length > 0 ? pools.uncommon : (groupPools(cards, setCode).uncommon.length > 0 ? groupPools(cards, setCode).uncommon : commonPool);
        uncommonPool = filterRecentPulls(setCode, uncommonPool, 'uncommon');
        const uncs = sampleWithoutReplacement(uncommonPool, 3);
        if(uncs.length < 3) uncs.push(...sampleWithReplacement(uncommonPool, 3-uncs.length));
        uncs.forEach(c => addToRecentPulls(setCode, 'uncommon', c.ID || c.Id || c.id));
        pack.push(...uncs);

        // Rare slot: Ultra Rare 1/121, Rare Plus 1/90, Regular Rare otherwise
        let rareCard;
        const ultraRoll = Math.random();
        if(pools.ultra.length > 0 && ultraRoll < (1/121)) {
          // 1 in 121 chance for Ultra Rare
          const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
          rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
        } else if(pools.rarePlus.length > 0 && ultraRoll < ((1/121) + (1/90))) {
          // 1 in 90 chance for Rare Plus (after ultra rare check)
          const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
          rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
        } else {
          // Regular rare for all other cases
          if(pools.rare.length > 0) {
            const rarePool = filterRecentPulls(setCode, pools.rare, 'rare');
            rareCard = rarePool[Math.floor(Math.random() * rarePool.length)];
          } else if(pools.rarePlus.length > 0) {
            const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
            rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
          } else if(pools.ultra.length > 0) {
            const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
            rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
          } else {
            // fallback
            const fallback = sampleWithoutReplacement(pools.uncommon.concat(pools.common), 1);
            rareCard = fallback[0];
          }
        }
        if(rareCard) {
          addToRecentPulls(setCode, 'rare', rareCard.ID || rareCard.Id || rareCard.id);
          pack.push(rareCard);
        }
      }
    } else {
      // Determine if this set is being opened on the Virtual page
      let isVirtualSet = false;
      try {
        if(typeof window !== 'undefined' && Array.isArray(window.VIRTUAL_SHORT_CODES) && window.VIRTUAL_SHORT_CODES.length){
          const pageVirtual = window.VIRTUAL_SHORT_CODES.map(c=>String(c).trim().toUpperCase());
          const merged = Array.from(new Set(pageVirtual.concat((defaultVirtualShortCodes||[]).map(x=>String(x).trim().toUpperCase()))));
          const meta = metaByName[s.name] || metaByCode[s.code] || {};
          const shortCode = String(meta.short_code || s.code || '').trim().toUpperCase();
          if(merged.includes(shortCode) || merged.includes(String(s.code).toUpperCase())) isVirtualSet = true;
        }
      } catch(e){ /* ignore */ }

      // Special virtual-pack composition: 11 cards -> 8 Commons, 2 Uncommons, 1 Rare
      if(isVirtualSet && setCode !== 'VPROMO'){
        // commons
        let commonPool = filterRecentPulls(setCode, pools.common, 'common');
        const commons = sampleWithoutReplacement(commonPool, 8);
        if(commons.length < 8) commons.push(...sampleWithReplacement(commonPool, 8-commons.length));
        commons.forEach(c => addToRecentPulls(setCode, 'common', c.ID || c.Id || c.id));
        pack.push(...commons);

        // uncommons
        let uncommonPool = filterRecentPulls(setCode, pools.uncommon, 'uncommon');
        const uncs = sampleWithoutReplacement(uncommonPool, 2);
        if(uncs.length < 2) uncs.push(...sampleWithReplacement(uncommonPool, 2-uncs.length));
        uncs.forEach(c => addToRecentPulls(setCode, 'uncommon', c.ID || c.Id || c.id));
        pack.push(...uncs);

        // Rare slot with scaled probabilities from Decipher math (scaled for 11/15)
        let rareCard;
        const scale = 11/15;
        const ultraProb = scale * (1/121);
        const rarePlusProb = scale * (1/90);

        const roll = Math.random();
        if(pools.ultra.length > 0 && roll < ultraProb){
          const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
          rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
        } else if(pools.rarePlus.length > 0 && roll < (ultraProb + rarePlusProb)){
          const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
          rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
        } else {
          if(pools.rare.length > 0) {
            const rarePool = filterRecentPulls(setCode, pools.rare, 'rare');
            rareCard = rarePool[Math.floor(Math.random() * rarePool.length)];
          } else if(pools.rarePlus.length > 0) {
            const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
            rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
          } else if(pools.ultra.length > 0) {
            const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
            rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
          } else {
            const fallback = sampleWithoutReplacement(pools.uncommon.concat(pools.common), 1);
            rareCard = fallback[0];
          }
        }
        if(rareCard){ addToRecentPulls(setCode, 'rare', rareCard.ID || rareCard.Id || rareCard.id); pack.push(rareCard); }
      } else {
        // standard 11C,3U,1R
        let commonPool = filterRecentPulls(setCode, pools.common, 'common');
        const commons = sampleWithoutReplacement(commonPool, 11);
        if(commons.length < 11) commons.push(...sampleWithReplacement(commonPool, 11-commons.length));
        commons.forEach(c => addToRecentPulls(setCode, 'common', c.ID || c.Id || c.id));
        pack.push(...commons);

        let uncommonPool = filterRecentPulls(setCode, pools.uncommon, 'uncommon');
        const uncs = sampleWithoutReplacement(uncommonPool, 3);
        if(uncs.length < 3) uncs.push(...sampleWithReplacement(uncommonPool, 3-uncs.length));
        uncs.forEach(c => addToRecentPulls(setCode, 'uncommon', c.ID || c.Id || c.id));
        pack.push(...uncs);

        // Rare slot: BOG foils (10% chance replacing rare), Ultra Rare 1/121, Rare Plus 1/90, Regular Rare otherwise
        let rareCard;
        
        // BOG special handling: 10% chance for foil replacing rare slot
        if(setCode === 'BOG' && pools.foil.length > 0 && Math.random() < 0.1) {
          rareCard = pools.foil[Math.floor(Math.random() * pools.foil.length)];
        } else {
          const ultraRoll = Math.random();
          if(pools.ultra.length > 0 && ultraRoll < (1/121)) {
            // 1 in 121 chance for Ultra Rare
            const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
            rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
          } else if(pools.rarePlus.length > 0 && ultraRoll < ((1/121) + (1/90))) {
            // 1 in 90 chance for Rare Plus (after ultra rare check)
            const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
            rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
          } else {
            // Regular rare for all other cases
            if(pools.rare.length > 0) {
              const rarePool = filterRecentPulls(setCode, pools.rare, 'rare');
              rareCard = rarePool[Math.floor(Math.random() * rarePool.length)];
            } else if(pools.rarePlus.length > 0) {
              const rarePlusPool = filterRecentPulls(setCode, pools.rarePlus, 'rare');
              rareCard = rarePlusPool[Math.floor(Math.random() * rarePlusPool.length)];
            } else if(pools.ultra.length > 0) {
              const ultraPool = filterRecentPulls(setCode, pools.ultra, 'rare');
              rareCard = ultraPool[Math.floor(Math.random() * ultraPool.length)];
            } else {
              // fallback
              const fallback = sampleWithoutReplacement(pools.uncommon.concat(pools.common), 1);
              rareCard = fallback[0];
            }
          }
        }
        if(rareCard) {
          addToRecentPulls(setCode, 'rare', rareCard.ID || rareCard.Id || rareCard.id);
          pack.push(rareCard);
        }
      }
    }

    // Foil / Rare+ replacement: for non-BOG sets with foils or RarePlus pool, ~1 every 5 packs replaces common
    if(setCode !== 'BOG') {
      const replacementPool = pools.foil.concat(pools.rarePlus);
      const replacementChance = 1/5;
      if(replacementPool.length && Math.random() < replacementChance){
        // pick a random common index to replace
        const commonIndexes = [];
        for(let i=0;i<pack.length;i++){
          const r = normalizeRarity(pack[i].Rarity||pack[i]['Rarity']||'');
          if(r.includes('common') || r.includes('starter')) commonIndexes.push(i);
        }
        if(commonIndexes.length){
          const replaceAt = commonIndexes[Math.floor(Math.random()*commonIndexes.length)];
          const replacement = replacementPool[Math.floor(Math.random()*replacementPool.length)];
          pack[replaceAt] = replacement;
        }
      }
    }

    // Order pack: commons, uncommons, rare, then extras (UR, Rare Plus, Promo, Starter, Foil)
    const commonsArr = [];
    const uncommonsArr = [];
    const rareArr = [];
    const extrasArr = [];
    pack.forEach(card => {
      const r = normalizeRarity(card.Rarity||card['Rarity']||'');
      if(r.includes('common') && !r.includes('starter')) commonsArr.push(card);
      else if(r.includes('uncommon')) uncommonsArr.push(card);
      else if(r === 'rare') rareArr.push(card);
      else extrasArr.push(card); // ultra, rare plus, promo, starter, foil, etc.
    });
    return commonsArr.concat(uncommonsArr, rareArr, extrasArr);
  }

  function renderPacks(packs, setCode){
    const container = document.getElementById('pack-container');
    // Clear previous packs
    container.innerHTML = '';
    // Check collection before rendering to detect new cards
    const col = loadCollection();
    
    packs.forEach((pack,i)=>{
      // Track which cards are new before adding to collection
      const newCards = new Set();
      pack.forEach(c=>{
        const id = c.ID || c.Id || c.id;
        if(id && !col[id]){
          newCards.add(id);
        }
      });
      
      // Don't auto-add pack to collection - wait for flip
      // addPackToCollection(pack);
      
      const packEl = document.createElement('div');
      packEl.className='pack';
      const header = document.createElement('div'); header.className='pack-header';
      header.innerHTML = `<div class="muted">Pack ${i+1}</div><div class="muted">${pack.length} cards</div><div><button class="flip-all-btn">Flip All</button></div>`;
      packEl.appendChild(header);
      const grid = document.createElement('div'); grid.className='pack-grid';
      pack.forEach((c, idx)=>{
        const cardEl = document.createElement('div'); cardEl.className='card';

        // inner flippable container
        const inner = document.createElement('div'); inner.className = 'card-inner';

        // front: image or placeholder
        const front = document.createElement('div'); front.className = 'card-front';
        const img = document.createElement('img'); img.src = c['File Name'] || c['FileName'] || '';
        img.alt = c.Name || c['Name'] || '';
        img.onerror = function(){
          // Try common fallback patterns for known mismatches
          const tries = [];
          const original = this.src || '';
          // Extension fallbacks
          if(original.endsWith('.jpeg')) tries.push(original.replace('.jpeg','.jpg'));
          if(original.endsWith('.jpg')) tries.push(original.replace('.jpg','.jpeg'));
          if(original.endsWith('.jpeg')) tries.push(original.replace('.jpeg','.png'));
          // Folder code mismatch: some Starter Deck 2 images are stored under SD2
          if(original.includes('/STD/')){
            // Try folder swap STD → SD2
            tries.push(original.replace('/STD/','/SD2/'));
            // Also try filename swap STD-### → SD2-###
            const stdMatch = original.match(/STD\/(STD-(\d+))/);
            if(stdMatch && stdMatch[2]){
              const num = stdMatch[2];
              tries.push(original.replace('images/STD/STD-'+num, 'images/SD2/SD2-'+num));
            }
          }
          // Attempt replacements sequentially
          for(let i=0;i<tries.length;i++){
            if(tries[i] && tries[i] !== this.src){ this.onerror = null; this.src = tries[i]; return; }
          }
            // Try removing known suffixes like -ai, -trib before extension swap
            const suffixes = ['-ai', '-trib'];
            for(const suf of suffixes){
              if(original.includes(suf + '.')){
                const base = original.replace(suf, '');
                tries.push(base);
                if(base.endsWith('.jpeg')){
                  tries.push(base.replace('.jpeg','.jpg'));
                  tries.push(base.replace('.jpeg','.png'));
                }
              }
            }
          // Final fallback: show text placeholder
          this.style.display = 'none';
          if(!front.querySelector('.card-noimg')){
            const ph = document.createElement('div'); ph.className='card-noimg'; ph.textContent = c.Name || c['Name'] || '';
            front.appendChild(ph);
          }
        };
        front.appendChild(img);

        // back: use an <img> so the whole portrait is shown and not cropped; no text overlay
        const back = document.createElement('div'); back.className = 'card-back';
        const backImg = document.createElement('img');
        backImg.alt = 'Card back';
        // prefer common capitalizations/names that might exist in the images folder
        backImg.src = 'images/Startrekccg.png';
        backImg.onerror = function(){
          // try a few fallback filenames
          const tries = ['images/startrekccg.png','images/card-back.png','images/card-back.svg'];
          for(let i=0;i<tries.length;i++){
            if(tries[i] && tries[i] !== this.src){ this.src = tries[i]; return; }
          }
          // nothing found: hide the element (CSS will show a subtle background)
          this.style.display = 'none';
        };
        back.appendChild(backImg);

        inner.appendChild(front);
        inner.appendChild(back);

        // flip on click - add card to collection when flipped
        inner.dataset.index = idx;
        inner.addEventListener('click', ()=> {
          inner.classList.toggle('is-flipped');
          // Add card to collection on first flip
          if(inner.classList.contains('is-flipped') && !inner.dataset.addedToCollection){
            inner.dataset.addedToCollection = 'true';
            addCardToCollection(c);
          }
        });

        const name = document.createElement('div'); name.className='name';
        const cardId = c.ID || c.Id || c.id;
        const isNew = cardId && newCards.has(cardId);
        
        if(isNew){
          const newBadge = document.createElement('span');
          newBadge.className = 'new-badge';
          newBadge.textContent = 'NEW!';
          name.appendChild(newBadge);
          name.appendChild(document.createTextNode(' ' + (c.Name || c['Name'] || '')));
        } else {
          name.textContent = c.Name || c['Name'] || '';
        }

        // Rarity code inline under the card title (e.g., C, U, R, UR, CV, RV)
        const rarityCodeText = getRarityCode(c.Rarity || c['Rarity'] || '');
        if(rarityCodeText){
          const rc = document.createElement('div');
          rc.className = 'rarity-code-inline';
          rc.textContent = rarityCodeText;
          name.appendChild(rc);
        }
        
        // Add set name for combined packs (e.g., WNOHGB, VPROMO)
        let setInfo = null;
        if(setCode === 'WNOHGB' || setCode === 'VPROMO'){
          setInfo = document.createElement('div');
          setInfo.className = 'set-info';
          setInfo.textContent = c['Set Name'] || c['SetName'] || '';
        }
        
        const rarity = document.createElement('div'); rarity.className='rarity'; rarity.textContent = c.Rarity || c['Rarity'] || '';
        cardEl.appendChild(inner); 
        cardEl.appendChild(name); 
        if(setInfo) cardEl.appendChild(setInfo);
        cardEl.appendChild(rarity);
        grid.appendChild(cardEl);
      });
        // Wire up Flip All button to flip every card in this pack
        const flipBtn = header.querySelector('.flip-all-btn');
        if(flipBtn){
          flipBtn.addEventListener('click', ()=>{
            const inners = grid.querySelectorAll('.card .card-inner');
            inners.forEach(inner => {
              if(!inner.classList.contains('is-flipped')){
                inner.classList.add('is-flipped');
              }
              if(!inner.dataset.addedToCollection){
                inner.dataset.addedToCollection = 'true';
                const idx = parseInt(inner.dataset.index,10);
                const cardObj = pack[idx];
                if(cardObj) addCardToCollection(cardObj);
              }
            });
          });
        }
      packEl.appendChild(grid);
      container.appendChild(packEl);
    });
  }

  // Recent pulls tracking (to avoid duplicates like real pack collation)
  // Per-set tracking to match actual print sheet layouts
  let recentPulls = {}; // {setCode: {common: [], uncommon: [], rare: []}}
  
  // Collation settings per set (how many recent cards to avoid)
  const collationSettings = {
    'PRE': {common: 20, uncommon: 15, rare: 10},  // Premiere - locked
    'QCM': {common: 20, uncommon: 15, rare: 10},  // Q Continuum - locked
    'FCO': {common: 20, uncommon: 15, rare: 10},  // First Contact - locked
    'DS9': {common: 20, uncommon: 15, rare: 10},  // Deep Space Nine - locked
    'BOG': {common: 20, uncommon: 15, rare: 10},  // Blaze of Glory - locked
    'ROA': {common: 20, uncommon: 15, rare: 10},  // Rules of Acquisition - locked
    'VOY': {common: 20, uncommon: 15, rare: 10},  // Voyager - locked
    'default': {common: 10, uncommon: 7, rare: 5}  // Other sets - can be adjusted
  };

  function getCollationSettings(setCode) {
    return collationSettings[setCode] || collationSettings['default'];
  }

  function addToRecentPulls(setCode, rarity, cardId) {
    if (!recentPulls[setCode]) recentPulls[setCode] = {common: [], uncommon: [], rare: []};
    const rarityKey = rarity.toLowerCase();
    if (!recentPulls[setCode][rarityKey]) recentPulls[setCode][rarityKey] = [];
    recentPulls[setCode][rarityKey].unshift(cardId);
    
    const maxPulls = getCollationSettings(setCode)[rarityKey];
    if (recentPulls[setCode][rarityKey].length > maxPulls) {
      recentPulls[setCode][rarityKey].pop();
    }
  }

  function filterRecentPulls(setCode, pool, rarity) {
    if (!recentPulls[setCode]) return pool;
    const rarityKey = rarity.toLowerCase();
    if (!recentPulls[setCode][rarityKey] || recentPulls[setCode][rarityKey].length === 0) return pool;
    
    // Filter out recently pulled cards
    const filtered = pool.filter(c => {
      const id = c.ID || c.Id || c.id;
      return !recentPulls[setCode][rarityKey].includes(id);
    });
    
    // If we filtered out everything, use the full pool (no choice)
    return filtered.length > 0 ? filtered : pool;
  }

  // Collection helpers (localStorage)
  function loadCollection(){
    try{ return JSON.parse(localStorage.getItem('stccg_collection')||'{}'); }catch(e){return{}}}
  function saveCollection(col){ localStorage.setItem('stccg_collection', JSON.stringify(col)); }
  
  function loadPackStats(){
    try{ return JSON.parse(localStorage.getItem('stccg_pack_stats')||'{}'); }catch(e){return{}}}
  function savePackStats(stats){ localStorage.setItem('stccg_pack_stats', JSON.stringify(stats)); }
  
  function loadCompletedRarities(){
    try{ return JSON.parse(localStorage.getItem('stccg_completed_rarities')||'[]'); }catch(e){return[]}}
  function saveCompletedRarities(list){ localStorage.setItem('stccg_completed_rarities', JSON.stringify(list)); }
  
  function incrementPackOpens(setCode){
    const stats = loadPackStats();
    if(!stats[setCode]) stats[setCode] = 0;
    stats[setCode]++;
    savePackStats(stats);
    console.log('Pack opened for', setCode, '- Total:', stats[setCode]);
  }
  
  function loadUnlockedAchievements(){
    try{ return JSON.parse(localStorage.getItem('stccg_achievements')||'[]'); }catch(e){return[]}
  }
  function saveUnlockedAchievements(list){
    localStorage.setItem('stccg_achievements', JSON.stringify(list));
  }

  async function checkAchievements(collection){
    try {
      const response = await fetch('achievements.json?v=' + Date.now());
      const data = await response.json();
      const achievements = data.achievements || [];
      const unlocked = loadUnlockedAchievements();
      const newUnlocks = [];

      achievements.forEach(achievement => {
        // Skip if already unlocked
        if(unlocked.includes(achievement.id)) return;
        
        // Check if all required cards are in collection
        const isComplete = achievement.required_cards.every(cardId => {
          return collection[cardId] && collection[cardId].count > 0;
        });

        if(isComplete){
          unlocked.push(achievement.id);
          newUnlocks.push(achievement);
        }
      });

      if(newUnlocks.length > 0){
        saveUnlockedAchievements(unlocked);
        // Show toast notification for first achievement
        showAchievementToast(newUnlocks[0]);
      }
    } catch(e){
      console.log('Achievement check skipped:', e.message);
    }
  }

  function showAchievementToast(achievement){
    // Create toast if it doesn't exist
    let toast = document.getElementById('achievement-toast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'achievement-toast';
      toast.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        background: linear-gradient(135deg, #0b1a2a, #0f2847);
        color: #f8fafc;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        border: 2px solid #0ea5e9;
        font-family: 'Futura', sans-serif;
        z-index: 4000;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.4s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
      `;
      document.body.appendChild(toast);
    }

    const badge = achievement.badge || '🏆';
    const badgeHtml = (badge.endsWith('.png') || badge.endsWith('.jpg') || badge.endsWith('.jpeg') || badge.endsWith('.webp'))
      ? `<img src="${badge}" style="width: 48px; height: 48px; object-fit: contain;">`
      : `<div style="font-size: 2rem;">${badge}</div>`;

    toast.innerHTML = `
      ${badgeHtml}
      <div style="flex: 1;">
        <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 4px;">🎉 Achievement Unlocked!</div>
        <div style="font-size: 1.1rem; color: #f8fafc;">${achievement.title}</div>
      </div>
    `;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(400px)';
    }, 4000);
  }

  function checkRarityCompletion(collection, pack){
    // Get the set code from the first card in the pack
    if(!pack || pack.length === 0) return;
    
    const firstCard = pack[0];
    const setCode = (firstCard['Set Code'] || firstCard['SetCode'] || firstCard['Set_Code'] || '').trim();
    if(!setCode) return;
    
    const setData = setsByCode[setCode];
    if(!setData) return;
    
    // Group cards by rarity
    const setCardsByRarity = {
      common: [],
      uncommon: [],
      rare: [],
      'rare plus': [],
      'ultra rare': []
    };
    
    setData.cards.forEach(c => {
      const id = c.ID || c.Id || c.id;
      if(!id) return;
      const r = normalizeRarity(c.Rarity || c['Rarity'] || '');
      if(r.includes('ultra')) setCardsByRarity['ultra rare'].push(id);
      else if(r.includes('rare plus') || r.includes('rare+')) setCardsByRarity['rare plus'].push(id);
      else if(r === 'rare') setCardsByRarity.rare.push(id);
      else if(r.includes('uncommon')) setCardsByRarity.uncommon.push(id);
      else if(r.includes('common')) setCardsByRarity.common.push(id);
    });
    
    // Check each rarity for completion
    const completions = [];
    Object.keys(setCardsByRarity).forEach(rarity => {
      const rarityCards = setCardsByRarity[rarity];
      if(rarityCards.length === 0) return; // Skip if set has no cards of this rarity
      
      const allCollected = rarityCards.every(cardId => {
        return collection[cardId] && collection[cardId].count > 0;
      });
      
      if(allCollected){
        completions.push({
          setCode,
          setName: setData.name,
          rarity,
          cardCount: rarityCards.length
        });
      }
    });
    
    return completions;
  }
  
  function showRarityCompletionToast(completion){
    // Create toast container
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 16px;
      background: linear-gradient(135deg, #1e293b, #334155);
      color: #f1f5f9;
      padding: 20px 24px;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      border: 3px solid #22c55e;
      font-family: 'Futura', sans-serif;
      z-index: 4001;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.4s ease;
      min-width: 320px;
      max-width: 400px;
    `;
    
    const rarityDisplay = completion.rarity.charAt(0).toUpperCase() + completion.rarity.slice(1);
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 2.5rem;">✨</div>
        <div style="flex: 1;">
          <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 4px;">🎊 Set Completed!</div>
          <div style="font-size: 1.15rem; font-weight: bold; color: #22c55e; margin-bottom: 4px;">${completion.setName}</div>
          <div style="font-size: 0.95rem; color: #cbd5e1;">
            All ${completion.cardCount} ${rarityDisplay} cards collected!
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }

  function addCardToCollection(c){
    const col = loadCollection();
    const id = c.ID || c.Id || c.id;
    if(!id) return;
    if(!col[id]) col[id] = {collected:true, count:0, card:{ID:id,Name:c.Name,Set:c['Set Code']}};
    col[id].count = (col[id].count||0)+1;
    col[id].collected = true;
    saveCollection(col);
    
    // Check for rarity completion for just this card
    const completions = checkRarityCompletion(col, [c]);
    if(completions && completions.length > 0){
      const alreadyCompleted = loadCompletedRarities();
      const newCompletions = [];
      
      completions.forEach(completion => {
        const key = `${completion.setCode}:${completion.rarity}`;
        if(!alreadyCompleted.includes(key)){
          newCompletions.push(completion);
          alreadyCompleted.push(key);
        }
      });
      
      if(newCompletions.length > 0){
        saveCompletedRarities(alreadyCompleted);
        // Show notification for each newly completed rarity
        newCompletions.forEach(completion => {
          showRarityCompletionToast(completion);
        });
      }
    }
  }

  function addPackToCollection(pack){
    const col = loadCollection();
    pack.forEach(c=>{
      const id = c.ID || c.Id || c.id;
      if(!id) return;
      if(!col[id]) col[id] = {collected:true, count:0, card:{ID:id,Name:c.Name,Set:c['Set Code']}};
      col[id].count = (col[id].count||0)+1;
      col[id].collected = true;
    });
    saveCollection(col);
    
    // Check for rarity completions
    const completions = checkRarityCompletion(col, pack);
    if(completions && completions.length > 0){
      const alreadyCompleted = loadCompletedRarities();
      const newCompletions = [];
      
      completions.forEach(completion => {
        const key = `${completion.setCode}:${completion.rarity}`;
        if(!alreadyCompleted.includes(key)){
          newCompletions.push(completion);
          alreadyCompleted.push(key);
        }
      });
      
      if(newCompletions.length > 0){
        saveCompletedRarities(alreadyCompleted);
        // Show notification for each newly completed rarity
        newCompletions.forEach((completion, index) => {
          setTimeout(() => showRarityCompletionToast(completion), index * 500);
        });
      }
    }
    
    // Check for achievement unlocks
    checkAchievements(col);
    console.log('Added pack to collection, total tracked items:', Object.keys(col).length);
  }

  document.getElementById('clear').addEventListener('click', ()=>{
    document.getElementById('pack-container').innerHTML='';
  });

  // Button to mark Enterprise-D Senior Staff complete and add cards to local collection
  const markBtn = document.getElementById('mark-enterprise-d');
  if(markBtn){
    markBtn.addEventListener('click', ()=>{
      const achievementId = 'enterprise_d_senior_staff';
      const required = ['PRE-334','PRE-215','PRE-250','PRE-204','PRE-212','PRE-251','PRE-200','PRE-205','PRE-249'];
      const ts = Date.now();
      try{
        const colKey = 'stccg_collection';
        const achKey = 'stccg_achievements';
        const col = localStorage.getItem(colKey);
        const ach = localStorage.getItem(achKey);
        if(col !== null) localStorage.setItem(colKey + '_backup_enterprise_d_' + ts, col);
        if(ach !== null) localStorage.setItem(achKey + '_backup_enterprise_d_' + ts, ach);

        let collection = {};
        try{ collection = JSON.parse(localStorage.getItem(colKey) || '{}'); }catch(e){ collection = {}; }

        required.forEach(id => {
          if(!collection[id]) collection[id] = { collected: true, count: 1, card: { ID: id } };
          else { collection[id].collected = true; collection[id].count = Math.max(1, (collection[id].count||0)); }
        });
        localStorage.setItem(colKey, JSON.stringify(collection));

        let unlocked = [];
        try{ unlocked = JSON.parse(localStorage.getItem(achKey) || '[]'); }catch(e){ unlocked = []; }
        if(!unlocked.includes(achievementId)) unlocked.push(achievementId);
        localStorage.setItem(achKey, JSON.stringify(unlocked));

        alert('Enterprise-D Senior Staff marked complete and cards added to collection. Backups created in localStorage.');
      }catch(err){ console.error('Error marking achievement:', err); alert('Failed to mark achievement — see console for details.'); }
    });
  }
})();
