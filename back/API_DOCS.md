# 📚 وثيقة الربط (API Documentation) لمشروع رابطة

**الرابط الأساسي للسيرفر (Base URL):** `http://localhost:5000/api/v1`
**طريقة المصادقة:** إرسال التوكن في الـ Headers `Authorization: Bearer <your_token>`

---

## 1️⃣ مسارات المصادقة (Authentication)

### 🟢 1. إنشاء حساب جديد (Register)
* **المسار:** `POST /auth/register`
* **الوصف:** لإنشاء حساب جديد كطالب، مستقل، أو صاحب عمل.
* **البيانات المطلوبة (Body):**
```json
{
  "fullName": "Menna ITI",
  "email": "menna@example.com",
  "phoneNumber": "01012345678",
  "password": "password123",
  "role": "student", // يجب أن يكون: 'student' أو 'freelancer' أو 'employer'
  "professionalTitle": "Front-End Developer", // تخصص الطالب أو مجال الشركة
  "location": "Aswan, Egypt",
  "bio": "شغوف بتطوير واجهات المستخدم"
}
الرد الناجح (201 Created): يرجع بيانات المستخدم + token.

🟢 2. تسجيل الدخول (Login)
المسار: POST /auth/login

البيانات المطلوبة (Body):

JSON

{
  "email": "menna@example.com",
  "password": "password123"
}
الرد الناجح (200 OK): يرجع token.

2️⃣ إدارة الملف الشخصي (Profile Management)
🔵 1. تحديث بيانات المستخدم (Update Profile)
المسار: PATCH /users/updateMe

التصريح (Auth): مطلوب (Bearer Token)

البيانات المطلوبة (Body): (ترسل فقط الحقول المراد تحديثها بناءً على دور المستخدم)

مثال لطالب / مستقل (Student/Freelancer):

JSON

{
  "professionalTitle": "Senior React Developer",
  "location": "Cairo, Egypt",
  "bio": "نبذة قصيرة عني",
  "about": "تفاصيل أكثر عن مسيرتي المهنية...",
  "skills": ["react", "node.js", "tailwind"],
  "socialLinks": {
    "github": "[https://github.com/](https://github.com/)...",
    "linkedin": "[https://linkedin.com/in/](https://linkedin.com/in/)...",
    "mostaql": ""
  },
  "featuredProjects": [
    {
      "title": "Rabta Platform",
      "description": "Telegram for techies",
      "link": "[https://rabta.app](https://rabta.app)"
    }
  ]
}
مثال لصاحب عمل / شركة (Employer):

JSON

{
  "professionalTitle": "Software Development Agency",
  "location": "Alexandria, Egypt",
  "bio": "نبذة عن شركتنا",
  "about": "نحن شركة رائدة في مجال التكنولوجيا...",
  "targetTalents": ["frontend", "backend", "ui/ux"]
}

3️⃣ البحث والاستكشاف (Search & Discovery)
🟣 1. البحث عن المستخدمين مع التقسيم لصفحات (Search Users & Pagination)
المسار: GET /users/search

التصريح (Auth): مطلوب (Bearer Token)

المعاملات (Query Parameters):

page (اختياري): رقم الصفحة (الافتراضي 1).

limit (اختياري): عدد النتائج في الصفحة (الافتراضي 10).

role (اختياري): للفلترة بنوع الحساب (student, employer).

keyword (اختياري): للبحث في الاسم، التخصص (professionalTitle)، أو المهارات.

مثال للطلب (Request): /users/search?role=student&keyword=react&page=1&limit=10

الرد الناجح (200 OK):

JSON

{
  "status": "success",
  "results": 10,
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalUsers": 48
  },
  "data": {
    "users": [ ... مصفوفة المستخدمين ... ]
  }
}

4️⃣ دليل المكالمات في الوقت الفعلي (Socket.io Real-time Calls)
للربط بخدمة المكالمات، يجب الاتصال بالرابط الأساسي للسيرفر http://localhost:5000.

📤 أحداث الإرسال (Events emitted from Frontend to Backend):
register-user: يتم إرساله فور فتح الموقع مع الـ userId لربط المتصفح بخط الاتصال.

call-user: لإجراء مكالمة. يُرسل مع البيانات التالية: { userToCall, signalData, from, callerName }.

answer-call: للرد على المكالمة. يُرسل مع البيانات التالية: { to, signal, callId }.

end-call: لإنهاء المكالمة. يُرسل مع البيانات التالية: { to }.

📥 أحداث الاستقبال (Events listened to by Frontend):
incoming-call: عندما يتصل بك شخص ما. تستقبل: { signal, from, callerName, callId }.

call-accepted: يتم استقبالها عند موافقة الطرف الآخر على المكالمة للبدء في نقل الفيديو.

user-offline: للرد بأن المستخدم غير متصل حالياً.

call-ended: يتم استقبالها عندما ينهي الطرف الآخر المكالمة.

🛑 توحيد شكل الردود (Standard Response Format)
جميع الردود من الخادم ستتبع هذا النمط ليسهل التعامل معها في الواجهة الأمامية:

في حالة النجاح (Success):

JSON

{
  "status": "success",
  "data": { ... } 
}
في حالة الخطأ (Error):

JSON

{
  "status": "error",
  "message": "وصف الخطأ هنا",
  "errors": [ ... ] // تظهر فقط في حالة أخطاء التحقق من البيانات (Validation)
}