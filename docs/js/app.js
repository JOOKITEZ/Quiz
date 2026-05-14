/* ═══════════════════════════════════
   MedQuiz — App Logic
   ═══════════════════════════════════ */

// ── 과목별 JSON 파일 목록 설정 ─────────────────────────────────────
// 새 JSON 파일을 추가할 때 이 목록에 경로를 추가하세요
const QUESTION_FILES = {
  '내과': [
    'data/내과/필수_187.json',
    'data/내과/필수_190.json',
    'data/내과/필수_418.json',
    'data/내과/필수_451.json',
    'data/내과/필수_632.json',
  ],
  '산부인과': [
    'data/산부인과/산부인과_001.json',
  ],
  '소아청소년과': [
    'data/소아청소년과/소아청소년과_001.json',
  ],
  '응급의학과': [
    'data/응급의학과/응급의학과_001.json',
  ],
};

// ── State ────────────────────────────────────────────────────────────
let state = {
  currentDept: null,
  questions: [],
  currentIndex: 0,
  correctCount: 0,
  wrongCount: 0,
  wrongQuestions: [],   // 오답 누적 (전 세션 포함)
  sessionWrong: [],     // 이번 세션 오답
  isReviewMode: false,
  totalAnswered: 0,
  totalCorrect: 0,
};

// ── LocalStorage helpers ─────────────────────────────────────────────
function saveWrongQuestions() {
  try {
    localStorage.setItem('medquiz_wrong', JSON.stringify(state.wrongQuestions));
  } catch (e) { console.warn('localStorage unavailable'); }
}

function loadWrongQuestions() {
  try {
    const data = localStorage.getItem('medquiz_wrong');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveGlobalStats() {
  try {
    localStorage.setItem('medquiz_stats', JSON.stringify({
      totalAnswered: state.totalAnswered,
      totalCorrect: state.totalCorrect,
    }));
  } catch (e) {}
}

function loadGlobalStats() {
  try {
    const data = localStorage.getItem('medquiz_stats');
    return data ? JSON.parse(data) : { totalAnswered: 0, totalCorrect: 0 };
  } catch (e) { return { totalAnswered: 0, totalCorrect: 0 }; }
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.wrongQuestions = loadWrongQuestions();
  const stats = loadGlobalStats();
  state.totalAnswered = stats.totalAnswered;
  state.totalCorrect  = stats.totalCorrect;
  updateLandingStats();
});

function updateLandingStats() {
  const wrong = state.wrongQuestions.length;
  document.getElementById('wrong-count-badge').textContent = wrong + '문제';

  const total   = state.totalAnswered;
  const correct = state.totalCorrect;
  const wrongSt = total - correct;
  const rate    = total > 0 ? Math.round(correct / total * 100) : 0;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-correct').textContent = correct;
  document.getElementById('stat-wrong').textContent   = wrongSt;
  document.getElementById('stat-rate').textContent    = rate + '%';
}

// ── Page switcher ─────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goHome() {
  updateLandingStats();
  showPage('page-landing');
}

// ── Load Questions ─────────────────────────────────────────────────────
async function loadQuestionsForDept(dept) {
  const files = QUESTION_FILES[dept] || [];
  const questions = [];
  for (const path of files) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const json = await res.json();
      json._dept = dept;
      questions.push(json);
    } catch (e) {
      console.warn('Failed to load:', path, e);
    }
  }
  return questions;
}

function parseQuestion(q) {
  // question 텍스트에서 선택지 파싱
  const text  = q.question || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 선택지 패턴: 숫자) 또는 숫자. 시작
  const choicePattern = /^([1-5])[)\.]\s*/;
  const choices = [];
  const questionLines = [];

  for (const line of lines) {
    if (choicePattern.test(line)) {
      choices.push(line);
    } else {
      questionLines.push(line);
    }
  }

  return {
    id:       q.qa_id,
    dept:     q._dept || '내과',
    qText:    questionLines.join('\n'),
    choices:  choices,
    answer:   (q.answer || '').trim(),
  };
}

