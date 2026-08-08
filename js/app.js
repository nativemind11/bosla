// ===================== BUSLA Frontend — معدّل وآمن =====================
// تحسينات الأمان والأخطاء والمحاولة مجددًا

// *** تحسين 1: استخدم 'const' و timeouts محدثة ***
const API_TIMEOUT_MS = 35000;
const API_TIMEOUT_MS_WRITE = 30000;
const API_TIMEOUT_MS_UPLOAD = 55000;
const CACHE_DURATION_MS = 10 * 60 * 1000;

// *** تحسين 2: دالة withTimeout محسّنة مع رسائل خطأ أفضل ***
function withTimeout(promise, ms = API_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("الطلب استغرق وقت طويل جدًا (> " + (ms / 1000) + "ث)، جرب تاني من فضلك")), ms)
    )
  ]);
}

async function apiGet(action, params = {}) {
  const cacheKey = `bosla_cache_${new URLSearchParams({ action, ...params }).toString()}`;

  const fetchFresh = async () => {
    let idToken = null;
    try {
      if (auth.currentUser) idToken = await auth.currentUser.getIdToken();
    } catch (e) { }

    const query = new URLSearchParams({ action, ...params, ...(idToken ? { idToken } : {}) }).toString();
    const res = await withTimeout(fetch(`${SCRIPT_URL}?${query}`));
    
    // *** تحسين 3: التحقق من أن الرد JSON صحيح ***
    if (!res.ok) {
      throw new Error(`خطأ من السيرفر: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    try { localStorage.setItem(cacheKey, JSON.stringify({ data, time: Date.now() })); } catch (e) {}
    return data;
  };

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, time } = JSON.parse(cached);
      if (Date.now() - time < CACHE_DURATION_MS) {
        fetchFresh().catch(() => {});
        return data;
      }
    }
  } catch (e) { }

  return fetchFresh();
}

function clearApiCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("bosla_cache_"))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// *** تحسين 4: دالة apiPost محسّنة مع معالجة أفضل للأخطاء ***
async function apiPost(action, payload = {}, timeoutMs = API_TIMEOUT_MS_WRITE) {
  let idToken = null;
  try {
    if (auth.currentUser) idToken = await auth.currentUser.getIdToken();
  } catch (e) { }

  const res = await withTimeout(fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload, ...(idToken ? { idToken } : {}) })
  }), timeoutMs);
  
  // *** تحسين 5: التحقق من رد السيرفر ***
  if (!res.ok) {
    throw new Error(`خطأ من السيرفر: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  clearApiCache();
  return data;
}

// *** تحسين 6: دالة retry محسّنة لإعادة المحاولة تلقائيًا عند الفشل ***
async function apiPostWithRetry(action, payload = {}, timeoutMs = API_TIMEOUT_MS_WRITE, maxRetries = 2) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiPost(action, payload, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // انتظر قبل إعادة المحاولة (exponential backoff: 1ث، 2ث)
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// تحويل ملف صورة لـ Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// *** تحسين 7: ضغط صورة محسّن مع معالجة أفضل للأخطاء ***
function compressImageFile(file, maxDimension = 1600, quality = 0.72) {
  return new Promise((resolve) => {
    try {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        resolve(file);
        return;
      }
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      // *** تحسين 8: معالجة timeout لتحميل الصورة ***
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // fallback: استخدم الملف الأصلي
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round(height * (maxDimension / width));
              width = maxDimension;
            } else {
              width = Math.round(width * (maxDimension / height));
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size >= file.size) {
              resolve(file);
              return;
            }
            resolve(new File([blob], file.name || "image.jpg", { type: "image/jpeg" }));
          }, "image/jpeg", quality);
        } catch (e) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    } catch (e) {
      resolve(file);
    }
  });
}

