'use strict';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ============================================================
   AUTH MODULE — Xac thuc sinh vien qua Supabase Auth
   Moi sinh vien co email ao: cfXXX@bebetter.vn
   ============================================================ */

const SUPABASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Z2VwbnRpaHNqcGhmdWh3bnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTI3NDksImV4cCI6MjEwMDgyODc0OX0.UQhbHVIhEV7SH0M4YtjkjBK1ceXEEuSkb8k4MjUgySw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EMAIL_DOMAIN = '@bebetter.vn';

let currentSession = null;
let currentStudentRecord = null;

/* DOM Elements */
const loginOverlay   = document.getElementById('loginOverlay');
const loginCFInput   = document.getElementById('loginCF');
const loginPassInput = document.getElementById('loginPassword');
const loginError     = document.getElementById('loginError');
const loginBtn       = document.getElementById('loginSubmitBtn');

const navUserInfo    = document.getElementById('navUserInfo');
const navUserName    = document.getElementById('navUserName');
const navUserAvatar  = document.getElementById('navUserAvatar');
const navLogoutBtn   = document.getElementById('navLogoutBtn');

function cfToEmail(cfCode) {
  return cfCode.trim().toLowerCase() + EMAIL_DOMAIN;
}

function showLoginOverlay() {
  if (loginOverlay) {
    loginOverlay.style.display = 'flex';
    loginOverlay.classList.add('active');
    setTimeout(() => { if (loginCFInput) loginCFInput.focus(); }, 100);
  }
}

function hideLoginOverlay() {
  if (loginOverlay) {
    loginOverlay.classList.remove('active');
    setTimeout(() => { loginOverlay.style.display = 'none'; }, 400);
  }
}

function updateNavUI(student) {
  if (!student) return;
  const initials = (student.full_name || student.name || 'SV')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (navUserAvatar) navUserAvatar.textContent = initials;
  if (navUserName) navUserName.textContent = student.full_name || student.name || '';
  if (navUserInfo) navUserInfo.style.display = 'flex';
  if (navLogoutBtn) navLogoutBtn.style.display = 'flex';
}

function resetNavUI() {
  if (navUserInfo) navUserInfo.style.display = 'none';
  if (navLogoutBtn) navLogoutBtn.style.display = 'none';
}

async function fetchStudentByCF(cfCode) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('cf_code', cfCode.trim().toUpperCase())
    .single();
  if (error || !data) return null;
  return data;
}

async function studentLogin() {
  const cfCode   = loginCFInput ? loginCFInput.value.trim() : '';
  const password = loginPassInput ? loginPassInput.value : '';

  if (!cfCode)   return showError('Vui lòng nhập mã CF.');
  if (!password) return showError('Vui lòng nhập mật khẩu.');

  hideError();
  setLoginLoading(true);

  const email = cfToEmail(cfCode);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setLoginLoading(false);
    showError('Mã CF hoặc mật khẩu không đúng. Vui lòng thử lại.');
    if (loginPassInput) loginPassInput.value = '';
    return;
  }

  const studentRecord = await fetchStudentByCF(cfCode);
  currentSession = data.session;
  currentStudentRecord = studentRecord;

  setLoginLoading(false);
  hideLoginOverlay();
  updateNavUI(studentRecord || { full_name: cfCode });

  window.dispatchEvent(new CustomEvent('studentLoggedIn', {
    detail: { session: data.session, student: studentRecord, cfCode }
  }));
}

async function studentLogout() {
  await supabase.auth.signOut();
  currentSession = null;
  currentStudentRecord = null;
  resetNavUI();
  showLoginOverlay();
  window.dispatchEvent(new CustomEvent('studentLoggedOut'));
}

function setLoginLoading(loading) {
  if (!loginBtn) return;
  loginBtn.disabled = loading;
  loginBtn.textContent = loading ? 'Đang xác thực...' : 'Đăng nhập';
}

function showError(msg) {
  if (loginError) { loginError.textContent = msg; loginError.style.display = 'flex'; }
}

function hideError() {
  if (loginError) { loginError.style.display = 'none'; loginError.textContent = ''; }
}

window.__studentLogin  = studentLogin;
window.__studentLogout = studentLogout;
window.__getStudentSession = () => currentSession;
window.__getCurrentStudent = () => currentStudentRecord;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentSession = session;
    const cfCode = session.user.email.replace(EMAIL_DOMAIN, '').toUpperCase();
    const studentRecord = await fetchStudentByCF(cfCode);
    currentStudentRecord = studentRecord;
    updateNavUI(studentRecord || { full_name: cfCode });
    hideLoginOverlay();
    window.dispatchEvent(new CustomEvent('studentLoggedIn', {
      detail: { session, student: studentRecord, cfCode }
    }));
  } else {
    showLoginOverlay();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && loginOverlay && loginOverlay.classList.contains('active')) {
    studentLogin();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
