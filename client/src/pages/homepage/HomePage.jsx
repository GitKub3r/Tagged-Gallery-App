import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faEnvelope,
    faEye,
    faEyeSlash,
    faLock,
    faMoon,
    faSun,
    faTags,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { Footer } from "../../components/footer/Footer";
import { LoginShowcase } from "../../components/login-showcase/LoginShowcase";
import { useAuth } from "../../hooks/useAuth";
import { useForm } from "../../hooks/useForm";

const REMEMBERED_LOGIN_EMAIL_STORAGE_KEY = "tagged:remembered-login-email";

const LoginField = ({ icon, label, name, type, value, onChange, autoComplete, action }) => (
    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300" htmlFor={name}>
        <span className="mb-4 block">{label}</span>
        <span className="flex h-12 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 transition-colors focus-within:border-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-neutral-400">
            <FontAwesomeIcon icon={icon} className="w-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
            <input
                id={name}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
                required
                className="min-w-0 flex-1 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
                placeholder={label}
            />
            {action}
        </span>
    </label>
);

export const HomePage = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, user } = useAuth();
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute("data-theme") !== "light");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberedEmail] = useState(() => localStorage.getItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY) || "");
    const [rememberMe, setRememberMe] = useState(() => Boolean(rememberedEmail));
    const { register, values } = useForm({ email: rememberedEmail, password: "" });

    const loginMutation = useMutation({
        mutationFn: ({ email, password }) => login(email, password),
    });

    const handleSubmit = async (event) => {
        event.preventDefault();
        const result = await loginMutation.mutateAsync({
            email: values.email.trim(),
            password: values.password,
        });

        if (!result.success) return;

        if (rememberMe) {
            localStorage.setItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY, values.email.trim());
        } else {
            localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY);
        }

        navigate(result.user?.type === "admin" ? "/logs" : "/gallery");
    };

    const handleThemeToggle = () => {
        const nextTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("tagged:theme", nextTheme);
        setIsDark(nextTheme === "dark");
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate(user?.type === "admin" ? "/logs" : "/gallery", { replace: true });
        }
    }, [isAuthenticated, navigate, user]);

    return (
        <main className="relative min-h-dvh overflow-hidden bg-neutral-100 text-neutral-950 transition-colors dark:bg-neutral-950 dark:text-neutral-100">
            <div className="tagged-login-orb pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-neutral-300/70 blur-3xl dark:bg-neutral-800/70" aria-hidden="true" />
            <div className="tagged-login-orb tagged-login-orb--reverse pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-neutral-300/70 blur-3xl dark:bg-neutral-800/70" aria-hidden="true" />

            <div className="relative grid min-h-dvh w-full bg-neutral-50 lg:grid-cols-12 dark:bg-neutral-900">
                <section className="flex min-h-dvh flex-col p-5 sm:p-8 lg:col-span-5 lg:p-12">
                    <header className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-950">
                                <FontAwesomeIcon icon={faTags} aria-hidden="true" />
                            </span>
                            <span className="text-lg font-black tracking-tight">Tagged</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleThemeToggle}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white p-0 text-neutral-600 hover:scale-100 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        >
                            <FontAwesomeIcon icon={isDark ? faMoon : faSun} aria-hidden="true" />
                        </button>
                    </header>

                    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12 sm:py-16">
                        <div className="mb-8">
                            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">Welcome back</p>
                            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tagged Gallery App</h1>
                            <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                                Sign in to search, organise and rediscover every piece of media.
                            </p>
                        </div>

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <LoginField
                                icon={faEnvelope}
                                label="Email address"
                                type="email"
                                autoComplete="email"
                                {...register("email")}
                            />
                            <LoginField
                                icon={faLock}
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                action={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-transparent p-0 text-neutral-400 hover:scale-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-500 dark:hover:text-neutral-200"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} aria-hidden="true" />
                                    </button>
                                }
                                {...register("password")}
                            />

                            <div className="flex min-h-6 items-center justify-between gap-4">
                                <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(event) => {
                                            setRememberMe(event.target.checked);
                                            if (!event.target.checked) {
                                                localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_STORAGE_KEY);
                                            }
                                        }}
                                        className="h-4 w-4 accent-neutral-950 dark:accent-neutral-100"
                                    />
                                    Remember me
                                </label>
                            </div>

                            <button
                                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-950 bg-neutral-950 px-5 text-sm font-bold text-white hover:scale-100 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-wait disabled:opacity-60 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
                                type="submit"
                                disabled={loginMutation.isPending}
                            >
                                <span>{loginMutation.isPending ? "Signing in…" : "Sign in"}</span>
                                {!loginMutation.isPending ? <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /> : null}
                            </button>
                        </form>
                    </div>

                    <Footer />
                </section>

                <section className="relative flex min-h-dvh items-center justify-center overflow-hidden border-t border-neutral-300 bg-neutral-100 p-6 text-neutral-950 sm:p-8 lg:col-span-7 lg:border-l lg:border-t-0 lg:p-12 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100" aria-label="Tagged Gallery preview">
                    <div className="absolute inset-0 opacity-30" aria-hidden="true">
                        <div className="tagged-login-orb absolute -right-20 top-10 h-64 w-64 rounded-full bg-neutral-300 blur-3xl dark:bg-neutral-600" />
                        <div className="tagged-login-orb tagged-login-orb--reverse absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-neutral-200 blur-3xl dark:bg-neutral-700" />
                    </div>

                    <LoginShowcase />
                </section>
            </div>
        </main>
    );
};