// ── Shuffle array ─────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Start Quiz ─────────────────────────────────────────────────────────
async function startQuiz(dept) {
  state.currentDept = dept;
  state.isReviewMode = false;

  const raw = await loadQuestionsForDept(dept);
  if (!raw.length) {
    alert(`${dept} 문제를 불러오지 못했습니다.\ndata/${dept}/ 폴더에 JSON 파일을 확인해주세요.`);
    return;
  }

  state.questions   = shuffle(raw.map(parseQuestion));
  state.currentIndex = 0;
  state.correctCount = 0;
  state.wrongCount   = 0;
  state.sessionWrong = [];

  showPage('page-quiz');
  renderQuestion();
}

// ── Start Review (오답 복습) ─────────────────────────────────────────
async function startReview() {
  if (!state.wrongQuestions.length) {
    alert('저장된 오답이 없습니다!\n문제를 먼저 풀어보세요.');
    return;
  }
  state.isReviewMode = true;
  state.currentDept  = '오답복습';
  state.questions    = shuffle([...state.wrongQuestions]);
  state.currentIndex = 0;
  state.correctCount = 0;
  state.wrongCount   = 0;
  state.sessionWrong = [];

  showPage('page-quiz');
  renderQuestion();
}

// ── Render Question ────────────────────────────────────────────────────
function renderQuestion() {
  const q     = state.questions[state.currentIndex];
  const total = state.questions.length;
  const idx   = state.currentIndex;

  // Topbar
  document.getElementById('quiz-dept-label').textContent = state.currentDept;
  document.getElementById('quiz-counter').textContent    = `${idx + 1} / ${total}`;
  document.getElementById('mini-correct').textContent    = `✓ ${state.correctCount}`;
  document.getElementById('mini-wrong').textContent      = `✗ ${state.wrongCount}`;

  // Progress bar
  const pct = Math.round((idx / total) * 100);
  document.getElementById('progress-fill').style.width  = pct + '%';

  // Question
  document.getElementById('q-number').textContent = `Q.${idx + 1}`;
  document.getElementById('q-text').textContent   = q.qText;

  // Choices
  const list = document.getElementById('choices-list');
  list.innerHTML = '';
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.setAttribute('data-choice', choice);
    btn.innerHTML = `<span class="choice-num">${i + 1}</span><span>${choice}</span>`;
    btn.onclick = () => selectAnswer(btn, choice, q);
    list.appendChild(btn);
  });

  // Reset reveal
  const reveal = document.getElementById('answer-reveal');
  reveal.classList.remove('visible');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Select Answer ──────────────────────────────────────────────────────
function selectAnswer(clickedBtn, selected, q) {
  // Disable all buttons
  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  const isCorrect = isAnswerCorrect(selected, q.answer);

  // Highlight chosen
  clickedBtn.classList.add(isCorrect ? 'correct-choice' : 'wrong-choice');

  // Always show correct answer
  document.querySelectorAll('.choice-btn').forEach(b => {
    const c = b.getAttribute('data-choice');
    if (isAnswerCorrect(c, q.answer)) {
      b.classList.add('correct-choice');
    }
  });

  // Update counts
  if (isCorrect) {
    state.correctCount++;
    state.totalCorrect++;

    // 오답 목록에서 제거 (복습 성공)
    state.wrongQuestions = state.wrongQuestions.filter(wq => wq.id !== q.id);
    saveWrongQuestions();
  } else {
    state.wrongCount++;

    // 오답 추가 (중복 방지)
    const exists = state.wrongQuestions.some(wq => wq.id === q.id);
    if (!exists) {
      state.wrongQuestions.push(q);
      saveWrongQuestions();
    }
    state.sessionWrong.push(q);
  }

  state.totalAnswered++;
  saveGlobalStats();

  // Show reveal
  const banner = document.getElementById('answer-banner');
  const detail = document.getElementById('answer-detail');
  const reveal = document.getElementById('answer-reveal');

  if (isCorrect) {
    banner.textContent = '✓ 정답입니다!';
    banner.className = 'answer-banner correct-banner';
  } else {
    banner.textContent = '✗ 오답입니다';
    banner.className = 'answer-banner wrong-banner';
  }

  detail.textContent = `정답: ${q.answer}`;

  // 마지막 문제
  const isLast = state.currentIndex >= state.questions.length - 1;
  document.getElementById('next-btn').textContent = isLast ? '결과 보기 →' : '다음 문제 →';

  reveal.classList.add('visible');

  // Update mini score
  document.getElementById('mini-correct').textContent = `✓ ${state.correctCount}`;
  document.getElementById('mini-wrong').textContent   = `✗ ${state.wrongCount}`;
}

