// New landmarks from the "Landmarks and Fun Facts" sheet.
// x, y are State Plane meters (EPSG:26986), converted from the sheet's lat/lon.
// Sprites come from src/data/generatedSprites.js (made by scripts/png_to_sprite.py).
// Until a PNG has been converted, a landmark shows a simple placeholder building.
import { PALETTE } from '../theme/pixel';
import { generatedSprites } from './generatedSprites';

const PLACEHOLDER = {
  rows: [
    '....KKKK....',
    '...KRRRRK...',
    '..KRRRRRRK..',
    '.KKKKKKKKKK.',
    '.KWWWWWWWWK.',
    '.KWDWWWWDWK.',
    '.KWWWWWWWWK.',
    '.KWDWKKWDWK.',
    '.KWWWKKWWWK.',
    '.KKKKKKKKKK.',
  ],
  colors: { K: PALETTE.ink, R: '#8a4a3a', W: '#d9cfbd', D: '#4a5068' },
};

// nearestStop must be a station id from greenLine.js (see the check in App.js notes)
const entries = [
  {
    id: 'bu-castle',
    name: 'Boston University Castle',
    shortName: 'BU CASTLE',
    owner: 'Boston University',
    address: '225 Bay State Rd',
    x: 232933,
    y: 900114,
    nearestStop: 'packards-corner',
    blurb: 'A Tudor Revival mansion on Bay State Road that is now part of the BU campus.',
    fact: 'Built in 1915 as the home of William Lindsey, it later became part of Boston University.',
  },
  {
    id: 'gardner-museum',
    name: 'Isabella Stewart Gardner Museum',
    shortName: 'GARDNER',
    owner: 'Fenway',
    address: '25 Evans Way',
    x: 233077,
    y: 898789,
    nearestStop: 'museum-of-fine-arts',
    blurb: 'A Venetian-style palace museum built around a glass-roofed garden courtyard.',
    fact: 'The central courtyard is replanted with the seasons, so its display keeps changing.',
  },
  {
    id: 'symphony-hall',
    name: 'Symphony Hall',
    shortName: 'SYMPHONY',
    owner: 'Back Bay',
    address: '301 Massachusetts Ave',
    x: 234128,
    y: 899226,
    nearestStop: 'symphony',
    blurb: 'Home of the Boston Symphony Orchestra and the Boston Pops.',
    fact: 'Opened in 1900, it is celebrated for its acoustics, designed with physicist Wallace Clement Sabine.',
  },
  {
    id: 'boston-common',
    name: 'Boston Common',
    shortName: 'COMMON',
    owner: 'Downtown',
    address: '139 Tremont St',
    x: 235952,
    y: 900592,
    nearestStop: 'park-street',
    blurb: 'The green heart of downtown Boston, right beside Park Street station.',
    fact: 'Founded in 1634, it is the oldest public park in the United States.',
  },
  {
    id: 'baahm',
    name: 'Boston African American National Historic Site',
    shortName: 'BAAHS',
    owner: 'Beacon Hill',
    address: '46 Joy St',
    x: 235744,
    y: 900961,
    nearestStop: 'government-center',
    blurb: 'Tells the story of Boston\u2019s 19th-century Black community on Beacon Hill.',
    fact: 'It covers the community\u2019s fight for civil rights and equal education.',
  },
  {
    id: 'paul-revere-house',
    name: 'Paul Revere House',
    shortName: 'REVERE',
    owner: 'North End',
    address: '19 North Square',
    x: 236771,
    y: 901553,
    nearestStop: 'haymarket',
    blurb: 'The North End home of the patriot famous for his midnight ride.',
    fact: 'Built around 1680, it is downtown Boston\u2019s oldest surviving house.',
  },
  {
    id: 'freedom-trail',
    name: 'Freedom Trail',
    shortName: 'FREEDOM TRAIL',
    owner: 'Boston Common',
    address: '139 Tremont St',
    x: 235953,
    y: 900648,
    nearestStop: 'park-street',
    blurb: 'A walking route past Boston\u2019s most important historic sites.',
    fact: 'The 2.5-mile trail links 16 sites and is marked by a red brick or painted line.',
  },
  {
    id: 'esplanade',
    name: 'Charles River Esplanade',
    shortName: 'ESPLANADE',
    owner: 'Back Bay',
    address: 'Hatch Memorial Shell',
    x: 235095,
    y: 900777,
    nearestStop: 'arlington',
    blurb: 'A riverside park along the Charles, home of the Hatch Shell.',
    fact: 'It runs about 3 miles and hosts the Boston Pops Fourth of July concert and fireworks.',
  },
];

export const moreLandmarks = entries.map((e) => {
  const art = generatedSprites[e.id] ?? PLACEHOLDER;
  return { ...e, sprite: art.rows, colors: art.colors };
});
