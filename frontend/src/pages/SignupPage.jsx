import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.png';
import signupImg from '../assets/images/signup.jpg';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    const clientErrors = [];
    if (!formData.username.trim()) {
      clientErrors.push('Username is required.');
    }
    if (!formData.email.trim()) {
      clientErrors.push('Email is required.');
    }
    if (!formData.password) {
      clientErrors.push('Password is required.');
    }
    if (formData.password !== formData.password_confirm) {
      clientErrors.push("Password fields didn't match.");
    }

    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        password_confirm: formData.password_confirm,
      });

      // After successful signup, redirect to Welcome page (as in Django signup view)
      navigate('/welcome', { replace: true });
    } catch (err) {
      const serverErrors = [];
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          serverErrors.push(data);
        } else if (Array.isArray(data)) {
          serverErrors.push(...data);
        } else if (typeof data === 'object') {
          Object.entries(data).forEach(([key, msgs]) => {
            const fieldLabel = key === 'password_confirm' || key === 'password2' ? 'Confirm Password' : key;
            if (Array.isArray(msgs)) {
              msgs.forEach((m) => serverErrors.push(`${fieldLabel}: ${m}`));
            } else if (typeof msgs === 'string') {
              serverErrors.push(`${fieldLabel}: ${msgs}`);
            }
          });
        }
      } else {
        serverErrors.push('Registration failed. Please check your network and try again.');
      }
      setErrors(serverErrors.length ? serverErrors : ['Registration failed.']);
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
              />
            </div>
          </div>

          {/* TAG */}
          <div className="w-max mt-6 px-4 py-2.5 rounded-full bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.14)] text-[#6d28d9] text-[11px] font-bold tracking-[0.6px] backdrop-blur-[14px]">
            ✦ START YOUR FITNESS JOURNEY
          </div>

          {/* HEADING */}
          <div className="mt-6 text-[#3b0764] text-[48px] font-extrabold leading-[0.94] tracking-[-2px] drop-shadow-[0_4px_14px_rgba(124,58,237,0.08)]">
            Build Your
            <br />
            Dream Body
          </div>

          {/* SUB */}
          <div className="mt-5 text-[#6b21a8] text-[16px] font-medium leading-[1.8] max-w-[320px]">
            Join thousands transforming their fitness, nutrition, and lifestyle with NutriCore.
          </div>

          {/* IMAGE CARD */}
          <div className="mt-7 relative h-[260px] rounded-[34px] overflow-hidden bg-black shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <img
              src={signupImg}
              alt="Fitness transformation"
              className="w-full h-full object-cover brightness-[0.76] contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/12 to-black/8" />
          </div>
        </div>

        {/* SIGNUP CARD */}
        <div className="auth-card mx-[18px] mt-6 mb-[26px] p-6">
          <div className="text-[26px] font-bold text-[#111827]">
            Create Account 🚀
          </div>

          <div className="mt-1.5 text-[#6b7280] text-[13px]">
            Start your premium fitness journey today.
          </div>

          {/* ERROR BOX */}
          {errors.length > 0 && (
            <div className="mt-[18px] p-[14px_16px] rounded-[18px] bg-gradient-to-br from-[#fee2e2] to-[#fecaca] border border-[#fca5a5] text-[#b91c1c] text-[13px] font-semibold space-y-1">
              {errors.map((msg, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span>❌</span>
                  <span>{msg}</span>
                </div>
              ))}
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
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                required
                className="w-full p-[15px_18px] rounded-[18px] border-[1.5px] border-[rgba(139,92,246,0.14)] bg-white text-[14px] text-gray-800 outline-none transition-all duration-200 focus:border-[#8b5cf6] focus:ring-4 focus:ring-[rgba(139,92,246,0.12)] box-border"
              />
            </div>

            {/* EMAIL */}
            <div className="mt-[18px]">
              <label className="block mb-2 text-[12px] font-bold text-[#4b5563]">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email"
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create password"
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

            {/* CONFIRM PASSWORD */}
            <div className="mt-[18px]">
              <label className="block mb-2 text-[12px] font-bold text-[#4b5563]">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="password_confirm"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  required
                  className="w-full p-[15px_18px] rounded-[18px] border-[1.5px] border-[rgba(139,92,246,0.14)] bg-white text-[14px] text-gray-800 outline-none transition-all duration-200 focus:border-[#8b5cf6] focus:ring-4 focus:ring-[rgba(139,92,246,0.12)] box-border pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-[15px] text-[18px] cursor-pointer opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
                >
                  {showConfirmPassword ? '👁️' : '🙈'}
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
                'Create Account'
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-[18px] text-center text-[13px] text-[#6b7280]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#7c3aed] font-bold hover:underline">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
