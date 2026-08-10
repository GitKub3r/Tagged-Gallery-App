import { useEffect, useState } from "react";
import {
    faCheck,
    faFolderOpen,
    faHeart,
    faImage,
    faMagnifyingGlass,
    faTag,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const STEPS = [
    { label: "Search", title: "Find anything instantly", description: "Search names, authors and metadata from one place." },
    { label: "Filter", title: "Narrow it down", description: "Combine tags and media types without losing context." },
    { label: "Save", title: "Keep the best close", description: "Mark favourites and return to them in one click." },
    { label: "Organize", title: "Build useful collections", description: "Move media into albums while staying in your gallery." },
];

const MOCK_MEDIA = [
    { name: "Summer coast", author: "Mara", tone: "from-neutral-500 to-neutral-800" },
    { name: "Quiet streets", author: "Alex", tone: "from-neutral-400 to-neutral-700" },
    { name: "Studio notes", author: "Noa", tone: "from-neutral-600 to-neutral-900" },
];

export const LoginShowcase = () => {
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
        const interval = window.setInterval(() => setActiveStep((step) => (step + 1) % STEPS.length), 2600);
        return () => window.clearInterval(interval);
    }, []);

    const step = STEPS[activeStep];

    return (
        <div className="relative z-10 mx-auto w-full max-w-3xl">
            <div className="mb-7 max-w-xl">
                <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Your media, under control</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Rediscover your library.</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-400">Tagged keeps search, metadata, albums and favourites in one focused workspace.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900/90 shadow-2xl shadow-black/30" aria-label="Animated preview of Tagged Gallery">
                <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-600" />
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-neutral-800" />
                    <span className="ml-2 text-xs font-bold text-neutral-500">Gallery</span>
                </div>

                <div className="grid min-h-80 grid-cols-[3.5rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)]">
                    <aside className="border-r border-neutral-800 p-2 sm:p-3" aria-hidden="true">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-neutral-950"><FontAwesomeIcon icon={faTag} /></div>
                        <div className="mt-5 space-y-2">
                            {[faImage, faHeart, faFolderOpen].map((icon, index) => <div key={index} className={`flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-bold transition-colors duration-500 ${activeStep === index + 1 ? "bg-neutral-800 text-white" : "text-neutral-500"}`}><FontAwesomeIcon icon={icon} className="w-4" /><span className="hidden sm:inline">{["Gallery", "Favourites", "Albums"][index]}</span></div>)}
                        </div>
                    </aside>

                    <div className="min-w-0 p-3 sm:p-5">
                        <div className={`flex h-10 items-center gap-3 rounded-xl border px-3 text-sm transition-all duration-500 ${activeStep === 0 ? "border-neutral-400 bg-neutral-950 text-white" : "border-neutral-700 bg-neutral-950/60 text-neutral-500"}`}>
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <span className="truncate">{activeStep === 0 ? "a:Mara summer" : "Search media"}</span>
                            {activeStep === 0 ? <span className="ml-auto h-4 w-px animate-pulse bg-white" /> : null}
                        </div>

                        <div className="mt-3 flex gap-2 overflow-hidden">
                            {["All", "Travel", "Portrait"].map((tag, index) => <span key={tag} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-500 ${activeStep === 1 && index === 1 ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"}`}>{tag}</span>)}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                            {MOCK_MEDIA.map((media, index) => {
                                const isFocused = (activeStep === 0 && index !== 0) || (activeStep === 1 && index === 2);
                                return <article key={media.name} className={`min-w-0 transition-all duration-500 ${isFocused ? "scale-95 opacity-30" : "scale-100 opacity-100"}`}><div className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br ${media.tone}`}><FontAwesomeIcon icon={faImage} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl text-white/25" />{index === 0 ? <span className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full transition-all duration-500 ${activeStep >= 2 ? "bg-white text-neutral-950" : "bg-black/45 text-white"}`}><FontAwesomeIcon icon={faHeart} /></span> : null}{activeStep === 3 && index === 1 ? <span className="absolute inset-2 grid place-items-center rounded-xl border border-white/30 bg-black/60 text-xs font-bold text-white"><FontAwesomeIcon icon={faCheck} className="mb-1" />Added</span> : null}</div><strong className="mt-2 block truncate text-xs text-neutral-200">{media.name}</strong><span className="block truncate text-[0.65rem] text-neutral-500">{media.author}</span></article>;
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-h-16"><p className="text-sm font-bold text-white">{step.title}</p><p className="mt-1 max-w-md text-sm text-neutral-500">{step.description}</p></div>
                <div className="flex gap-2" aria-label="Preview steps">{STEPS.map((item, index) => <button key={item.label} type="button" className={`h-2.5! rounded-full! border-0! p-0! transition-[width,background-color]! ${activeStep === index ? "w-8! bg-white!" : "w-2.5! bg-neutral-700! hover:bg-neutral-500!"}`} onClick={() => setActiveStep(index)} aria-label={`Show ${item.label} preview`} aria-pressed={activeStep === index} />)}</div>
            </div>
        </div>
    );
};
