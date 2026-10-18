const CANONICAL_SERVICES = [
  {
    slug: 'masaz-klasyczny',
    title: 'Masaż klasyczny',
    img: '/services-img/1.webp',
    desc: 'Masaż klasyczny to sprawdzona metoda relaksu i regeneracji. Łagodzi napięcia, poprawia krążenie i rozluźnia mięśnie, dopasowując się do Twoich potrzeb.',
    seoTitle: 'Masaż klasyczny — NUAR Warszawa | Masaż premium',
    seoDescription: 'Masaż klasyczny to sprawdzona metoda relaksu i regeneracji. Łagodzi napięcia, poprawia krążenie i rozluźnia mięśnie, dopasowując się do Twoich potrzeb. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [5], topMaster: [6] },
    matchKeywords: ['klasyczn'],
  },
  {
    slug: 'masaz-sportowy',
    title: 'Masaż sportowy',
    img: '/services-img/2.webp',
    desc: 'Intensywny masaż wspierający regenerację po wysiłku. Zmniejsza napięcia mięśni, poprawia elastyczność i pomaga zapobiegać kontuzjom.',
    seoTitle: 'Masaż sportowy — NUAR Warszawa | Masaż premium',
    seoDescription: 'Intensywny masaż wspierający regenerację po wysiłku. Zmniejsza napięcia mięśni, poprawia elastyczność i pomaga zapobiegać kontuzjom. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [7], topMaster: [] },
    matchKeywords: ['sportow'],
  },
  {
    slug: 'masaz-relaksacyjny',
    title: 'Masaż relaksacyjny',
    img: '/services-img/3.webp',
    desc: 'Delikatny masaż, który redukuje stres i napięcie. Płynne, rytmiczne ruchy wprowadzają ciało i umysł w stan głębokiego odprężenia.',
    seoTitle: 'Masaż relaksacyjny — NUAR Warszawa | Masaż premium',
    seoDescription: 'Delikatny masaż, który redukuje stres i napięcie. Płynne, rytmiczne ruchy wprowadzają ciało i umysł w stan głębokiego odprężenia. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [4], topMaster: [17] },
    matchKeywords: ['relaksacyjn'],
  },
  {
    slug: 'masaz-limfatyczny',
    title: 'Masaż limfatyczny',
    img: '/services-img/4.webp',
    desc: 'Terapia wspierająca układ limfatyczny. Pomaga redukować obrzęki, poprawia przepływ limfy i wspomaga proces detoksykacji organizmu.',
    seoTitle: 'Masaż limfatyczny — NUAR Warszawa | Masaż premium',
    seoDescription: 'Terapia wspierająca układ limfatyczny. Pomaga redukować obrzęki, poprawia przepływ limfy i wspomaga proces detoksykacji organizmu. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [11], topMaster: [18] },
    matchKeywords: ['limfat'],
  },
  {
    slug: 'masaz-antycellulitowy',
    title: 'Masaż antycellulitowy',
    img: '/services-img/5.webp',
    desc: 'Zabieg ujędrniający skórę i poprawiający krążenie. Skutecznie wspiera walkę z cellulitem i przywraca skórze gładkość i elastyczność.',
    seoTitle: 'Masaż antycellulitowy — NUAR Warszawa | Masaż premium',
    seoDescription: 'Zabieg ujędrniający skórę i poprawiający krążenie. Skutecznie wspiera walkę z cellulitem i przywraca skórze gładkość i elastyczność. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [2], topMaster: [9, 19] },
    matchKeywords: ['antycellulit'],
  },
  {
    slug: 'masaz-twarzy-i-glowy',
    title: 'Masaż twarzy i głowy',
    img: '/services-img/6.webp',
    desc: 'Relaksujący masaż łagodzący napięcia w okolicy głowy i twarzy. Poprawia krążenie, zmniejsza stres i wspiera ogólne samopoczucie.',
    seoTitle: 'Masaż twarzy i głowy — NUAR Warszawa | Masaż premium',
    seoDescription: 'Relaksujący masaż łagodzący napięcia w okolicy głowy i twarzy. Poprawia krążenie, zmniejsza stres i wspiera ogólne samopoczucie. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [], topMaster: [20] },
    matchKeywords: ['twarz', 'лиц'],
  },
  {
    slug: 'masaz-autorski',
    title: 'Masaż autorski',
    img: '/services-img/7.webp',
    desc: 'Indywidualnie dopasowany masaż, łączący techniki klasyczne, relaksacyjne i sportowe. Idealny dla głębokiego relaksu i regeneracji.',
    seoTitle: 'Masaż autorski — NUAR Warszawa | Masaż premium',
    seoDescription: 'Indywidualnie dopasowany masaż, łączący techniki klasyczne, relaksacyjne i sportowe. Idealny dla głębokiego relaksu i regeneracji. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [10], topMaster: [10] },
    matchKeywords: ['autorsk'],
  },
  {
    slug: 'masaz-dla-dwojga',
    title: 'Masaż dla dwojga',
    img: '/services-img/8.webp',
    desc: 'Wyjątkowy rytuał relaksu we dwoje w nastrojowej atmosferze naszego salonu.',
    seoTitle: 'Masaż dla dwojga — NUAR Warszawa | Masaż premium',
    seoDescription: 'Wyjątkowy rytuał relaksu we dwoje w nastrojowej atmosferze нашего salonu. Zarezerwuj online w centrum Warszawy, ul. Świętojerska 5/7.',
    crmIds: { master: [14], topMaster: [14] },
    matchKeywords: ['dwojga', 'dla 2', 'пары'],
  },
];

