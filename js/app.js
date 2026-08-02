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

// تطبيع رابط لينكدإن (بتضيف https:// لو المرشد كتب الرابط من غيرها)
function normalizeLinkedinUrl(value) {
  if (!value) return "";
  let v = String(value).trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v.replace(/^\/+/, "");
  return v;
}

// أيقونة رابط لينكدإن المرشد - بتظهر بس لو المرشد حاط رابط بروفايله عند التسجيل
function linkedinIconHtml(url) {
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="linkedin-link" title="بروفايل المرشد على لينكدإن" onclick="event.stopPropagation()">🔗 لينكدإن</a>`;
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
      window.location.href = "login/";
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
      <a href="./" class="logo"><img src="assets/logo-mark.svg" alt="" width="34" height="34">BOSLA</a>
      <nav class="nav-links" id="nav-links">
        <a href="mentors/">لاقي مرشد</a>
        <a href="./#how">إزاي بتشتغل</a>
      </nav>
      <div class="nav-auth" id="nav-auth">
        <a href="login/" class="btn btn-ghost">تسجيل الدخول</a>
        <a href="register-mentee/" class="btn btn-primary">ابدأ دلوقتي</a>
      </div>
    </div>
  `;
  auth.onAuthStateChanged(user => {
    const navAuth = document.getElementById("nav-auth");
    if (user && navAuth) {
      // رابط لوحة الأدمن بيظهر بس لو الإيميل اللي داخل بيه موجود في ADMIN_EMAILS (js/firebase-config.js)
      const isAdmin = typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.includes(user.email);
      const adminLinkHtml = isAdmin ? `<a href="admin/" class="btn btn-ghost">لوحة الأدمن</a>` : "";

      navAuth.innerHTML = `
        <a href="dashboard/" class="btn btn-ghost">لوحتي</a>
        ${adminLinkHtml}
        <button class="btn btn-primary" id="logout-btn">تسجيل خروج</button>
      `;
      document.getElementById("logout-btn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "./");
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", renderHeader);

// ===================== بوت الأسئلة الشائعة (Chatbot) =====================
// أسئلة جاهزة بضغطة زرار — من غير أي API خارجي أو تكلفة. آخر خيار بيفتح فورم تواصل بسيط.
const CHATBOT_FAQ = [
  {
    q: "الدفع بيتم إزاي؟",
    a: "بتحول مبلغ الجلسة على رقم إنستاباي بتاع المرشد، وبترفع صورة إيصال التحويل. المرشد بيراجعها ويأكدها، وبعد التأكيد بيظهرلك رابط الميتينج في لوحة حسابك."
  },
  {
    q: "فلوسي بتروح فين، وإمتى المرشد ياخدها؟",
    a: "الفلوس بتتحول مباشرة من حسابك لحساب المرشد وقت التأكيد. بعد ما الجلسة تخلص ويأكدها الطرفين، المرشد بياخد المبلغ بعد خصم عمولة بسيطة لمنصة BOSLA."
  },
  {
    q: "لو المرشد ملبيش أو معملش الميتينج؟",
    a: "بلغنا فورًا من نفس الصفحة دي (زرار \"لسه عندي مشكلة\" تحت). الحالة بتتراجع يدويًا من فريق BOSLA، ولو اتأكد إن الجلسة معملتش هيتم استرجاع المبلغ."
  },
  {
    q: "بياناتي وصورة الإيصال بتتحفظ فين؟",
    a: "بتتحفظ في مساحة تخزين خاصة بـ BOSLA، ومش بتتشارك مع أي حد غير المرشد اللي حجزت معاه لغرض تأكيد الدفع بس."
  },
  {
    q: "ممكن أستفسر عن حاجة تانية؟",
    a: null // ده اللي بيفتح فورم التواصل
  }
];

function renderChatbot() {
  if (document.getElementById("bosla-chatbot-fab")) return;

  const fab = document.createElement("button");
  fab.id = "bosla-chatbot-fab";
  fab.className = "chatbot-fab";
  fab.setAttribute("aria-label", "أسئلة شائعة ومساعدة");
  fab.innerHTML = `<i class="fa-solid fa-comment-dots"></i>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "bosla-chatbot-panel";
  panel.className = "chatbot-panel";
  panel.innerHTML = `
    <div class="chatbot-header">
      <span>مساعدة BOSLA</span>
      <button class="chatbot-close" aria-label="قفل">&times;</button>
    </div>
    <div class="chatbot-body" id="chatbot-body"></div>
  `;
  document.body.appendChild(panel);

  function renderMenu() {
    const body = panel.querySelector("#chatbot-body");
    body.innerHTML = `<p class="chatbot-intro">اختار سؤالك:</p>`;
    CHATBOT_FAQ.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.className = "chatbot-option-btn";
      btn.textContent = item.q;
      btn.addEventListener("click", () => {
        if (item.a) {
          renderAnswer(item.q, item.a);
        } else {
          renderContactForm();
        }
      });
      body.appendChild(btn);
    });
  }

  function renderAnswer(q, a) {
    const body = panel.querySelector("#chatbot-body");
    body.innerHTML = `
      <div class="chatbot-answer">
        <strong>${q}</strong>
        <p>${a}</p>
      </div>
      <button class="chatbot-option-btn chatbot-back-btn">⟵ رجوع للأسئلة</button>
    `;
    body.querySelector(".chatbot-back-btn").addEventListener("click", renderMenu);
  }

  function renderContactForm() {
    const body = panel.querySelector("#chatbot-body");
    body.innerHTML = `
      <form id="chatbot-contact-form" class="chatbot-contact-form">
        <p class="chatbot-intro">اكتب مشكلتك وهنرد عليك في أقرب وقت:</p>
        <input type="text" id="cc-name" placeholder="الاسم" required>
        <input type="text" id="cc-contact" placeholder="رقم موبايل أو إيميل للرد عليك" required>
        <textarea id="cc-message" rows="3" placeholder="اكتب مشكلتك هنا" required></textarea>
        <button type="submit" class="btn btn-primary btn-block">إرسال</button>
        <button type="button" class="chatbot-option-btn chatbot-back-btn">⟵ رجوع للأسئلة</button>
      </form>
    `;
    body.querySelector(".chatbot-back-btn").addEventListener("click", renderMenu);
    body.querySelector("#chatbot-contact-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "بيتبعت...";
      const payload = {
        name: document.getElementById("cc-name").value.trim(),
        contact: document.getElementById("cc-contact").value.trim(),
        message: document.getElementById("cc-message").value.trim(),
        page: window.location.href
      };
      try {
        const res = await apiPost("submitContactMessage", payload);
        if (res && res.error) {
          showToast(res.error, "error");
          submitBtn.disabled = false;
          submitBtn.textContent = "إرسال";
          return;
        }
        body.innerHTML = `<div class="chatbot-answer"><p>تم استلام رسالتك، هنتواصل معاك في أقرب وقت 🙏</p></div>`;
      } catch (err) {
        showToast("حصل خطأ، جرب تاني", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "إرسال";
      }
    });
  }

  fab.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) renderMenu();
  });
  panel.querySelector(".chatbot-close").addEventListener("click", () => {
    panel.classList.remove("open");
  });
}

document.addEventListener("DOMContentLoaded", renderChatbot);
