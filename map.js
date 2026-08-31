// Renders the vector world map + flight routes into #map (SVG).
// No image files: country outlines come from countries-110m.json (TopoJSON).

// Real-world coordinates [longitude, latitude]
const CITIES = {
    telAviv:     { name: 'Tel Aviv',    coords: [34.7818, 32.0853], img: 'images/city_telaviv.png',     place: 'left' },
    yerevan:     { name: 'Yerevan',     coords: [44.5136, 40.1792], img: 'images/city_yerevan.png',     place: 'right' },
    moscow:      { name: 'Moscow',      coords: [37.6173, 55.7558], img: 'images/city_moscow.png',      place: 'top' },
    novosibirsk: { name: 'Novosibirsk', coords: [82.9357, 55.0084], img: 'images/city_novosibirsk.png', place: 'right' },
};

// Flight legs, flown in order as the user scrolls. `trip` groups consecutive
// legs flown by the same traveller (one plane, one sprite per trip).
const ROUTES = [
    // fixed:  sprite never rotates, just slides along the path.
    // mirror: flip the sprite horizontally.
    // spin:   extra clockwise degrees applied on top of path-following rotation.
    { from: 'telAviv',     to: 'yerevan', trip: 0, sprite: 'planes/mark.png',  fixed: true, mirror: true, spin: 30 },
    { from: 'novosibirsk', to: 'moscow',  trip: 1, sprite: 'planes/masha.png', spin: 30 },
    { from: 'moscow',      to: 'yerevan', trip: 1, sprite: 'planes/masha.png' },
];

// Geographic window the map is framed to (lon/lat bounding box).
// Keeps the framing stable no matter which countries land on screen.
const REGION = {
    type: 'Polygon',
    coordinates: [[[22, 62], [90, 62], [90, 26], [22, 26], [22, 62]]],
};

const svg = document.getElementById('map');
const gLand = document.getElementById('mapLand');
const gRoutes = document.getElementById('routes');
const gMarkers = document.getElementById('cityMarkers');

let projection = d3.geoMercator();
let geoPath = d3.geoPath(projection);
let countries = null;
let landPathData = '';

// Wave shape along each route. Tweak these to taste.
const WAVE_HUMPS = 3;        // number of sine humps between the two cities
const WAVE_AMPLITUDE = 0.09; // peak offset as a fraction of route length
const WAVE_SAMPLES = 160;    // polyline resolution

const SVGNS = 'http://www.w3.org/2000/svg';

// Sine-wave path data between two projected points, in current pixel space.
function wavePathData(a, b) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len; // unit perpendicular
    const py = dx / len;
    const amp = len * WAVE_AMPLITUDE;

    let d = '';
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
        const t = i / WAVE_SAMPLES;
        const envelope = Math.sin(t * Math.PI);       // wave fades to 0 at both ends
        const offset = Math.sin(t * Math.PI * WAVE_HUMPS) * amp * envelope;
        const x = ax + dx * t + px * offset;
        const y = ay + dy * t + py * offset;
        d += (i === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return d;
}

// Build one <path> pair (faint base + revealable trail) per route.
function buildRoutes() {
    gRoutes.innerHTML = '';
    for (let i = 0; i < ROUTES.length; i++) {
        const r = ROUTES[i];
        const d = wavePathData(
            projection(CITIES[r.from].coords),
            projection(CITIES[r.to].coords),
        );

        const base = document.createElementNS(SVGNS, 'path');
        base.setAttribute('class', 'flight-path');
        base.setAttribute('d', d);
        base.dataset.route = i;

        const trail = document.createElementNS(SVGNS, 'path');
        trail.setAttribute('class', 'flight-trail');
        trail.setAttribute('d', d);
        trail.dataset.route = i;
        trail.dataset.trip = r.trip || 0;
        if (r.sprite) trail.dataset.sprite = r.sprite;
        trail.dataset.fixed = r.fixed ? '1' : '0';
        trail.dataset.mirror = r.mirror ? '1' : '0';
        trail.dataset.spin = r.spin || 0;

        gRoutes.appendChild(base);
        gRoutes.appendChild(trail);

        const total = trail.getTotalLength();
        trail.style.strokeDasharray = total;
        trail.style.strokeDashoffset = total; // hidden until its leg is flown
    }
}

// Thumbnail card dimensions (SVG px).
const CARD_W = 68;
const CARD_IMG_H = 54;    // image area (~5:4 source)
const CARD_CAP_H = 14;    // caption strip
const CARD_H = CARD_IMG_H + CARD_CAP_H;

// Card offset (top-left corner, relative to the city dot) for each placement.
function cardOffset(place) {
    const gap = 12;
    switch (place) {
        case 'right':  return [gap, -CARD_H / 2];
        case 'left':   return [-CARD_W - gap, -CARD_H / 2];
        case 'bottom': return [-CARD_W / 2, gap];
        case 'top':
        default:       return [-CARD_W / 2, -CARD_H - gap];
    }
}

function drawMarkers() {
    gMarkers.innerHTML = '';

    for (const key of Object.keys(CITIES)) {
        const city = CITIES[key];
        const [x, y] = projection(city.coords);
        const [cardX, cardY] = cardOffset(city.place);

        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', `city-marker ${key}`);
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = `
            <g class="thumb-card" transform="translate(${cardX} ${cardY})">
                <clipPath id="clip-${key}">
                    <rect x="0" y="0" width="${CARD_W}" height="${CARD_IMG_H}" rx="9"></rect>
                </clipPath>
                <image href="${city.img}" x="0" y="0" width="${CARD_W}" height="${CARD_IMG_H}"
                       preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${key})"></image>
                <rect class="thumb-outline" x="0" y="0" width="${CARD_W}" height="${CARD_IMG_H}" rx="9"></rect>
                <text class="thumb-caption" x="${CARD_W / 2}" y="${CARD_IMG_H + 11}" text-anchor="middle">${city.name}</text>
            </g>
            <circle class="marker-dot" r="5"></circle>
        `;
        gMarkers.appendChild(g);
    }
}

// (Re)compute projection for the current viewport size and redraw everything.
function render() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    const pad = Math.min(w, h) * 0.04;
    projection.fitExtent([[pad, pad], [w - pad, h - pad]], REGION);
    geoPath = d3.geoPath(projection);

    if (countries) {
        landPathData = geoPath(countries);
        gLand.innerHTML = `<path class="land" d="${landPathData}"></path>`;
    }

    buildRoutes();
    drawMarkers();

    window.dispatchEvent(new CustomEvent('map:render'));
}

async function initMap() {
    const topo = await fetch('countries-110m.json').then((r) => r.json());
    countries = topojson.feature(topo, topo.objects.countries);
    render();
    window.dispatchEvent(new CustomEvent('map:ready'));
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
});

initMap();

// Current on-screen pixel position of a city (SVG userspace == CSS px here).
window.getCityPoint = function (key) {
    const [x, y] = projection(CITIES[key].coords);
    return { x, y };
};

// Exposed for script.js: one entry per leg, in flight order.
window.getRoutes = function () {
    return Array.from(gRoutes.querySelectorAll('.flight-trail')).map((trail) => ({
        trail,
        base: gRoutes.querySelector(`.flight-path[data-route="${trail.dataset.route}"]`),
        trip: Number(trail.dataset.trip || 0),
        sprite: trail.dataset.sprite || '',
        fixed: trail.dataset.fixed === '1',
        mirror: trail.dataset.mirror === '1',
        spin: Number(trail.dataset.spin || 0),
    }));
};
