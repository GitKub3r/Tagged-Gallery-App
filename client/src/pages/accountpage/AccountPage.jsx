import { useMemo, useRef, useState } from "react";
import {
  faArrowRight,
  faCamera,
  faCircleCheck,
  faFloppyDisk,
  faKey,
  faEnvelope,
  faFolderOpen,
  faGaugeHigh,
  faImages,
  faListCheck,
  faMoon,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faRightFromBracket,
  faShieldHalved,
  faSun,
  faTags,
  faTrash,
  faUser,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { accountApi } from "../../api/accountApi";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../hooks/useAuth";
import { UserAvatar } from "../../components/user-avatar/UserAvatar";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { toast } from "sonner";

const createCroppedAvatar = (source, zoom, positionX, positionY) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      const scale =
        Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      // Mirror the editor transform exactly: the preview translates the
      // square image by 20% and then applies zoom around its centre.
      const x = -(width - size) / 2 + zoom * positionX * size * 0.2;
      const y = -(height - size) / 2 + zoom * positionY * size * 0.2;
      context.drawImage(image, x, y, width, height);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Unable to process image")),
        "image/jpeg",
        0.9,
      );
    };
    image.onerror = () => reject(new Error("Unable to read image"));
    image.src = source;
  });

const toTitle = (value) => {
  const normalized = String(value || "").trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
    : "-";
};

const ACCESS_BY_ROLE = {
  admin: [
    {
      label: "Logs",
      description: "Review system activity",
      icon: faListCheck,
      path: "/logs",
    },
    {
      label: "Actions",
      description: "Manage action definitions",
      icon: faShieldHalved,
      path: "/actions",
    },
    {
      label: "Users",
      description: "Administer user accounts",
      icon: faUsers,
      path: "/users",
    },
  ],
  basic: [
    {
      label: "Gallery",
      description: "Browse and manage media",
      icon: faImages,
      path: "/gallery",
    },
    {
      label: "Albums",
      description: "Organize media collections",
      icon: faFolderOpen,
      path: "/albums",
    },
    {
      label: "Metadata",
      description: "Manage reusable metadata",
      icon: faTags,
      path: "/metadata",
    },
    {
      label: "Dashboard",
      description: "Explore library statistics",
      icon: faGaugeHigh,
      path: "/dashboard",
    },
  ],
};

