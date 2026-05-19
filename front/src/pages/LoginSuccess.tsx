import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import axiosInstance from "../api/axiosInstance";
import toast from "react-hot-toast";

export const LoginSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const processed = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (processed.current) return;
    processed.current = true;

    const processLogin = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get("token");
      const profileCompleteStr = params.get("profileComplete");
      const profileComplete = profileCompleteStr === "true";

      if (!token) {
        toast.error("Authentication failed. Missing token.");
        navigate("/login");
        return;
      }

      try {
        // 1. Immediately save token so axiosInstance can use it
        localStorage.setItem("token", token);
        console.log("[Google Auth] Token saved to localStorage.");

        // 2. Fetch the user profile from the backend
        const response = await axiosInstance.get("/profile/me");
        const user = response.data.data.user;
        console.log("[Google Auth] User fetched:", user);

        // 3. Save to Redux
        dispatch(setCredentials({ user, token }));
        toast.success("Successfully logged in with Google!");

        // 4. Redirect logically
        if (user.role === "employer" && profileComplete) {
          navigate("/employer-dashboard", { replace: true });
        } else if (!profileComplete) {
          navigate("/setup-profile", { replace: true });
        } else {
          navigate("/freelancer-dashboard", { replace: true });
        }
      } catch (error) {
        console.error("Failed to fetch user profile during Google Login", error);
        localStorage.removeItem("token");
        toast.error("Authentication failed. Please try again.");
        navigate("/login");
      }
    };

    processLogin();
  }, [location, navigate, dispatch]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5]">
      <div className="w-16 h-16 border-4 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin mb-4"></div>
      <h2 className="text-xl font-bold">Authenticating...</h2>
      <p className="text-gray-500 dark:text-gray-400">Please wait while we log you in securely.</p>
    </div>
  );
};