const STANDARD_TOP_MASTER_PRICES = {
  60: 310,
  75: 350,
  90: 370,
  120: 470,
};

const extractVariantsMap = (servicesList, ids, keywords, isTopTier) => {
  const map = {};
  const matched = servicesList.filter((s) => {
    if (ids.includes(s.id)) return true;
    const name = String(s.name || '').toLowerCase();
    const hasKeyword = keywords.some((k) => name.includes(k));
    if (!hasKeyword) return false;
    const isTop = /top[- ]?master/i.test(name) || /top/i.test(String(s.category || ''));
    return isTopTier ? isTop : !isTop;
  });

  matched.forEach((s) => {
    const variants = Array.isArray(s.variants) ? s.variants : [];
    variants.forEach((v) => {
      const dur = Number(v?.duration);
      const pr = Number(v?.price);
      if (dur > 0 && pr > 0) {
        map[dur] = pr;
      }
    });
  });

  return map;
};

const buildPublicServicesCatalog = (crmServices = [], existingOverridesServices = []) => {
  const activeServices = crmServices.filter(
    (s) => s.status !== 'Архив' && s.siteVisible !== false,
  );

  const existingMap = new Map();
  if (Array.isArray(existingOverridesServices)) {
    existingOverridesServices.forEach((s) => {
      if (s?.slug) existingMap.set(s.slug, s);
    });
  }

  return CANONICAL_SERVICES.map((canon) => {
    const existing = existingMap.get(canon.slug);
    const masterMap = extractVariantsMap(activeServices, canon.crmIds.master, canon.matchKeywords, false);
    let topMap = extractVariantsMap(activeServices, canon.crmIds.topMaster, canon.matchKeywords, true);

    // If topMaster tier has no specific service, for core body massages fallback to standard top-master prices
    if (Object.keys(topMap).length === 0) {
      if (['masaz-sportowy', 'masaz-klasyczny', 'masaz-relaksacyjny', 'masaz-limfatyczny', 'masaz-antycellulitowy'].includes(canon.slug)) {
        topMap = { ...STANDARD_TOP_MASTER_PRICES };
      } else {
        topMap = { ...masterMap };
      }
    }

    // If master tier has no specific service (e.g. specialized top-master only), use topMap
    if (Object.keys(masterMap).length === 0) {
      Object.assign(masterMap, topMap);
    }

    const allDurations = Array.from(
      new Set([
        ...Object.keys(masterMap).map(Number),
        ...Object.keys(topMap).map(Number),
      ]),
    ).sort((a, b) => a - b);

    const price = allDurations.map((d) => masterMap[d] ?? topMap[d] ?? 0);
    const priceTopMaster = allDurations.map((d) => topMap[d] ?? masterMap[d] ?? 0);

    return {
      title: existing?.title || canon.title,
      slug: canon.slug,
      img: existing?.img || canon.img,
      desc: existing?.desc || canon.desc,
      seoTitle: existing?.seoTitle || canon.seoTitle,
      seoDescription: existing?.seoDescription || canon.seoDescription,
      discount: 0,
      time: allDurations.length ? allDurations : [60],
      price: price.length ? price : [200],
      priceTopMaster: priceTopMaster.length ? priceTopMaster : [310],
      prices: {
        master: masterMap,
        topMaster: topMap,
      },
    };
  });
};

module.exports = {
  CANONICAL_SERVICES,
  STANDARD_TOP_MASTER_PRICES,
  buildPublicServicesCatalog,
};
