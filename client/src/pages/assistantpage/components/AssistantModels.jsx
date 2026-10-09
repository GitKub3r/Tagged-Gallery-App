import { faHardDrive, faMicrochip, faTrash, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DetailRow } from "../../../components/detail-row/DetailRow";
import { formatMediaSize } from "../../../utils/mediaFormat";

export const AssistantModels = ({ totalBytes, isBusy, isRemoving, onRemove }) => (
    <>
        <dl className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            <DetailRow icon={faWandMagicSparkles} label="Models" value="CLIP ViT-B/16 and WD Tagger v3" detail="Open models (MIT and Apache 2.0) from Hugging Face." />
            <DetailRow icon={faMicrochip} label="Runs on" value="This server's CPU" detail="Your media never leave the server. No subscription or API cost." />
            <DetailRow icon={faHardDrive} label="Disk space" value={formatMediaSize(totalBytes)} detail="Shared by every account on this server." />
        </dl>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="text-sm font-bold">Remove the models</p>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Frees the disk space. Tags already added are kept, and you can set the assistant up again later.</p>
            </div>
            <button type="button" className={buttonClasses.dangerGhost} onClick={onRemove} disabled={isBusy || isRemoving}>
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                Remove models
            </button>
        </div>
    </>
);
