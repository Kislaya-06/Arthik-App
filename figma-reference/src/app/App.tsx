import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// ─── Screen list for dot nav ──────────────────────────────────────────────────
type Screen = "splash" | "onboarding-1" | "onboarding-2" | "onboarding-3" | "login" | "signup" | "profile-setup" | "home" | "add-expense" | "expense-detail" | "history" | "insights" | "profile-tab" | "manage-categories" | "add-edit-category";

const SCREEN_ORDER: Screen[] = [
  "splash", "onboarding-1", "onboarding-2", "onboarding-3",
  "login", "signup", "profile-setup", "home", "add-expense", "expense-detail", "history", "insights", "profile-tab", "manage-categories", "add-edit-category",
];

const SCREEN_LABELS: Record<Screen, string> = {
  "splash": "Splash",
  "onboarding-1": "Onboard 1",
  "onboarding-2": "Onboard 2",
  "onboarding-3": "Onboard 3",
  "login": "Login",
  "signup": "Sign Up",
  "profile-setup": "Profile Setup",
  "home": "Home",
  "add-expense": "Add Expense",
  "expense-detail": "Expense Detail",
  "history": "History",
  "insights": "Insights",
  "profile-tab": "Profile",
  "manage-categories": "Manage Categories",
  "add-edit-category": "Add/Edit Category",
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screenIdx, setScreenIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState(0);
  const screen = SCREEN_ORDER[screenIdx];

  const goTo = (idx: number) => {
    setPrevIdx(screenIdx);
    setScreenIdx(idx);
  };

  const direction = screenIdx >= prevIdx ? 1 : -1;

  return (
    <div
      className="size-full flex flex-col items-center justify-center"
      style={{ fontFamily: "'Quicksand', sans-serif", background: "linear-gradient(135deg, #e8edf5 0%, #d6dde8 100%)", gap: 20 }}
    >
      {/* Ambient glow */}
      <div className="absolute pointer-events-none" style={{ width: 340, height: 680, background: "radial-gradient(ellipse, rgba(184,224,200,0.35) 0%, transparent 70%)", filter: "blur(40px)" }} />

      {/* Phone shell */}
      <div className="relative flex-shrink-0" style={{ width: 320, height: 672, borderRadius: 52, background: "linear-gradient(160deg, #2a2a2e 0%, #1a1a1d 60%, #111113 100%)", boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 2px 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.1), 0 32px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)" }}>
        {/* Physical buttons */}
        {[130, 172].map((top) => (
          <div key={top} className="absolute" style={{ left: -3, top, width: 3, height: 32, borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg,#3a3a3e,#2a2a2e)", boxShadow: "-1px 0 2px rgba(0,0,0,0.4)" }} />
        ))}
        <div className="absolute" style={{ right: -3, top: 148, width: 3, height: 52, borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg,#3a3a3e,#2a2a2e)", boxShadow: "1px 0 2px rgba(0,0,0,0.4)" }} />

        {/* Screen glass */}
        <div className="absolute overflow-hidden" style={{ top: 8, left: 8, right: 8, bottom: 8, borderRadius: 46, background: "#0d0d0f" }}>
          {/* Status bar — hidden on splash */}
          {screen !== "splash" && (
            <div className="relative flex items-end justify-between px-5 pb-2" style={{ height: 44, background: "#F8F9FB" }}>
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 10, width: 11, height: 11, borderRadius: "50%", background: "#0d0d0f" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#1A2B4C" }}>9:41</span>
              <div className="flex items-center gap-1">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="#1A2B4C" /><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="#1A2B4C" /><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="#1A2B4C" /><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="#1A2B4C" opacity="0.3" /></svg>
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M6.5 8.5a1 1 0 1 0 0-1 1 1 0 0 0 0 1z" fill="#1A2B4C" /><path d="M3.8 6.2a3.8 3.8 0 0 1 5.4 0" stroke="#1A2B4C" strokeWidth="1.2" strokeLinecap="round" /><path d="M1.5 3.8a6.4 6.4 0 0 1 10 0" stroke="#1A2B4C" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" /></svg>
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x="0.5" y="0.5" width="16" height="9" rx="2.5" stroke="#1A2B4C" strokeOpacity="0.6" /><rect x="2" y="2" width="11" height="6" rx="1.5" fill="#1A2B4C" /><path d="M17.5 3.5v3" stroke="#1A2B4C" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" /></svg>
              </div>
            </div>
          )}

          {/* Screen router */}
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0"
              style={{ top: screen === "splash" ? 0 : 44, bottom: 0 }}
            >
              {screen === "splash"        && <SplashScreen />}
              {screen === "onboarding-1"  && <OnboardingScreen onFinish={() => {}} initialSlide={0} />}
              {screen === "onboarding-2"  && <OnboardingScreen onFinish={() => {}} initialSlide={1} />}
              {screen === "onboarding-3"  && <OnboardingScreen onFinish={() => {}} initialSlide={2} />}
              {screen === "login"         && <LoginScreen onBack={() => {}} onSwitch={() => {}} />}
              {screen === "signup"        && <SignupScreen onBack={() => {}} onSwitch={() => {}} />}
              {screen === "profile-setup" && <ProfileSetupScreen onBack={() => {}} />}
              {screen === "home"          && <HomeScreen />}
              {screen === "add-expense"   && <AddExpenseScreen onBack={() => {}} />}
              {screen === "expense-detail" && <ExpenseDetailScreen onBack={() => {}} />}
              {screen === "history"        && <HistoryScreen />}
              {screen === "insights"       && <InsightsScreen />}
              {screen === "profile-tab"       && <ProfileTabScreen />}
              {screen === "manage-categories" && <ManageCategoriesScreen onBack={() => {}} />}
              {screen === "add-edit-category" && <AddEditCategoryScreen onBack={() => {}} mode="add" />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Frame shine */}
        <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 52, background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)" }} />
      </div>

      {/* ── Dot navigator ── */}
      <div className="flex flex-col items-center z-10" style={{ gap: 10 }}>
        {/* Prev / Next arrows + label */}
        <div className="flex items-center" style={{ gap: 16 }}>
          <button
            onClick={() => goTo(Math.max(0, screenIdx - 1))}
            disabled={screenIdx === 0}
            style={{ width: 32, height: 32, borderRadius: "50%", background: screenIdx === 0 ? "rgba(255,255,255,0.2)" : "white", border: "none", cursor: screenIdx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: screenIdx === 0 ? "none" : "0 2px 8px rgba(0,0,0,0.12)", opacity: screenIdx === 0 ? 0.35 : 1, transition: "all 0.2s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#1A2B4C", minWidth: 88, textAlign: "center" }}>
            {SCREEN_LABELS[screen]}
          </span>

          <button
            onClick={() => goTo(Math.min(SCREEN_ORDER.length - 1, screenIdx + 1))}
            disabled={screenIdx === SCREEN_ORDER.length - 1}
            style={{ width: 32, height: 32, borderRadius: "50%", background: screenIdx === SCREEN_ORDER.length - 1 ? "rgba(255,255,255,0.2)" : "white", border: "none", cursor: screenIdx === SCREEN_ORDER.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: screenIdx === SCREEN_ORDER.length - 1 ? "none" : "0 2px 8px rgba(0,0,0,0.12)", opacity: screenIdx === SCREEN_ORDER.length - 1 ? 0.35 : 1, transition: "all 0.2s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center" style={{ gap: 7 }}>
          {SCREEN_ORDER.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === screenIdx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === screenIdx ? "#1A2B4C" : "rgba(255,255,255,0.55)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: i === screenIdx ? "0 2px 6px rgba(26,43,76,0.3)" : "none",
              }}
            />
          ))}
        </div>

        {/* Step counter */}
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "rgba(26,43,76,0.4)", letterSpacing: "0.05em" }}>
          {screenIdx + 1} / {SCREEN_ORDER.length}
        </span>
      </div>
    </div>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden" style={{ height: "100%", background: "#F8F9FB" }}>
      <div className="absolute pointer-events-none" style={{ top: -40, left: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #B8E0C8 0%, transparent 70%)", opacity: 0.4, filter: "blur(40px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: -50, right: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #F4B8AE 0%, transparent 70%)", opacity: 0.3, filter: "blur(36px)" }} />
      <motion.div className="flex flex-col items-center z-10" style={{ gap: 14 }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}>
        <motion.div className="flex items-center justify-center" style={{ width: 80, height: 80, borderRadius: 28, background: "#B8E0C8", boxShadow: "0 4px 24px rgba(184,224,200,0.45)" }}
          initial={{ scale: 0.75 }} animate={{ scale: 1 }} transition={{ duration: 0.55, delay: 0.1, ease: [0.34,1.56,0.64,1] }}>
          <svg width="38" height="38" viewBox="0 0 38 38"><text x="19" y="27" textAnchor="middle" style={{ fontFamily: "'Quicksand',system-ui", fontWeight: 700, fontSize: 26, fill: "#1A2B4C" }}>₹</text></svg>
        </motion.div>
        <div className="flex flex-col items-center" style={{ gap: 5 }}>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 52, color: "#1A2B4C", letterSpacing: "-0.02em", lineHeight: 1 }}>Arthik</span>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 15, color: "#8A96AA", letterSpacing: "0.01em" }}>Apna kharcha, apna hisaab</span>
        </div>
        <div className="flex" style={{ gap: 6, marginTop: 8 }}>
          {[0,1,2].map((i) => (
            <motion.span key={i} style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: "#B8E0C8" }}
              animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const slides = [
  { id: 0, heading: "Track Every Rupee",    subtext: "Log your daily expenses in seconds",           cta: "Next",        showSkip: true,  illustration: <SlideOneIllustration /> },
  { id: 1, heading: "See Where It Goes",    subtext: "Understand your spending with clear insights",  cta: "Next",        showSkip: true,  illustration: <SlideTwoIllustration /> },
  { id: 2, heading: "Simple. Fast. Yours.", subtext: "Start your journey to smarter spending",        cta: "Get Started", showSkip: false, illustration: <SlideThreeIllustration /> },
];

function OnboardingScreen({ onFinish, initialSlide = 0 }: { onFinish: () => void; initialSlide?: number }) {
  const [current, setCurrent] = useState(initialSlide);
  const [direction, setDirection] = useState(1);

  const goTo = (index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  };

  const next = () => {
    if (current < slides.length - 1) goTo(current + 1);
    else onFinish();
  };

  return (
    <div className="relative overflow-hidden" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Skip */}
      <div className="absolute z-20" style={{ top: 16, right: 20, height: 20 }}>
        <AnimatePresence>
          {slides[current].showSkip && (
            <motion.button key="skip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={onFinish}
              style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 13, fontWeight: 600, color: "#8A96AA", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Skip
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          className="absolute inset-0 flex flex-col items-center"
          initial={{ x: direction * 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -60, opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-full flex items-center justify-center" style={{ height: "45%" }}>
            {slides[current].illustration}
          </div>
          <div className="flex flex-col items-center px-6 text-center" style={{ gap: 8 }}>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 24, color: "#1A2B4C", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              {slides[current].heading}
            </span>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", lineHeight: 1.5, maxWidth: 220 }}>
              {slides[current].subtext}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination dots */}
      <div className="absolute flex items-center justify-center gap-2" style={{ bottom: 100, left: 0, right: 0 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 4, background: i === current ? "#B8E0C8" : "transparent", border: i === current ? "none" : "1.5px solid #C8CDD8", padding: 0, cursor: "pointer", transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)" }} />
        ))}
      </div>

      {/* CTA */}
      <div className="absolute" style={{ bottom: 32, left: 24, right: 24 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={next}
          style={{ width: "100%", height: 50, borderRadius: 25, background: "#B8E0C8", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", letterSpacing: "0.01em", boxShadow: "0 4px 16px rgba(184,224,200,0.5)" }}>
          <AnimatePresence mode="wait">
            <motion.span key={slides[current].cta} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} style={{ display: "block" }}>
              {slides[current].cta}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="absolute" style={{ bottom: 10, left: "50%", transform: "translateX(-50%)", width: 100, height: 4, borderRadius: 2, background: "#1A2B4C", opacity: 0.15 }} />
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function Input({ label, type = "text", placeholder, value, onChange, rightEl }: {
  label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; rightEl?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <label style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#8A96AA", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</label>
      <div className="relative flex items-center">
        <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", height: 48, borderRadius: 16, background: "#F1F2F5", border: "none", outline: "none", padding: "0 16px", paddingRight: rightEl ? 44 : 16, fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#1A2B4C", boxSizing: "border-box" }} />
        {rightEl && <div className="absolute right-3 flex items-center justify-center" style={{ height: "100%" }}>{rightEl}</div>}
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A96AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A96AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div style={{ flex: 1, height: 1, background: "#E0E3EA" }} />
      <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#B0B7C3" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "#E0E3EA" }} />
    </div>
  );
}

function BackArrow({ onPress }: { onPress: () => void }) {
  return (
    <button onClick={onPress} style={{ background: "none", border: "none", cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, marginLeft: -8, marginBottom: 20 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSwitch }: { onBack: () => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // bottom dock height: divider(24) + gap(12) + google(48) + gap(12) + cta(50) + gap(12) + toggle(20) + gap(8) + indicator(14) + bottom(32) = ~232
  const DOCK_H = 232;

  return (
    <div className="relative" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Blobs */}
      <div className="absolute pointer-events-none" style={{ top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, #B8E0C8 0%, transparent 70%)", opacity: 0.35, filter: "blur(32px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: DOCK_H, left: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, #F4B8AE 0%, transparent 70%)", opacity: 0.25, filter: "blur(28px)" }} />

      {/* Scrollable form area */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: DOCK_H, overflowY: "auto", padding: "16px 24px 0" }}>
        <BackArrow onPress={onBack} />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 26, color: "#1A2B4C", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Welcome Back</h1>
          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", margin: "6px 0 0" }}>Log in to continue tracking</p>
        </div>
        <div className="flex flex-col" style={{ gap: 14 }}>
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Input label="Password" type={showPw ? "text" : "password"} placeholder="Enter password" value={password} onChange={setPassword}
            rightEl={<button onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><EyeIcon open={showPw} /></button>} />
          <div style={{ textAlign: "right", marginTop: -6 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 12, color: "#B8E0C8" }}>Forgot Password?</button>
          </div>
        </div>
      </div>

      {/* Fixed bottom dock */}
      <div className="absolute flex flex-col" style={{ bottom: 0, left: 0, right: 0, padding: "0 24px 0", background: "#F8F9FB", gap: 12 }}>
        <OrDivider />
        <button style={{ width: "100%", height: 48, borderRadius: 24, background: "white", border: "1.5px solid #E0E3EA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <GoogleIcon /> Continue with Google
        </button>
        <motion.button whileTap={{ scale: 0.97 }} style={{ width: "100%", height: 50, borderRadius: 25, background: "#B8E0C8", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", letterSpacing: "0.01em", boxShadow: "0 4px 16px rgba(184,224,200,0.5)" }}>
          Log In
        </motion.button>
        {/* Toggle */}
        <div className="flex items-center justify-center" style={{ paddingBottom: 4 }}>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 13, color: "#8A96AA" }}>New here? </span>
          <button onClick={onSwitch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#1A2B4C", marginLeft: 4 }}>Sign up</button>
        </div>
        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 10 }}>
          <div style={{ width: 100, height: 4, borderRadius: 2, background: "#1A2B4C", opacity: 0.15 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Signup ───────────────────────────────────────────────────────────────────
function SignupScreen({ onBack, onSwitch, onSuccess }: { onBack: () => void; onSwitch: () => void; onSuccess?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const DOCK_H = 232;

  return (
    <div className="relative" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Blobs */}
      <div className="absolute pointer-events-none" style={{ top: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, #B8E0C8 0%, transparent 70%)", opacity: 0.3, filter: "blur(32px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: DOCK_H, right: -24, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, #F4B8AE 0%, transparent 70%)", opacity: 0.25, filter: "blur(28px)" }} />

      {/* Scrollable form area */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: DOCK_H, overflowY: "auto", padding: "16px 24px 0" }}>
        <BackArrow onPress={onBack} />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 26, color: "#1A2B4C", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Create Account</h1>
          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", margin: "6px 0 0" }}>Start your expense journey</p>
        </div>
        <div className="flex flex-col" style={{ gap: 14 }}>
          <Input label="Full Name" type="text" placeholder="Your name" value={name} onChange={setName} />
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Input label="Password" type={showPw ? "text" : "password"} placeholder="Create a password" value={password} onChange={setPassword}
            rightEl={<button onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><EyeIcon open={showPw} /></button>} />
          <div style={{ marginTop: -8 }}>
            <div className="flex gap-1" style={{ marginBottom: 4 }}>
              {["#B8E0C8", "#B8E0C8", "#F9E4B4", "#E0E3EA"].map((c, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: password.length > i * 3 ? c : "#E0E3EA", transition: "background 0.3s" }} />
              ))}
            </div>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 11, fontWeight: 500, color: "#B0B7C3" }}>
              {password.length === 0 ? "Enter a strong password" : password.length < 6 ? "Weak" : password.length < 10 ? "Good" : "Strong"}
            </span>
          </div>
        </div>
      </div>

      {/* Fixed bottom dock */}
      <div className="absolute flex flex-col" style={{ bottom: 0, left: 0, right: 0, padding: "0 24px 0", background: "#F8F9FB", gap: 12 }}>
        <OrDivider />
        <button style={{ width: "100%", height: 48, borderRadius: 24, background: "white", border: "1.5px solid #E0E3EA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <GoogleIcon /> Continue with Google
        </button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSuccess} style={{ width: "100%", height: 50, borderRadius: 25, background: "#B8E0C8", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", letterSpacing: "0.01em", boxShadow: "0 4px 16px rgba(184,224,200,0.5)" }}>
          Sign Up
        </motion.button>
        {/* Toggle */}
        <div className="flex items-center justify-center" style={{ paddingBottom: 4 }}>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 13, color: "#8A96AA" }}>Already have an account? </span>
          <button onClick={onSwitch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#1A2B4C", marginLeft: 4 }}>Log in</button>
        </div>
        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 10 }}>
          <div style={{ width: 100, height: 4, borderRadius: 2, background: "#1A2B4C", opacity: 0.15 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Currency options ─────────────────────────────────────────────────────────
const currencies = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
];

// ─── Profile Setup ────────────────────────────────────────────────────────────
function ProfileSetupScreen({ onBack, onDone }: { onBack: () => void; onDone?: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarHovered, setAvatarHovered] = useState(false);

  const DOCK_H = 106;

  return (
    <div className="relative" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Blobs */}
      <div className="absolute pointer-events-none" style={{ top: -30, right: -30, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, #B8E0C8 0%, transparent 70%)", opacity: 0.3, filter: "blur(36px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: DOCK_H + 40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, #F4B8AE 0%, transparent 70%)", opacity: 0.22, filter: "blur(30px)" }} />

      {/* Scrollable content */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: DOCK_H, overflowY: "auto", padding: "16px 24px 24px" }}>
        {/* Back arrow */}
        <BackArrow onPress={onBack} />

        {/* Progress bar */}
        <div style={{ marginBottom: 28, marginTop: -8 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#B0B7C3", letterSpacing: "0.04em", textTransform: "uppercase" }}>Profile Setup</span>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#B8E0C8" }}>Step 1 of 1</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "#E8EBF0", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: "100%", borderRadius: 2, background: "#B8E0C8" }}
            />
          </div>
        </div>

        {/* Avatar */}
        <motion.div
          className="flex items-center justify-center"
          style={{ marginBottom: 22 }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div
            className="relative"
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            style={{ width: 96, height: 96, cursor: "pointer" }}
          >
            {/* Circle */}
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#E8EBF0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "3px solid white", boxShadow: "0 4px 16px rgba(26,43,76,0.1)" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="18" r="10" fill="#C8CDD8" />
                <path d="M4 44c0-11.046 8.954-20 20-20s20 8.954 20 20" fill="#C8CDD8" />
              </svg>
              {avatarHovered && (
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(26,43,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              )}
            </div>
            {/* Camera badge */}
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", background: "#B8E0C8", border: "2.5px solid white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.div
          className="flex flex-col items-center text-center"
          style={{ marginBottom: 28 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
        >
          <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 24, color: "#1A2B4C", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Tell us about you
          </h1>
          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", margin: "6px 0 0" }}>
            This helps personalise your experience
          </p>
        </motion.div>

        {/* Form fields */}
        <motion.div
          className="flex flex-col"
          style={{ gap: 14 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
        >
          {/* First Name */}
          <Input label="First Name" type="text" placeholder="First Name" value={firstName} onChange={setFirstName} />

          {/* Last Name with Optional tag */}
          <div className="flex flex-col" style={{ gap: 6 }}>
            <div className="flex items-center justify-between">
              <label style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#8A96AA", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Last Name
              </label>
              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 10.5, color: "#B8E0C8", letterSpacing: "0.03em", background: "#EEF9F3", padding: "2px 8px", borderRadius: 20 }}>
                Optional
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Last Name (optional)"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: "100%", height: 48, borderRadius: 16, background: "#F1F2F5", border: "none", outline: "none", padding: "0 16px", fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#1A2B4C", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Fixed bottom dock */}
      <div className="absolute flex flex-col" style={{ bottom: 0, left: 0, right: 0, padding: "20px 24px 0", background: "#F8F9FB", gap: 0 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDone}
          style={{ width: "100%", height: 50, borderRadius: 25, background: "#B8E0C8", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", letterSpacing: "0.01em", boxShadow: "0 4px 16px rgba(184,224,200,0.5)" }}
        >
          {"Let's Go →"}
        </motion.button>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
          <div style={{ width: 100, height: 4, borderRadius: 2, background: "#1A2B4C", opacity: 0.15 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Home / Dashboard ─────────────────────────────────────────────────────────
const NAV_H = 64;
const FAB_SIZE = 56;
const FILTERS = ["All", "Daily", "Weekly", "Monthly"];

const TRANSACTIONS = [
  { id: 1, category: "Food",          sub: "Card",              amount: -340,   date: "Mar 07, 2023", bg: "#FFF3E8" },
  { id: 2, category: "Salary",        sub: "Bank Account",      amount: 52000,  date: "Mar 07, 2023", bg: "#E8F7EF" },
  { id: 3, category: "Entertainment", sub: "Card",              amount: -649,   date: "Mar 07, 2023", bg: "#EEEAF7" },
  { id: 4, category: "Groceries",     sub: "Cash",              amount: -1230,  date: "Mar 06, 2023", bg: "#FFF0EC" },
];

const NAV_ITEMS = [
  { key: "home",     label: "Home",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? "#1A2B4C" : "#B0B7C3"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>
        <path d="M9 21V13h6v8"/>
      </svg>
    )},
  { key: "history",  label: "History",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? "#1A2B4C" : "#B0B7C3"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <polyline points="12 8 12 12 15 14"/>
      </svg>
    )},
  { key: "insights", label: "Insights",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? "#1A2B4C" : "#B0B7C3"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="5" y2="12"/>
        <line x1="12" y1="19" x2="12" y2="5"/>
        <line x1="19" y1="19" x2="19" y2="9"/>
      </svg>
    )},
  { key: "profile",  label: "Profile",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? "#1A2B4C" : "#B0B7C3"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5"/>
        <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
      </svg>
    )},
];

// SVG icons per category matching the reference line-icon style
function TxIcon({ category, bg }: { category: string; bg: string }) {
  const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const color = category === "Salary" ? "#4CAF86" : category === "Entertainment" ? "#9B87D6" : "#E07A50";
  const icon = category === "Food" ? (
    <svg {...iconProps} stroke={color}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ) : category === "Salary" ? (
    <svg {...iconProps} stroke={color}>
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ) : category === "Entertainment" ? (
    <svg {...iconProps} stroke={color}>
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l-4 5-4-5"/>
    </svg>
  ) : (
    <svg {...iconProps} stroke={color}>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
  return (
    <div style={{ width: 48, height: 48, borderRadius: 16, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {icon}
    </div>
  );
}

function DonutRing({ income, spent }: { income: number; spent: number }) {
  const total = income + spent;
  const cx = 56, cy = 56, R = 48, r = 32;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const incPct = income / total;
  const gap = 4;
  const makeArc = (s: number, e: number) => {
    const sr = toRad(s), er = toRad(e);
    const x1 = cx+R*Math.cos(sr), y1 = cy+R*Math.sin(sr);
    const x2 = cx+R*Math.cos(er), y2 = cy+R*Math.sin(er);
    const x3 = cx+r*Math.cos(er), y3 = cy+r*Math.sin(er);
    const x4 = cx+r*Math.cos(sr), y4 = cy+r*Math.sin(sr);
    const lg = (e-s) > 180 ? 1 : 0;
    return `M${x1},${y1} A${R},${R},0,${lg},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${lg},0,${x4},${y4} Z`;
  };
  const incEnd = -90 + incPct * 360;
  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <path d={makeArc(-90 + gap/2, incEnd - gap/2)} fill="#B8E0C8" />
      <path d={makeArc(incEnd + gap/2, 270 - gap/2)} fill="#F4B8AE" />
      <circle cx={cx} cy={cy} r={r-1} fill="#F5F6F8" />
    </svg>
  );
}

function HomeScreen() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeNav, setActiveNav] = useState("home");
  const income = 52000, spent = 2219;

  return (
    <div className="relative" style={{ height: "100%", background: "white" }}>

      {/* Scrollable body */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: NAV_H, overflowY: "auto", overflowX: "hidden" }}>

        {/* Header — large two-line greeting */}
        <div className="flex items-start justify-between" style={{ padding: "26px 24px 0" }}>
          <div>
            <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 26, color: "#1A2B4C", margin: 0, lineHeight: 1.15 }}>Hello,</p>
            <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 32, color: "#1A2B4C", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Arjun</p>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #E8EBF0", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Filter pills — white bg, green outline when active */}
        <div style={{ display: "flex", gap: 8, padding: "20px 24px 0", overflowX: "auto" }}>
          {FILTERS.map((f) => {
            const active = f === activeFilter;
            return (
              <button key={f} onClick={() => setActiveFilter(f)}
                style={{ flexShrink: 0, height: 36, padding: "0 20px", borderRadius: 18, background: "white", border: `1.5px solid ${active ? "#B8E0C8" : "#D8DCE4"}`, fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 13, color: active ? "#1A2B4C" : "#8A96AA", cursor: "pointer", transition: "all 0.2s" }}>
                {f}
              </button>
            );
          })}
        </div>

        {/* Summary card */}
        <div style={{ margin: "18px 14px 0", borderRadius: 22, background: "#F5F6F8", padding: "20px 22px" }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col" style={{ gap: 20 }}>
              <div>
                <div className="flex items-center" style={{ gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: "#B8E0C8" }} />
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 13, color: "#8A96AA" }}>Income</span>
                </div>
                <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 26, color: "#1A2B4C", margin: 0, letterSpacing: "-0.02em" }}>
                  ₹{income.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <div className="flex items-center" style={{ gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: "#F4B8AE" }} />
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 13, color: "#8A96AA" }}>Spent</span>
                </div>
                <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 26, color: "#1A2B4C", margin: 0, letterSpacing: "-0.02em" }}>
                  ₹{spent.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <DonutRing income={income} spent={spent} />
          </div>
        </div>

        {/* Recent transactions — flat rows, no card backgrounds */}
        <div style={{ padding: "22px 24px 0" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 16, color: "#1A2B4C" }}>Recent transactions</span>
            <button style={{ display: "flex", alignItems: "center", gap: 3, height: 30, padding: "0 12px", borderRadius: 15, background: "transparent", border: "1.5px solid #D8DCE4", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#8A96AA" }}>
              See All
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A96AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          {/* Flat rows — no card/shadow, plain on white bg */}
          <div className="flex flex-col" style={{ gap: 18, paddingBottom: NAV_H + FAB_SIZE / 2 + 20 }}>
            {TRANSACTIONS.map((tx, i) => (
              <motion.div key={tx.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                <TxIcon category={tx.category} bg={tx.bg} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", margin: 0 }}>{tx.category}</p>
                  <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 12, color: "#8A96AA", margin: "2px 0 0" }}>{tx.sub}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: tx.amount > 0 ? "#4CAF86" : "#1A2B4C", margin: 0 }}>
                    {tx.amount > 0 ? "+₹" : "−₹"}{Math.abs(tx.amount).toLocaleString("en-IN")}
                  </p>
                  <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "#B0B7C3", margin: "2px 0 0" }}>{tx.date}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* White halo ring behind FAB */}
      <div style={{
        position: "absolute",
        bottom: NAV_H - (FAB_SIZE + 14) / 2,
        left: "50%",
        transform: "translateX(-50%)",
        width: FAB_SIZE + 14,
        height: FAB_SIZE + 14,
        borderRadius: "50%",
        background: "white",
        zIndex: 19,
        pointerEvents: "none",
      }} />

      {/* FAB — centering wrapper keeps translateX stable; inner div handles scale */}
      <div style={{
        position: "absolute",
        bottom: NAV_H - FAB_SIZE / 2,
        left: "50%",
        transform: "translateX(-50%)",
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 20,
      }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: "50%",
            background: "#B8E0C8",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 18px rgba(184,224,200,0.7)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </motion.button>
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: NAV_H, background: "white",
        borderTop: "1px solid rgba(26,43,76,0.06)",
        display: "flex", alignItems: "center",
        paddingBottom: 6, paddingLeft: 12, paddingRight: 12, zIndex: 10,
      }}>
        {NAV_ITEMS.flatMap((item, idx) => {
          const active = item.key === activeNav;
          const btn = (
            <button key={item.key} onClick={() => setActiveNav(item.key)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 0 0" }}
            >
              <div style={{ width: 44, height: 28, borderRadius: 14, background: active ? "#D8F2E4" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
                {item.icon(active)}
              </div>
              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: active ? 700 : 500, fontSize: 10, color: active ? "#1A2B4C" : "#B0B7C3", lineHeight: 1 }}>
                {item.label}
              </span>
            </button>
          );
          if (idx === 2) return [<div key="fab-gap" style={{ flex: 1, flexShrink: 0 }} />, btn];
          return [btn];
        })}
      </div>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
const HISTORY_DATA = [
  { id: 1,  catKey: "food",          note: "Dinner at Barbeque Nation",        amount: -340,   group: "Today",     pay: "UPI"   },
  { id: 2,  catKey: "transport",     note: "Ola cab to airport",                amount: -180,   group: "Today",     pay: "Cash"  },
  { id: 3,  catKey: "salary",        note: "Monthly salary credited",           amount: 52000,  group: "Yesterday", pay: "Bank"  },
  { id: 4,  catKey: "shopping",      note: "Amazon — boAt Airdopes 141",        amount: -1299,  group: "Yesterday", pay: "Card"  },
  { id: 5,  catKey: "entertainment", note: "Netflix subscription",              amount: -649,   group: "11 Jul",    pay: "Card"  },
  { id: 6,  catKey: "food",          note: "Big Bazaar weekly groceries",       amount: -1230,  group: "11 Jul",    pay: "UPI"   },
  { id: 7,  catKey: "health",        note: "Pharmacy — vitamins & calcium",     amount: -245,   group: "10 Jul",    pay: "Cash"  },
  { id: 8,  catKey: "food",          note: "Swiggy lunch delivery",             amount: -220,   group: "10 Jul",    pay: "UPI"   },
  { id: 9,  catKey: "bills",         note: "Electricity bill July",             amount: -890,   group: "9 Jul",     pay: "UPI"   },
  { id: 10, catKey: "transport",     note: "Metro card recharge",               amount: -500,   group: "9 Jul",     pay: "Card"  },
];

const H_FILTERS = ["All", "Food", "Transport", "Shopping", "Fun", "Health", "Salary", "Bills", "Cash", "UPI", "Card"];
const H_GROUP_ORDER = ["Today", "Yesterday", "11 Jul", "10 Jul", "9 Jul"];

function HistoryScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = HISTORY_DATA.filter(tx => {
    const cat = EXPENSE_CATEGORIES.find(c => c.key === tx.catKey);
    const label = cat?.label ?? "";
    const matchFilter =
      activeFilter === "All" ||
      label === activeFilter ||
      (activeFilter === "Fun" && tx.catKey === "entertainment") ||
      tx.pay === activeFilter;
    const q = query.trim().toLowerCase();
    const matchSearch =
      !q ||
      label.toLowerCase().includes(q) ||
      tx.note.toLowerCase().includes(q) ||
      Math.abs(tx.amount).toString().includes(q);
    return matchFilter && matchSearch;
  });

  const grouped = H_GROUP_ORDER
    .map(g => ({ group: g, txs: filtered.filter(tx => tx.group === g) }))
    .filter(g => g.txs.length > 0);

  const isEmpty = filtered.length === 0;

  const PayIcon = ({ mode }: { mode: string }) => {
    const stroke = "#B0B7C3";
    if (mode === "Card") return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>;
    if (mode === "Cash") return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    if (mode === "Bank") return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2 2 4-4"/></svg>;
  };

  return (
    <div className="relative flex flex-col" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Ambient blobs */}
      <div className="absolute pointer-events-none" style={{ top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,#B8E0C8 0%,transparent 70%)", opacity: 0.28, filter: "blur(32px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: 100, left: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,#F4B8AE 0%,transparent 70%)", opacity: 0.2, filter: "blur(28px)" }} />

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 6 }}>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 22, color: "#1A2B4C", letterSpacing: "-0.01em" }}>History</span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { setSearchOpen(o => !o); setQuery(""); }}
          style={{ width: 36, height: 36, borderRadius: 18, background: searchOpen ? "#D8F2E4" : "white", border: `1.5px solid ${searchOpen ? "#B8E0C8" : "#E8EBF0"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
        >
          {searchOpen
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
        </motion.button>
      </div>

      {/* ── Search Bar ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="searchbar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 56, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden", flexShrink: 0, position: "relative", zIndex: 6 }}
          >
            <div style={{ padding: "8px 20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", height: 44, borderRadius: 22, background: "white", border: "1.5px solid #E8EBF0", padding: "0 14px", gap: 8, boxShadow: "0 1px 6px rgba(26,43,76,0.06)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8CDD8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  autoFocus
                  placeholder="Search expenses..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#1A2B4C" }}
                />
                <AnimatePresence>
                  {query && (
                    <motion.button
                      key="clear"
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setQuery("")}
                      style={{ background: "#E8EBF0", border: "none", cursor: "pointer", width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#8A96AA" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter Chips ── */}
      <div style={{ flexShrink: 0, padding: "10px 20px 0", overflowX: "auto", display: "flex", gap: 7, position: "relative", zIndex: 5 }}>
        {H_FILTERS.map(f => {
          const active = f === activeFilter;
          return (
            <button key={f} onClick={() => setActiveFilter(f)}
              style={{ flexShrink: 0, height: 32, padding: "0 13px", borderRadius: 16, background: active ? "#B8E0C8" : "white", border: `1.5px solid ${active ? "#B8E0C8" : "#E0E3EA"}`, fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: active ? "#1A2B4C" : "#8A96AA", cursor: "pointer", transition: "all 0.18s" }}>
              {f}
            </button>
          );
        })}
      </div>

      {/* ── List area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 88px", position: "relative", zIndex: 1 }}>
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 12 }}
          >
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#EEF9F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#B8E0C8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 16, color: "#1A2B4C" }}>No expenses found</span>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 13, color: "#8A96AA", textAlign: "center", lineHeight: 1.5 }}>
              Try a different filter{"\n"}or adjust your search
            </span>
          </motion.div>
        ) : (
          grouped.map(({ group, txs }) => {
            const daySpend = txs.reduce((s, tx) => tx.amount < 0 ? s + Math.abs(tx.amount) : s, 0);
            return (
              <div key={group}>
                {/* Sticky date header */}
                <div style={{ position: "sticky", top: 0, zIndex: 4, background: "#F8F9FB", paddingTop: 14, paddingBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 11, color: "#B0B7C3", letterSpacing: "0.06em", textTransform: "uppercase" }}>{group}</span>
                  {daySpend > 0 && (
                    <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#B0B7C3" }}>
                      −₹{daySpend.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                {/* Expense rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                  {txs.map((tx, i) => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === tx.catKey)!;
                    const isIncome = tx.amount > 0;
                    const badgeBg = isIncome ? "#E8F7EF" : cat.color + "22";
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        whileTap={{ scale: 0.985 }}
                        style={{ display: "flex", alignItems: "center", gap: 12, background: "white", borderRadius: 20, padding: "11px 14px", boxShadow: "0 1px 8px rgba(26,43,76,0.05)", cursor: "pointer" }}
                      >
                        {/* Category badge */}
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: badgeBg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {cat.icon(isIncome ? "#4CAF86" : cat.color)}
                        </div>
                        {/* Middle */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", margin: 0 }}>{cat.label}</p>
                          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 12, color: "#8A96AA", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.note}</p>
                        </div>
                        {/* Right */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: isIncome ? "#4CAF86" : "#1A2B4C", margin: 0 }}>
                            {isIncome ? "+" : "−"}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 3 }}>
                            <PayIcon mode={tx.pay} />
                            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "#B0B7C3" }}>{tx.pay}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

// ─── Expense Detail ───────────────────────────────────────────────────────────
const DETAIL_TX = {
  category: "Food",
  color: "#FFF3E8",
  iconColor: "#E07A50",
  amount: -340,
  date: "13 Jul 2026",
  payMode: "UPI",
  note: "Dinner at Barbeque Nation with family — anniversary dinner",
  addedOn: "13 Jul 2026, 9:42 AM",
  editedOn: "13 Jul 2026, 10:15 AM",
};

function DetailRow({ label, value, isLast = false, wide = false }: { label: string; value: React.ReactNode; isLast?: boolean; wide?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: wide ? "flex-start" : "center", justifyContent: "space-between", padding: "14px 20px", gap: 12 }}>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 13, color: "#8A96AA", flexShrink: 0 }}>{label}</span>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 14, color: "#1A2B4C", textAlign: "right", lineHeight: 1.45 }}>{value}</span>
      </div>
      {!isLast && <div style={{ height: 1, background: "rgba(26,43,76,0.05)", margin: "0 20px" }} />}
    </div>
  );
}

function ExpenseDetailScreen({ onBack }: { onBack: () => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const tx = DETAIL_TX;

  const payIcon = tx.payMode === "Cash"
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    : tx.payMode === "Card"
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2 2 4-4"/></svg>;

  return (
    <div className="relative flex flex-col" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Ambient tint blob */}
      <div className="absolute pointer-events-none" style={{ top: -20, left: "50%", transform: "translateX(-50%)", width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${tx.color} 0%, transparent 70%)`, opacity: 0.9, filter: "blur(40px)" }} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 0", flexShrink: 0, position: "relative", zIndex: 2 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 18, color: "#1A2B4C", letterSpacing: "-0.01em" }}>Expense Detail</span>
        <div style={{ display: "flex", gap: 4 }}>
          {/* Edit pencil */}
          <button style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {/* Delete trash */}
          <button onClick={() => setShowDelete(true)} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4B8AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", position: "relative", zIndex: 2 }}>

        {/* ── Hero badge + amount ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 28, paddingBottom: 28 }}>
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ width: 80, height: 80, borderRadius: "50%", background: tx.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 32px ${tx.color}` }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={tx.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </motion.div>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", marginTop: 10 }}>{tx.category}</span>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 3 }}
          >
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 22, color: "#1A2B4C" }}>₹</span>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 42, color: "#1A2B4C", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {Math.abs(tx.amount).toLocaleString("en-IN")}
            </span>
          </motion.div>
          {/* Expense / Income chip */}
          <div style={{ marginTop: 10, height: 26, padding: "0 14px", borderRadius: 13, background: tx.amount < 0 ? "#FFF0EC" : "#E8F7EF", display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 11, color: tx.amount < 0 ? "#E07A50" : "#4CAF86", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {tx.amount < 0 ? "Expense" : "Income"}
            </span>
          </div>
        </div>

        {/* ── Detail Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ borderRadius: 24, background: "white", border: "1.5px solid rgba(26,43,76,0.07)", overflow: "hidden", boxShadow: "0 2px 16px rgba(26,43,76,0.05)", marginBottom: 12 }}
        >
          <DetailRow label="Date" value={tx.date} />
          <DetailRow label="Paid via" value={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {payIcon}{tx.payMode}
            </span>
          } />
          <DetailRow label="Note" value={tx.note} isLast wide />
        </motion.div>

        {/* ── Timestamps ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.28 }}
          style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 4px", marginBottom: 24 }}
        >
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "#B0B7C3" }}>Added on {tx.addedOn}</span>
          {tx.editedOn && <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "#B0B7C3" }}>Last edited {tx.editedOn}</span>}
        </motion.div>
      </div>

      {/* ── Primary Actions ── */}
      <div style={{ flexShrink: 0, padding: "12px 20px 16px", background: "#F8F9FB", borderTop: "1px solid rgba(26,43,76,0.05)", position: "relative", zIndex: 2 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          style={{ width: "100%", height: 56, borderRadius: 28, background: "#B8E0C8", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 16, color: "#1A2B4C", letterSpacing: "0.01em", boxShadow: "0 4px 18px rgba(184,224,200,0.55)" }}
        >
          Edit Expense
        </motion.button>
        <button
          onClick={() => setShowDelete(true)}
          style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#F4B8AE" }}
        >
          Delete Expense
        </button>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {showDelete && (
          <>
            {/* Scrim */}
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowDelete(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(26,43,76,0.35)", zIndex: 30, backdropFilter: "blur(2px)" }}
            />
            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 24px", zIndex: 31 }}
            >
              {/* Drag pill */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E0E3EA", margin: "0 auto 24px" }} />

              {/* Icon */}
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FFF0EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F4B8AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </div>

              <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 18, color: "#1A2B4C", textAlign: "center", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                Delete this expense?
              </p>
              <p style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 14, color: "#8A96AA", textAlign: "center", margin: "0 0 28px", lineHeight: 1.5 }}>
                {"This can't be undone. The record will be permanently removed."}
              </p>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setShowDelete(false)}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F1F2F5", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C" }}
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { setDeleted(true); setShowDelete(false); }}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F4B8AE", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", boxShadow: "0 4px 14px rgba(244,184,174,0.5)" }}
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Deleted toast-state overlay */}
      <AnimatePresence>
        {deleted && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{ position: "absolute", bottom: 100, left: 20, right: 20, height: 52, borderRadius: 26, background: "#1A2B4C", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}
          >
            <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "white" }}>Expense deleted</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add Expense ──────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { key: "food",          label: "Food",          icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, color: "#E07A50" },
  { key: "transport",     label: "Transport",     icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, color: "#5B8FD6" },
  { key: "shopping",      label: "Shopping",      icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>, color: "#D46FA8" },
  { key: "entertainment", label: "Fun",           icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>, color: "#9B87D6" },
  { key: "health",        label: "Health",        icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, color: "#4CAF86" },
  { key: "salary",        label: "Salary",        icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, color: "#4CAF86" },
  { key: "bills",         label: "Bills",         icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, color: "#F09B3C" },
  { key: "other",         label: "Other",         icon: (c: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, color: "#8A96AA" },
];

const PAY_MODES = [
  { key: "cash", label: "Cash",  icon: (c: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { key: "upi",  label: "UPI",   icon: (c: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2 2 4-4"/></svg> },
  { key: "card", label: "Card",  icon: (c: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/></svg> },
];

function AddExpenseScreen({ onBack }: { onBack: () => void }) {
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("food");
  const [note, setNote] = useState("");
  const [payMode, setPayMode] = useState("upi");

  const today = new Date();
  const dateLabel = `Today, ${today.getDate()} ${today.toLocaleString("en-IN", { month: "short" })}`;
  const isValid = parseFloat(amount) > 0;

  const handleAmountKey = (k: string) => {
    if (k === "⌫") { setAmount(a => a.slice(0, -1)); return; }
    if (k === "." && amount.includes(".")) return;
    if (amount.length >= 8) return;
    setAmount(a => a + k);
  };

  const CAT = EXPENSE_CATEGORIES.find(c => c.key === selectedCategory)!;

  const QS = "'Quicksand',sans-serif";

  return (
    <div style={{ height: "100%", background: "#F8F9FB", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Soft blobs */}
      <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, #B8E0C8 0%, transparent 70%)", opacity: 0.28, filter: "blur(30px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 180, left: -30, width: 110, height: 110, borderRadius: "50%", background: "radial-gradient(circle, #F4B8AE 0%, transparent 70%)", opacity: 0.2, filter: "blur(26px)", pointerEvents: "none" }} />

      {/* ── Header (pinned) ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 0" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontFamily: QS, fontWeight: 700, fontSize: 18, color: "#1A2B4C", letterSpacing: "-0.01em" }}>Add Expense</span>
        <div style={{ width: 36 }} />
      </div>

      {/* ── Amount display (pinned) ── */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: QS, fontWeight: 700, fontSize: 24, color: amount ? "#1A2B4C" : "#C8CDD8", lineHeight: 1 }}>₹</span>
          <span style={{ fontFamily: QS, fontWeight: 700, fontSize: 38, color: amount ? "#1A2B4C" : "#C8CDD8", letterSpacing: "-0.03em", lineHeight: 1, minWidth: 20 }}>
            {amount || "0"}
          </span>
        </div>
        <div style={{ width: 72, height: 2, borderRadius: 1, background: amount ? "#B8E0C8" : "#E0E3EA", marginTop: 8, transition: "background 0.25s" }} />
      </div>

      {/* ── Scrollable middle: Category → Note → Date → Paymode ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 20px 4px", minHeight: 0 }}>

        {/* Category chips */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 11, color: "#8A96AA", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Category</span>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = cat.key === selectedCategory;
              return (
                <button key={cat.key} onClick={() => setSelectedCategory(cat.key)}
                  style={{ flexShrink: 0, height: 36, padding: "0 12px", borderRadius: 18, display: "flex", alignItems: "center", gap: 5, background: active ? "#B8E0C8" : "white", border: `1.5px solid ${active ? "#B8E0C8" : "#E0E3EA"}`, cursor: "pointer", transition: "all 0.2s" }}>
                  {cat.icon(active ? "#1A2B4C" : cat.color)}
                  <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 12, color: active ? "#1A2B4C" : "#8A96AA", whiteSpace: "nowrap" }}>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 11, color: "#8A96AA", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Note (optional)</span>
          <input
            placeholder="Add a note..."
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ width: "100%", height: 42, borderRadius: 16, background: "white", border: "1.5px solid #E8EBF0", outline: "none", padding: "0 16px", fontFamily: QS, fontWeight: 500, fontSize: 14, color: "#1A2B4C", boxSizing: "border-box" }}
          />
        </div>

        {/* Date */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 11, color: "#8A96AA", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Date</span>
          <button style={{ width: "100%", height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderRadius: 16, background: "white", border: "1.5px solid #E8EBF0", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A96AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 14, color: "#1A2B4C" }}>{dateLabel}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C8CDD8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        {/* Pay Mode */}
        <div>
          <span style={{ fontFamily: QS, fontWeight: 600, fontSize: 11, color: "#8A96AA", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Paid via</span>
          <div style={{ display: "flex", background: "white", borderRadius: 22, border: "1.5px solid #E8EBF0", padding: 3, gap: 2 }}>
            {PAY_MODES.map((mode) => {
              const active = mode.key === payMode;
              return (
                <button key={mode.key} onClick={() => setPayMode(mode.key)}
                  style={{ flex: 1, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: active ? "#F4B8AE" : "transparent", border: "none", cursor: "pointer", transition: "background 0.2s" }}>
                  {mode.icon(active ? "#1A2B4C" : "#B0B7C3")}
                  <span style={{ fontFamily: QS, fontWeight: 700, fontSize: 12, color: active ? "#1A2B4C" : "#B0B7C3" }}>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Numpad (pinned) ── */}
      <div style={{ flexShrink: 0, padding: "10px 20px 0" }}>
        {[["1","2","3"],["4","5","6"],["7","8","9"],[".", "0","⌫"]].map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 8, marginBottom: ri < 3 ? 8 : 0 }}>
            {row.map((k) => (
              <motion.button key={k} whileTap={{ scale: 0.91 }} onClick={() => handleAmountKey(k)}
                style={{ flex: 1, height: 42, borderRadius: 14, background: k === "⌫" ? "#FFF0EC" : "white", border: "1.5px solid #E8EBF0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {k === "⌫" ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F4B8AE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                  </svg>
                ) : (
                  <span style={{ fontFamily: QS, fontWeight: 700, fontSize: 17, color: "#1A2B4C" }}>{k}</span>
                )}
              </motion.button>
            ))}
          </div>
        ))}
      </div>

      {/* ── CTA (pinned) ── */}
      <div style={{ flexShrink: 0, padding: "10px 20px 14px" }}>
        <motion.button
          whileTap={isValid ? { scale: 0.97 } : {}}
          style={{ width: "100%", height: 52, borderRadius: 26, background: isValid ? "#B8E0C8" : "#E8EBF0", border: "none", cursor: isValid ? "pointer" : "default", fontFamily: QS, fontWeight: 700, fontSize: 16, color: isValid ? "#1A2B4C" : "#B0B7C3", letterSpacing: "0.01em", transition: "all 0.25s", boxShadow: isValid ? "0 4px 18px rgba(184,224,200,0.55)" : "none" }}
        >
          Save Expense
        </motion.button>
      </div>
    </div>
  );
}

// ─── Insights ─────────────────────────────────────────────────────────────────
type InsightPeriod = "Weekly" | "Monthly" | "Yearly";

const DONUT_COLORS: Record<string, string> = {
  food: "#F4B8AE", transport: "#B8D4F4", shopping: "#EDB8D8",
  entertainment: "#D4C8F0", health: "#B8E0C8", bills: "#F9E4B4", other: "#C8CDD8",
};

const INS: Record<InsightPeriod, {
  total: number; label: string; change: number;
  cats: { key: string; amount: number }[];
  bars: { day: string; amount: number }[];
  barLabel: string; topPay: string; topPayPct: number;
}> = {
  Weekly: {
    total: 3280, label: "Total Spent This Week", change: 8,
    cats: [
      { key: "food", amount: 780 }, { key: "transport", amount: 360 },
      { key: "shopping", amount: 1299 }, { key: "entertainment", amount: 649 },
      { key: "health", amount: 192 },
    ],
    bars: [
      { day: "Mon", amount: 340 }, { day: "Tue", amount: 180 }, { day: "Wed", amount: 1299 },
      { day: "Thu", amount: 649 }, { day: "Fri", amount: 220 }, { day: "Sat", amount: 402 }, { day: "Sun", amount: 190 },
    ],
    barLabel: "Last 7 Days", topPay: "UPI", topPayPct: 62,
  },
  Monthly: {
    total: 18450, label: "Total Spent This Month", change: 12,
    cats: [
      { key: "food", amount: 5200 }, { key: "transport", amount: 2100 },
      { key: "shopping", amount: 4800 }, { key: "entertainment", amount: 1800 },
      { key: "health", amount: 890 }, { key: "bills", amount: 3660 },
    ],
    bars: [
      { day: "Mon", amount: 1240 }, { day: "Tue", amount: 890 }, { day: "Wed", amount: 3200 },
      { day: "Thu", amount: 2100 }, { day: "Fri", amount: 4800 }, { day: "Sat", amount: 1890 }, { day: "Sun", amount: 4330 },
    ],
    barLabel: "This Week", topPay: "UPI", topPayPct: 58,
  },
  Yearly: {
    total: 214200, label: "Total Spent This Year", change: -5,
    cats: [
      { key: "food", amount: 62400 }, { key: "transport", amount: 25200 },
      { key: "shopping", amount: 57600 }, { key: "entertainment", amount: 21600 },
      { key: "health", amount: 10680 }, { key: "bills", amount: 36720 },
    ],
    bars: [
      { day: "Jan", amount: 16200 }, { day: "Feb", amount: 14800 }, { day: "Mar", amount: 19400 },
      { day: "Apr", amount: 17600 }, { day: "May", amount: 22100 }, { day: "Jun", amount: 18900 }, { day: "Jul", amount: 15200 },
    ],
    barLabel: "Last 7 Months", topPay: "UPI", topPayPct: 55,
  },
};

function InsightsDonut({ segs }: { segs: Array<{ color: string; pct: number }> }) {
  const cx = 90, cy = 90, R = 78, r = 50, gap = 3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let angle = -90;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      {segs.map((seg, i) => {
        const s = angle + gap / 2;
        const sweep = seg.pct * 360 - gap;
        const e = angle + seg.pct * 360 - gap / 2;
        angle += seg.pct * 360;
        if (sweep < 2) return null;
        const sr = toRad(s), er = toRad(e);
        const x1 = cx + R * Math.cos(sr), y1 = cy + R * Math.sin(sr);
        const x2 = cx + R * Math.cos(er), y2 = cy + R * Math.sin(er);
        const x3 = cx + r * Math.cos(er), y3 = cy + r * Math.sin(er);
        const x4 = cx + r * Math.cos(sr), y4 = cy + r * Math.sin(sr);
        const lg = sweep > 180 ? 1 : 0;
        return (
          <path key={i}
            d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R},0,${lg},1,${x2.toFixed(1)},${y2.toFixed(1)} L${x3.toFixed(1)},${y3.toFixed(1)} A${r},${r},0,${lg},0,${x4.toFixed(1)},${y4.toFixed(1)} Z`}
            fill={seg.color}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r - 1} fill="white" />
    </svg>
  );
}

function InsightsScreen() {
  const [period, setPeriod] = useState<InsightPeriod>("Monthly");
  const d = INS[period];
  const catTotal = d.cats.reduce((s, c) => s + c.amount, 0);
  const topCat = [...d.cats].sort((a, b) => b.amount - a.amount)[0];
  const topCatDef = EXPENSE_CATEGORIES.find(c => c.key === topCat.key)!;
  const maxBar = Math.max(...d.bars.map(b => b.amount));
  const biggestCat = topCat;
  const biggestCatDef = topCatDef;
  const PERIODS: InsightPeriod[] = ["Weekly", "Monthly", "Yearly"];

  const donutSegs = d.cats.map(cat => ({
    key: cat.key,
    color: DONUT_COLORS[cat.key] ?? DONUT_COLORS.other,
    pct: cat.amount / catTotal,
    label: EXPENSE_CATEGORIES.find(c => c.key === cat.key)?.label ?? cat.key,
    amount: cat.amount,
  }));

  const topPct = Math.round((topCat.amount / catTotal) * 100);
  const periodWord = period === "Yearly" ? "year" : period === "Monthly" ? "month" : "week";

  // Sparkline from bar data (72×22px)
  const spkMax = maxBar;
  const spkPoints = d.bars.map((b, i) => {
    const x = (i / (d.bars.length - 1)) * 72;
    const y = 22 - Math.max(2, (b.amount / spkMax) * 18);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="relative flex flex-col" style={{ height: "100%", background: "#F8F9FB" }}>
      {/* Ambient blobs */}
      <div className="absolute pointer-events-none" style={{ top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,#B8E0C8 0%,transparent 70%)", opacity: 0.25, filter: "blur(36px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: 80, left: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,#F4B8AE 0%,transparent 70%)", opacity: 0.18, filter: "blur(28px)" }} />

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 4 }}>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 22, color: "#1A2B4C", flexShrink: 0 }}>Insights</span>
        {/* Period 3-way toggle */}
        <div style={{ display: "flex", alignItems: "center", background: "white", borderRadius: 22, border: "1.5px solid #E8EBF0", padding: 3, gap: 2, alignSelf: "center" }}>
          {PERIODS.map(p => {
            const active = p === period;
            return (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ height: 28, padding: "0 9px", borderRadius: 16, background: active ? "#B8E0C8" : "transparent", border: "none", cursor: "pointer", fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 11, color: active ? "#1A2B4C" : "#8A96AA", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" }}>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 28px", position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", flexDirection: "column", gap: 22 }}
          >

            {/* ── Summary card ── */}
            <div style={{ borderRadius: 24, background: "linear-gradient(140deg, #1A2B4C 0%, #2C4470 100%)", padding: "22px 22px 20px", position: "relative", overflow: "hidden" }}>
              {/* Decorative concentric rings */}
              <div style={{ position: "absolute", right: -42, top: -42, width: 160, height: 160, borderRadius: "50%", border: "28px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", right: -8, top: -8, width: 90, height: 90, borderRadius: "50%", border: "18px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />
              {/* Sparkline */}
              <div style={{ position: "absolute", right: 22, bottom: 20, opacity: 0.22, pointerEvents: "none" }}>
                <svg width="72" height="22" viewBox="0 0 72 22" fill="none">
                  <polyline points={spkPoints} stroke="#B8E0C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>

              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                {d.label}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 20, color: "rgba(255,255,255,0.65)", lineHeight: 1 }}>₹</span>
                <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 40, color: "white", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {d.total.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 12px", borderRadius: 13, background: d.change > 0 ? "rgba(244,184,174,0.18)" : "rgba(184,224,200,0.18)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={d.change > 0 ? "#F4B8AE" : "#B8E0C8"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  {d.change > 0 ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
                </svg>
                <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 12, color: d.change > 0 ? "#F4B8AE" : "#B8E0C8" }}>
                  {Math.abs(d.change)}% vs last {periodWord}
                </span>
              </div>
            </div>

            {/* ── Category donut ── */}
            <div>
              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", display: "block", marginBottom: 14 }}>By Category</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Chart + center label */}
                <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
                  <InsightsDonut segs={donutSegs} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                    <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#8A96AA", display: "block", marginBottom: 2 }}>Top spend</span>
                    <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", display: "block", lineHeight: 1.1 }}>{topCatDef.label}</span>
                    <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#8A96AA", display: "block", marginTop: 2 }}>{topPct}%</span>
                  </div>
                </div>

                {/* Legend — 2-column grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", width: "100%", marginTop: 12 }}>
                  {donutSegs.map(seg => (
                    <div key={seg.key} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: seg.color, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 12, color: "#1A2B4C", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {seg.label}
                        </span>
                        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 11, color: "#8A96AA", display: "block" }}>
                          ₹{seg.amount.toLocaleString("en-IN")} · {Math.round(seg.pct * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bar chart ── */}
            <div>
              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", display: "block", marginBottom: 12 }}>{d.barLabel}</span>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 112 }}>
                {d.bars.map((bar, i) => {
                  const isMax = bar.amount === maxBar;
                  const barH = Math.max(5, Math.round((bar.amount / maxBar) * 86));
                  return (
                    <div key={bar.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: barH }}
                        transition={{ duration: 0.48, delay: i * 0.055, ease: [0.22, 1, 0.36, 1] }}
                        style={{ width: "100%", borderRadius: "5px 5px 2px 2px", background: isMax ? "#F4B8AE" : "#B8E0C8", flexShrink: 0 }}
                      />
                      <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 9, color: isMax ? "#E07A50" : "#B0B7C3", marginTop: 5, whiteSpace: "nowrap" }}>{bar.day}</span>
                    </div>
                  );
                })}
              </div>
              {/* Max day callout */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", borderRadius: 12, background: "#FFF0EC" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F4B8AE", flexShrink: 0 }} />
                <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#E07A50" }}>
                  Highest spend: {d.bars.find(b => b.amount === maxBar)!.day} — ₹{maxBar.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* ── Quick insights cards ── */}
            <div>
              <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 15, color: "#1A2B4C", display: "block", marginBottom: 12 }}>Quick Insights</span>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>

                {/* Most spent on */}
                <div style={{ flexShrink: 0, width: 148, borderRadius: 20, background: "white", padding: "14px 14px 12px", boxShadow: "0 2px 10px rgba(26,43,76,0.06)", border: "1.5px solid rgba(26,43,76,0.05)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: (DONUT_COLORS[topCat.key] ?? "#E8EBF0") + "55", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    {topCatDef.icon(topCatDef.color)}
                  </div>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#8A96AA", display: "block", marginBottom: 3 }}>Most Spent On</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", display: "block" }}>{topCatDef.label}</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#1A2B4C", display: "block", marginTop: 1 }}>
                    ₹{topCat.amount.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Top payment mode */}
                <div style={{ flexShrink: 0, width: 148, borderRadius: 20, background: "white", padding: "14px 14px 12px", boxShadow: "0 2px 10px rgba(26,43,76,0.06)", border: "1.5px solid rgba(26,43,76,0.05)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#EEF9F3", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2 2 4-4"/></svg>
                  </div>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#8A96AA", display: "block", marginBottom: 3 }}>Top Payment</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", display: "block" }}>{d.topPay}</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 12, color: "#8A96AA", display: "block", marginTop: 1 }}>{d.topPayPct}% of txns</span>
                </div>

                {/* Biggest category */}
                <div style={{ flexShrink: 0, width: 148, borderRadius: 20, background: "white", padding: "14px 14px 12px", boxShadow: "0 2px 10px rgba(26,43,76,0.06)", border: "1.5px solid rgba(26,43,76,0.05)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FFF0EC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    {biggestCatDef.icon(biggestCatDef.color)}
                  </div>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 11, color: "#8A96AA", display: "block", marginBottom: 3 }}>Biggest Category</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 14, color: "#1A2B4C", display: "block" }}>{biggestCatDef.label}</span>
                  <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 13, color: "#F4B8AE", display: "block", marginTop: 1 }}>
                    ₹{biggestCat.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function SettingsRow({
  icon, label, right, isLast = false, tappable = true, onPress,
}: {
  icon: React.ReactNode; label: string; right?: React.ReactNode;
  isLast?: boolean; tappable?: boolean; onPress?: () => void;
}) {
  return (
    <div>
      <button
        onClick={onPress}
        style={{ width: "100%", height: 56, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", background: "none", border: "none", cursor: tappable ? "pointer" : "default", textAlign: "left" }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "#F1F2F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ flex: 1, fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 14, color: "#1A2B4C" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{right}</div>
      </button>
      {!isLast && <div style={{ height: 1, background: "rgba(26,43,76,0.05)", margin: "0 18px" }} />}
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{ width: 44, height: 26, borderRadius: 13, background: on ? "#B8E0C8" : "#D8DCE4", position: "relative", cursor: "pointer", transition: "background 0.22s", flexShrink: 0 }}
    >
      <motion.div
        animate={{ x: on ? 20 : 2 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 5px rgba(0,0,0,0.18)" }}
      />
    </div>
  );
}

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8CDD8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

function ProfileTabScreen() {
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [darkModeOn, setDarkModeOn]           = useState(false);
  const [showLogout, setShowLogout]           = useState(false);
  const [loggedOut, setLoggedOut]             = useState(false);

  const F = "'Quicksand',sans-serif";

  return (
    <div style={{ height: "100%", background: "#F8F9FB", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Ambient blobs */}
      <div style={{ position: "absolute", top: -30, right: -20, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,#B8E0C8 0%,transparent 70%)", opacity: 0.28, filter: "blur(36px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 80, left: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,#F4B8AE 0%,transparent 70%)", opacity: 0.2, filter: "blur(28px)", pointerEvents: "none" }} />

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "18px 20px 0", position: "relative", zIndex: 2 }}>
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 22, color: "#1A2B4C" }}>Profile</span>
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 36px", position: "relative", zIndex: 1 }}>

        {/* ── User info card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          style={{ borderRadius: 24, background: "white", border: "1.5px solid rgba(26,43,76,0.06)", boxShadow: "0 2px 14px rgba(26,43,76,0.06)", padding: "28px 20px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* Avatar wrapper — relative so badge is positioned against it */}
          <div style={{ position: "relative", width: 80, height: 80, marginBottom: 14 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#B8E0C8 0%,#9ECFB4 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(184,224,200,0.5)", border: "3px solid white" }}>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: 26, color: "#1A2B4C" }}>AK</span>
            </div>
            {/* Camera badge — inset 4px from bottom-right edge of the 80px circle */}
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 24, height: 24, borderRadius: "50%", background: "#1A2B4C", border: "2.5px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>

          <span style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", letterSpacing: "-0.01em", marginBottom: 4 }}>Arjun Kumar</span>
          <span style={{ fontFamily: F, fontWeight: 500, fontSize: 13, color: "#8A96AA", marginBottom: 14 }}>arjun.kumar@gmail.com</span>

          <button style={{ height: 34, padding: "0 22px", borderRadius: 17, background: "transparent", border: "1.5px solid #B8E0C8", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 13, color: "#1A2B4C" }}>
            Edit Profile
          </button>
        </motion.div>

        {/* ── 24px gap ── */}
        <div style={{ height: 20 }} />

        {/* ── Account settings card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{ borderRadius: 24, background: "white", border: "1.5px solid rgba(26,43,76,0.06)", boxShadow: "0 2px 14px rgba(26,43,76,0.06)" }}
        >
          {/* Section label */}
          <div style={{ padding: "14px 20px 2px" }}>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 11, color: "#B0B7C3", letterSpacing: "0.07em", textTransform: "uppercase" }}>Account</span>
          </div>

          <SettingsRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>}
            label="Manage Categories"
            right={<ChevronRight />}
          />
          <SettingsRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
            label="Notifications"
            right={<ToggleSwitch on={notificationsOn} onToggle={() => setNotificationsOn(o => !o)} />}
          />
          <SettingsRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
            label="Dark Mode"
            right={<ToggleSwitch on={darkModeOn} onToggle={() => setDarkModeOn(o => !o)} />}
          />
          <SettingsRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            label="Privacy Policy"
            right={<ChevronRight />}
          />
          <SettingsRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            label="Terms of Service"
            right={<ChevronRight />}
          />
          <SettingsRow
            isLast tappable={false}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="App Version"
            right={<span style={{ fontFamily: F, fontWeight: 600, fontSize: 13, color: "#B0B7C3" }}>v1.0.0</span>}
          />
        </motion.div>

        {/* ── 24px gap ── */}
        <div style={{ height: 24 }} />

        {/* ── Log Out button ── */}
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowLogout(true)}
          style={{ width: "100%", height: 52, borderRadius: 26, background: "#FFF0EC", border: "1.5px solid #F4B8AE", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#E07A50", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E07A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Log Out
        </motion.button>
      </div>

      {/* ── Logout confirmation sheet ── */}
      <AnimatePresence>
        {showLogout && (
          <>
            <motion.div key="lo-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowLogout(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(26,43,76,0.35)", zIndex: 30, backdropFilter: "blur(2px)" }}
            />
            <motion.div key="lo-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 24px", zIndex: 31 }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E0E3EA", margin: "0 auto 24px" }} />
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FFF0EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F4B8AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <p style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", textAlign: "center", margin: "0 0 8px" }}>Log out of Arthik?</p>
              <p style={{ fontFamily: F, fontWeight: 500, fontSize: 14, color: "#8A96AA", textAlign: "center", margin: "0 0 28px", lineHeight: 1.5 }}>
                {"You'll need to sign in again to access your expenses."}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowLogout(false)}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F1F2F5", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C" }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => { setLoggedOut(true); setShowLogout(false); }}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F4B8AE", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C", boxShadow: "0 4px 14px rgba(244,184,174,0.45)" }}>
                  Log Out
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Logged out toast */}
      <AnimatePresence>
        {loggedOut && (
          <motion.div key="lo-toast"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{ position: "absolute", bottom: 24, left: 20, right: 20, height: 52, borderRadius: 26, background: "#1A2B4C", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}
          >
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "white" }}>Logged out successfully</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Manage Categories ────────────────────────────────────────────────────────
const MANAGED_CATS = [
  { key: "food",          label: "Food",      isDefault: true,  count: 18, total: 5200, color: "#F4B8AE", iconColor: "#E07A50" },
  { key: "transport",     label: "Transport", isDefault: true,  count: 9,  total: 2100, color: "#B8D4F4", iconColor: "#5B8FD6" },
  { key: "shopping",      label: "Shopping",  isDefault: true,  count: 6,  total: 4800, color: "#EDB8D8", iconColor: "#D46FA8" },
  { key: "entertainment", label: "Fun",       isDefault: false, count: 4,  total: 1800, color: "#D4C8F0", iconColor: "#9B87D6" },
  { key: "health",        label: "Health",    isDefault: true,  count: 3,  total: 890,  color: "#B8E0C8", iconColor: "#4CAF86" },
  { key: "bills",         label: "Bills",     isDefault: true,  count: 7,  total: 3660, color: "#F9E4B4", iconColor: "#F09B3C" },
  { key: "other",         label: "Other",     isDefault: false, count: 2,  total: 420,  color: "#E8EBF0", iconColor: "#8A96AA" },
];

function ManageCategoriesScreen({ onBack }: { onBack: () => void }) {
  const [cats, setCats] = useState(MANAGED_CATS);
  const [deleteTarget, setDeleteTarget] = useState<typeof MANAGED_CATS[0] | null>(null);
  const F = "'Quicksand',sans-serif";

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setCats(prev => prev.filter(c => c.key !== deleteTarget.key));
    setDeleteTarget(null);
  };

  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4B8AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  );
  const PencilIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );

  return (
    <div style={{ height: "100%", background: "#F8F9FB", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Ambient blob */}
      <div style={{ position: "absolute", top: -20, right: -20, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle,#B8E0C8 0%,transparent 70%)", opacity: 0.25, filter: "blur(32px)", pointerEvents: "none" }} />

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 4, position: "relative", zIndex: 2 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, flexShrink: 0, marginLeft: -6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span style={{ flex: 1, fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", letterSpacing: "-0.01em", textAlign: "center" }}>Manage Categories</span>
        <div style={{ width: 36, height: 36, flexShrink: 0 }} />
      </div>

      {/* ── Scroll body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px", position: "relative", zIndex: 1 }}>

        {/* Count label */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: F, fontWeight: 600, fontSize: 12, color: "#B0B7C3", letterSpacing: "0.04em" }}>
            {cats.length} {cats.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {/* Grouped card */}
        {cats.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#EEF9F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B8E0C8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </div>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 16, color: "#1A2B4C" }}>No categories yet</span>
            <span style={{ fontFamily: F, fontWeight: 500, fontSize: 13, color: "#8A96AA" }}>Tap + to add your first category</span>
          </motion.div>
        ) : (
          <div style={{ borderRadius: 22, background: "white", border: "1.5px solid rgba(26,43,76,0.06)", boxShadow: "0 2px 14px rgba(26,43,76,0.05)", overflow: "hidden" }}>
            {cats.map((cat, i) => {
              const catDef = EXPENSE_CATEGORIES.find(c => c.key === cat.key);
              const isLast = i === cats.length - 1;
              return (
                <motion.div
                  key={cat.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Row */}
                  <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, cursor: "pointer" }}>
                    {/* Badge */}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: cat.color + "55", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {catDef ? catDef.icon(cat.iconColor) : null}
                    </div>

                    {/* Name + stats */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "#1A2B4C" }}>{cat.label}</span>
                      </div>
                      <span style={{ fontFamily: F, fontWeight: 500, fontSize: 12, color: "#8A96AA", whiteSpace: "nowrap" }}>
                        {cat.count} expenses
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <motion.button whileTap={{ scale: 0.88 }}
                        style={{ width: 32, height: 32, borderRadius: 10, background: "#F1F2F5", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <PencilIcon />
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.88 }}
                        onClick={() => setDeleteTarget(cat)}
                        style={{ width: 32, height: 32, borderRadius: 10, background: "#FFF0EC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <TrashIcon />
                      </motion.button>
                    </div>
                  </div>

                  {!isLast && <div style={{ height: 1, background: "rgba(26,43,76,0.05)", margin: "0 16px" }} />}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>


      {/* ── Delete confirmation sheet ── */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div key="del-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDeleteTarget(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(26,43,76,0.35)", zIndex: 30, backdropFilter: "blur(2px)" }}
            />
            <motion.div key="del-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 24px", zIndex: 31 }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E0E3EA", margin: "0 auto 24px" }} />

              {/* Category badge preview */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: (deleteTarget.color ?? "#F4B8AE") + "55", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={deleteTarget.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                </div>
                <p style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", textAlign: "center", margin: "0 0 6px" }}>
                  Delete "{deleteTarget.label}"?
                </p>
                <p style={{ fontFamily: F, fontWeight: 500, fontSize: 14, color: "#8A96AA", textAlign: "center", margin: 0, lineHeight: 1.55, maxWidth: 260 }}>
                  {deleteTarget.count > 0
                    ? `${deleteTarget.count} expenses will need to be reassigned to another category.`
                    : "This category has no expenses and can be safely removed."}
                </p>
              </div>

              {deleteTarget.isDefault && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 14, background: "#FFF9EC", border: "1px solid #F9E4B4", marginBottom: 16 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F09B3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ fontFamily: F, fontWeight: 600, fontSize: 12, color: "#F09B3C", lineHeight: 1.45 }}>
                    This is a default category. Deleting it may affect expense reporting.
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F1F2F5", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C" }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={confirmDelete}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F4B8AE", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C", boxShadow: "0 4px 14px rgba(244,184,174,0.45)" }}>
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add / Edit Category ──────────────────────────────────────────────────────
const CAT_ICONS: Array<{ key: string; icon: (color: string) => JSX.Element }> = [
  { key: "food",     icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { key: "transport",icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
  { key: "shopping", icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> },
  { key: "fun",      icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> },
  { key: "health",   icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { key: "bills",    icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { key: "education",icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
  { key: "travel",   icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.9.5-.9 1v.1c0 .4.2.8.5 1l2.5 2.5L2.3 13c-.3.4-.3.9 0 1.2l1.5 1.5c.3.3.8.3 1.2 0l2.2-1.5 2.5 2.5c.2.2.6.4 1 .5h.1c.5 0 .9-.4 1-.9z"/></svg> },
  { key: "home",     icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { key: "grocery",  icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg> },
  { key: "fitness",  icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h1a4 4 0 000 8H2M6 12h12M6 8v8M18 8v8"/></svg> },
  { key: "gift",     icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg> },
  { key: "coffee",   icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { key: "music",    icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
  { key: "pets",     icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5.172C10 3.443 8.766 2 7.172 2 5.398 2 4 3.5 4 5c0 1.657 1.343 3 3 3 1.21 0 2.249-.7 2.757-1.72M14 5.172C14 3.443 15.234 2 16.828 2 18.602 2 20 3.5 20 5c0 1.657-1.343 3-3 3-1.21 0-2.249-.7-2.757-1.72M2 12c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3zM16 12c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z"/><path d="M12 22c-4 0-6-2.5-6-6 0-2 1-4 2.5-5.5S12 9 12 9s1.5.5 3.5 2S18 14 18 16c0 3.5-2 6-6 6z"/></svg> },
  { key: "salary",   icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { key: "other",    icon: c => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
];

const CAT_COLORS = [
  { key: "mint",   hex: "#B8E0C8" },
  { key: "peach",  hex: "#F4B8AE" },
  { key: "blue",   hex: "#B8D4F4" },
  { key: "pink",   hex: "#EDB8D8" },
  { key: "purple", hex: "#D4C8F0" },
  { key: "yellow", hex: "#F9E4B4" },
  { key: "teal",   hex: "#B8E8E0" },
  { key: "grey",   hex: "#DDE1E8" },
];

const EXISTING_CAT_NAMES = MANAGED_CATS.map(c => c.label.toLowerCase());

interface AddEditCategoryProps {
  onBack: () => void;
  mode: "add" | "edit";
  initialName?: string;
  initialIcon?: string;
  initialColor?: string;
  isDefaultCat?: boolean;
}

function AddEditCategoryScreen({ onBack, mode, initialName = "", initialIcon = "", initialColor = "", isDefaultCat = false }: AddEditCategoryProps) {
  const F = "'Quicksand',sans-serif";
  const MAX = 24;
  const [name, setName] = useState(initialName);
  const [selectedIcon, setSelectedIcon] = useState(initialIcon);
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [showDelete, setShowDelete] = useState(false);
  const isDuplicate = name.trim().length > 0 && EXISTING_CAT_NAMES.includes(name.trim().toLowerCase()) && name.trim().toLowerCase() !== initialName.toLowerCase();
  const canSave = name.trim().length > 0 && selectedIcon !== "" && selectedColor !== "" && !isDuplicate;
  const previewColor = selectedColor || "#DDE1E8";
  const previewIconDef = CAT_ICONS.find(c => c.key === selectedIcon);

  const SectionLabel = ({ children }: { children: string }) => (
    <span style={{ fontFamily: F, fontWeight: 600, fontSize: 11, color: "#B0B7C3", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
      {children}
    </span>
  );

  return (
    <div style={{ height: "100%", background: "#F8F9FB", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Ambient blob */}
      <div style={{ position: "absolute", top: -20, left: -20, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,#B8E0C8 0%,transparent 70%)", opacity: 0.22, filter: "blur(36px)", pointerEvents: "none" }} />

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "14px 20px 0", display: "flex", alignItems: "center", position: "relative", zIndex: 2 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, marginLeft: -6, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A2B4C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span style={{ flex: 1, fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", letterSpacing: "-0.01em", textAlign: "center" }}>
          {mode === "add" ? "Add Category" : "Edit Category"}
        </span>
        <div style={{ width: 36, height: 36, flexShrink: 0 }} />
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 120px", position: "relative", zIndex: 1 }}>

        {/* ── Live Preview Badge ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <motion.div
            animate={{ backgroundColor: previewColor + "66", scale: selectedColor ? 1 : 0.95 }}
            transition={{ duration: 0.22 }}
            style={{ width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2.5px solid ${previewColor}` }}
          >
            {previewIconDef
              ? previewIconDef.icon("#1A2B4C")
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8CDD8" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            }
          </motion.div>
          <span style={{ fontFamily: F, fontWeight: 600, fontSize: 11, color: "#B0B7C3", letterSpacing: "0.07em", textTransform: "uppercase", marginTop: 8 }}>Preview</span>
        </div>

        {/* ── Category Name ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Category Name</SectionLabel>
          <div style={{ position: "relative", borderRadius: 20, background: "white", border: `1.5px solid ${isDuplicate ? "#F4B8AE" : "rgba(26,43,76,0.08)"}`, overflow: "hidden", transition: "border-color 0.18s" }}>
            <input
              value={name}
              onChange={e => setName(e.target.value.slice(0, MAX))}
              placeholder="e.g. Groceries, Travel, Rent"
              autoFocus={mode === "add"}
              style={{ width: "100%", padding: "14px 52px 14px 18px", fontFamily: F, fontWeight: 500, fontSize: 15, color: "#1A2B4C", background: "transparent", border: "none", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: 14, bottom: 14, fontFamily: F, fontWeight: 500, fontSize: 11, color: name.length >= MAX ? "#F4B8AE" : "#C8CDD8" }}>
              {name.length}/{MAX}
            </span>
          </div>
          {isDuplicate && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ fontFamily: F, fontWeight: 600, fontSize: 12, color: "#E07A50", margin: "6px 4px 0" }}>
              Category already exists
            </motion.p>
          )}
        </div>

        {/* ── Icon Picker ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Choose Icon</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {CAT_ICONS.map(({ key, icon }) => {
              const active = selectedIcon === key;
              return (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setSelectedIcon(key)}
                  style={{
                    width: "100%", aspectRatio: "1", borderRadius: "50%",
                    background: active ? (selectedColor || "#B8E0C8") + "55" : "white",
                    border: active ? `2px solid ${selectedColor || "#B8E0C8"}` : "1.5px solid rgba(26,43,76,0.07)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.18s, border 0.18s",
                  }}
                >
                  {icon(active ? "#1A2B4C" : "#B0B7C3")}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Color Picker ── */}
        <div style={{ marginBottom: 8 }}>
          <SectionLabel>Choose Color</SectionLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {CAT_COLORS.map(({ key, hex }) => {
              const active = selectedColor === hex;
              return (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedColor(hex)}
                  style={{
                    width: 40, height: 40, borderRadius: "50%", background: hex,
                    border: active ? "3px solid #1A2B4C" : "3px solid transparent",
                    cursor: "pointer", flexShrink: 0,
                    boxShadow: active ? "0 0 0 2px white inset" : "none",
                    transform: active ? "scale(1.12)" : "scale(1)",
                    transition: "transform 0.18s, border 0.18s, box-shadow 0.18s",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Fixed bottom CTA area ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 20px 20px", background: "linear-gradient(to top, #F8F9FB 70%, transparent)", zIndex: 10 }}>
        <motion.button
          whileTap={canSave ? { scale: 0.97 } : {}}
          style={{
            width: "100%", height: 56, borderRadius: 28,
            background: canSave ? "#B8E0C8" : "#E8EBF0",
            border: "none", cursor: canSave ? "pointer" : "default",
            fontFamily: F, fontWeight: 700, fontSize: 16,
            color: canSave ? "#1A2B4C" : "#B0B7C3",
            opacity: canSave ? 1 : 0.7,
            transition: "background 0.22s, color 0.22s, opacity 0.22s",
            boxShadow: canSave ? "0 4px 18px rgba(184,224,200,0.55)" : "none",
          }}
        >
          {mode === "add" ? "Save Category" : "Update Category"}
        </motion.button>

        {/* Delete link — edit mode, non-default only */}
        {mode === "edit" && !isDefaultCat && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowDelete(true)}
            style={{ width: "100%", marginTop: 10, padding: "6px 0", background: "none", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 14, color: "#F4B8AE" }}
          >
            Delete Category
          </motion.button>
        )}
      </div>

      {/* ── Delete confirmation sheet ── */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div key="del-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowDelete(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(26,43,76,0.35)", zIndex: 30, backdropFilter: "blur(2px)" }}
            />
            <motion.div key="del-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 28px", zIndex: 31 }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E0E3EA", margin: "0 auto 24px" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FFF0EC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E07A50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                </div>
                <p style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#1A2B4C", textAlign: "center", margin: "0 0 6px" }}>Delete "{name || "this category"}"?</p>
                <p style={{ fontFamily: F, fontWeight: 500, fontSize: 14, color: "#8A96AA", textAlign: "center", margin: 0, lineHeight: 1.55, maxWidth: 260 }}>
                  Expenses in this category will need to be reassigned.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDelete(false)}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F1F2F5", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C" }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowDelete(false); onBack(); }}
                  style={{ flex: 1, height: 52, borderRadius: 26, background: "#F4B8AE", border: "none", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 15, color: "#1A2B4C", boxShadow: "0 4px 14px rgba(244,184,174,0.45)" }}>
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Illustrations ────────────────────────────────────────────────────────────
function SlideOneIllustration() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
      {/* All circles share cx=110 cy=110 */}
      <circle cx="110" cy="110" r="96" fill="#EAF7F0" />
      <circle cx="110" cy="110" r="76" fill="#D8F2E8" opacity="0.55" />
      <circle cx="110" cy="110" r="57" fill="none" stroke="#B8E0C8" strokeWidth="1.2" strokeDasharray="3.5 3" opacity="0.5" />
      <circle cx="110" cy="110" r="50" fill="none" stroke="#B8E0C8" strokeWidth="1"   opacity="0.3" />
      <circle cx="110" cy="110" r="43" fill="none" stroke="#B8E0C8" strokeWidth="0.7" opacity="0.18" />

      {/* Coin drop shadow */}
      <circle cx="112" cy="113" r="36" fill="#8EC9A8" opacity="0.2" />

      {/* Coin layers */}
      <circle cx="110" cy="110" r="36" fill="#B8E0C8" />
      <circle cx="110" cy="110" r="28" fill="#CDEADB" />
      <circle cx="110" cy="110" r="20" fill="#E0F4EC" />

      {/* Rupee symbol */}
      <text x="110" y="120" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="26" fill="#1A2B4C">₹</text>

      {/* Coin shine */}
      <ellipse cx="99" cy="99" rx="10" ry="4.5" fill="white" opacity="0.38" transform="rotate(-25 99 99)" />

      {/* Sparkles — evenly around the coin */}
      <path d="M42 70  l2.2 -5.8 l2.2 5.8 l5.8 2.2 l-5.8 2.2 l-2.2 5.8 l-2.2 -5.8 l-5.8 -2.2z" fill="#F4B8AE" opacity="0.78" />
      <path d="M170 58 l1.6 -4.2 l1.6 4.2 l4.2 1.6 l-4.2 1.6 l-1.6 4.2 l-1.6 -4.2 l-4.2 -1.6z" fill="#B8E0C8" opacity="0.88" />
      <path d="M172 152 l1.1 -2.8 l1.1 2.8 l2.8 1.1 l-2.8 1.1 l-1.1 2.8 l-1.1 -2.8 l-2.8 -1.1z" fill="#F9E4B4" opacity="0.9"  />
      <path d="M44 152 l1   -2.5 l1   2.5 l2.5 1   l-2.5 1   l-1   2.5 l-1   -2.5 l-2.5 -1z"   fill="#D4C8F0" opacity="0.8"  />

      {/* Accent dots */}
      <circle cx="34"  cy="110" r="3.5" fill="#B8E0C8" opacity="0.85" />
      <circle cx="186" cy="110" r="3.5" fill="#F4B8AE" opacity="0.85" />
      <circle cx="110" cy="28"  r="2.5" fill="#B8E0C8" opacity="0.7"  />
      <circle cx="110" cy="192" r="2.5" fill="#F4B8AE" opacity="0.7"  />

      {/* Floating mini coins — left and right */}
      <circle cx="38"  cy="148" r="10" fill="#F9E4B4" opacity="0.75" />
      <circle cx="38"  cy="148" r="7"  fill="#FBF0CC" opacity="0.8" />
      <text x="38"  y="152" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="9" fill="#B08020" opacity="0.85">₹</text>

      <circle cx="182" cy="148" r="8.5" fill="#B8E0C8" opacity="0.75" />
      <circle cx="182" cy="148" r="5.5" fill="#D4EEE0" opacity="0.8" />
      <text x="182" y="152" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="8" fill="#1A2B4C" opacity="0.8">₹</text>
    </svg>
  );
}

function SlideTwoIllustration() {
  const cx = 110, cy = 80, R = 54, r = 33;
  const segments = [
    { pct: 0.38, color: "#B8E0C8", label: "Food",     amount: "38%" },
    { pct: 0.27, color: "#F4B8AE", label: "Travel",   amount: "27%" },
    { pct: 0.20, color: "#F9E4B4", label: "Shopping", amount: "20%" },
    { pct: 0.15, color: "#D4C8F0", label: "Other",    amount: "15%" },
  ];
  const toRad = (d: number) => (d * Math.PI) / 180;
  const legendRows = [[segments[0], segments[1]], [segments[2], segments[3]]];
  return (
    <svg width="220" height="195" viewBox="0 0 220 195" fill="none">
      <circle cx="110" cy="80" r="70" fill="#EAF7F0" />
      <circle cx="110" cy="80" r="58" fill="#D8F0E6" opacity="0.5" />
      {segments.map((seg, i) => {
        let a = -90;
        segments.slice(0, i).forEach(s => { a += s.pct * 360; });
        const s2 = toRad(a + 1), e2 = toRad(a + seg.pct * 360 - 1);
        const x1 = cx + R * Math.cos(s2), y1 = cy + R * Math.sin(s2);
        const x2 = cx + R * Math.cos(e2), y2 = cy + R * Math.sin(e2);
        const x3 = cx + r * Math.cos(e2), y3 = cy + r * Math.sin(e2);
        const x4 = cx + r * Math.cos(s2), y4 = cy + r * Math.sin(s2);
        const large = seg.pct * 360 > 180 ? 1 : 0;
        return <path key={i} d={`M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${large},0,${x4},${y4} Z`} fill={seg.color} />;
      })}
      <circle cx="110" cy="80" r={r} fill="#F8F9FB" />
      <circle cx="110" cy="80" r={r} fill="none" stroke="rgba(26,43,76,0.06)" strokeWidth="1.5" />
      {/* Center badge */}
      <circle cx="110" cy="80" r="18" fill="#B8E0C8" opacity="0.35" />
      <circle cx="110" cy="80" r="13" fill="#B8E0C8" />
      <circle cx="110" cy="80" r="9"  fill="#D4EEE0" />
      <text x="110" y="84" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="11" fill="#1A2B4C">₹</text>
      <ellipse cx="106" cy="75" rx="4" ry="2" fill="white" opacity="0.4" transform="rotate(-20 106 75)" />
      {legendRows.map((row, ri) =>
        row.map((seg, ci) => {
          const itemW = 90, totalW = itemW * 2 + 12;
          const startX = (220 - totalW) / 2;
          const x = startX + ci * (itemW + 12), y = 154 + ri * 18;
          return (
            <g key={`${ri}-${ci}`}>
              <circle cx={x + 5} cy={y + 4} r={4} fill={seg.color} />
              <text x={x + 14} y={y + 8} style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 600, fontSize: 10.5, fill: "#1A2B4C" }}>{seg.label}</text>
              <text x={x + itemW} y={y + 8} textAnchor="end" style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 500, fontSize: 10.5, fill: "#8A96AA" }}>{seg.amount}</text>
            </g>
          );
        })
      )}
    </svg>
  );
}

function SlideThreeIllustration() {
  return (
    <svg width="200" height="190" viewBox="0 0 200 190" fill="none">
      <circle cx="100" cy="88" r="72" fill="#EAF7F0" />
      <circle cx="100" cy="88" r="56" fill="#D4EEE0" opacity="0.7" />
      <circle cx="100" cy="88" r="44" fill="#B8E0C8" />
      <path d="M80 88 L93 101 L122 72" stroke="#1A2B4C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(148, 52)"><rect width="36" height="22" rx="6" fill="white" opacity="0.9" /><rect x="6" y="6" width="14" height="3" rx="1.5" fill="#B8E0C8" /><rect x="6" y="12" width="20" height="2" rx="1" fill="#E0E4EC" /></g>
      <g transform="translate(16, 60)"><rect width="36" height="22" rx="6" fill="white" opacity="0.9" /><rect x="6" y="6" width="10" height="3" rx="1.5" fill="#F4B8AE" /><rect x="6" y="12" width="20" height="2" rx="1" fill="#E0E4EC" /></g>
      <g transform="translate(24, 112)"><rect width="28" height="18" rx="5" fill="white" opacity="0.8" /><rect x="5" y="5" width="8" height="2.5" rx="1.2" fill="#F9E4B4" /><rect x="5" y="10" width="16" height="2" rx="1" fill="#E0E4EC" /></g>
      <circle cx="152" cy="116" r="3" fill="#F4B8AE" opacity="0.8" />
      <path d="M160 88 l1.5 -3.5 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5z" fill="#B8E0C8" opacity="0.8" />
      <path d="M38 52 l1.2 -2.8 l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2z" fill="#F4B8AE" opacity="0.7" />
    </svg>
  );
}
