/* ═══════════════════════════════════
   MedQuiz — app.js
   ═══════════════════════════════════ */

// ── 상태 ─────────────────────────────
const state = {
  questions:    [],   // 현재 퀴즈 문제 배열
  index:        0,    // 현재 문제 인덱스
  correct:      0,
  wrong:        0,
  answered:     false,
  dept:         '',
  mode:         'normal', // 'normal' | 'wrong'
};

// 누적 통계 (localStorage)
let stats = JSON.parse(localStorage.getItem('mq_stats') || '{"total":0,"correct":0}');
// 오답 맵 {id: questionObject}
let wrongMap = JSON.parse(localStorage.getItem('mq_wrong') || '{}');

// ── 페이지 전환 ───────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'page-home') updateHomeStats();
  if (id === 'page-wrong-menu') updateWrongMenu();
}

// ── 홈 통계 업데이트 ─────────────────
function updateHomeStats() {
  const wrongCount = Object.keys(wrongMap).length;
  document.getElementById('home-wrong-count').textContent = wrongCount + '문제';
  document.getElementById('stat-total').textContent   = stats.total;
  document.getElementById('stat-correct').textContent = stats.correct;
  document.getElementById('stat-wrong').textContent   = stats.total - stats.correct;
  const rate = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
  document.getElementById('stat-rate').textContent    = rate + '%';
}

// ── 퀴즈 시작 (과목별) ───────────────
async function startQuiz(dept, file) {
  showPage('page-loading');
  try {
    const res  = await fetch('data/' + file + '.json');
    const all  = await res.json();
    const pool = shuffle([...all]).slice(0, 20);
    beginQuiz(pool, dept, 'normal');
  } catch(e) {
    alert('문제를 불러오지 못했습니다: ' + e.message);
    showPage('page-home');
  }
}

// ── 오답 퀴즈 시작 ───────────────────
function startWrongQuiz(dept) {
  let pool = Object.values(wrongMap);
  if (dept !== 'MIX') pool = pool.filter(q => q.dept === dept);
  if (pool.length === 0) { alert('해당 과목의 오답이 없습니다!'); return; }
  pool = shuffle(pool);
  beginQuiz(pool, dept === 'MIX' ? '전체 오답' : dept + ' 오답', 'wrong');
}

// ── 퀴즈 초기화 ─────────────────────
function beginQuiz(pool, dept, mode) {
  state.questions = pool;
  state.index     = 0;
  state.correct   = 0;
  state.wrong     = 0;
  state.answered  = false;
  state.dept      = dept;
  state.mode      = mode;
  showPage('page-quiz');
  renderQuiz();
}

// ── 퀴즈 렌더링 ─────────────────────
function renderQuiz() {
  const q     = state.questions[state.index];
  const total = state.questions.length;
  const idx   = state.index;

  // 상단 정보
  document.getElementById('quiz-dept-badge').textContent   = state.dept;
  document.getElementById('quiz-counter').textContent      = (idx + 1) + ' / ' + total;
  document.getElementById('quiz-correct-count').textContent = '✓ ' + state.correct;
  document.getElementById('quiz-wrong-count').textContent   = '✗ ' + state.wrong;
  document.getElementById('quiz-progress').style.width     = Math.round(idx / total * 100) + '%';

  // 번호 탭
  const tabs = document.getElementById('quiz-tabs');
  tabs.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const s = document.createElement('span');
    s.textContent = i + 1;
    s.style.cssText = 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:12px;' +
      (i === idx
        ? 'background:var(--accent);color:#fff;font-weight:700;'
        : 'background:var(--surface);color:var(--text3);border:1px solid var(--border);');
    tabs.appendChild(s);
  }

  // 문제 번호 + 타입
  const typeMap = {1:'객관식', 2:'단답형', 3:'서술형'};
  const typeClass = {1:'obj', 2:'short', 3:'essay'};
  document.getElementById('quiz-qnum').innerHTML =
    'Q.' + (idx + 1) +
    '<span class="q-type-tag ' + (typeClass[q.type] || 'obj') + '">' + (typeMap[q.type] || '') + '</span>';

  // 문제 본문
  document.getElementById('quiz-qtext').textContent = q.question;

  // 답변 영역
  renderAnswerArea(q);
}

// ── 답변 영역 렌더링 ────────────────
function renderAnswerArea(q) {
  const area = document.getElementById('quiz-answer-area');

  if (state.answered) {
    renderAnswered(q, area);
  } else {
    renderInput(q, area);
  }
}

