// Cấu hình Supabase
const SUPABASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Z2VwbnRpaHNqcGhmdWh3bnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTI3NDksImV4cCI6MjEwMDgyODc0OX0.UQhbHVIhEV7SH0M4YtjkjBK1ceXEEuSkb8k4MjUgySw';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudents = []; // Biến toàn cục lưu danh sách sinh viên hiện tại

supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showAdmin();
});

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) return alert("Vui lòng nhập đủ email và mật khẩu!");
    
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Sai email hoặc mật khẩu! Vui lòng thử lại.");
    } else {
        showAdmin();
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('admin-section').classList.add('hidden');
}

function showAdmin() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('admin-section').classList.remove('hidden');
    loadStudents();
}

// ----------------------------------------------------
// TÍNH NĂNG CẬP NHẬT / SỬA SINH VIÊN
// ----------------------------------------------------
function editStudent(id) {
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    // Đổ dữ liệu vào form
    document.getElementById('s_id').value = student.id;
    document.getElementById('s_name').value = student.full_name || '';
    document.getElementById('s_major').value = student.major || '';
    document.getElementById('s_uni').value = student.university || '';
    document.getElementById('s_year').value = student.school_year || '';
    document.getElementById('s_email').value = student.email || '';
    document.getElementById('s_phone').value = student.phone || '';
    document.getElementById('s_facebook').value = student.facebook || '';
    document.getElementById('s_image').value = ''; // Reset file input
    
    // Đổi giao diện form sang chế độ cập nhật
    document.getElementById('form-title').innerText = "Cập nhật Hồ sơ Sinh viên";
    document.getElementById('btn-save').innerHTML = "Cập nhật thông tin";
    document.getElementById('btn-cancel').classList.remove('hidden');

    // Tự động cuộn lên form cho người dùng thấy
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    // Làm sạch form
    document.getElementById('s_id').value = '';
    document.getElementById('s_name').value = '';
    document.getElementById('s_major').value = '';
    document.getElementById('s_uni').value = '';
    document.getElementById('s_year').value = '';
    document.getElementById('s_email').value = '';
    document.getElementById('s_phone').value = '';
    document.getElementById('s_facebook').value = '';
    document.getElementById('s_image').value = '';

    // Trả giao diện về chế độ thêm mới
    document.getElementById('form-title').innerText = "Thêm Hồ sơ Sinh viên mới";
    document.getElementById('btn-save').innerHTML = "+ Lưu Hồ sơ Sinh viên";
    document.getElementById('btn-cancel').classList.add('hidden');
}

// Hàm gộp chung cả Thêm Mới và Cập Nhật
async function saveStudent() {
    const id = document.getElementById('s_id').value; // Nếu có id tức là đang Sửa
    const name = document.getElementById('s_name').value;
    const major = document.getElementById('s_major').value;
    const uni = document.getElementById('s_uni').value;
    const year = document.getElementById('s_year').value;
    const email = document.getElementById('s_email').value;
    const phone = document.getElementById('s_phone').value;
    const facebook = document.getElementById('s_facebook').value;
    const fileInput = document.getElementById('s_image');
    
    if (!name) return alert("Vui lòng nhập họ tên!");
    // Nếu là thêm mới (không có id) thì bắt buộc chọn ảnh. Nếu sửa thì không bắt buộc.
    if (!id && fileInput.files.length === 0) return alert("Vui lòng chọn ảnh đại diện!");

    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Đang xử lý...";
    btn.disabled = true;

    let publicUrl = null;

    // Chỉ upload ảnh NẾU người dùng có chọn file mới
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`; 
        
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, file);

        if (uploadError) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            return alert("Lỗi upload ảnh: " + uploadError.message);
        }

        const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
    }

    // Chuẩn bị cục dữ liệu
    const studentData = { 
        full_name: name, 
        major: major, 
        university: uni, 
        school_year: year, 
        email: email,
        phone: phone,
        facebook: facebook
    };

    // Chỉ đè ảnh mới nếu có upload
    if (publicUrl) {
        studentData.image_url = publicUrl;
    }

    let dbError;
    if (id) {
        // Lệnh UPDATE (Sửa)
        const { error } = await supabaseClient.from('students').update(studentData).eq('id', id);
        dbError = error;
    } else {
        // Lệnh INSERT (Thêm mới)
        const { error } = await supabaseClient.from('students').insert([studentData]);
        dbError = error;
    }

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (dbError) {
        alert("Lỗi lưu dữ liệu: " + dbError.message);
    } else {
        alert(id ? "Cập nhật thành công!" : "Đã thêm sinh viên thành công!");
        cancelEdit(); // Dọn dẹp form
        loadStudents(); // Tải lại danh sách
    }
}

async function loadStudents() {
    const { data, error } = await supabaseClient.from('students').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    
    currentStudents = data; // Lưu mảng data vào biến toàn cục để dùng cho hàm Sửa
    
    const tbody = document.getElementById('student-list');
    tbody.innerHTML = '';
    const STORAGE_BASE_URL = 'https://hugepntihsjphfuhwnuf.supabase.co/storage/v1/object/public/avatars/';

    data.forEach(s => {
        let finalImgUrl = s.image_url;
        if (finalImgUrl && !finalImgUrl.startsWith('http')) {
            finalImgUrl = STORAGE_BASE_URL + finalImgUrl;
        }

        tbody.innerHTML += `
            <tr>
                <td><img src="${finalImgUrl || 'https://via.placeholder.com/45'}"></td>
                <td><strong>${s.full_name}</strong></td>
                <td>${s.university || '-'}</td>
                <td>${s.school_year || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td>
                    <button class="btn-small" style="background: #f4a261; color: white;" onclick="editStudent('${s.id}')">Sửa</button>
                    <button class="btn-danger btn-small" onclick="deleteStudent('${s.id}')">Xóa</button>
                </td>
            </tr>
        `;
    });
}

async function deleteStudent(id) {
    if (confirm("Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa sinh viên này không?")) {
        await supabaseClient.from('students').delete().eq('id', id);
        loadStudents();
    }
}