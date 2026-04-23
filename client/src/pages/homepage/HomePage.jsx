import { Footer } from "../../components/footer/Footer";
import { Input } from "../../components/Input/Input";
import { useForm } from "../../hooks/useForm";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import "./HomePage.css";

export const HomePage = () => {
    const heroText = "SEARCH • SAVE • SHARE";
    const navigate = useNavigate();
    const { login, error: authError, isAuthenticated, user } = useAuth();
    const { register, values } = useForm({
        email: "",
        password: "",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(values.email, values.password);
        if (result.success) {
            navigate(result.user?.type === "admin" ? "/logs" : "/gallery");
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate(user?.type === "admin" ? "/logs" : "/gallery", { replace: true });
        }
    }, [isAuthenticated, navigate, user]);

    return (
        <main className="tagged-home-page">
            <section className="tagged-login-section">
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
                    <button className="tagged-login-button" type="submit">
                        Log In
                    </button>
                </form>

                <Footer />
            </section>
            <section className="tagged-home-page-main-section">
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
