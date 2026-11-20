// Leonida 55 — the tracker: loads the trophy list, renders the checklist,
// keeps earned trophies in localStorage, and filters/searches/spoils it.
// Everything runs from files under app/; nothing here touches the network.
(function () {
  'use strict';

  var DATA_URL = 'data/trophies.json';
  var STORAGE_KEY = 'leonida55:earned:v1';

  var listEl = document.getElementById('trophyList');
  var emptyEl = document.getElementById('emptyNote');
  var resultEl = document.getElementById('resultLine');
  var searchEl = document.getElementById('search');
  var gradeEl = document.getElementById('gradeFilter');
  var kindEl = document.getElementById('kindFilter');
  var missableEl = document.getElementById('missableOnly');
  var earnedOnlyEl = document.getElementById('earnedOnly');
  var spoilerEl = document.getElementById('spoilerToggle');
  var exportBtn = document.getElementById('exportBtn');
  var importFile = document.getElementById('importFile');
  var resetBtn = document.getElementById('resetBtn');

  var trophies = [];
  var earned = loadEarned();
  var openGuides = {};

  function loadEarned() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var ids = JSON.parse(raw);
      var map = {};
      ids.forEach(function (id) { map[id] = true; });
      return map;
    } catch (err) {
      return {};
    }
  }

  function saveEarned() {
    var ids = Object.keys(earned).map(Number).sort(function (a, b) { return a - b; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function earnedCount() {
    return Object.keys(earned).length;
  }

  function readParams() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('q')) searchEl.value = params.get('q');
    if (params.get('grade')) gradeEl.value = params.get('grade');
    if (params.get('kind')) kindEl.value = params.get('kind');
    if (params.get('missable') === '1') missableEl.checked = true;
    if (params.get('earned') === '1') earnedOnlyEl.checked = true;
    if (params.get('spoiler') === '0') spoilerEl.checked = false;
    if (params.get('spoiler') === '1') spoilerEl.checked = true;
    return params;
  }

  function writeParams() {
    var params = new URLSearchParams();
    if (searchEl.value) params.set('q', searchEl.value);
    if (gradeEl.value !== 'all') params.set('grade', gradeEl.value);
    if (kindEl.value !== 'all') params.set('kind', kindEl.value);
    if (missableEl.checked) params.set('missable', '1');
    if (earnedOnlyEl.checked) params.set('earned', '1');
    params.set('spoiler', spoilerEl.checked ? '1' : '0');
    var query = params.toString();
    var url = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }

  function trophyHidden(t) {
    return spoilerEl.checked && t.story && !earned[t.id];
  }

  function matchesFilters(t) {
    var q = searchEl.value.trim().toLowerCase();
    if (q) {
      var hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + t.kind).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (kindEl.value !== 'all' && t.kind !== kindEl.value) return false;
    if (missableEl.checked && !t.missable) return false;
    if (earnedOnlyEl.checked && !earned[t.id]) return false;
    return true;
  }

  function gradeLabel(grade) {
    return grade.charAt(0).toUpperCase() + grade.slice(1);
  }

  function buildRow(t) {
    var card = document.createElement('article');
    card.className = 'trophy' + (earned[t.id] ? ' earned' : '');
    card.id = 'trophy-' + t.id;

    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!earned[t.id];
    box.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
    box.addEventListener('change', function () {
      if (box.checked) earned[t.id] = true;
      else delete earned[t.id];
      saveEarned();
      render();
    });
    card.appendChild(box);

    var body = document.createElement('div');

    var head = document.createElement('div');
    head.className = 'trophy-head';
    var name = document.createElement('h3');
    name.className = 'trophy-name';
    name.textContent = trophyHidden(t) ? 'Hidden story trophy' : t.name;
    head.appendChild(name);
    var badge = document.createElement('span');
    badge.className = 'badge ' + t.grade;
    badge.textContent = gradeLabel(t.grade);
    head.appendChild(badge);
    var kind = document.createElement('span');
    kind.className = 'kind-tag';
    kind.textContent = t.kind;
    head.appendChild(kind);
    if (t.missable) {
      var miss = document.createElement('span');
      miss.className = 'missable-tag';
      miss.textContent = 'Missable';
      head.appendChild(miss);
    }
    body.appendChild(head);

    var desc = document.createElement('p');
    if (trophyHidden(t)) {
      desc.className = 'trophy-desc hidden-spoiler';
      desc.textContent = 'A story trophy — its name and description stay hidden until you earn it.';
    } else {
      desc.className = 'trophy-desc';
      desc.textContent = t.description;
    }
    body.appendChild(desc);

    if (!trophyHidden(t)) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'guide-toggle';
      toggle.textContent = openGuides[t.id] ? 'Hide guide' : 'Read guide';
      toggle.addEventListener('click', function () {
        openGuides[t.id] = !openGuides[t.id];
        render();
      });
      body.appendChild(toggle);
      if (openGuides[t.id]) {
        var guide = document.createElement('div');
        guide.className = 'guide-body';
        var text = document.createElement('p');
        text.textContent = t.guide;
        guide.appendChild(text);
        var src = document.createElement('p');
        src.className = 'guide-source';
        src.textContent = 'Source: ';
        var link = document.createElement('a');
        link.href = t.source_url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = t.source;
        src.appendChild(link);
        guide.appendChild(src);
        body.appendChild(guide);
      }
    }

    card.appendChild(body);
    return card;
  }

  function renderProgress() {
    var total = trophies.length;
    var done = earnedCount();
    var pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('earnedCount').textContent = String(done);
    document.getElementById('earnedPct').textContent = pct + '%';
    var fill = document.getElementById('progressFill');
    fill.style.width = pct + '%';
    document.getElementById('progressBar').setAttribute('aria-valuenow', String(done));
    var grades = ['platinum', 'gold', 'silver', 'bronze'];
    var parts = grades.map(function (g) {
      var all = trophies.filter(function (t) { return t.grade === g; }).length;
      var got = trophies.filter(function (t) { return t.grade === g && earned[t.id]; }).length;
      return gradeLabel(g) + ' ' + got + '/' + all;
    });
    document.getElementById('gradeCounts').textContent = parts.join(' · ');
    var next = trophies.find(function (t) { return !earned[t.id]; });
    var nextEl = document.getElementById('nextUp');
    if (next) {
      nextEl.textContent = '';
      nextEl.appendChild(document.createTextNode('Next up: '));
      var strong = document.createElement('strong');
      strong.textContent = trophyHidden(next) ? 'a hidden story trophy' : next.name;
      nextEl.appendChild(strong);
    } else if (total) {
      nextEl.textContent = 'All 55 earned — Leonida Legend.';
    }
  }

  function render() {
    renderProgress();
    listEl.replaceChildren();
    var shown = 0;
    trophies.forEach(function (t) {
      if (!matchesFilters(t)) return;
      shown += 1;
      listEl.appendChild(buildRow(t));
    });
    emptyEl.hidden = shown !== 0;
    resultEl.textContent = 'Showing ' + shown + ' of ' + trophies.length + ' trophies'
      + (spoilerEl.checked ? ' — story spoilers hidden until earned' : '');
    writeParams();
  }

  function exportProgress() {
    var payload = {
      app: 'leonida55',
      version: 1,
      exportedAt: new Date().toISOString(),
      earned: Object.keys(earned).map(Number).sort(function (a, b) { return a - b; })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leonida55-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var ids = Array.isArray(data) ? data : data.earned;
        if (!Array.isArray(ids)) throw new Error('no earned list');
        var valid = {};
        ids.forEach(function (id) {
          if (trophies.some(function (t) { return t.id === id; })) valid[id] = true;
        });
        earned = valid;
        saveEarned();
        render();
      } catch (err) {
        alert('That file is not a Leonida 55 progress export.');
      }
    };
    reader.readAsText(file);
  }

  searchEl.addEventListener('input', render);
  gradeEl.addEventListener('change', render);
  kindEl.addEventListener('change', render);
  missableEl.addEventListener('change', render);
  earnedOnlyEl.addEventListener('change', render);
  spoilerEl.addEventListener('change', render);
  exportBtn.addEventListener('click', exportProgress);
  importFile.addEventListener('change', function (e) {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
  resetBtn.addEventListener('click', function () {
    if (confirm('Clear all earned trophies?')) {
      earned = {};
      saveEarned();
      render();
    }
  });

  var params = readParams();
  fetch(DATA_URL)
    .then(function (res) { return res.json(); })
    .then(function (doc) {
      trophies = doc.trophies;
      render();
      if (params.get('scroll') === 'roadmap') {
        document.getElementById('roadmap').scrollIntoView();
      }
    })
    .catch(function () {
      listEl.textContent = 'Could not load data/trophies.json.';
    });
})();
