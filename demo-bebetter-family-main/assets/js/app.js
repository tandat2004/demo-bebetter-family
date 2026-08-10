'use strict';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// THÔNG TIN KẾT NỐI SUPABASE CỦA BẠN
const SUPABASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Z2VwbnRpaHNqcGhmdWh3bnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTI3NDksImV4cCI6MjEwMDgyODc0OX0.UQhbHVIhEV7SH0M4YtjkjBK1ceXEEuSkb8k4MjUgySw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============================================================
   BE BETTER FAMILY — Danh mục học bổng
   Version: 1.0.0
   ============================================================ */


/* ============================================================
   1. CONFIG — Cấu hình chung
   ============================================================ */
const filterConfigs = [
  { key: 'major', containerId: 'filterMajor', countId: 'countMajor' },
  { key: 'school', containerId: 'filterSchool', countId: 'countSchool' },
  { key: 'year', containerId: 'filterYear', countId: 'countYear' },
];


/* ============================================================
   2. DataSource — Nguồn dữ liệu sinh viên từ Supabase
   ============================================================ */
const DataSource = (() => {
  async function getStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false }); // Lấy người mới nhất lên đầu

      if (error) throw error;

      // Khớp dữ liệu từ Supabase về đúng định dạng mà Frontend đang dùng
      const formattedStudents = data.map(row => ({
        dbId: row.id,      // Giữ lại ID gốc từ Supabase để so sánh khi đăng nhập
        name: row.full_name,
        major: row.major,
        school: row.university,
        year: row.school_year,
        photo: row.image_url, // Link ảnh từ Storage
        email: row.email,
        phone: row.phone,
        facebook: row.facebook,
        description: row.description ?? row.bio ?? row.about_me ?? row.self_description ?? ''
      }));

      return { students: formattedStudents, source: 'api' };
    } catch (err) {
      console.error('[DataSource] Lỗi tải dữ liệu Supabase:', err.message);
      return { students: [], source: 'error' };
    }
  }

  return { getStudents };
})();


/* ============================================================
   3. ScrollHeader — Nav đổi sang glass blur khi cuộn
   ============================================================ */
(function initScrollHeader() {
  const navEl = document.getElementById('mainNav');
  if (!navEl) return;
  const THRESHOLD = 30; // px

  function update() {
    navEl.classList.toggle('scrolled', window.scrollY > THRESHOLD);
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();


/* ============================================================
   4. State & DOM
   ============================================================ */
let students = [];

const filters = filterConfigs.reduce((state, cfg) => {
  state[cfg.key] = new Set();
  return state;
}, {});

const dom = {
  grid: document.getElementById('grid'),
  emptyState: document.getElementById('emptyState'),
  loadState: document.getElementById('loadState'),
  resultCount: document.getElementById('resultCount'),
  clearBtn: document.getElementById('clearBtn'),
};


/* ============================================================
   5. Filters — Bộ lọc
   ============================================================ */
function slugify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
}

// Lấy danh sách giá trị DUY NHẤT (không trùng lặp) từ dữ liệu sinh viên thật
function getUniqueValues(key) {
  const set = new Set();
  students.forEach(s => {
    const val = (s[key] || '').trim();
    if (val) set.add(val);
  });
  return Array.from(set);
}

// Sắp xếp: "Năm 1, Năm 2..." theo số thứ tự; còn lại theo bảng chữ cái tiếng Việt
function sortValues(key, values) {
  if (key === 'year') {
    return values.sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
      return numA - numB;
    });
  }
  return values.sort((a, b) => a.localeCompare(b, 'vi'));
}

function buildFilterGroup({ key, containerId, countId }) {
  const values = sortValues(key, getUniqueValues(key));
  const container = document.getElementById(containerId);

  // Không có sinh viên nào có giá trị -> ẩn cả nhóm bộ lọc đi
  const group = container.closest('.filter-group');
  if (group) group.style.display = values.length ? '' : 'none';

  container.innerHTML = values.map(value => {
    const id = `${key}-${slugify(value)}`;
    return `
      <label class="checkbox-item" for="${id}">
        <svg class="checkbox-item-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        <input type="checkbox" id="${id}" value="${value}">
        <span class="checkbox-box"></span>
        <span class="checkbox-text">${value}</span>
      </label>
    `;
  }).join('');

  container.addEventListener('change', (event) => {
    const cb = event.target;
    if (cb.type !== 'checkbox') return;
    cb.checked ? filters[key].add(cb.value) : filters[key].delete(cb.value);
    render();
  });
}