function renderInput(q, area) {
  if (q.type === 1) {
    // 객관식
    let html = '<div class="choices-form">';
    q.choices.forEach((choice, i) => {
      html += `<label class="choice-label" onclick="selectChoice(this, ${i})">
        <input type="radio" name="choice" value="${i}" style="display:none;">
        <span class="choice-num">${i + 1}</span>
        <span>${escHtml(choice)}</span>
      </label>`;
    });
    html += '</div>';
    html += '<button class="submit-btn" onclick="submitAnswer()">제출하기</button>';
    area.innerHTML = html;
  } else if (q.type === 2) {
    area.innerHTML = `
      <div class="answer-input-group">
        <label class="answer-label">A. 답을 입력하세요</label>
        <input type="text" id="user-input" class="answer-input" placeholder="답을 입력하세요" />
      </div>
      <button class="submit-btn" onclick="submitAnswer()">제출하기</button>`;
    setTimeout(() => document.getElementById('user-input')?.focus(), 100);
  } else {
    area.innerHTML = `
      <div class="answer-input-group">
        <label class="answer-label">A. 답을 서술하세요</label>
        <textarea id="user-input" class="answer-input" placeholder="답을 서술하세요"></textarea>
      </div>
      <button class="submit-btn" onclick="submitAnswer()">제출하기</button>`;
    setTimeout(() => document.getElementById('user-input')?.focus(), 100);
  }
}

function renderAnswered(q, area) {
  const isCorrect = state._lastCorrect;
  const userAns   = state._lastUserAns;

  let html = '';

  if (q.type === 1) {
    // 정답 번호 추출
    const ansNum  = extractNum(q.answer);
    const userNum = extractNum(userAns);
    html += '<div class="choices-form">';
    q.choices.forEach((choice, i) => {
      const cNum = String(i + 1);
      let cls = 'choice-label';
      if (cNum === ansNum) cls += ' correct-choice';
      else if (cNum === userNum && !isCorrect) cls += ' wrong-choice';
      html += `<label class="${cls}" style="cursor:default;">
        <span class="choice-num">${i + 1}</span>
        <span>${escHtml(choice)}</span>
      </label>`;
    });
    html += '</div>';
  } else {
    html += `<div class="answer-input-group">
      <label class="answer-label">내 답변</label>
      <div class="answer-input" style="opacity:.7;min-height:50px;white-space:pre-wrap;">${escHtml(userAns)}</div>
    </div>`;
  }

  html += `<div class="reveal ${isCorrect ? 'correct' : 'wrong'}">${isCorrect ? '✓ 정답입니다!' : '✗ 오답입니다'}</div>`;
  html += `<div class="answer-box">정답: ${escHtml(q.answer)}</div>`;

  const isLast = state.index >= state.questions.length - 1;
  html += `<button class="next-btn" onclick="${isLast ? 'showResult()' : 'nextQuestion()'}">
    ${isLast ? '결과 보기 →' : '다음 문제 →'}
  </button>`;

  area.innerHTML = html;
}

// ── 선택지 클릭 ─────────────────────
function selectChoice(label, idx) {
  document.querySelectorAll('.choice-label').forEach(l => {
    l.style.borderColor = '';
    l.style.background  = '';
    const num = l.querySelector('.choice-num');
    if (num) { num.style.background = ''; num.style.color = ''; }
  });
  label.style.borderColor = 'var(--accent)';
  label.style.background  = 'rgba(77,141,245,0.06)';
  const num = label.querySelector('.choice-num');
  if (num) { num.style.background = 'var(--accent)'; num.style.color = '#fff'; }
  label.querySelector('input').checked = true;
}

// ── 답 제출 ─────────────────────────
function submitAnswer() {
  const q = state.questions[state.index];
  let userAns = '';

  if (q.type === 1) {
    const checked = document.querySelector('input[name="choice"]:checked');
    if (!checked) { alert('선택지를 골라주세요!'); return; }
    userAns = q.choices[parseInt(checked.value)];
  } else {
    const inp = document.getElementById('user-input');
    if (!inp || !inp.value.trim()) { alert('답을 입력해주세요!'); return; }
    userAns = inp.value.trim();
  }

  const isCorrect = checkAnswer(userAns, q);
  state.answered      = true;
  state._lastCorrect  = isCorrect;
  state._lastUserAns  = userAns;

  if (isCorrect) {
    state.correct++;
    delete wrongMap[q.id];
  } else {
    state.wrong++;
    wrongMap[q.id] = q;
  }

  // 누적 통계
  stats.total++;
  if (isCorrect) stats.correct++;
  saveData();

  renderAnswerArea(q);
}

// ── 다음 문제 ────────────────────────
function nextQuestion() {
  state.index++;
  state.answered = false;
  renderQuiz();
}

