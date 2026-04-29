import { Footer } from "../../components/footer/Footer";
import { Input } from "../../components/Input/Input";
import { useForm } from "../../hooks/useForm";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./HomePage.css";

const REMEMBERED_LOGIN_EMAIL_STORAGE_KEY = "tagged:remembered-login-email";

export const HomePage = () => {
    const heroText = "SEARCH • SAVE • SHARE";
    const navigate = useNavigate();
    const { login, error: authError, isAuthenticated, user } = useAuth();
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");
    const [isThemeAnimating, setIsThemeAnimating] = useState(false);
    const [rememberedEmail] = useState(() => localStorage.getItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY) || "");
    const [rememberMe, setRememberMe] = useState(() => Boolean(rememberedEmail));
    const { register, values } = useForm({
        email: rememberedEmail,
        password: "",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(values.email, values.password);
        if (result.success) {
            if (rememberMe) {
                localStorage.setItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY, values.email.trim());
            } else {
                localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY);
            }
            navigate(result.user?.type === "admin" ? "/logs" : "/gallery");
        }
    };

    const handleThemeToggle = () => {
        const next = isDark ? "light" : "dark";

        setIsThemeAnimating(true);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("tagged:theme", next);
        setIsDark(next === "dark");

        window.setTimeout(() => {
            setIsThemeAnimating(false);
        }, 220);
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate(user?.type === "admin" ? "/logs" : "/gallery", { replace: true });
        }
    }, [isAuthenticated, navigate, user]);

    return (
        <main className="tagged-home-page">
            <span className="tagged-login-bg-square tagged-login-bg-square--top-right" aria-hidden="true" />
            <span className="tagged-login-bg-square tagged-login-bg-square--bottom-left" aria-hidden="true" />
            <section className="tagged-login-section">
                <button
                    type="button"
                    className={`tagged-login-theme-toggle${isDark ? " is-dark" : ""}${
                        isThemeAnimating ? " is-animating" : ""
                    }`}
                    onClick={handleThemeToggle}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    aria-pressed={isDark}
                    title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                    <img
                        src={isDark ? "/icons/moon.svg" : "/icons/sun.svg"}
                        alt=""
                        aria-hidden="true"
                        className="tagged-login-theme-toggle-icon"
                    />
                    <span className="tagged-login-theme-toggle-label">{isDark ? "Dark" : "Light"}</span>
                </button>
                <h1 className="tagged-login-section-title">Tagged</h1>
                <div className="tagged-error-slot" aria-live="polite">
                    <div
                        className={`tagged-error-message${authError ? "" : " tagged-error-message--hidden"}`}
                        role={authError ? "alert" : undefined}
                        aria-hidden={!authError}
                    >
                        {authError || "\u00A0"}
                    </div>
                </div>
                <form className="tagged-login-form" onSubmit={handleSubmit}>
                    <Input label="Email" type="email" {...register("email")} />
                    <Input label="Password" type="password" {...register("password")} />
                    <label className="tagged-login-remember">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(event) => {
                                const isChecked = event.target.checked;
                                setRememberMe(isChecked);
                                if (!isChecked) {
                                    localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY);
                                }
                            }}
                        />
                        <span>Remember me</span>
                    </label>
                    <button className="tagged-login-button" type="submit">
                        Log In
                    </button>
                </form>

                <Footer />
            </section>
            <section className="tagged-home-page-main-section">
                <span
                    className="tagged-login-bg-square tagged-login-bg-square--desktop-top-left"
                    aria-hidden="true"
                />
                <span
                    className="tagged-login-bg-square tagged-login-bg-square--desktop-top-right"
                    aria-hidden="true"
                />
                <span
                    className="tagged-login-bg-square tagged-login-bg-square--desktop-center-left"
                    aria-hidden="true"
                />
                <span
                    className="tagged-login-bg-square tagged-login-bg-square--desktop-center-right"
                    aria-hidden="true"
                />
                <span
                    className="tagged-login-bg-square tagged-login-bg-square--desktop-bottom-right"
                    aria-hidden="true"
                />
                <div className="tagged-hero-text" aria-hidden="true">
                    {heroText.split("").map((char, index) => (
                        <span key={`${char}-${index}`} style={{ "--i": index }}>
                            {char === " " ? "\u00A0" : char}
                        </span>
                    ))}
                </div>
            </section>
        </main>
    );
};