function initFilters() {
  filterConfigs.forEach(buildFilterGroup);
}

function clearAllFilters() {
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  filterConfigs.forEach(cfg => filters[cfg.key].clear());
  render();
}

function getFilteredStudents() {
  return students.filter(s =>
    filterConfigs.every(cfg => {
      // 1. Nếu không tick chọn bộ lọc nào ở nhóm này -> Cho hiển thị
      if (filters[cfg.key].size === 0) return true;

      // 2. Lấy thông tin sinh viên và "chuẩn hóa" (đưa về chữ thường, bỏ dấu, bỏ khoảng trắng thừa)
      // Sử dụng luôn hàm slugify đã có sẵn trong code
      const studentValue = slugify(s[cfg.key] || '');

      // 3. Kiểm tra xem thông tin sinh viên có khớp với bất kỳ checkbox nào đang tick không
      return Array.from(filters[cfg.key]).some(filterValue => {
        const filterSlug = slugify(filterValue);

        // Dùng includes thay vì === để cho phép khớp một phần
        // VD: Sinh viên học "Khoa Công nghệ thông tin", bộ lọc là "Công nghệ thông tin" -> Vẫn nhận diện được
        return studentValue.includes(filterSlug) || filterSlug.includes(studentValue);
      });
    })
  );
}


/* ============================================================
   6. Modal — Popup thông tin sinh viên
   ============================================================ */
const modal = {
  overlay: document.getElementById('studentModal'),
  closeBtn: document.getElementById('modalClose'),
  photo: document.getElementById('modalPhoto'),
  name: document.getElementById('modalStudentName'),
  year: document.getElementById('modalYear'),
  major: document.getElementById('modalMajor'),
  school: document.getElementById('modalSchool'),
  description: document.getElementById('modalDescription'),
  facebook: document.getElementById('modalFacebook'),
};

function openStudentModal(student) {
  modal.photo.src = student.photo || '';
  modal.photo.alt = `Ảnh sinh viên ${student.name}`;
  modal.name.textContent = student.name || '—';
  modal.year.textContent = student.year || '';
  modal.major.textContent = student.major || '—';
  modal.school.textContent = student.school || '—';
  modal.description.textContent = student.description || '—';
  modal.facebook.textContent = student.facebook || '—';

  // Hiện nút "Chỉnh sửa" nếu đây là hồ sơ của sinh viên đang đăng nhập
  const currentStudent = window.__getCurrentStudent ? window.__getCurrentStudent() : null;
  const editSection = document.getElementById('modalEditSection');
  const isOwn = currentStudent && student.dbId && currentStudent.id === student.dbId;
  if (editSection) editSection.style.display = isOwn ? 'block' : 'none';

  modal.overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  modal.closeBtn.focus();
}

function closeStudentModal() {
  modal.overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function initModal() {
  modal.closeBtn.addEventListener('click', closeStudentModal);
  modal.overlay.addEventListener('click', e => { if (e.target === modal.overlay) closeStudentModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.overlay.classList.contains('open')) closeStudentModal();
  });

  // Nút "Chỉnh sửa thông tin của tôi" trong modal
  const editBtn = document.getElementById('modalEditBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    closeStudentModal();
    openEditProfileModal();
  });
}


/* ============================================================
   7. Render — Vẽ giao diện
   ============================================================ */
function renderFilterCounts() {
  filterConfigs.forEach(cfg => {
    const el = document.getElementById(cfg.countId);
    const n = filters[cfg.key].size;
    el.textContent = n > 0 ? n : '';
  });
}

function renderHeroStats() {
  const el = {
    students: document.getElementById('statStudents'),
    majors: document.getElementById('statMajors'),
    schools: document.getElementById('statSchools'),
  };
  if (el.students) el.students.textContent = students.length;
  if (el.majors) el.majors.textContent = new Set(students.map(s => s.major).filter(Boolean)).size;
  if (el.schools) el.schools.textContent = new Set(students.map(s => s.school).filter(Boolean)).size;
}