export const AccountPage = () => {
  const navigate = useNavigate();
  const { user, accessToken, logout, updateCurrentUser } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [, setFeedback] = useState(null);
  const [avatarEditor, setAvatarEditor] = useState(null);
  const [avatarAdjust, setAvatarAdjust] = useState({ zoom: 1, x: 0, y: 0 });
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [isResetAvatarConfirmOpen, setIsResetAvatarConfirmOpen] = useState(false);
  const avatarDragRef = useRef(null);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute("data-theme") !== "light",
  );
  const mediaNameMatchMode = user?.media_name_match_mode === "strict" ? "strict" : "normal";

  const account = useMemo(() => {
    const username = String(user?.username || "").trim() || "Unnamed user";
    const email = String(user?.email || "").trim() || "No email available";
    const roleKey =
      String(user?.type || "basic").toLowerCase() === "admin"
        ? "admin"
        : "basic";

    return {
      username,
      email,
      roleKey,
      role: toTitle(roleKey),
      access: ACCESS_BY_ROLE[roleKey],
    };
  }, [user]);
  const profileHasChanges =
    profileForm.username.trim() !== account.username ||
    profileForm.email.trim().toLowerCase() !== account.email.toLowerCase();

  const handleSignOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const profileMutation = useMutation({
    mutationFn: (profile) => accountApi.updateProfile(profile, accessToken),
    onSuccess: ({ data }) => {
      updateCurrentUser(data);
      setProfileForm({ username: data.username, email: data.email });
      toast.success("Profile updated.");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      accountApi.changePassword({ currentPassword, newPassword }, accessToken),
    onSuccess: () => {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setChangingPassword(false);
      toast.success("Password updated.");
    },
  });

  const mediaSearchPreferenceMutation = useMutation({
    mutationFn: (matchMode) => accountApi.updateMediaSearchPreference(matchMode, accessToken),
    onSuccess: ({ data }) => {
      updateCurrentUser(data);
      toast.success("Media search preference updated.");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authApi.logoutAll(accessToken),
    onSuccess: () => {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("tagged:session-invalidated"));
      navigate("/", { replace: true });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async () =>
      accountApi.updateAvatar(
        await createCroppedAvatar(
          avatarEditor,
          avatarAdjust.zoom,
          avatarAdjust.x,
          avatarAdjust.y,
        ),
        accessToken,
      ),
    onSuccess: ({ data }) => {
      updateCurrentUser(data);
      URL.revokeObjectURL(avatarEditor);
      setAvatarEditor(null);
      toast.success("Profile image updated.");
    },
  });

  const resetAvatarMutation = useMutation({
    mutationFn: () => accountApi.resetAvatar(accessToken),
    onSuccess: ({ data }) => {
      updateCurrentUser(data);
      setIsResetAvatarConfirmOpen(false);
      toast.success("Profile image removed.");
    },
  });

  const openAvatarEditor = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isHeic =
      /\.(heic|heif)$/i.test(file.name) ||
      ["image/heic", "image/heif"].includes(file.type.toLowerCase());
    if (!file.type.startsWith("image/") && !isHeic) {
      toast.error("Choose a valid image.");
      return;
    }
    setIsPreparingAvatar(true);
    try {
      const preparedFile = isHeic
        ? await import("heic2any").then(({ default: convertHeic }) =>
            convertHeic({ blob: file, toType: "image/jpeg", quality: 0.92 }),
          )
        : file;
      const imageBlob = Array.isArray(preparedFile)
        ? preparedFile[0]
        : preparedFile;
      setAvatarAdjust({ zoom: 1, x: 0, y: 0 });
      setAvatarEditor(URL.createObjectURL(imageBlob));
    } catch {
      toast.error("This HEIC image could not be converted.");
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const closeAvatarEditor = () => {
    if (avatarEditor) URL.revokeObjectURL(avatarEditor);
    setAvatarEditor(null);
  };

  const changeAvatarZoom = (amount) => {
    setAvatarAdjust((value) => ({
      ...value,
      zoom: Math.min(
        2.5,
        Math.max(1, Number((value.zoom + amount).toFixed(2))),
      ),
    }));
  };

  const startAvatarDrag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const moveAvatar = (event) => {
    const drag = avatarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    avatarDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setAvatarAdjust((value) => ({
      ...value,
      x: Math.min(1, Math.max(-1, value.x + deltaX / 110)),
      y: Math.min(1, Math.max(-1, value.y + deltaY / 110)),
    }));
  };

  const stopAvatarDrag = (event) => {
    if (avatarDragRef.current?.pointerId === event.pointerId)
      avatarDragRef.current = null;
  };

  const submitProfile = (event) => {
    event.preventDefault();
    profileMutation.mutate(profileForm);
  };

  const submitPassword = (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    passwordMutation.mutate(passwordForm);
  };

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("tagged:theme", nextTheme);
    setIsDark(nextTheme === "dark");
  };

  return (
    <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
      <header className="flex flex-col gap-6 border-b border-neutral-200 pb-8 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit shrink-0">
            <UserAvatar
              username={account.username}
              avatarPath={user?.avatar_path}
              size="lg"
            />
            <span
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-4 border-neutral-50 bg-green-500 text-xs text-white dark:border-neutral-950"
              title="Online"
            >
              <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
            </span>
            <label
              className={`absolute inset-0 grid place-items-center rounded-full transition ${isPreparingAvatar ? "cursor-wait bg-black/60 text-xs font-bold text-white" : "cursor-pointer bg-black/0 text-transparent hover:bg-black/55 hover:text-white focus-within:bg-black/55 focus-within:text-white"}`}
              title="Change profile image"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                className="sr-only"
                disabled={isPreparingAvatar}
                onChange={openAvatarEditor}
              />
              {isPreparingAvatar ? (
                "Converting…"
              ) : (
                <FontAwesomeIcon icon={faCamera} />
              )}
              <span className="sr-only">Change profile image</span>
            </label>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Your account
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">
                {account.username}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <FontAwesomeIcon
                  icon={account.roleKey === "admin" ? faShieldHalved : faUser}
                  aria-hidden="true"
                />
                {account.role}
              </span>
            </div>
            <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <FontAwesomeIcon
                icon={faEnvelope}
                className="shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{account.email}</span>
            </p>
            {user?.avatar_path ? (
              <button
                type="button"
                className="mt-3 inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-3! py-0! text-xs! font-bold! text-neutral-600! shadow-none! hover:border-red-500/40! hover:bg-red-500/10! hover:text-red-600! dark:border-neutral-700! dark:text-neutral-300! dark:hover:text-red-400!"
                onClick={() => setIsResetAvatarConfirmOpen(true)}
              >
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Session active
        </p>
      </header>

      <div className="mx-auto max-w-5xl">
        <section className="py-8" aria-labelledby="identity-title">
          <div className="mb-4">
            <h2 id="identity-title" className="text-xl font-bold">
              Identity
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Edit your details directly. Changes are only applied when you
              save.
            </p>
          </div>
          <form onSubmit={submitProfile}>
            <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {[
                ["username", "Username", "text", faUser],
                ["email", "Email address", "email", faEnvelope],
              ].map(([field, label, type, icon]) => (
                <label
                  key={field}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <span className="flex w-40 shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    <FontAwesomeIcon icon={icon} className="w-4" />
                    {label}
                  </span>
                  <input
                    type={type}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-neutral-100 px-3 text-sm font-bold outline-none transition hover:border-neutral-300 focus:border-neutral-500 focus:bg-white dark:bg-neutral-900 dark:hover:border-neutral-700 dark:focus:border-neutral-500 dark:focus:bg-neutral-950"
                    value={profileForm[field]}
                    onChange={(event) => {
                      setProfileForm((value) => ({
                        ...value,
                        [field]: event.target.value,
                      }));
                      setFeedback(null);
                    }}
                    minLength={field === "username" ? 3 : undefined}
                    maxLength={field === "username" ? 50 : undefined}
                    required
                  />
                </label>
              ))}
            </div>
            <div
              className={`mt-4 flex flex-col-reverse gap-2 transition-opacity sm:flex-row sm:justify-end ${profileHasChanges ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!profileHasChanges}
            >
              <button
                type="button"
                className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-0! text-sm! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800! sm:w-auto!"
                onClick={() =>
                  setProfileForm({
                    username: account.username,
                    email: account.email,
                  })
                }
              >
                <FontAwesomeIcon icon={faXmark} />
                Discard
              </button>
              <button
                disabled={profileMutation.isPending || !profileHasChanges}
                className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-0! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-white! dark:text-neutral-950! dark:hover:bg-neutral-200! sm:w-auto!"
                type="submit"
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
                {profileMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section
          className="border-t border-neutral-200 py-8 dark:border-neutral-800"
          aria-labelledby="access-title"
        >
          <div className="mb-4">
            <h2 id="access-title" className="text-xl font-bold">
              Workspace access
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Open the areas available with your {account.role.toLowerCase()}{" "}
              role.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Available workspace areas"
          >
            {account.access.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group inline-flex min-h-14 min-w-56 flex-1 items-center gap-3 rounded-xl border border-neutral-200 bg-white/60 px-3 text-neutral-950 transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 sm:flex-none"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{item.label}</strong>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {item.description}
                  </span>
                </span>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className="text-neutral-400 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </nav>
        </section>

        <section
          className="border-t border-neutral-200 py-8 dark:border-neutral-800"
          aria-labelledby="preferences-title"
        >
          <h2 id="preferences-title" className="text-xl font-bold">
            Preferences and session
          </h2>
          <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">Appearance</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Switch the interface theme on this device.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-0! text-sm! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800! sm:w-auto!"
                onClick={toggleTheme}
              >
                <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
                <span>{isDark ? "Use light mode" : "Use dark mode"}</span>
              </button>
            </div>
            <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="mt-1 text-neutral-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold">Media name matching</h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Normal includes partial names. Strict only returns exact names.
                  </p>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-2 rounded-xl border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-900" aria-label="Media name matching mode">
                {["normal", "strict"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`h-9! w-auto! rounded-xl! border-0! px-3! py-0! text-xs! font-bold! capitalize! shadow-none! ${mediaNameMatchMode === mode ? "bg-neutral-950! text-white! dark:bg-white! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-200! dark:text-neutral-400! dark:hover:bg-neutral-800!"}`}
                    onClick={() => mediaSearchPreferenceMutation.mutate(mode)}
                    disabled={mediaSearchPreferenceMutation.isPending || mediaNameMatchMode === mode}
                    aria-pressed={mediaNameMatchMode === mode}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold">Password</h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Replace your password after confirming the current one.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-0! text-sm! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800! sm:w-auto!"
                  onClick={() => {
                    setChangingPassword((value) => !value);
                    setFeedback(null);
                  }}
                >
                  <FontAwesomeIcon icon={changingPassword ? faXmark : faKey} />
                  {changingPassword ? "Cancel" : "Change password"}
                </button>
              </div>
              {changingPassword && (
                <form
                  className="mt-5 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700 sm:pl-6"
                  onSubmit={submitPassword}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      ["currentPassword", "Current password"],
                      ["newPassword", "New password"],
                      ["confirmPassword", "Confirm new password"],
                    ].map(([name, label]) => (
                      <label key={name} className="text-sm font-bold">
                        {label}
                        <input
                          type="password"
                          autoComplete={
                            name === "currentPassword"
                              ? "current-password"
                              : "new-password"
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-neutral-300 bg-transparent px-3 text-sm outline-none transition focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
                          value={passwordForm[name]}
                          onChange={(event) =>
                            setPasswordForm((value) => ({
                              ...value,
                              [name]: event.target.value,
                            }))
                          }
                          minLength={6}
                          required
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    disabled={passwordMutation.isPending}
                    className="mt-4 inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-0! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-white! dark:text-neutral-950! dark:hover:bg-neutral-200! sm:w-auto!"
                    type="submit"
                  >
                    <FontAwesomeIcon icon={faKey} />
                    {passwordMutation.isPending
                      ? "Updating…"
                      : "Update password"}
                  </button>
                </form>
              )}
            </div>
            <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">Current session</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Sign out safely when you finish using this device.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border! border-red-500/30! bg-transparent! px-4! py-0! text-sm! font-bold! text-red-600! shadow-none! hover:bg-red-500/10! dark:text-red-400! sm:w-auto!"
                onClick={handleSignOut}
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
                <span>Sign out</span>
              </button>
            </div>
            <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">All sessions</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Revoke access on every device, including this one.
                </p>
              </div>
              <button
                disabled={logoutAllMutation.isPending}
                type="button"
                className="inline-flex! h-10! w-full! items-center! justify-center! gap-2! rounded-xl! border! border-red-500/30! bg-red-500/10! px-4! py-0! text-sm! font-bold! text-red-600! shadow-none! hover:bg-red-500/20! disabled:opacity-50! dark:text-red-400! sm:w-auto!"
                onClick={() => logoutAllMutation.mutate()}
              >
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>
                  {logoutAllMutation.isPending
                    ? "Revoking…"
                    : "Sign out everywhere"}
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {avatarEditor && (
        <div
          className="fixed inset-0 z-[1400] grid items-end bg-black/75 p-2 backdrop-blur-sm sm:place-items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAvatarEditor();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-editor-title"
            className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-white sm:max-h-[calc(100dvh-2rem)] sm:p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Profile image
                </p>
                <h2 id="avatar-editor-title" className="mt-1 text-xl font-bold">
                  Adjust your photo
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close image editor"
                className="grid! h-10! w-10! place-items-center! rounded-xl! border! border-neutral-700! bg-transparent! p-0! text-neutral-300! hover:bg-neutral-800!"
                onClick={closeAvatarEditor}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div
              className="relative mx-auto mt-5 h-52 w-52 touch-none cursor-grab select-none overflow-hidden rounded-full bg-neutral-900 active:cursor-grabbing sm:mt-6 sm:h-64 sm:w-64"
              onPointerDown={startAvatarDrag}
              onPointerMove={moveAvatar}
              onPointerUp={stopAvatarDrag}
              onPointerCancel={stopAvatarDrag}
              onWheel={(event) => {
                event.preventDefault();
                changeAvatarZoom(event.deltaY < 0 ? 0.1 : -0.1);
              }}
            >
              <img
                src={avatarEditor}
                alt="Profile preview"
                draggable="false"
                className="pointer-events-none h-full w-full object-cover will-change-transform"
                style={{
                  transform: `scale(${avatarAdjust.zoom}) translate(${avatarAdjust.x * 20}%, ${avatarAdjust.y * 20}%)`,
                }}
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/30" />
            </div>
            <p className="mt-4 text-center text-sm text-neutral-400">
              Drag the photo to reposition it
            </p>
            <div
              className="mt-4 flex items-center justify-center gap-3"
              aria-label="Photo zoom controls"
            >
              <button
                type="button"
                aria-label="Zoom out"
                disabled={avatarAdjust.zoom <= 1}
                className="grid! h-11! w-11! place-items-center! rounded-xl! border! border-neutral-700! bg-neutral-900! p-0! text-white! hover:bg-neutral-800! disabled:opacity-30!"
                onClick={() => changeAvatarZoom(-0.1)}
              >
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <span className="w-14 text-center text-sm font-bold tabular-nums">
                {Math.round(avatarAdjust.zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={avatarAdjust.zoom >= 2.5}
                className="grid! h-11! w-11! place-items-center! rounded-xl! border! border-neutral-700! bg-neutral-900! p-0! text-white! hover:bg-neutral-800! disabled:opacity-30!"
                onClick={() => changeAvatarZoom(0.1)}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex! h-11! w-full! items-center! justify-center! rounded-xl! border! border-neutral-700! bg-transparent! px-4! text-sm! font-bold! text-neutral-300! hover:bg-neutral-800! sm:w-auto!"
                onClick={closeAvatarEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={avatarMutation.isPending}
                className="inline-flex! h-11! w-full! items-center! justify-center! gap-2! rounded-xl! border-0! bg-white! px-4! text-sm! font-bold! text-neutral-950! hover:bg-neutral-200! disabled:opacity-50! sm:w-auto!"
                onClick={() => avatarMutation.mutate()}
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
                {avatarMutation.isPending ? "Saving…" : "Save photo"}
              </button>
            </div>
          </section>
        </div>
      )}
      <DeleteConfirmationModal
        isOpen={isResetAvatarConfirmOpen}
        title="Remove profile image?"
        description="Your initials will be shown instead. You can upload another image at any time."
        confirmLabel="Remove photo"
        isDeleting={resetAvatarMutation.isPending}
        onConfirm={() => resetAvatarMutation.mutate()}
        onClose={() => setIsResetAvatarConfirmOpen(false)}
      />
    </section>
  );
};
