import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.webp';
import loginImg from '../assets/images/login.webp';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Must include both username and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      const user = data.user;

      // Handle redirect according to user role and onboarding status
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.is_superuser || user.is_staff) {
        navigate('/', { replace: true });
      } else if (!user.profile?.is_onboarded) {
        navigate('/welcome', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors.join(' '));
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-container glass-phone">
      <div className="scroll flex-1 overflow-y-auto no-scrollbar">
        {/* HERO */}
        <div className="pt-7 px-6 pb-0">
          {/* TOP NAV */}
          <div className="flex justify-between items-center">
            {/* BRAND */}
            <div className="text-[34px] font-extrabold text-[#4c1d95] tracking-[-1px] leading-none drop-shadow-[0_2px_10px_rgba(124,58,237,0.12)]">
              Nutr<span className="leaf-i">i</span>Core
            </div>

            {/* LOGO */}
            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-white/95 to-white/80 border border-white/55 flex items-center justify-center backdrop-blur-[18px] shadow-[0_10px_24px_rgba(124,58,237,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <img
                src={logoImg}
                alt="NutriCore Logo"
                className="w-12 h-12 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.08)]"
                loading="eager"
                decoding="async"
                width={48}
                height={48}
              />
            </div>
          </div>

          {/* TAG */}
          <div className="w-max mt-6 px-4 py-2.5 rounded-full bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.14)] text-[#6d28d9] text-[11px] font-bold tracking-[0.6px] backdrop-blur-[14px]">
            ✦ PREMIUM FITNESS EXPERIENCE
          </div>

          {/* HEADING */}
          <div className="mt-6 text-[#3b0764] text-[52px] font-extrabold leading-[0.94] tracking-[-2.5px] drop-shadow-[0_4px_14px_rgba(124,58,237,0.08)]">
            Push Beyond
            <br />
            Your Limits
          </div>

          {/* SUB */}
          <div className="mt-5 text-[#6b21a8] text-[16px] font-medium leading-[1.8] max-w-[320px]">
            Track workouts, monitor nutrition, and transform your body with a premium fitness experience.
          </div>

          {/* IMAGE CARD */}
          <div className="mt-7 relative h-[340px] rounded-[34px] overflow-hidden bg-black shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <img
              src={loginImg}
              alt="Fitness motivation"
              className="w-full h-full object-cover brightness-[0.72] contrast-[1.05] grayscale-[10%]"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/12 to-black/8" />
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="auth-card mx-[18px] mt-6 mb-[26px] p-6">
          <div className="text-[26px] font-bold text-[#111827]">
            Welcome Back 👋
          </div>

          <div className="mt-1.5 text-[#6b7280] text-[13px]">
            Login to continue your fitness journey.
          </div>

          {/* ERROR BOX */}
          {error && (
            <div className="mt-[18px] p-[14px_16px] rounded-[18px] bg-gradient-to-br from-[#fee2e2] to-[#fecaca] border border-[#fca5a5] text-[#b91c1c] text-[13px] font-semibold flex items-center gap-2.5">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-0">
            {/* USERNAME */}
            <div className="mt-[18px]">
              <label className="block mb-2 text-[12px] font-bold text-[#4b5563]">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="w-full p-[15px_18px] rounded-[18px] border-[1.5px] border-[rgba(139,92,246,0.14)] bg-white text-[14px] text-gray-800 outline-none transition-all duration-200 focus:border-[#8b5cf6] focus:ring-4 focus:ring-[rgba(139,92,246,0.12)] box-border"
              />
            </div>

            {/* PASSWORD */}
            <div className="mt-[18px]">
              <label className="block mb-2 text-[12px] font-bold text-[#4b5563]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full p-[15px_18px] rounded-[18px] border-[1.5px] border-[rgba(139,92,246,0.14)] bg-white text-[14px] text-gray-800 outline-none transition-all duration-200 focus:border-[#8b5cf6] focus:ring-4 focus:ring-[rgba(139,92,246,0.12)] box-border pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-[15px] text-[18px] cursor-pointer opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-[26px] p-4 rounded-[22px] bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-white text-[15px] font-bold cursor-pointer transition-all duration-200 shadow-[0_14px_30px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-[18px] text-center text-[13px] text-[#6b7280]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#7c3aed] font-bold hover:underline">
              Signup
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