function renderCard(student) {
  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Xem thông tin sinh viên ${student.name}`);

  // Kiểm tra đây có phải hồ sơ của sinh viên đầng nhập không
  const currentStudent = window.__getCurrentStudent ? window.__getCurrentStudent() : null;
  const isOwn = currentStudent && student.dbId && currentStudent.id === student.dbId;

  card.innerHTML = `
    <div class="card-photo${isOwn ? ' card-own' : ''}">
      <img src="${student.photo}" alt="Ảnh sinh viên ${student.name}" loading="lazy">
      ${isOwn ? '<div class="card-own-badge">✨ Hồ sơ của bạn</div>' : ''}
      <div class="name-overlay">
        <div class="name">${student.name}</div>
      </div>
    </div>
    <div class="card-info">
      <div class="meta">${student.major || ''}${student.school ? ' · ' + student.school : ''}</div>
      <div class="meta">${student.year || ''}</div>
    </div>
  `;

  card.addEventListener('click', () => openStudentModal(student));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudentModal(student); }
  });
  return card;
}

function render() {
  const filtered = getFilteredStudents();
  dom.grid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  filtered.forEach(s => fragment.appendChild(renderCard(s)));
  dom.grid.appendChild(fragment);

  // Xử lý để 2 thông báo không đè lên nhau
  if (students.length === 0) {
    // Nếu database hoàn toàn trống, ẩn thông báo của bộ lọc đi
    dom.emptyState.style.display = 'none';
  } else {
    // Nếu có data gốc nhưng bộ lọc không khớp, thì mới hiện thông báo bộ lọc
    dom.emptyState.style.display = filtered.length ? 'none' : 'block';
  }

  dom.resultCount.innerHTML = `Hiển thị <span>${filtered.length}</span> / ${students.length} sinh viên`;
  renderFilterCounts();
}


/* ============================================================
   8. Init — Khởi động ứng dụng
   ============================================================ */
async function init() {
  dom.clearBtn.addEventListener('click', clearAllFilters);
  initModal();

  dom.loadState.style.display = 'block';
  dom.grid.style.display = 'none';

  const { students: loaded, source } = await DataSource.getStudents();

  // Map lại dữ liệu
  const STORAGE_BASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co/storage/v1/object/public/avatars/';

  students = loaded.map((s, i) => {
    let finalPhotoUrl = '';

    if (s.photo) {
      // Nếu ảnh đã là link web (do thêm từ trang admin) thì giữ nguyên
      if (s.photo.startsWith('http')) {
        finalPhotoUrl = s.photo;
      }
      // Nếu chỉ là tên file (do nhập từ Excel) thì tự động ghép thêm đường dẫn gốc
      else {
        finalPhotoUrl = STORAGE_BASE_URL + s.photo;
      }
    }

    return {
      id: i + 1,
      dbId: s.dbId, // Giữ lại ID gốc từ Supabase
      ...s,
      photo: finalPhotoUrl
    };
  });
  if (source === 'error') {
    dom.loadState.textContent = '⚠ Lỗi tải dữ liệu từ máy chủ.';
    dom.loadState.classList.add('error');
    dom.loadState.style.display = 'block';
  } else if (students.length === 0) {
    dom.loadState.textContent = 'Chưa có dữ liệu sinh viên nào.';
    dom.loadState.style.display = 'block';
  } else {
    dom.loadState.style.display = 'none';
  }

  dom.grid.style.display = 'grid';
  initFilters();      // Build bộ lọc DỰA TRÊN dữ liệu sinh viên thật vừa tải về
  renderHeroStats();
  render();
}

init();

/* ============================================================
   9. Auth Integration — Lắng nghe sự kiện đăng nhập/đăng xuất
   ============================================================ */
window.addEventListener('studentLoggedIn', () => {
  render(); // Re-render để cập nhật badge "của bạn" trên card
});

window.addEventListener('studentLoggedOut', () => {
  render();
});

/* ============================================================
   10. Edit Profile Modal
   ============================================================ */
let editingStudentDbId = null; // ID của sinh viên đang được chỉnh sửa

function openEditProfileModal() {
  const currentStudent = window.__getCurrentStudent ? window.__getCurrentStudent() : null;
  if (!currentStudent) return;

  editingStudentDbId = currentStudent.id;

  // Điền dữ liệu vào form
  const f = (id) => document.getElementById(id);
  if (f('editMajor')) f('editMajor').value = currentStudent.major || '';
  if (f('editSchool')) f('editSchool').value = currentStudent.university || '';
  if (f('editYear')) f('editYear').value = currentStudent.school_year || '';
  if (f('editDescription')) f('editDescription').value = currentStudent.description || currentStudent.bio || currentStudent.about_me || currentStudent.self_description || '';
  if (f('editFacebook')) f('editFacebook').value = currentStudent.facebook || '';

  // Hiện ảnh đang có
  const preview = document.getElementById('editAvatarPreview');
  if (preview) {
    const STORAGE_BASE = 'https://hugepntihsjphfuhwnuf.supabase.co/storage/v1/object/public/avatars/';
    let imgUrl = currentStudent.image_url || '';
    if (imgUrl && !imgUrl.startsWith('http')) imgUrl = STORAGE_BASE + imgUrl;
    preview.src = imgUrl || '';
    preview.style.display = imgUrl ? 'block' : 'none';
  }

  // Ẩn thông báo cũ
  const msg = document.getElementById('editSaveMsg');
  if (msg) msg.style.display = 'none';

  // Mở modal
  const editOverlay = document.getElementById('editProfileModal');
  if (editOverlay) {
    editOverlay.style.display = 'flex';
    editOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeEditProfileModal() {
  const editOverlay = document.getElementById('editProfileModal');
  if (editOverlay) {
    editOverlay.classList.remove('open');
    setTimeout(() => { editOverlay.style.display = 'none'; }, 350);
  }
  document.body.style.overflow = '';
  editingStudentDbId = null;
}

async function saveStudentProfile() {
  if (!editingStudentDbId) return;

  const f = (id) => document.getElementById(id);
  const saveBtn = document.getElementById('editSaveBtn');
  const msg = document.getElementById('editSaveMsg');

  const updateData = {
    major: f('editMajor')?.value || null,
    university: f('editSchool')?.value || null,
    school_year: f('editYear')?.value || null,
    description: f('editDescription')?.value || null,
    facebook: f('editFacebook')?.value || null,
  };

  // Upload ảnh nếu có chọn file mới
  const fileInput = f('editPhotoInput');
  if (fileInput && fileInput.files.length > 0) {
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang tải ảnh...'; }
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);

    if (uploadError) {
      if (msg) { msg.textContent = '⚠ Lỗi tải ảnh: ' + uploadError.message; msg.style.display = 'block'; msg.className = 'edit-save-msg error'; }
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu thay đổi'; }
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    updateData.image_url = data.publicUrl;
  }

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', editingStudentDbId);

  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu thay đổi'; }

  if (error) {
    if (msg) { msg.textContent = '⚠ Lỗi lưu dữ liệu: ' + error.message; msg.style.display = 'block'; msg.className = 'edit-save-msg error'; }
    return;
  }

  if (msg) { msg.textContent = '✓ Đã lưu thành công!'; msg.style.display = 'block'; msg.className = 'edit-save-msg success'; }

  // Tải lại dữ liệu để cập nhật giao diện
  setTimeout(async () => {
    closeEditProfileModal();
    const { students: reloaded } = await DataSource.getStudents();
    students = reloaded.map((s, i) => {
      const STORAGE_BASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co/storage/v1/object/public/avatars/';
      let finalPhotoUrl = '';
      if (s.photo) {
        finalPhotoUrl = s.photo.startsWith('http') ? s.photo : STORAGE_BASE_URL + s.photo;
      }
      return { id: i + 1, ...s, photo: finalPhotoUrl, description: s.description ?? s.bio ?? s.about_me ?? s.self_description ?? '' };
    });
    render();
  }, 1500);
}

// Khởi tạo sự kiện cho Edit Modal
(function initEditModal() {
  const closeBtn = document.getElementById('editModalClose');
  const cancelBtn = document.getElementById('editCancelBtn');
  const saveBtn = document.getElementById('editSaveBtn');
  const overlay = document.getElementById('editProfileModal');

  if (closeBtn) closeBtn.addEventListener('click', closeEditProfileModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeEditProfileModal);
  if (saveBtn) saveBtn.addEventListener('click', saveStudentProfile);
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEditProfileModal();
  });

  // Preview ảnh khi chọn file
  const fileInput = document.getElementById('editPhotoInput');
  const preview = document.getElementById('editAvatarPreview');
  if (fileInput && preview) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(fileInput.files[0]);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) closeEditProfileModal();
  });
})();
// Xử lý đóng/mở thanh bộ lọc (accordion) — độc lập với app.js,
// nên hoạt động dù dữ liệu checkbox được app.js render trước hay sau.
(function () {
  function init() {
    var sidebar = document.querySelector('.sidebar');
    var panelToggle = document.getElementById('filterPanelToggle');

    if (panelToggle && sidebar) {
      panelToggle.addEventListener('click', function () {
        var collapsed = sidebar.classList.toggle('panel-collapsed');
        panelToggle.setAttribute('aria-expanded', String(!collapsed));
      });
    }

    document.querySelectorAll('.filter-accordion-header').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.closest('.filter-accordion');
        if (!group) return;
        var collapsed = group.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();