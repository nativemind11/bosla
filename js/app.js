// ===================== دوال مساعدة عامة لموقع BOSLA =====================

// نداء GET للباك إند (قراءة بيانات)
async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${SCRIPT_URL}?${query}`);
  return res.json();
}

// نداء POST للباك إند (كتابة بيانات) - بنستخدم text/plain عشان نتجنب مشاكل CORS مع Apps Script
async function apiPost(action, payload = {}) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  return res.json();
}

// تحويل ملف صورة لـ Base64 (لرفع إثبات الدفع)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// تنظيف نص قبل حقنه في HTML (حماية بسيطة)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// بناء دائرة صورة البروفايل (بترجع صورة حقيقية لو موجودة، وإلا أول حرف من الاسم)
function avatarHtml(name, photoUrl, sizeClass = "") {
  const initial = escapeHtml((name || "?").trim().charAt(0) || "?");
  const cls = "mentor-avatar" + (sizeClass ? " " + sizeClass : "");
  if (photoUrl) {
    return `<div class="${cls}"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name || "")}" loading="lazy"></div>`;
  }
  return `<div class="${cls}">${initial}</div>`;
}

// نص جهة العمل/الدراسة + سنوات الخبرة كسطر واحد (بيتخطى أي حقل فاضي)
function employerExperienceLine(employer, years) {
  const parts = [];
  if (employer) parts.push(escapeHtml(employer));
  if (years !== undefined && years !== null && years !== "") parts.push(`${escapeHtml(String(years))} سنين خبرة`);
  return parts.join(" · ");
}

// بناء نص نجوم للتقييم (مثال: ★★★★☆)
function starsText(rating) {
  const r = Math.round(Number(rating) || 0);
  return "★".repeat(Math.max(0, Math.min(5, r))) + "☆".repeat(5 - Math.max(0, Math.min(5, r)));
}

// رسالة تنبيه بسيطة (Toast)
function showToast(msg, type = "success") {
  let toast = document.getElementById("bosla-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bosla-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// حماية صفحة: لازم يكون فيه مستخدم مسجل دخول
function requireAuth(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "login.html";
    } else {
      callback(user);
    }
  });
}

// تعبئة قائمة المجالات (select)
function populateFieldsSelect(selectEl) {
  selectEl.innerHTML = '<option value="">اختر المجال</option>';
  Object.keys(FIELDS).forEach(field => {
    const opt = document.createElement("option");
    opt.value = field;
    opt.textContent = field;
    selectEl.appendChild(opt);
  });
}

// تعبئة قائمة التخصصات بناءً على المجال المختار
function populateSpecializationsSelect(fieldValue, selectEl) {
  selectEl.innerHTML = '<option value="">اختر التخصص</option>';
  (FIELDS[fieldValue] || []).forEach(spec => {
    const opt = document.createElement("option");
    opt.value = spec;
    opt.textContent = spec;
    selectEl.appendChild(opt);
  });
}

// حقن الهيدر والفوتر المشترك في أي صفحة فيها عنصر #bosla-header / #bosla-footer
function renderHeader() {
  const header = document.getElementById("bosla-header");
  if (!header) return;
  header.innerHTML = `
    <div class="nav-wrap">
      <a href="index.html" class="logo"><img src="assets/logo-mark.svg" alt="" width="30" height="30">BOSLA</a>
      <nav class="nav-links" id="nav-links">
        <a href="mentors.html">لاقي مرشد</a>
        <a href="index.html#how">إزاي بتشتغل</a>
      </nav>
      <div class="nav-auth" id="nav-auth">
        <a href="login.html" class="btn btn-ghost">تسجيل الدخول</a>
        <a href="register-mentee.html" class="btn btn-primary">ابدأ دلوقتي</a>
      </div>
    </div>
  `;
  auth.onAuthStateChanged(user => {
    const navAuth = document.getElementById("nav-auth");
    if (user && navAuth) {
      navAuth.innerHTML = `
        <a href="dashboard.html" class="btn btn-ghost">لوحتي</a>
        <button class="btn btn-primary" id="logout-btn">تسجيل خروج</button>
      `;
      document.getElementById("logout-btn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "index.html");
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", renderHeader);