// ── 결과 표시 ────────────────────────
function showResult() {
  const total   = state.correct + state.wrong;
  const rate    = total > 0 ? Math.round(state.correct / total * 100) : 0;
  const offset  = 314.16 - (rate / 100 * 314.16);
  const color   = rate >= 70 ? 'var(--green)' : rate >= 50 ? 'var(--yellow)' : 'var(--red)';
  const emoji   = rate >= 90 ? '🏆' : rate >= 70 ? '🎉' : rate >= 50 ? '📚' : '💪';
  const title   = rate >= 90 ? '완벽합니다!' : rate >= 70 ? '잘 하셨어요!' : rate >= 50 ? '조금 더 공부해봐요' : '오답 복습으로 실력을 키워봐요!';

  document.getElementById('result-emoji').textContent   = emoji;
  document.getElementById('result-title').textContent   = title;
  document.getElementById('result-pct').textContent     = rate + '%';
  document.getElementById('result-correct').textContent = state.correct;
  document.getElementById('result-wrong').textContent   = state.wrong;
  document.getElementById('result-total').textContent   = total;

  const ring = document.getElementById('ring-fg');
  ring.style.stroke          = color;
  ring.style.strokeDashoffset = 314.16;
  setTimeout(() => { ring.style.transition = 'stroke-dashoffset 1s ease'; ring.style.strokeDashoffset = offset; }, 100);

  // 버튼
  let btns = '';
  if (state.wrong > 0) {
    btns += `<button class="action-btn primary" onclick="startWrongQuiz('${state.dept}')">오답만 다시 풀기</button>`;
  }
  if (state.mode === 'wrong') {
    btns += `<button class="action-btn secondary" onclick="showPage('page-wrong-menu')">오답노트로</button>`;
  } else {
    const fileMap = {'내과':'internal','산부인과':'ob','응급의학과':'emergency','소아청소년과':'pediatrics'};
    const file = fileMap[state.dept];
    if (file) btns += `<button class="action-btn secondary" onclick="startQuiz('${state.dept}','${file}')">같은 과목 다시</button>`;
  }
  btns += `<button class="action-btn ghost" onclick="showPage('page-home')">홈으로</button>`;
  document.getElementById('result-actions').innerHTML = btns;

  showPage('page-result');
}

// ── 오답노트 메뉴 업데이트 ───────────
function updateWrongMenu() {
  const all = Object.values(wrongMap);
  const total = all.length;
  document.getElementById('wrong-total').textContent    = total;
  document.getElementById('wrong-mix-count').textContent = total;

  const depts = ['내과','산부인과','응급의학과','소아청소년과'];
  const grid  = document.getElementById('wrong-dept-grid');
  const empty = document.getElementById('wrong-empty');
  const mixBtn = document.getElementById('wrong-mix-btn');

  if (total === 0) {
    empty.style.display  = 'block';
    grid.style.display   = 'none';
    mixBtn.style.display = 'none';
    return;
  }
  empty.style.display  = 'none';
  grid.style.display   = 'grid';
  mixBtn.style.display = 'flex';

  grid.innerHTML = '';
  depts.forEach(dept => {
    const count = all.filter(q => q.dept === dept).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'wrong-card';
    btn.innerHTML = `${dept} <span class="badge">${count}</span>`;
    btn.onclick   = () => startWrongQuiz(dept);
    grid.appendChild(btn);
  });
}

// ── 오답 초기화 ──────────────────────
function clearWrong() {
  if (!confirm('오답 목록을 초기화할까요?')) return;
  wrongMap = {};
  saveData();
  updateWrongMenu();
}

// ── 홈으로 확인 ─────────────────────
function confirmHome() {
  if (state.answered || state.index === 0) { showPage('page-home'); return; }
  if (confirm('퀴즈를 종료하고 홈으로 돌아갈까요?')) showPage('page-home');
}

// ── 정답 판정 ────────────────────────
function checkAnswer(userAns, q) {
  if (q.type === 1) {
    return extractNum(userAns) === extractNum(q.answer);
  } else {
    const a = userAns.replace(/\s+/g,'').toLowerCase();
    const b = q.answer.replace(/\s+/g,'').toLowerCase();
    return a === b || b.includes(a) || a.includes(b);
  }
}

function extractNum(s) {
  if (!s) return '';
  for (const c of s) { if (c >= '1' && c <= '5') return c; }
  return s.trim();
}

// ── 유틸 ────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function saveData() {
  localStorage.setItem('mq_stats', JSON.stringify(stats));
  localStorage.setItem('mq_wrong', JSON.stringify(wrongMap));
}

// ── 초기화 ───────────────────────────
updateHomeStats();