// تنظيف النص قبل حقنه في HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// بناء صورة البروفايل
function avatarHtml(name, photoUrl, sizeClass = "") {
  const initial = escapeHtml((name || "?").trim().charAt(0) || "?");
  const cls = "mentor-avatar" + (sizeClass ? " " + sizeClass : "");
  if (photoUrl) {
    return `<div class="${cls}"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name || "")}" loading="lazy" onerror="this.parentElement.textContent='${initial}'"></div>`;
  }
  return `<div class="${cls}">${initial}</div>`;
}

function employerExperienceLine(employer, years) {
  const parts = [];
  if (employer) parts.push(escapeHtml(employer));
  if (years !== undefined && years !== null && years !== "") parts.push(`${escapeHtml(String(years))} سنين خبرة`);
  return parts.join(" · ");
}

function normalizeLinkedinUrl(value) {
  if (!value) return "";
  let v = String(value).trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v.replace(/^\/+/, "");
  return v;
}

function linkedinIconHtml(url) {
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="linkedin-link" title="بروفايل المرشد على لينكدإن" onclick="event.stopPropagation()">🔗 لينكدإن</a>`;
}

function starsText(rating) {
  const r = Math.round(Number(rating) || 0);
  return "★".repeat(Math.max(0, Math.min(5, r))) + "☆".repeat(5 - Math.max(0, Math.min(5, r)));
}

// *** تحسين 9: رسائل Toast محسّنة مع الإغلاق التلقائي ***
function showToast(msg, type = "success") {
  let toast = document.getElementById("bosla-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bosla-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      right: 24px;
      max-width: 400px;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideUp 0.3s ease;
      font-family: inherit;
    `;
    document.body.appendChild(toast);

    if (!document.getElementById("bosla-toast-style")) {
      const style = document.createElement("style");
      style.id = "bosla-toast-style";
      style.textContent = `
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  toast.textContent = msg;
  toast.style.background = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
  toast.style.color = "#fff";
  toast.style.display = "block";

  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// *** تحسين 10: دالة للتحقق من نوع الملف المرفوع ***
function validateImageFile(file, maxSizeMB) {
  if (!file) return { valid: false, error: "لا يوجد ملف محدد" };
  
  const validTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "يجب أن يكون الملف صورة JPG أو PNG" };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return { valid: false, error: `حجم الصورة أكبر من ${maxSizeMB} ميجا` };
  }

  return { valid: true };
}

// رندر رأس الصفحة
function renderHeader() {
  const navAuth = document.getElementById("nav-auth");
  if (!navAuth) return;

  auth.onAuthStateChanged((user) => {
    if (!user) {
      navAuth.innerHTML = `
        <button type="button" class="theme-toggle-btn" id="theme-toggle-btn" title="بدّل الوضع الليلي/النهاري" aria-label="بدّل الوضع الليلي/النهاري">
          <span class="theme-icon-sun">☀️</span><span class="theme-icon-moon">🌙</span>
        </button>
        <a href="login/" class="btn btn-primary">دخول / تسجيل</a>
      `;
      document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
    } else {
      const isAdmin = typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.includes(user.email);
      const adminLinkHtml = isAdmin ? `<a href="admin/" class="btn btn-ghost">لوحة الأدمن</a>` : "";

      navAuth.innerHTML = `
        <button type="button" class="theme-toggle-btn" id="theme-toggle-btn" title="بدّل الوضع الليلي/النهاري" aria-label="بدّل الوضع الليلي/النهاري">
          <span class="theme-icon-sun">☀️</span><span class="theme-icon-moon">🌙</span>
        </button>
        <a href="dashboard/" class="btn btn-ghost">لوحتي</a>
        ${adminLinkHtml}
        <button class="btn btn-primary" id="logout-btn">تسجيل خروج</button>
      `;
      document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
      document.getElementById("logout-btn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "./");
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", renderHeader);

// ===================== Chatbot =====================
const MENTEE_FAQ = [
  {
    q: "كيف تتم عملية الدفع؟",
    a: "يتم تحويل قيمة الجلسة إلى رقم إنستاباي الرسمي الخاص بمنصة BUSLA (وليس لحساب المرشد مباشرة)، ثم رفع صورة إيصال التحويل على المنصة. بعد مراجعة فريق BUSLA للإيصال وتأكيده، يظهر رابط الاجتماع في لوحة حسابك."
  },
  {
    q: "إلى أين تذهب الأموال، ومتى يستلمها المرشد؟",
    a: "المبلغ بيتحول أول حاجة لحساب BUSLA، مش لحساب المرشد مباشرة. وبعد انتهاء الجلسة وتأكيدها من الطرفين (المستفيد والمرشد)، تقوم BUSLA بتحويل نصيب المرشد على رقم الإنستاباي المسجل في حسابه، بعد خصم عمولة المنصة (10%)."
  },
  {
    q: "ماذا لو لم يحضر المرشد أو لم يُرسل رابط الاجتماع؟",
    a: "يمكنك التبليغ فورًا من خلال زر \"لسه عندي مشكلة\" في هذه الصفحة. سيراجع فريق BUSLA الحالة يدويًا، وفي حال ثبوت عدم انعقاد الجلسة يتم استرداد المبلغ المدفوع."
  },
  {
    q: "أين يتم حفظ بياناتي وصورة إيصال الدفع؟",
    a: "تُحفظ بياناتك وصورة الإيصال في مساحة تخزين خاصة بمنصة BUSLA، ولا تتم مشاركتها مع أي طرف سوى المرشد الذي حجزت معه، وذلك بغرض تأكيد الدفع فقط."
  },
  {
    q: "هل لديك استفسار آخر؟",
    a: null
  }
];

const MENTOR_FAQ = [
  {
    q: "كيف أستلم مستحقاتي المالية؟",
    a: "يقوم المستفيد بتحويل قيمة الجلسة إلى رقم إنستاباي BUSLA الرسمي (مش لحسابك مباشرة)، ويرفع صورة إيصال التحويل. يراجع فريق BUSLA الإيصال ويؤكده، وبعد انتهاء الجلسة وتأكيدها من الطرفين، تحول BUSLA نصيبك على رقم الإنستاباي المسجل في حسابك، بعد خصم عمولة المنصة (10%)."
  },
  {
    q: "هل هناك عمولة على المنصة؟",
    a: "نعم، تخصم BUSLA عمولة 10% من قيمة كل جلسة مدفوعة مقابل استخدام المنصة وخدمات المتابعة والدعم الفني."
  },
  {
    q: "كيف يظهر رابط الاجتماع للمستفيد؟",
    a: "تقوم بإضافة رابط الاجتماع الخاص بك من لوحة حسابك، وسيظهر تلقائيًا للمستفيد فور تأكيد الحجز."
  },
  {
    q: "ماذا لو لم يحضر المستفيد إلى الجلسة؟",
    a: "يمكنك الإبلاغ عن ذلك من لوحة حسابك، وسيقوم فريق BUSLA بمراجعة الحالة والتواصل مع المستفيد لمعرفة السبب."
  },
  {
    q: "هل لديك استفسار آخر؟",
    a: null
  }
];

function getActiveFaq() {
  const role = window.__boslaRole || "";
  if (role === "mentor") return MENTOR_FAQ;
  if (role === "mentee") return MENTEE_FAQ;
  if (window.location.pathname.includes("register-mentor")) return MENTOR_FAQ;
  return MENTEE_FAQ;
}

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
      <span>مساعدة BUSLA</span>
      <button class="chatbot-close" aria-label="قفل">&times;</button>
    </div>
    <div class="chatbot-body" id="chatbot-body"></div>
  `;
  document.body.appendChild(panel);

  function renderMenu() {
    const body = panel.querySelector("#chatbot-body");
    body.innerHTML = `<p class="chatbot-intro">اختر سؤالك:</p>`;
    getActiveFaq().forEach((item, i) => {
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

// *** دالة toggle theme ***
function toggleTheme() {
  try {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bosla_theme", next);
  } catch (e) { }
}