function isAnswerCorrect(selected, answer) {
  // 숫자 번호만 추출해 비교
  const extractNum = s => {
    const m = s.match(/^(\d)/);
    return m ? m[1] : s.trim().toLowerCase();
  };
  return extractNum(selected) === extractNum(answer);
}

// ── Next Question ──────────────────────────────────────────────────────
function nextQuestion() {
  if (state.currentIndex >= state.questions.length - 1) {
    showResult();
    return;
  }
  state.currentIndex++;
  renderQuestion();
}

// ── Show Result ────────────────────────────────────────────────────────
function showResult() {
  const total   = state.questions.length;
  const correct = state.correctCount;
  const wrong   = state.wrongCount;
  const rate    = total > 0 ? Math.round(correct / total * 100) : 0;

  // Emoji / title
  let emoji, title;
  if (rate >= 90)     { emoji = '🏆'; title = '완벽합니다!'; }
  else if (rate >= 70) { emoji = '🎉'; title = '잘 하셨어요!'; }
  else if (rate >= 50) { emoji = '📚'; title = '조금 더 공부가 필요해요'; }
  else                 { emoji = '💪'; title = '오답 복습으로 실력을 키워봐요'; }

  document.getElementById('result-emoji').textContent  = emoji;
  document.getElementById('result-title').textContent  = title;
  document.getElementById('ring-pct').textContent      = rate + '%';
  document.getElementById('res-correct').textContent   = correct;
  document.getElementById('res-wrong').textContent     = wrong;
  document.getElementById('res-total').textContent     = total;

  // Ring animation
  const ring = document.getElementById('score-ring');
  const circumference = 2 * Math.PI * 50; // r=50
  const offset = circumference - (rate / 100) * circumference;
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = rate >= 70 ? 'var(--green)' : rate >= 50 ? 'var(--yellow)' : 'var(--red)';
  }, 200);

  // Hide retry wrong if no session wrongs
  document.getElementById('retry-wrong-btn').style.display =
    state.sessionWrong.length > 0 ? 'block' : 'none';

  showPage('page-result');
  updateLandingStats();
}

// ── Retry Wrong ────────────────────────────────────────────────────────
function retryWrong() {
  if (!state.sessionWrong.length && !state.wrongQuestions.length) {
    alert('오답이 없습니다!');
    return;
  }
  const source = state.sessionWrong.length ? state.sessionWrong : state.wrongQuestions;
  state.questions    = shuffle([...source]);
  state.currentIndex = 0;
  state.correctCount = 0;
  state.wrongCount   = 0;
  state.sessionWrong = [];
  state.isReviewMode = true;
  state.currentDept  = '오답복습';

  showPage('page-quiz');
  renderQuestion();
}

// ── Restart Same ───────────────────────────────────────────────────────
async function restartSame() {
  if (state.isReviewMode) {
    await startReview();
  } else {
    await startQuiz(state.currentDept);
  }
}
