const path = require('path');

const DESIGN_VERSION = '2026-07-14-royalty-gold-v1';

const ASSET_FILES = {
  diamond: 'diamond.jpg',
  gold: 'gold.jpg',
  member: 'member.jpg',
  royal: 'royal.jpg',
  silver: 'silver.jpg',
};

const ASSET_DIR = path.resolve(__dirname, '../../src/assets/club-cards');

const FALLBACK_BACKGROUNDS = {
  MEMBER:
    'linear-gradient(112deg, transparent 0%, rgba(255,255,255,.08) 42%, transparent 54%), radial-gradient(circle at 82% 18%, rgba(212,189,130,.2), transparent 28%), linear-gradient(135deg, #090a0b, #303232 48%, #111 100%)',
  SILVER:
    'linear-gradient(102deg, rgba(255,255,255,.08) 0%, transparent 18%, rgba(255,255,255,.32) 42%, transparent 54%, rgba(255,255,255,.1) 100%), radial-gradient(circle at 82% 18%, rgba(220,227,238,.26), transparent 30%), linear-gradient(135deg, #0c0f12, #8a939c 40%, #333b43 62%, #101317)',
  GOLD:
    'linear-gradient(110deg, rgba(255,236,178,.08) 0%, transparent 20%, rgba(255,225,139,.34) 43%, transparent 56%, rgba(164,111,36,.22) 100%), radial-gradient(circle at 80% 18%, rgba(241,206,123,.3), transparent 30%), linear-gradient(135deg, #170c04, #9b6f2f 42%, #4a2a0e 64%, #090604)',
  DIAMOND:
    'radial-gradient(ellipse at 28% 24%, rgba(255,255,255,.18), transparent 18%), radial-gradient(ellipse at 78% 72%, rgba(166,220,255,.16), transparent 22%), radial-gradient(circle at 50% 46%, rgba(204,235,255,.18), transparent 34%), linear-gradient(122deg, transparent 0%, rgba(255,255,255,.26) 34%, transparent 46%, rgba(166,220,255,.18) 70%, transparent 100%), linear-gradient(135deg, #02060c, #31485a 45%, #122334 68%, #05070d)',
  ROYAL:
    'radial-gradient(circle at 50% 46%, rgba(42,32,74,.6), transparent 34%), radial-gradient(circle at 76% 12%, rgba(215,164,109,.08), transparent 28%), radial-gradient(circle at 12% 88%, rgba(83,35,96,.2), transparent 34%), linear-gradient(135deg, #070414, #151027 46%, #0b0718 74%, #03020a)',
};

const TIERS = {
  MEMBER: {
    accent: '#d4bd82',
    badge: 'MEMBER',
    backgroundFile: ASSET_FILES.member,
    fallbackBackground: FALLBACK_BACKGROUNDS.MEMBER,
    inkGradient:
      'linear-gradient(92deg, rgba(255,243,204,.92), rgba(212,189,130,.9) 42%, rgba(165,128,64,.88) 74%, rgba(255,230,156,.78))',
    label: 'NUAR MEMBER',
    shine: {
      color: 'rgba(212,189,130,.18)',
      duration: '8.5s',
      rotate: '14deg',
    },
    text: '#f5f0e6',
  },
  SILVER: {
    accent: '#dce4ef',
    badge: 'SILVER',
    backgroundFile: ASSET_FILES.silver,
    fallbackBackground: FALLBACK_BACKGROUNDS.SILVER,
    inkGradient:
      'linear-gradient(94deg, rgba(255,255,255,.92), rgba(214,223,235,.76) 46%, rgba(134,148,164,.82) 74%, rgba(246,249,255,.76))',
    label: 'NUAR SILVER',
    shine: {
      color: 'rgba(225,235,245,.2)',
      duration: '7.6s',
      rotate: '-14deg',
    },
    text: '#f6f8fb',
  },
  GOLD: {
    accent: '#e7bd62',
    badge: 'GOLD',
    backgroundFile: ASSET_FILES.gold,
    fallbackBackground: FALLBACK_BACKGROUNDS.GOLD,
    inkGradient:
      'linear-gradient(92deg, rgba(255,241,189,.98), rgba(255,213,112,.82) 42%, rgba(161,99,24,.84) 74%, rgba(255,229,146,.88))',
    label: 'NUAR GOLD',
    shine: {
      color: 'rgba(255,205,90,.22)',
      duration: '8.2s',
      rotate: '9deg',
    },
    text: '#fff5dc',
  },
  DIAMOND: {
    accent: '#90d6ff',
    badge: 'DIAMOND',
    backgroundFile: ASSET_FILES.diamond,
    fallbackBackground: FALLBACK_BACKGROUNDS.DIAMOND,
    inkGradient:
      'linear-gradient(94deg, rgba(255,255,255,.94), rgba(204,233,255,.72) 44%, rgba(101,164,210,.82) 72%, rgba(239,249,255,.82))',
    label: 'NUAR DIAMOND',
    shine: {
      color: 'rgba(170,225,255,.24)',
      duration: '6.8s',
      rotate: '31deg',
    },
    text: '#f7fbff',
  },
  ROYAL: {
    accent: '#e2ad56',
    badge: 'ROYALTY',
    backgroundFile: ASSET_FILES.royal,
    fallbackBackground: FALLBACK_BACKGROUNDS.ROYAL,
    inkGradient:
      'linear-gradient(92deg, rgba(255,236,174,.98), rgba(226,173,86,.92) 34%, rgba(124,74,22,.94) 66%, rgba(255,216,128,.88))',
    label: 'NUAR ROYALTY',
    shine: {
      color: 'rgba(143,67,214,.22)',
      duration: '9.4s',
      rotate: '-8deg',
    },
    text: '#f2c88b',
  },
};

const getRequestOrigin = (req) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  if (!host) return '';
  return `${proto}://${host}`;
};

const buildAssetUrl = (req, fileName) =>
  `${getRequestOrigin(req)}/api/public/loyalty/design/assets/${encodeURIComponent(fileName)}`;

const getPublicLoyaltyCardDesign = (req) => ({
  version: DESIGN_VERSION,
  tiers: Object.fromEntries(
    Object.entries(TIERS).map(([key, tier]) => [
      key,
      {
        ...tier,
        backgroundImage: `url("${buildAssetUrl(req, tier.backgroundFile)}"), ${tier.fallbackBackground}`,
      },
    ]),
  ),
});

module.exports = {
  ASSET_DIR,
  ASSET_FILES,
  DESIGN_VERSION,
  getPublicLoyaltyCardDesign,
};
