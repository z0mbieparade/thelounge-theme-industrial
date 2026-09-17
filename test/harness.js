// Shared by both test pages. Plain script, not a module: file:// blocks `type="module"`.
window.Harness = (function () {
	// The sigil shows in the nick text only - data-name stays clean, and the rules match that.
	const USER_MODES = [
		{mode: "owner", sigil: "~"},
		{mode: "admin", sigil: "!"},
		{mode: "op", sigil: "@"},
		{mode: "half-op", sigil: "%"},
		{mode: "voice", sigil: "+"},
		{mode: "normal", sigil: ""},
	];

	const SIGILS = USER_MODES.map((m) => m.sigil).filter(Boolean).join("");

	const SYLLABLES = [
		"ack", "bit", "core", "dev", "fault", "glitch", "hex", "ion", "jolt", "kern",
		"lux", "mod", "null", "ohm", "pulse", "quark", "rune", "seg", "tron", "volt",
		"watt", "xor", "yield", "zap", "grid", "rust", "flux", "arc",
	];

	const SUFFIXES = ["", "", "", "_", "42", "[m]", "^", "99"];

	const LOREM = (
		"lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor " +
		"incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud " +
		"exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure " +
		"in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur " +
		"sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim " +
		"id est laborum"
	).split(" ");

	// The color class TheLounge gives a nick - sum of char codes mod 32, from its colorClass.ts.
	function colorClass(nick) {
		let hash = 0;

		for (let i = 0; i < nick.length; i++) {
			hash += nick.charCodeAt(i);
		}

		return 1 + (hash % 32);
	}

	// Deterministic PRNG, so a reload shows the same nicks and only the theme changed.
	function seededRandom(seed) {
		let state = seed >>> 0;

		return function next() {
			state = (state + 0x6d2b79f5) >>> 0;
			let t = Math.imul(state ^ (state >>> 15), 1 | state);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function pick(items, random) {
		return items[Math.floor(random() * items.length)];
	}

	// A plausible IRC nick starting with the given prefix.
	function makeNick(prefix, random) {
		const body = pick(SYLLABLES, random) + (random() < 0.4 ? pick(SYLLABLES, random) : "");
		return prefix + body + pick(SUFFIXES, random);
	}

	// A nick matching one $name-styles token; a trailing $ means it goes on the end.
	function makeNickFor(token, random) {
		if (token.endsWith("$")) {
			return makeNick("", random) + token.slice(0, -1);
		}

		return makeNick(token, random);
	}

	function lorem(random, words) {
		const out = [];

		for (let i = 0; i < words; i++) {
			out.push(pick(LOREM, random));
		}

		return out.join(" ");
	}

	// One nick per line, optional leading mode sigil.
	function parseUsers(text) {
		const users = [];

		for (const line of String(text).split("\n")) {
			const trimmed = line.trim();

			if (!trimmed) {
				continue;
			}

			const sigil = SIGILS.includes(trimmed[0]) ? trimmed[0] : "";
			const nick = trimmed.slice(sigil.length).trim();

			if (nick) {
				users.push(describe(nick, sigil));
			}
		}

		return users;
	}

	function describe(nick, sigil) {
		// "" is a real entry (normal), so every sigil parseUsers can produce is found here.
		const entry = USER_MODES.find((m) => m.sigil === sigil);
		return {nick: nick, sigil: sigil, mode: entry.mode, color: colorClass(nick)};
	}

	// Weighted so most users are unprivileged, as on a real channel.
	function randomUsers(count, random) {
		const weighted = ["", "", "", "", "", "", "+", "+", "+", "%", "@", "@", "!", "~"];
		const users = [];
		const taken = new Set();

		while (users.length < count) {
			const nick = makeNick(pick("abcdefghijklmnopqrstuvwxyz".split(""), random), random);

			if (!taken.has(nick.toLowerCase())) {
				taken.add(nick.toLowerCase());
				users.push(describe(nick, pick(weighted, random)));
			}
		}

		return users;
	}

	// The nick span as TheLounge marks it up - class and data-name are what the theme selects on.
	function userSpan(user) {
		const span = document.createElement("span");
		span.className = "user color-" + user.color;
		span.setAttribute("role", "button");
		span.dataset.name = user.nick;
		span.textContent = user.sigil + user.nick;
		return span;
	}

	// One message row; the angle brackets are .only-copy spans in the client, not CSS.
	function messageRow(user, text, time) {
		const msg = document.createElement("div");
		msg.className = "msg";
		msg.dataset.type = "message";
		msg.dataset.from = user.nick;

		const stamp = document.createElement("span");
		stamp.className = "time";
		stamp.textContent = time + " ";

		const from = document.createElement("span");
		from.className = "from";
		const open = document.createElement("span");
		open.className = "only-copy";
		open.textContent = "<";
		const close = document.createElement("span");
		close.className = "only-copy";
		close.innerHTML = ">&nbsp;";
		from.append(open, userSpan(user), close);

		const content = document.createElement("span");
		content.className = "content";
		content.dir = "auto";
		content.textContent = text;

		msg.append(stamp, from, content);
		return msg;
	}

	// A sidebar DM row.
	function queryItem(user, item) {
		const row = document.createElement("div");
		row.className = "channel-list-item";
		row.dataset.name = user.nick;
		row.dataset.type = "query";
		row.dataset.item = String(item);
		row.setAttribute("aria-label", "query: " + user.nick + " ");
		row.setAttribute("title", "query: " + user.nick + " ");
		row.setAttribute("aria-controls", "#chan-" + item);
		row.setAttribute("role", "tab");
		row.setAttribute("aria-selected", "false");

		const name = document.createElement("span");
		name.className = "name";
		name.textContent = user.nick;

		const tooltip = document.createElement("span");
		tooltip.className = "close-tooltip tooltipped tooltipped-w";
		tooltip.setAttribute("aria-label", "Close");

		const close = document.createElement("button");
		close.className = "close";
		close.setAttribute("aria-label", "Close");
		tooltip.append(close);

		row.append(name, tooltip);
		return row;
	}

	// One .user-mode per mode that has members; empty groups would show a bare heading.
	function userGroups(users) {
		const groups = [];

		for (const entry of USER_MODES) {
			const members = users.filter((u) => u.mode === entry.mode);

			if (!members.length) {
				continue;
			}

			const group = document.createElement("div");
			group.className = "user-mode " + entry.mode;
			members.sort((a, b) => a.nick.toLowerCase().localeCompare(b.nick.toLowerCase()));

			for (const member of members) {
				group.append(userSpan(member));
			}

			groups.push(group);
		}

		return groups;
	}

	return {
		colorClass, seededRandom, pick, makeNick, makeNickFor, lorem,
		parseUsers, randomUsers, userSpan, messageRow, userGroups, queryItem,
	};
})();
