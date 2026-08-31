// Scroll-driven plane animation.
// The map + flight legs are built in map.js. The scroll is split into one
// phase per leg. Each leg gets its own plane: it flies during its phase,
// then stays parked at the destination while later legs fly.
(function () {
    // The sprite art isn't drawn pointing "east": its nose points down-left.
    // SPRITE_NOSE is that built-in heading in screen degrees (0 = east, 90 = south).
    // Rotation applied to a sprite = travelHeading - SPRITE_NOSE.
    const SPRITE_NOSE = 208;

    let routes = [];     // [{ trail, base, trip }] one per leg, in flight order
    let trips = [];      // [{ id, legs: [routeIndex...] }] grouped by traveller
    let planes = [];     // [{ el, img, facing }] one per trip
    let ticking = false;

    // --- Heart burst on arrival (canvas-confetti) ---
    const heartScalar = 3.6;   // heart size (bitmap res + render scale)
    const fxCanvas = document.getElementById('fx');
    const fire = window.confetti
        ? confetti.create(fxCanvas, { resize: true, useWorker: true })
        : null;
    const heartShapes = window.confetti
        ? ['❤️', '🧡', '💛', '💚', '💙', '💜', '💗', '🤍']
            .map((text) => confetti.shapeFromText({ text, scalar: heartScalar }))
        : [];
    const firedFor = [];   // per-leg: has the burst already gone off this arrival?

    function burstHearts(origin) {
        if (!fire) return;
        const defaults = {
            origin,
            spread: 360,
            ticks: 260,        // particle lifetime -> longer animation
            gravity: 0.12,     // slight float-down so they linger on screen
            decay: 0.92,
            startVelocity: 26,
            colors: ['#ff2d55', '#ff6b6b', '#e0245e'],
            shapes: heartShapes,
            scalar: heartScalar,
        };
        const shoot = () => {
            fire({ ...defaults, particleCount: 30 });
            fire({ ...defaults, particleCount: 6, flat: true });
            fire({ ...defaults, particleCount: 14, scalar: heartScalar / 2, shapes: ['circle'] });
        };
        // Staggered emission stretches the burst out over ~0.9s.
        [0, 120, 240, 420, 650, 900].forEach((t) => setTimeout(shoot, t));
    }

    function cacheRoutes() {
        routes = (window.getRoutes && window.getRoutes()) || [];

        // Group legs into trips (one plane per trip), keeping first-seen order.
        const seen = new Map();
        trips = [];
        routes.forEach((r, i) => {
            const id = r.trip || 0;
            if (!seen.has(id)) {
                seen.set(id, trips.length);
                trips.push({ id, legs: [], sprite: r.sprite || 'planes/mark.png' });
            }
            trips[seen.get(id)].legs.push(i);
        });

        buildPlanes();
    }

    let planesKey = '';
    function buildPlanes() {
        const key = trips.map((t) => t.sprite).join('|');
        if (key === planesKey && planes.length) return; // unchanged (e.g. resize)
        planesKey = key;
        planes.forEach((p) => p.el.remove());
        planes = trips.map((trip) => {
            const el = document.createElement('div');
            el.className = 'plane';
            el.hidden = true;
            const img = document.createElement('img');
            img.className = 'plane-image';
            img.alt = 'Traveller';
            img.src = trip.sprite;
            el.appendChild(img);
            document.body.appendChild(el);
            return { el, img, facing: 'right' };
        });
    }

    // --- Countdown intro ---
    const COUNTDOWN_HOURS = 5 * 24;   // start at "5 days 0 hours"
    const cdEl = document.getElementById('countdown');
    const flashEl = document.getElementById('flash');
    const introSpacer = document.getElementById('introSpacer');
    const outroSpacer = document.getElementById('outroSpacer');
    const planCard = document.getElementById('planCard');

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Split the scroll into the countdown phase (the intro spacer) and the
    // journey phase (everything after it).
    function scrollState() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const introEnd = introSpacer ? introSpacer.offsetHeight : 0;
        const outroLen = outroSpacer ? outroSpacer.offsetHeight : 0;

        const introProgress = introEnd > 0
            ? Math.min(Math.max(scrollTop / introEnd, 0), 1)
            : 1;

        // Journey runs between the intro spacer and the outro spacer.
        const journeyEnd = Math.max(docHeight - outroLen, introEnd + 1);
        const journeySpan = Math.max(journeyEnd - introEnd, 1);
        const journeyProgress = Math.min(Math.max((scrollTop - introEnd) / journeySpan, 0), 1);

        // Outro spacer scroll, drives the plan card reveal.
        const outroProgress = outroLen > 0
            ? Math.min(Math.max((scrollTop - journeyEnd) / outroLen, 0), 1)
            : 0;

        return { introProgress, journeyProgress, outroProgress };
    }

    // Russian plural: forms = [1, 2-4, 5-0]  e.g. ['день','дня','дней']
    function ruPlural(n, forms) {
        const n10 = n % 10;
        const n100 = n % 100;
        if (n10 === 1 && n100 !== 11) return forms[0];
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
        return forms[2];
    }

    function updateCountdown(introProgress) {
        const hoursLeft = Math.ceil(COUNTDOWN_HOURS * (1 - introProgress));
        const days = Math.floor(hoursLeft / 24);
        const hours = hoursLeft % 24;
        setText('cdDays', days);
        setText('cdDaysWord', ruPlural(days, ['день', 'дня', 'дней']));
        setText('cdHours', hours);
        setText('cdHoursWord', ruPlural(hours, ['час', 'часа', 'часов']));

        // Overlay fades and lifts away over the last stretch of the countdown.
        const t = Math.min(Math.max((introProgress - 0.86) / 0.14, 0), 1);
        if (cdEl) {
            cdEl.style.opacity = String(1 - t);
            cdEl.style.transform = `scale(${1 + 0.12 * t})`;
            cdEl.style.pointerEvents = t >= 1 ? 'none' : '';
            cdEl.style.visibility = t >= 1 ? 'hidden' : 'visible';
        }
        // Brief white flash during the handover — fully clear before the journey.
        if (flashEl) {
            const f = 1 - Math.min(Math.abs(introProgress - 0.92) / 0.05, 1);
            flashEl.style.opacity = String(0.7 * f);
        }
    }

    // Place one plane along a path at a given distance.
    // opts: { fixed } -> don't rotate at all; { spin } -> extra clockwise degrees.
    function placePlane(plane, path, dist, pathLength, opts) {
        opts = opts || {};
        const p = path.getPointAtLength(dist);
        plane.el.style.left = `${p.x}px`;
        plane.el.style.top = `${p.y}px`;

        if (opts.fixed) {
            plane.el.style.transform =
                `translate(-50%, -50%) scaleX(${opts.mirror ? -1 : 1}) rotate(${opts.spin || 0}deg)`;
            return;
        }

        const ahead = path.getPointAtLength(Math.min(dist + 2, pathLength));
        const behind = path.getPointAtLength(Math.max(dist - 2, 0));
        const heading = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;

        // Rotate the sprite so its nose follows the travel heading. If that would
        // tip it past vertical, mirror it left<->right instead of flying inverted.
        let deg = heading - SPRITE_NOSE;
        deg = ((deg % 360) + 540) % 360 - 180;     // normalise to -180..180
        let sx = 1;
        if (deg > 90 || deg < -90) {
            sx = -1;
            deg += deg > 0 ? -180 : 180;
        }

        // Leading rotate(spin) is in screen space (unaffected by the mirror).
        plane.el.style.transform =
            `translate(-50%, -50%) rotate(${opts.spin || 0}deg) scaleX(${sx}) rotate(${deg}deg)`;
    }

    function update() {
        ticking = false;

        const { introProgress, journeyProgress, outroProgress } = scrollState();
        updateCountdown(introProgress);

        // Plan card rises from below as you keep scrolling past the arrival
        // (which is where the confetti has already fired).
        if (planCard) {
            const e = outroProgress * outroProgress * (3 - 2 * outroProgress); // smoothstep
            const y = (1 - e) * 115;                       // vh: off-bottom -> centred
            planCard.style.transform =
                `translate(-50%, calc(-50% + ${y}vh)) scale(${0.94 + 0.06 * e})`;
            planCard.style.opacity = String(Math.min(outroProgress / 0.2, 1));
        }

        // Scroll hints: prompt the countdown first, then "more more more" carries
        // you through the journey, both gone by the final approach.
        const hint1 = document.getElementById('scrollHint');
        const hintCd = document.getElementById('scrollHintCd');
        const hint2 = document.getElementById('scrollHint2');
        const hint3 = document.getElementById('scrollHint3');
        const inJourney = introProgress >= 1;
        if (hint1) hint1.classList.toggle('is-hidden', introProgress > 0.03);
        if (hintCd) {
            hintCd.classList.toggle('is-hidden',
                !(introProgress > 0.03 && introProgress < 0.85));
        }
        if (hint2) {
            hint2.classList.toggle('is-hidden',
                !(inJourney && journeyProgress > 0.02 && journeyProgress < 0.5));
        }
        if (hint3) {
            hint3.classList.toggle('is-hidden',
                !(inJourney && journeyProgress >= 0.5 && journeyProgress < 0.9));
        }

        if (!routes.length) cacheRoutes();
        if (!routes.length || !planes.length) return;

        const n = routes.length;
        // Journey stays frozen at the start until the countdown reaches zero.
        const progress = introProgress >= 1 ? journeyProgress : 0;

        // Which leg are we on, and how far along it (0..1)?
        let seg = Math.floor(progress * n);
        if (seg >= n) seg = n - 1;
        const localT = progress * n - seg;

        // Trail reveal: done legs fully drawn, current leg partial, future hidden.
        for (let i = 0; i < n; i++) {
            const path = routes[i].trail;
            const len = path.getTotalLength();
            const shown = i < seg ? 1 : i > seg ? 0 : localT;
            path.style.strokeDasharray = len;
            path.style.strokeDashoffset = len * (1 - shown);
        }

        // One plane per trip: hidden before its first leg, flying its active leg,
        // parked on the final destination once all its legs are done.
        for (let t = 0; t < trips.length; t++) {
            const legs = trips[t].legs;
            const first = legs[0];
            const last = legs[legs.length - 1];
            const plane = planes[t];
            if (!plane || !plane.el) continue;

            if (seg < first) {
                plane.el.hidden = true;
                continue;
            }
            plane.el.hidden = false;

            const legIdx = seg > last ? last : seg;
            const route = routes[legIdx];
            const len = route.trail.getTotalLength();
            const dist = seg > last ? len : localT * len;
            placePlane(plane, route.trail, dist, len,
                { fixed: route.fixed, mirror: route.mirror, spin: route.spin });
        }

        // Hearts once the final leg arrives; re-arm when scrolling back up.
        if (seg === n - 1 && localT > 0.98 && !firedFor[seg]) {
            const y = window.getCityPoint && window.getCityPoint('yerevan');
            if (y) burstHearts({ x: y.x / window.innerWidth, y: y.y / window.innerHeight });
            firedFor[seg] = true;
        } else if (localT < 0.9) {
            firedFor[seg] = false;
        }
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('map:ready', () => { cacheRoutes(); update(); });
    window.addEventListener('map:render', () => { cacheRoutes(); update(); });

    cacheRoutes();
    update();
})();
