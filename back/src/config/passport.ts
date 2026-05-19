import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // ⚠️ تأكدي إن اللينك ده هو نفس اللي مكتوب في Google Cloud Console بالظبط
      callbackURL: '/api/v1/auth/google/callback', 
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. هل المستخدم موجود بالفعل باستخدام الإيميل؟
        let user = await User.findOne({ email: profile.emails?.[0].value });

        if (user) {
          // إذا كان موجوداً ولم يربط حساب جوجل من قبل، قم بربطه أوتوماتيكياً (تسهيلاً لليوزر)
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save(); // ده هيشتغل عادي لأن اليوزر متسجل برقم تليفونه مسبقاً
          }
          // تسجيل دخول ناجح
          return done(null, user);
        }

        // 2. التعديل الجوهري: إذا لم يكن موجوداً، نرفض الطلب بدلاً من إنشاء حساب!
        // لا يمكننا إنشاء حساب بدون رقم هاتف، لذلك نعيد false (فشل تسجيل الدخول)
        return done(null, false, { message: 'This account is not registered with us. Please create an account with the phone number first.' });

      } catch (error) {
        done(error, undefined);
      }
    }
  )
);